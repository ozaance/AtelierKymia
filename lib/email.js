/* ==========================================================================
   Atelier Kymia — lib/email.js
   Envoi d'e-mails via Resend, partagé par api/contact.js et api/webhook.js.

   Variables d'environnement :
     RESEND_API_KEY  clé API Resend (obligatoire).
     RESEND_FROM     expéditeur, ex. « Atelier Kymia <commande@atelier-kymia.com> »
                     (le domaine doit être vérifié dans Resend). Par défaut
                     l'expéditeur de test de Resend, qui n'écrit qu'à ton adresse.
   ========================================================================== */

"use strict";

const EXPEDITEUR_TEST = "Atelier Kymia <onboarding@resend.dev>";

/**
 * Envoie un e-mail texte via Resend.
 * @param {{ to: string|string[], subject: string, text: string, replyTo?: string }} mail
 * @returns {Promise<boolean>} true si Resend a accepté l'e-mail
 */
async function envoyerEmail({ to, subject, text, replyTo }) {
  const cle = process.env.RESEND_API_KEY;
  if (!cle) return false;

  try {
    const reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || EXPEDITEUR_TEST,
        to: Array.isArray(to) ? to : [to],
        reply_to: replyTo,
        subject: String(subject).replace(/[\r\n]+/g, " "),
        text,
      }),
    });
    if (!reponse.ok) {
      const data = await reponse.json().catch(() => ({}));
      console.error("Resend :", data?.message || reponse.status);
    }
    return reponse.ok;
  } catch (e) {
    console.error("Resend injoignable :", e);
    return false;
  }
}

module.exports = { envoyerEmail };
