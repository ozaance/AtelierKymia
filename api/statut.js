/* ==========================================================================
   Atelier Kymia — api/statut.js
   Fonction serverless (Vercel) : renvoie le statut d'un paiement Mollie.
   Appelée par merci.html au retour du client, pour ne confirmer la commande
   (et ne vider le panier) que si le paiement est réellement abouti.

   Entrée  : GET /api/statut?id=tr_xxxxxxxx
   Sortie  : { statut } — open, pending, paid, failed, canceled, expired…

   Variable d'environnement requise : MOLLIE_API_KEY.
   ========================================================================== */

"use strict";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const cle = process.env.MOLLIE_API_KEY;
  const id = String(req.query?.id || "");
  if (!cle) {
    return res.status(500).json({ erreur: "Paiement non configuré." });
  }
  if (!/^tr_[A-Za-z0-9]{6,30}$/.test(id)) {
    return res.status(400).json({ erreur: "Identifiant invalide." });
  }

  try {
    const reponse = await fetch(`https://api.mollie.com/v2/payments/${id}`, {
      headers: { Authorization: `Bearer ${cle}` },
    });
    if (!reponse.ok) {
      return res.status(404).json({ erreur: "Paiement introuvable." });
    }
    const data = await reponse.json();
    return res.status(200).json({ statut: data.status });
  } catch (e) {
    console.error("Mollie injoignable :", e);
    return res.status(502).json({ erreur: "Statut momentanément indisponible." });
  }
};
