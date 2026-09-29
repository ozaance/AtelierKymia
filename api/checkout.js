/* ==========================================================================
   Atelier Kymia — api/checkout.js
   Fonction serverless (Vercel) : crée une session Stripe Checkout pour tout
   le panier, quel que soit le nombre de bijoux.

   Entrée  : POST { lignes: [{ id, quantite }, ...] }
   Sortie  : { url } — page de paiement Stripe vers laquelle rediriger.

   Les prix ne viennent jamais du navigateur : on ne lit que l'id et la
   quantité, puis on retrouve le prix Stripe dans data/products.json.

   Variable d'environnement requise : STRIPE_SECRET_KEY (sk_test_… ou rk_test_…
   en test, sk_live_… en production).
   ========================================================================== */

"use strict";

const { produits } = require("../data/products.json");

const PAYS_LIVRAISON = ["FR", "BE", "CH", "LU", "MC"];
const MAX_LIGNES = 20; /* limite Stripe par session */

/**
 * Encode un objet imbriqué au format attendu par l'API Stripe
 * (application/x-www-form-urlencoded, ex. line_items[0][price]=…).
 * @param {Object} objet
 * @param {string} [prefixe]
 * @param {URLSearchParams} [params]
 * @returns {URLSearchParams}
 */
function encoderStripe(objet, prefixe = "", params = new URLSearchParams()) {
  for (const [cle, valeur] of Object.entries(objet)) {
    const nom = prefixe ? `${prefixe}[${cle}]` : cle;
    if (valeur !== null && typeof valeur === "object") {
      encoderStripe(valeur, nom, params);
    } else if (valeur !== undefined) {
      params.append(nom, String(valeur));
    }
  }
  return params;
}

/**
 * Vérifie le panier reçu et le convertit en line_items Stripe.
 * @param {*} lignes
 * @returns {{ items?: Array<Object>, erreur?: string }}
 */
function construireLignes(lignes) {
  if (!Array.isArray(lignes) || lignes.length === 0) {
    return { erreur: "Le panier est vide." };
  }
  if (lignes.length > MAX_LIGNES) {
    return { erreur: `Un panier ne peut pas contenir plus de ${MAX_LIGNES} bijoux différents.` };
  }

  const items = [];
  for (const ligne of lignes) {
    const produit = produits.find((p) => p.id === Number(ligne?.id));
    const quantite = Number(ligne?.quantite);

    if (!produit || !produit.stripe_prix) {
      return { erreur: "Un bijou de ton panier n'est plus disponible." };
    }
    if (!Number.isInteger(quantite) || quantite < 1) {
      return { erreur: `Quantité invalide pour ${produit.nom}.` };
    }
    if (quantite > produit.stock) {
      return { erreur: `Il ne reste que ${produit.stock} ${produit.nom} en stock.` };
    }

    items.push({
      price: produit.stripe_prix,
      quantity: quantite,
      adjustable_quantity: { enabled: true, minimum: 0, maximum: produit.stock },
    });
  }
  return { items };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erreur: "Méthode non autorisée." });
  }

  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) {
    return res.status(500).json({ erreur: "Paiement non configuré." });
  }

  const corps = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { items, erreur } = construireLignes(corps.lignes);
  if (erreur) {
    return res.status(400).json({ erreur });
  }

  // Adresse du site (Vercel, domaine perso ou local) pour les retours Stripe.
  const origine = `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;

  const session = {
    mode: "payment",
    line_items: items,
    success_url: `${origine}/merci.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origine}/panier.html`,
    locale: "fr",
    allow_promotion_codes: true,
    phone_number_collection: { enabled: true },
    shipping_address_collection: { allowed_countries: PAYS_LIVRAISON },
    metadata: {
      panier: corps.lignes.map((l) => `${Number(l.id)}x${Number(l.quantite)}`).join(","),
    },
  };

  try {
    const reponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encoderStripe(session),
    });
    const data = await reponse.json();

    if (!reponse.ok) {
      console.error("Stripe :", data.error?.message);
      return res.status(502).json({ erreur: "Le paiement est momentanément indisponible." });
    }
    return res.status(200).json({ url: data.url });
  } catch (e) {
    console.error("Stripe injoignable :", e);
    return res.status(502).json({ erreur: "Le paiement est momentanément indisponible." });
  }
};
