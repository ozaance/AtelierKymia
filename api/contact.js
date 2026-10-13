/* ==========================================================================
   Atelier Kymia — api/contact.js
   Fonction serverless (Vercel) : transmet le formulaire de contact par e-mail
   via Resend.

   Entrée  : POST { nom, email, message, site }   (site = piège anti-robots)
   Sortie  : { ok: true } ou { erreur }

   Variables d'environnement (voir lib/email.js) :
     RESEND_API_KEY  (obligatoire) clé API Resend.
     CONTACT_TO      (facultative) adresse qui reçoit les messages ;
                     par défaut proxicall.paris@gmail.com.
   ========================================================================== */

"use strict";

const { envoyerEmail } = require("../lib/email.js");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ erreur: "Méthode non autorisée." });
  }

  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    return res.status(500).json({ erreur: "Le formulaire n'est pas encore disponible. Écris-nous à proxicall.paris@gmail.com." });
  }

  let corps;
  try {
    corps = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch (_) {
    return res.status(400).json({ erreur: "Requête invalide." });
  }

  // Champ piège : un humain ne le remplit pas. On répond « ok » sans rien envoyer.
  if (corps.site) {
    return res.status(200).json({ ok: true });
  }

  const nom = String(corps.nom ?? "").trim().slice(0, 100);
  const email = String(corps.email ?? "").trim().slice(0, 120);
  const message = String(corps.message ?? "").trim().slice(0, 5000);

  if (!nom || !message) {
    return res.status(400).json({ erreur: "Merci de compléter tous les champs." });
  }
  if (!EMAIL.test(email)) {
    return res.status(400).json({ erreur: "L'adresse e-mail n'est pas valide." });
  }

  const envoye = await envoyerEmail({
    to: process.env.CONTACT_TO || "proxicall.paris@gmail.com",
    replyTo: email,
    subject: `Message de ${nom} depuis le site`,
    text: `De : ${nom} <${email}>\n\n${message}`,
  });
  if (!envoye) {
    return res.status(502).json({ erreur: "L'envoi a échoué. Écris-nous à proxicall.paris@gmail.com." });
  }
  return res.status(200).json({ ok: true });
};
