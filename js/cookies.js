/* ==========================================================================
   Atelier Kymia — cookies.js
   Bandeau de consentement cookies, sans traceur avant consentement.

   Principe RGPD :
   - Aucun script de mesure / publicité n'est chargé tant que l'utilisateur
     n'a pas donné son accord.
   - Le choix est stocké dans localStorage (clé « kymia.cookies ») avec la
     valeur « accepte » ou « refuse ».
   - Les scripts conditionnels se déclarent via
     <script type="text/plain" data-consentement="analytics" data-src="...">.
     Ils sont injectés UNIQUEMENT si le consentement correspondant est donné.
   ========================================================================== */

"use strict";

const CLE_CONSENTEMENT = "kymia.cookies";

/**
 * Lit le choix mémorisé (« accepte » | « refuse » | null).
 * @returns {string|null}
 */
function lireChoixCookies() {
  try {
    return localStorage.getItem(CLE_CONSENTEMENT);
  } catch (_) {
    return null;
  }
}

/**
 * Enregistre le choix de l'utilisateur.
 * @param {string} choix "accepte" | "refuse"
 */
function ecrireChoixCookies(choix) {
  try {
    localStorage.setItem(CLE_CONSENTEMENT, choix);
  } catch (_) {
    /* ignore */
  }
}

/**
 * Charge les scripts conditionnels marqués selon le consentement.
 * Ex. : <script type="text/plain" data-consentement="analytics"
 *              data-src="https://exemple/analytics.js"></script>
 *
 * TODO (à brancher plus tard) : ajouter ici vos traceurs (Google Analytics,
 * Meta Pixel, etc.) sous forme de balises conditionnelles dans le HTML, ou
 * directement dans cette fonction après consentement.
 */
function chargerScriptsConsentis() {
  document
    .querySelectorAll('script[type="text/plain"][data-consentement]')
    .forEach((ancien) => {
      if (ancien.dataset.charge === "true") return;
      const nouveau = document.createElement("script");
      const src = ancien.getAttribute("data-src");
      if (src) {
        nouveau.src = src;
        nouveau.async = true;
      } else {
        nouveau.textContent = ancien.textContent;
      }
      ancien.dataset.charge = "true";
      ancien.parentNode.insertBefore(nouveau, ancien.nextSibling);
    });
}

/* --------------------------------------------------------------------------
   Bandeau de consentement
   -------------------------------------------------------------------------- */

/**
 * Initialise le bandeau : affichage si aucun choix, gestion accepter/refuser,
 * et mémorisation. Expose un moyen de rouvrir le bandeau (data-ouvrir-cookies).
 */
function initBanniereCookies() {
  const bandeau = document.querySelector("[data-banniere-cookies]");
  if (!bandeau) return;

  const choix = lireChoixCookies();

  if (!choix) {
    bandeau.hidden = false;
  } else if (choix === "accepte") {
    chargerScriptsConsentis();
  }

  const afficherEtat = (valeur) => {
    document.querySelectorAll("[data-etat-cookies]").forEach((el) => {
      el.textContent =
        valeur === "accepte"
          ? "Cookies acceptés"
          : valeur === "refuse"
          ? "Cookies refusés"
          : "Aucun choix enregistré";
    });
  };

  const fermer = (valeur) => {
    ecrireChoixCookies(valeur);
    bandeau.hidden = true;
    if (valeur === "accepte") chargerScriptsConsentis();
    afficherEtat(valeur);
  };

  bandeau.querySelector("[data-cookies-accepter]")?.addEventListener("click", () => fermer("accepte"));
  bandeau.querySelector("[data-cookies-refuser]")?.addEventListener("click", () => fermer("refuse"));

  // Permet de rouvrir le bandeau depuis le footer ou la page cookies.
  document.querySelectorAll("[data-ouvrir-cookies]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      bandeau.hidden = false;
    });
  });

  // Si le choix était « refuse » ou non défini, on affiche l'état courant
  // sur les boutons de préférences (page cookies) s'ils existent.
  afficherEtat(choix);
}

document.addEventListener("DOMContentLoaded", initBanniereCookies);
