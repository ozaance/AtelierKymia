/* ==========================================================================
   Atelier Kymia — api/checkout.js
   Fonction serverless (Vercel) : crée un paiement Mollie pour tout le panier,
   quel que soit le nombre de bijoux.

   Entrée  : POST { lignes: [{ id, quantite }, ...], client: { … } }
   Sortie  : { url, id } — page de paiement Mollie vers laquelle rediriger,
             et identifiant du paiement (pour vérifier son statut au retour).

   Les prix ne viennent jamais du navigateur : on ne lit que l'id et la
   quantité, puis on retrouve le prix dans data/products.json.

   Mollie ne demande pas l'adresse de livraison : elle est saisie sur
   panier.html, vérifiée ici, puis jointe au paiement (visible dans le
   tableau de bord Mollie).

   Variable d'environnement requise : MOLLIE_API_KEY (test_… en test,
   live_… en production).
   ========================================================================== */

"use strict";

const { produits } = require("../data/products.json");

const PAYS_LIVRAISON = ["FR", "BE", "CH", "LU", "MC"];
const MAX_LIGNES = 20;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Vérifie le panier reçu et calcule le total à partir des prix du catalogue.
 * @param {*} lignes
 * @returns {{ total?: number, resume?: string, erreur?: string }}
 */
function calculerPanier(lignes) {
  if (!Array.isArray(lignes) || lignes.length === 0) {
    return { erreur: "Le panier est vide." };
  }
  if (lignes.length > MAX_LIGNES) {
    return { erreur: `Un panier ne peut pas contenir plus de ${MAX_LIGNES} bijoux différents.` };
  }

  let totalCentimes = 0;
  const resume = [];
  for (const ligne of lignes) {
    const produit = produits.find((p) => p.id === Number(ligne?.id));
    const quantite = Number(ligne?.quantite);

    if (!produit || !(produit.prix > 0)) {
      return { erreur: "Un bijou de ton panier n'est plus disponible." };
    }
    if (!Number.isInteger(quantite) || quantite < 1) {
      return { erreur: `Quantité invalide pour ${produit.nom}.` };
    }
    if (quantite > produit.stock) {
      return { erreur: `Il ne reste que ${produit.stock} ${produit.nom} en stock.` };
    }

    totalCentimes += Math.round(produit.prix * 100) * quantite;
    resume.push(`${quantite} x ${produit.nom}`);
  }
  return { total: totalCentimes / 100, resume: resume.join(", ") };
}

/**
 * Vérifie les coordonnées de livraison saisies sur panier.html.
 * @param {*} client
 * @returns {{ client?: Object, erreur?: string }}
 */
function verifierClient(client) {
  const nettoyer = (v, max) => String(v ?? "").trim().slice(0, max);
  const c = {
    prenom: nettoyer(client?.prenom, 60),
    nom: nettoyer(client?.nom, 60),
    email: nettoyer(client?.email, 120),
    telephone: nettoyer(client?.telephone, 30),
    adresse: nettoyer(client?.adresse, 120),
    codePostal: nettoyer(client?.codePostal, 12),
    ville: nettoyer(client?.ville, 60),
    pays: nettoyer(client?.pays, 2).toUpperCase(),
  };

  if (!c.prenom || !c.nom || !c.adresse || !c.codePostal || !c.ville || !c.telephone) {
    return { erreur: "Merci de remplir toutes les informations de livraison." };
  }
  if (!EMAIL.test(c.email)) {
    return { erreur: "L'adresse e-mail n'est pas valide." };
  }
  if (!PAYS_LIVRAISON.includes(c.pays)) {
    return { erreur: "Nous ne livrons pas encore dans ce pays." };
  }
  return { client: c };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erreur: "Méthode non autorisée." });
  }

  const cle = process.env.MOLLIE_API_KEY;
  if (!cle) {
    return res.status(500).json({ erreur: "Paiement non configuré." });
  }

  let corps;
  try {
    corps = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch (_) {
    return res.status(400).json({ erreur: "Requête invalide." });
  }

  const panier = calculerPanier(corps.lignes);
  if (panier.erreur) {
    return res.status(400).json({ erreur: panier.erreur });
  }
  const verif = verifierClient(corps.client);
  if (verif.erreur) {
    return res.status(400).json({ erreur: verif.erreur });
  }
  const c = verif.client;

  // Adresse du site (Vercel, domaine perso ou local) pour les retours Mollie.
  const origine = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;

  const adresse = {
    givenName: c.prenom,
    familyName: c.nom,
    email: c.email,
    streetAndNumber: c.adresse,
    postalCode: c.codePostal,
    city: c.ville,
    country: c.pays,
  };

  const paiement = {
    amount: { currency: "EUR", value: panier.total.toFixed(2) },
    description: `Atelier Kymia — ${panier.resume}`.slice(0, 255),
    redirectUrl: `${origine}/merci.html`,
    cancelUrl: `${origine}/panier.html`,
    locale: "fr_FR",
    billingAddress: adresse,
    shippingAddress: adresse,
    // Les métadonnées s'affichent dans le tableau de bord Mollie (1 Ko max).
    metadata: {
      panier: corps.lignes.map((l) => `${Number(l.id)}x${Number(l.quantite)}`).join(","),
      client: `${c.prenom} ${c.nom}`,
      email: c.email,
      tel: c.telephone,
      livraison: `${c.adresse}, ${c.codePostal} ${c.ville}, ${c.pays}`,
    },
  };

  try {
    const reponse = await fetch("https://api.mollie.com/v2/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paiement),
    });
    const data = await reponse.json();
    const url = data?._links?.checkout?.href;

    if (!reponse.ok || !url) {
      console.error("Mollie :", data?.detail || data?.title);
      return res.status(502).json({ erreur: "Le paiement est momentanément indisponible." });
    }
    return res.status(200).json({ url, id: data.id });
  } catch (e) {
    console.error("Mollie injoignable :", e);
    return res.status(502).json({ erreur: "Le paiement est momentanément indisponible." });
  }
};
