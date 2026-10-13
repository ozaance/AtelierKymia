/* ==========================================================================
   Atelier Kymia — api/webhook.js
   Appelée par Mollie à chaque changement de statut d'un paiement.
   Quand un paiement est réussi, envoie :
     - un e-mail de confirmation au client ;
     - une copie à l'atelier (adresse CONTACT_TO) avec l'adresse de livraison.
   Un drapeau « mail » est ensuite écrit dans les métadonnées du paiement pour
   ne jamais envoyer deux fois le même e-mail (Mollie peut rappeler).

   Entrée : POST id=tr_xxxxxxxx  (envoyé par Mollie)
   Variables : MOLLIE_API_KEY, RESEND_API_KEY, RESEND_FROM, CONTACT_TO.
   ========================================================================== */

"use strict";

const { produits } = require("../data/products.json");
const { envoyerEmail } = require("../lib/email.js");

const ATELIER = process.env.CONTACT_TO || "proxicall.paris@gmail.com";

/** Transforme « 1x2,4x1 » en lignes lisibles. */
function lignesCommande(panier) {
  return String(panier || "")
    .split(",")
    .map((morceau) => {
      const [id, quantite] = morceau.split("x").map(Number);
      const produit = produits.find((p) => p.id === id);
      return produit && quantite > 0 ? `- ${quantite} x ${produit.nom}` : null;
    })
    .filter(Boolean)
    .join("\n");
}

module.exports = async function handler(req, res) {
  const cle = process.env.MOLLIE_API_KEY;
  const corps = typeof req.body === "string" ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {};
  const id = String(corps.id || "");

  if (!cle || !/^tr_[A-Za-z0-9]{6,30}$/.test(id)) {
    return res.status(200).end(); // rien à faire ; on évite que Mollie réessaie
  }

  const entetes = { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" };

  let paiement;
  try {
    const reponse = await fetch(`https://api.mollie.com/v2/payments/${id}`, { headers: entetes });
    if (!reponse.ok) return res.status(200).end();
    paiement = await reponse.json();
  } catch (e) {
    console.error("Mollie injoignable :", e);
    return res.status(500).end(); // Mollie réessaiera plus tard
  }

  const meta = paiement.metadata || {};
  if (paiement.status !== "paid" || meta.mail === "1") {
    return res.status(200).end();
  }

  // On pose le drapeau avant l'envoi : mieux vaut un e-mail manquant (visible dans
  // Mollie) qu'un client qui reçoit la même confirmation plusieurs fois.
  try {
    await fetch(`https://api.mollie.com/v2/payments/${id}`, {
      method: "PATCH",
      headers: entetes,
      body: JSON.stringify({ metadata: { ...meta, mail: "1" } }),
    });
  } catch (e) {
    console.error("Mollie (métadonnées) :", e);
    return res.status(500).end();
  }

  const recap = lignesCommande(meta.panier);
  const total = `${String(paiement.amount.value).replace(".", ",")} €`;

  if (meta.email) {
    await envoyerEmail({
      to: meta.email,
      replyTo: ATELIER,
      subject: "Atelier Kymia — ta commande est confirmée",
      text:
        `Bonjour ${meta.client || ""},\n\n` +
        `Merci pour ta commande, ton paiement est bien reçu.\n\n` +
        `${recap}\n\nTotal payé : ${total} (livraison offerte)\n\n` +
        `Livraison à : ${meta.livraison || ""}\n\n` +
        `Nous préparons ton colis sous 1 à 2 jours ouvrés. Tu recevras un e-mail avec ` +
        `le numéro de suivi dès l'expédition (livraison en 2 à 4 jours ouvrés).\n\n` +
        `Une question ? Réponds simplement à cet e-mail.\n\n` +
        `À très vite,\nAtelier Kymia`,
    });
  }

  await envoyerEmail({
    to: ATELIER,
    replyTo: meta.email,
    subject: `Nouvelle commande — ${total} — ${meta.client || ""}`,
    text:
      `Nouvelle commande payée (${id}).\n\n${recap}\n\nTotal : ${total}\n\n` +
      `Client : ${meta.client}\nE-mail : ${meta.email}\nTéléphone : ${meta.tel}\n` +
      `Livraison : ${meta.livraison}\n`,
  });

  return res.status(200).end();
};
