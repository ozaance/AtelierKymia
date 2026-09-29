/* ==========================================================================
   Atelier Kymia — main.js
   Utilitaires partagés : chargement des produits, formatage, helpers DOM.
   Chargé sur toutes les pages avec defer.
   ========================================================================== */

"use strict";

/* --------------------------------------------------------------------------
   Chemins et constantes
   -------------------------------------------------------------------------- */
const CHEMIN_PRODUITS = "/data/products.json";

/* Libellés lisibles pour les collections (clé technique -> nom affiché). */
const COLLECTIONS = {
  douceurs: "Les Douceurs",
  eclats: "Les Éclats",
  couleurs: "Les Couleurs",
};

/* --------------------------------------------------------------------------
   Chargement des données
   -------------------------------------------------------------------------- */

/**
 * Charge la liste des produits depuis /data/products.json.
 * Le résultat est mis en cache mémoire pour éviter des requêtes répétées.
 * @returns {Promise<Array<Object>>} tableau de produits
 */
async function chargerProduits() {
  if (chargerProduits._cache) return chargerProduits._cache;

  try {
    const reponse = await fetch(CHEMIN_PRODUITS, { cache: "no-cache" });
    if (!reponse.ok) {
      throw new Error(`HTTP ${reponse.status}`);
    }
    const data = await reponse.json();
    const produits = Array.isArray(data) ? data : data.produits || [];
    chargerProduits._cache = produits;
    return produits;
  } catch (erreur) {
    console.error("Impossible de charger les produits :", erreur);
    return [];
  }
}

/**
 * Récupère un produit par son slug.
 * @param {string} slug
 * @returns {Promise<Object|null>}
 */
async function chargerProduit(slug) {
  const produits = await chargerProduits();
  return produits.find((p) => p.slug === slug) || null;
}

/* --------------------------------------------------------------------------
   Formatage
   -------------------------------------------------------------------------- */

/**
 * Formate un prix en euros, au format français (fr-FR).
 * @param {number} montant
 * @returns {string} ex. « 19,00 € »
 */
function formatPrix(montant) {
  const formateur = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formateur.format(Number(montant) || 0);
}

/* --------------------------------------------------------------------------
   Helpers DOM
   -------------------------------------------------------------------------- */

/**
 * Raccourci document.querySelector.
 * @param {string} selecteur
 * @param {ParentNode} [racine=document]
 * @returns {Element|null}
 */
function qs(selecteur, racine = document) {
  return racine.querySelector(selecteur);
}

/**
 * Raccourci document.querySelectorAll renvoyant un vrai tableau.
 * @param {string} selecteur
 * @param {ParentNode} [racine=document]
 * @returns {Element[]}
 */
function qsa(selecteur, racine = document) {
  return Array.from(racine.querySelectorAll(selecteur));
}

/**
 * Crée un élément avec attributs et contenu.
 * @param {string} tag
 * @param {Object} [attributs]
 * @param {string} [html]
 * @returns {HTMLElement}
 */
function creerElement(tag, attributs = {}, html = "") {
  const el = document.createElement(tag);
  for (const [cle, valeur] of Object.entries(attributs)) {
    if (valeur === null || valeur === undefined || valeur === false) continue;
    if (cle === "classe") {
      el.className = valeur;
    } else if (cle === "dataset") {
      Object.assign(el.dataset, valeur);
    } else {
      el.setAttribute(cle, valeur === true ? "" : valeur);
    }
  }
  if (html) el.innerHTML = html;
  return el;
}

/**
 * Construit un chemin d'image produit à partir de son id et d'un suffixe.
 * (Utile pour les placeholders tant que les visuels définitifs ne sont pas en place.)
 * @param {number} id
 * @param {string} [suffixe="a"]
 * @returns {string}
 */
function cheminImage(id, suffixe = "a") {
  const num = String(id).padStart(2, "0");
  return `/assets/img/produit-${num}-${suffixe}.jpg`;
}

/* --------------------------------------------------------------------------
   Hero — vidéo d'ambiance
   -------------------------------------------------------------------------- */

/**
 * Initialise la vidéo du hero :
 *  - respecte prefers-reduced-motion (poster seul, pas de lecture) ;
 *  - affiche seulement le poster si la vidéo ne charge pas ;
 *  - gère le bouton pause / lecture accessible.
 * Ne fait rien si le hero est absent de la page.
 */
function initHero() {
  const video = qs("[data-hero-video]");
  if (!video) return;

  const section = video.closest(".hero");
  const bouton = qs("[data-hero-lecture]");
  const iconePause = qs("[data-icone-pause]");
  const iconePlay = qs("[data-icone-play]");

  /* Poster portrait sur mobile (même point de rupture que les sources). */
  if (video.dataset.posterMobile && window.matchMedia("(max-width: 768px)").matches) {
    video.poster = video.dataset.posterMobile;
  }

  /** Bascule le hero en mode statique (poster seul). */
  const passerEnStatique = () => {
    if (section) section.classList.add("hero--statique");
    try {
      video.pause();
    } catch (_) {
      /* ignore */
    }
  };

  /* Respect de prefers-reduced-motion : on n'autoplay pas, poster visible. */
  const reduireMouvement = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );
  if (reduireMouvement.matches) {
    passerEnStatique();
    return;
  }

  /* Si aucune source ne charge, on retombe sur le poster. */
  video.addEventListener("error", passerEnStatique);

  /* Repli : certaines sources peuvent échouer individuellement. */
  const sources = qsa("source", video);
  sources.forEach((source) => {
    source.addEventListener("error", () => {
      /* On ne bascule en statique que si plus aucune source n'est exploitable. */
      const aucuneSource = sources.every((s) => s === source || !s.src);
      if (aucuneSource) passerEnStatique();
    });
  });

  /* Réagit au changement de préférence en cours de visite. */
  reduireMouvement.addEventListener("change", (e) => {
    if (e.matches) passerEnStatique();
  });

  /* --- Bouton pause / lecture --- */
  if (bouton) {
    const majBouton = () => {
      const enPause = video.paused;
      bouton.setAttribute("aria-pressed", String(enPause));
      bouton.setAttribute(
        "aria-label",
        enPause ? "Lire la vidéo" : "Mettre la vidéo en pause"
      );
      if (iconePause) iconePause.hidden = enPause;
      if (iconePlay) iconePlay.hidden = !enPause;
    };

    bouton.addEventListener("click", () => {
      if (video.paused) {
        video.play().catch(() => passerEnStatique());
      } else {
        video.pause();
      }
    });

    video.addEventListener("play", majBouton);
    video.addEventListener("pause", majBouton);
    majBouton();
  }
}

/* --------------------------------------------------------------------------
   Header : bordure au scroll
   -------------------------------------------------------------------------- */

/** Ajoute la classe .is-colle au header quand la page est défilée. */
function initHeaderColle() {
  const header = qs("[data-header]");
  if (!header) return;

  const maj = () => {
    header.classList.toggle("is-colle", window.scrollY > 8);
  };

  maj();
  window.addEventListener("scroll", maj, { passive: true });
}

/* --------------------------------------------------------------------------
   Menu mobile (panneau plein écran)
   -------------------------------------------------------------------------- */

/**
 * Initialise le panneau mobile : ouverture/fermeture, piège de focus simple,
 * fermeture par Échap, et synchronisation de aria-expanded.
 */
function initMenuMobile() {
  const panneau = qs("[data-panneau-mobile]");
  const boutonOuvrir = qs("#ouvrir-menu");
  if (!panneau || !boutonOuvrir) return;

  const boutonFermer = qs("#fermer-menu", panneau);
  const premierLien = panneau.querySelector("a, button");
  let dernierFocus = null;

  const ouvrir = () => {
    dernierFocus = document.activeElement;
    panneau.hidden = false;
    document.body.classList.add("sans-scroll");
    boutonOuvrir.setAttribute("aria-expanded", "true");
    premierLien?.focus();
  };

  const fermer = () => {
    panneau.hidden = true;
    document.body.classList.remove("sans-scroll");
    boutonOuvrir.setAttribute("aria-expanded", "false");
    (dernierFocus instanceof HTMLElement ? dernierFocus : boutonOuvrir).focus();
  };

  boutonOuvrir.addEventListener("click", ouvrir);
  boutonFermer?.addEventListener("click", fermer);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panneau.hidden) fermer();
  });
}

/* --------------------------------------------------------------------------
   Recherche (panneau sous le header)
   -------------------------------------------------------------------------- */

/**
 * Initialise le panneau de recherche : filtrage en direct des produits,
 * suggestions, ouverture/fermeture et accessibilité.
 */
function initRecherche() {
  const panneau = qs("[data-recherche]");
  const boutonOuvrir = qs("#ouvrir-recherche");
  if (!panneau || !boutonOuvrir) return;

  const champ = qs("[data-champ-recherche]", panneau);
  const boutonFermer = qs("#fermer-recherche", panneau);
  const resultats = qs("[data-resultats-recherche]", panneau);
  const suggestions = qs("[data-suggestions]", panneau);

  /** Normalise une chaîne pour la recherche (minuscules, sans accents). */
  const normaliser = (texte) =>
    (texte || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const afficherResultats = (produits) => {
    if (!resultats) return;
    if (produits.length === 0) {
      resultats.innerHTML =
        '<li class="recherche__vide">Aucun résultat. Essaie « charms », « jonc » ou « émail ».</li>';
      return;
    }
    resultats.innerHTML = produits
      .slice(0, 6)
      .map(
        (p) => `
        <li class="resultat-recherche">
          <a class="resultat-recherche__lien" href="/produit.html?slug=${encodeURIComponent(p.slug)}">
            <span class="resultat-recherche__nom">${p.nom}</span>
            <span class="resultat-recherche__meta">${COLLECTIONS[p.collection] || ""}</span>
            <span class="resultat-recherche__prix">${formatPrix(p.prix)}</span>
          </a>
        </li>`
      )
      .join("");
  };

  const filtrer = async (terme) => {
    const q = normaliser(terme).trim();
    if (!q) {
      if (resultats) resultats.innerHTML = "";
      if (suggestions) suggestions.hidden = false;
      return;
    }
    if (suggestions) suggestions.hidden = true;
    const produits = await chargerProduits();
    const trouves = produits.filter((p) =>
      normaliser(
        `${p.nom} ${p.collection} ${p.couleur_finition} ${p.description_courte} ${p.matiere}`
      ).includes(q)
    );
    afficherResultats(trouves);
  };

  const ouvrir = () => {
    panneau.hidden = false;
    boutonOuvrir.setAttribute("aria-expanded", "true");
    champ?.focus();
  };

  const fermer = () => {
    panneau.hidden = true;
    boutonOuvrir.setAttribute("aria-expanded", "false");
    boutonOuvrir.focus();
  };

  boutonOuvrir.addEventListener("click", () => {
    if (panneau.hidden) ouvrir();
    else fermer();
  });
  boutonFermer?.addEventListener("click", fermer);

  let minuteur;
  champ?.addEventListener("input", () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(() => filtrer(champ.value), 150);
  });

  qsa("[data-suggestion]", panneau).forEach((puce) => {
    puce.addEventListener("click", () => {
      if (!champ) return;
      champ.value = puce.dataset.suggestion;
      filtrer(champ.value);
      champ.focus();
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panneau.hidden) fermer();
  });
}

/* --------------------------------------------------------------------------
   Carrousel « Nos coups de cœur »
   -------------------------------------------------------------------------- */

/* Icône cœur (wishlist) réutilisable. */
const ICONE_COEUR =
  '<svg class="icone" width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="1.4" aria-hidden="true" focusable="false">' +
  '<path d="M12 20.5 4.5 13a4.6 4.6 0 0 1 0-6.5 4.6 4.6 0 0 1 6.5 0l1 1 1-1a4.6 4.6 0 0 1 6.5 0 4.6 4.6 0 0 1 0 6.5Z" />' +
  "</svg>";

/**
 * Construit la carte DOM d'un produit.
 * @param {Object} produit
 * @returns {HTMLLIElement}
 */
function carteProduit(produit) {
  const img1 = produit.images && produit.images[0] ? produit.images[0] : cheminImage(produit.id, "a");
  const img2 = produit.images && produit.images[1];
  const alt = `${produit.nom} — ${produit.matiere}, finition ${produit.couleur_finition}`;
  const finition = produit.couleur_finition.charAt(0).toUpperCase() + produit.couleur_finition.slice(1);
  const url = `/produit.html?slug=${encodeURIComponent(produit.slug)}`;

  const li = creerElement("li", { classe: "carrousel__item" });

  li.innerHTML = `
    <article class="carte-produit">
      <div class="carte-produit__media">
        ${produit.nouveau ? '<span class="etiquette-nouveau">Nouveau</span>' : ""}
        <button type="button" class="carte-produit__wish" aria-pressed="false"
          aria-label="Ajouter ${produit.nom} à ma liste de souhaits" data-wish="${produit.id}">
          ${ICONE_COEUR}
        </button>
        <img class="carte-produit__img" src="${img1}" alt="${alt}"
          width="600" height="600" loading="lazy" decoding="async" />
        ${img2 ? `<img class="carte-produit__img carte-produit__img--alt" src="${img2}" alt=""
          width="600" height="600" loading="lazy" decoding="async" aria-hidden="true" />` : ""}
      </div>
      <div class="carte-produit__corps">
        <h3 class="carte-produit__nom">${produit.nom}</h3>
        <p class="carte-produit__finition">${finition}</p>
        <p class="carte-produit__prix">${formatPrix(produit.prix)}</p>
        <a class="carte-produit__decouvrir" href="${url}"
          aria-label="Découvrir ${produit.nom}">Découvrir</a>
      </div>
    </article>
  `;

  return li;
}

/**
 * Active le bouton cœur d'une carte (état local, sans persistance dans ce prompt).
 * @param {HTMLElement} racine
 */
function activerWishlist(racine) {
  qsa("[data-wish]", racine).forEach((bouton) => {
    bouton.addEventListener("click", () => {
      const actif = bouton.getAttribute("aria-pressed") === "true";
      bouton.setAttribute("aria-pressed", String(!actif));
    });
  });
}

/**
 * Initialise le carrousel des coups de cœur : injecte les produits
 * (nouveautés d'abord), puis relie les flèches précédent / suivant.
 */
async function initCarrousel() {
  const piste = qs("[data-piste-produits]");
  if (!piste) return;

  const produits = await chargerProduits();

  // Nouveautés d'abord, puis prix croissant pour l'ordre de présentation.
  const tries = [...produits].sort((a, b) => {
    if (a.nouveau !== b.nouveau) return a.nouveau ? -1 : 1;
    return a.prix - b.prix;
  });

  const fragment = document.createDocumentFragment();
  tries.forEach((produit) => fragment.appendChild(carteProduit(produit)));
  piste.appendChild(fragment);
  activerWishlist(piste);

  // --- Flèches de navigation ---
  const boutonPrec = qs("[data-prec]");
  const boutonSuiv = qs("[data-suiv]");

  /** Largeur d'un pas = largeur d'une carte + la gouttière. */
  const pas = () => {
    const item = piste.querySelector(".carrousel__item");
    if (!item) return piste.clientWidth;
    const style = getComputedStyle(piste);
    const gap = parseFloat(style.columnGap || style.gap) || 0;
    return item.getBoundingClientRect().width + gap;
  };

  const majFleches = () => {
    const max = piste.scrollWidth - piste.clientWidth - 1;
    if (boutonPrec) boutonPrec.disabled = piste.scrollLeft <= 0;
    if (boutonSuiv) boutonSuiv.disabled = piste.scrollLeft >= max;
  };

  if (boutonPrec) {
    boutonPrec.addEventListener("click", () => {
      piste.scrollBy({ left: -pas(), behavior: "smooth" });
    });
  }
  if (boutonSuiv) {
    boutonSuiv.addEventListener("click", () => {
      piste.scrollBy({ left: pas(), behavior: "smooth" });
    });
  }

  piste.addEventListener("scroll", majFleches, { passive: true });
  window.addEventListener("resize", majFleches);
  majFleches();
}

/* --------------------------------------------------------------------------
   Newsletter
   -------------------------------------------------------------------------- */

/* Clé de stockage local des inscriptions (en attendant un vrai service). */
const CLE_NEWSLETTER = "kymia.newsletter";

/**
 * Initialise le formulaire de newsletter :
 *  - valide l'e-mail et la case de consentement RGPD ;
 *  - enregistre l'adresse dans localStorage ;
 *  - affiche un message de confirmation.
 *
 * À BRANCHER PLUS TARD (service d'e-mailing) :
 *   - Brevo : POST https://api.brevo.com/v3/contacts (header api-key).
 *   - Mailchimp : POST https://<dc>.api.mailchimp.com/3.0/lists/<id>/members.
 *   Remplacer le bloc « enregistrement local » par l'appel fetch correspondant,
 *   puis afficher le message uniquement en cas de succès (reponse.ok).
 */
function initNewsletter() {
  const formulaire = qs("[data-newsletter]");
  if (!formulaire) return;

  const message = qs("[data-newsletter-message]", formulaire);
  const champEmail = qs('input[type="email"]', formulaire);
  const caseConsentement = qs('input[name="consentement"]', formulaire);

  const afficher = (texte, estErreur = false) => {
    if (!message) return;
    message.textContent = texte;
    message.style.color = estErreur ? "#E2B4A0" : "var(--or)";
  };

  formulaire.addEventListener("submit", (evenement) => {
    evenement.preventDefault();

    const email = (champEmail?.value || "").trim();

    // Validation minimale côté client.
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      afficher("Vérifie ton adresse e-mail.", true);
      champEmail?.focus();
      return;
    }
    if (caseConsentement && !caseConsentement.checked) {
      afficher("Merci de cocher la case pour continuer.", true);
      caseConsentement.focus();
      return;
    }

    // --- Enregistrement local (provisoire) ---
    try {
      let inscrits = [];
      try {
        inscrits = JSON.parse(localStorage.getItem(CLE_NEWSLETTER)) || [];
      } catch (_) {
        inscrits = [];
      }
      if (!inscrits.includes(email)) inscrits.push(email);
      localStorage.setItem(CLE_NEWSLETTER, JSON.stringify(inscrits));
    } catch (_) {
      /* localStorage indisponible : on continue quand même */
    }

    // --- Message de confirmation ---
    afficher("Merci ! Ton inscription est bien notée. À très vite.");

    formulaire.reset();
  });
}

/* --------------------------------------------------------------------------
   Formulaires simples (contact, suivi) — maquette sans envoi
   -------------------------------------------------------------------------- */

/**
 * Affiche un message de confirmation. TODO : brancher un vrai envoi (API,
 * Formspree…) pour l'envoi réel des messages.
 * @param {HTMLFormElement} form
 * @param {string} message
 */
function initFormulaireMaquette(form, message) {
  if (!form) return;
  const retour = form.querySelector("[data-contact-message], [data-suivi-message]");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      if (retour) retour.textContent = "Merci de compléter les champs requis.";
      return;
    }
    if (retour) retour.textContent = message;
    form.reset();
  });
}

/** Initialise les formulaires de contact et de suivi. */
function initFormulaires() {
  initFormulaireMaquette(
    qs("[data-contact]"),
    "Merci ! Ton message a bien été pris en compte (démo)."
  );
  initFormulaireMaquette(
    qs("[data-suivi]"),
    "Recherche du colis en cours… (démo, à brancher sur ton transporteur)."
  );
}

/* --------------------------------------------------------------------------
   Bouton « Désactiver les animations »
   -------------------------------------------------------------------------- */

/* Clé de stockage de la préférence de mouvement. */
const CLE_MOTION = "kymia.motion";

/**
 * Initialise le bouton qui pose/retire la classe .no-motion sur <html>.
 * La préférence est mémorisée dans localStorage.
 */
function initToggleMotion() {
  const bouton = qs("[data-toggle-motion]");
  const racine = document.documentElement;

  const appliquer = (desactive) => {
    racine.classList.toggle("no-motion", desactive);
    if (bouton) {
      bouton.setAttribute("aria-pressed", String(desactive));
      bouton.textContent = desactive
        ? "Réactiver les animations"
        : "Désactiver les animations";
    }
  };

  // Restaure la préférence enregistrée.
  let memorise = false;
  try {
    memorise = localStorage.getItem(CLE_MOTION) === "reduit";
  } catch (_) {
    memorise = false;
  }
  appliquer(memorise);

  if (bouton) {
    bouton.addEventListener("click", () => {
      const desactive = !racine.classList.contains("no-motion");
      appliquer(desactive);
      try {
        localStorage.setItem(CLE_MOTION, desactive ? "reduit" : "normal");
      } catch (_) {
        /* ignore */
      }
    });
  }
}

/* --------------------------------------------------------------------------
   Année dynamique dans le footer
   -------------------------------------------------------------------------- */
function initAnnee() {
  const cible = qs("[data-annee]");
  if (cible) cible.textContent = String(new Date().getFullYear());
}

/* --------------------------------------------------------------------------
   Page collection — grille, filtre par finition, tri par prix
   -------------------------------------------------------------------------- */

/* Textes d'introduction par collection. */
const INTRO_COLLECTIONS = {
  douceurs:
    "Des bracelets à charms en acier inoxydable, tout en retenue. À porter seul ou à superposer.",
  eclats:
    "Des joncs rigides en acier inoxydable, à la nacre, aux pierres et aux strass. Une ligne nette.",
  couleurs:
    "Des joncs émaillés en acier inoxydable. Des teintes douces, pour tous les jours.",
};

/**
 * Initialise la page collection : lit ?c=, rend la grille,
 * branche le filtre par finition et le tri par prix (sans rechargement).
 */
async function initPageCollection() {
  const grille = qs("[data-grille-produits]");
  if (!grille) return;

  const titreEl = qs("#titre-collection");
  const introEl = qs("#intro-collection");
  const nombreEl = qs("[data-resultats-nombre]");
  const videEl = qs("[data-grille-vide]");

  const params = new URLSearchParams(window.location.search);
  const collection = params.get("c");

  // État courant des filtres.
  const etat = { finition: "tous", tri: "defaut" };

  const tous = await chargerProduits();
  const base = collection ? tous.filter((p) => p.collection === collection) : tous;

  // Titre et introduction selon la collection.
  if (collection && COLLECTIONS[collection]) {
    if (titreEl) titreEl.textContent = COLLECTIONS[collection];
    if (introEl) introEl.textContent = INTRO_COLLECTIONS[collection] || introEl.textContent;
    document.title = `${COLLECTIONS[collection]} — Atelier Kymia`;
  }

  /** Applique le filtre + le tri, puis (re)rend la grille. */
  function rendre() {
    let liste = [...base];

    if (etat.finition !== "tous") {
      liste = liste.filter((p) => p.couleur_finition === etat.finition);
    }

    if (etat.tri === "prix-asc") liste.sort((a, b) => a.prix - b.prix);
    else if (etat.tri === "prix-desc") liste.sort((a, b) => b.prix - a.prix);
    else liste.sort((a, b) => (b.nouveau ? 1 : 0) - (a.nouveau ? 1 : 0));

    grille.innerHTML = "";
    const fragment = document.createDocumentFragment();
    liste.forEach((produit) => {
      const item = carteProduit(produit);
      item.classList.remove("carrousel__item");
      item.classList.add("grille-produits__item");
      fragment.appendChild(item);
    });
    grille.appendChild(fragment);

    // Wishlist gérée globalement par cart.js (délégation sur [data-wish]).
    document.dispatchEvent(new CustomEvent("grille:rendue"));

    if (videEl) videEl.hidden = liste.length > 0;
    if (nombreEl) {
      nombreEl.textContent = `${liste.length} bracelet${liste.length > 1 ? "s" : ""}`;
    }
  }

  // --- Filtre par finition (sans rechargement) ---
  qsa(".puce-filtre", qs("[data-filtres]") || document).forEach((bouton) => {
    bouton.addEventListener("click", () => {
      etat.finition = bouton.dataset.finition;
      qsa(".puce-filtre").forEach((b) => {
        const actif = b === bouton;
        b.classList.toggle("is-actif", actif);
        b.setAttribute("aria-pressed", String(actif));
      });
      rendre();
    });
  });

  // --- Tri par prix ---
  const selectTri = qs("[data-tri]");
  selectTri?.addEventListener("change", () => {
    etat.tri = selectTri.value;
    rendre();
  });

  rendre();

  // Si cart.js applique l'état des cœurs après coup, on le sollicite.
  if (window.Kymia?.reflechirCoeurs) window.Kymia.reflechirCoeurs();
}

/* --------------------------------------------------------------------------
   Page produit — galerie, infos, quantité, JSON-LD, produits liés
   -------------------------------------------------------------------------- */

/**
 * Initialise la fiche produit : lit ?slug=, remplit la galerie et les infos,
 * gère le zoom, le sélecteur de quantité, la wishlist et les produits liés.
 */
async function initPageProduit() {
  const fiche = qs("[data-fiche]");
  if (!fiche) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const produit = slug ? await chargerProduit(slug) : null;

  // Si le slug est inconnu, on retombe sur le premier produit.
  const tous = await chargerProduits();
  const p = produit || tous[0];
  if (!p) return;

  const finition = p.couleur_finition.charAt(0).toUpperCase() + p.couleur_finition.slice(1);
  const images = (p.images && p.images.length ? p.images : [cheminImage(p.id, "a")]);
  const alt = `${p.nom} — bracelet en acier inoxydable, finition ${p.couleur_finition}`;

  // --- Métadonnées de page ---
  document.title = `${p.nom} — Atelier Kymia`;
  qs('meta[name="description"]')?.setAttribute("content", p.description_courte);
  qs('meta[property="og:title"]')?.setAttribute("content", `${p.nom} — Atelier Kymia`);
  qs('meta[property="og:description"]')?.setAttribute("content", p.description_courte);
  qs('meta[property="og:image"]')?.setAttribute("content", images[0]);

  // --- Fil d'Ariane ---
  if (COLLECTIONS[p.collection]) {
    const arianeColl = qs("[data-ariane-collection]");
    if (arianeColl) {
      arianeColl.textContent = COLLECTIONS[p.collection];
      arianeColl.setAttribute("href", `/collection.html?c=${encodeURIComponent(p.collection)}`);
    }
  }
  const arianeProduit = qs("[data-ariane-produit]");
  if (arianeProduit) arianeProduit.textContent = p.nom;

  // --- Galerie ---
  const imgPrincipale = qs("[data-image-principale]");
  const vignettes = qs("[data-vignettes]");

  const afficherImage = (index) => {
    if (!imgPrincipale) return;
    imgPrincipale.src = images[index];
    qsa(".galerie__vignette", vignettes).forEach((v, i) => {
      v.setAttribute("aria-current", String(i === index));
    });
  };

  if (imgPrincipale) {
    imgPrincipale.src = images[0];
    imgPrincipale.alt = alt;
  }
  // Une seule image : pas de vignettes.
  if (vignettes && images.length < 2) {
    vignettes.hidden = true;
  } else if (vignettes) {
    vignettes.innerHTML = images
      .map(
        (src, i) => `
        <li>
          <button type="button" class="galerie__vignette" data-index="${i}"
            aria-current="${i === 0}" aria-label="Voir l'image ${i + 1} sur ${images.length}">
            <img src="${src}" alt="" width="120" height="120" loading="lazy" decoding="async" />
          </button>
        </li>`
      )
      .join("");
    qsa(".galerie__vignette", vignettes).forEach((v) => {
      v.addEventListener("click", () => afficherImage(Number(v.dataset.index)));
    });
  }

  // --- Zoom au clic sur l'image principale ---
  const zoneZoom = qs("[data-zoom]");
  zoneZoom?.addEventListener("click", () => {
    const agrandie = zoneZoom.classList.toggle("is-zoome");
    zoneZoom.setAttribute("aria-pressed", String(agrandie));
  });

  // --- Infos produit ---
  qs("[data-collection-nom]").textContent = COLLECTIONS[p.collection] || "Atelier Kymia";
  qs("[data-nom]").textContent = p.nom;
  qs("[data-prix]").textContent = formatPrix(p.prix);
  qs("[data-finition]").textContent = `Finition ${p.couleur_finition}`;
  qs("[data-description-courte]").textContent = p.description_longue || p.description_courte;

  // --- Bouton « Ajouter au panier » : on lui affecte l'id du produit ---
  const boutonAjout = qs("[data-ajouter-panier]");
  if (boutonAjout) {
    boutonAjout.dataset.ajouterPanier = String(p.id);
    boutonAjout.disabled = false;
  }

  // --- Wishlist : on associe l'id au bouton cœur de la fiche ---
  const boutonWish = qs("[data-wish]");
  if (boutonWish) boutonWish.dataset.wish = String(p.id);

  // --- Sélecteur de quantité ---
  const champQte = qs("[data-quantite]");
  const changerQte = (delta) => {
    if (!champQte) return;
    const min = Number(champQte.min) || 1;
    const max = Number(champQte.max) || 99;
    const val = Math.min(max, Math.max(min, (Number(champQte.value) || 1) + delta));
    champQte.value = String(val);
  };
  qs("[data-qte-moins]")?.addEventListener("click", () => changerQte(-1));
  qs("[data-qte-plus]")?.addEventListener("click", () => changerQte(1));

  // --- JSON-LD Product ---
  const jsonld = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: p.nom,
    image: images.map((src) => new URL(src, window.location.origin).href),
    description: p.description_longue || p.description_courte,
    material: p.matiere,
    brand: { "@type": "Brand", name: "Atelier Kymia" },
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: Number(p.prix).toFixed(2),
      availability:
        p.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url: window.location.href,
    },
  };
  const scriptJsonld = qs("#jsonld-produit");
  if (scriptJsonld) scriptJsonld.textContent = JSON.stringify(jsonld);

  // --- « Tu aimeras aussi » : 4 produits de la même collection ---
  const conteneurAussi = qs("[data-produits-aussi]");
  if (conteneurAussi) {
    const memeCollection = tous
      .filter((x) => x.collection === p.collection && x.id !== p.id)
      .slice(0, 4);
    const fragment = document.createDocumentFragment();
    memeCollection.forEach((x) => {
      const item = carteProduit(x);
      item.classList.remove("carrousel__item");
      item.classList.add("grille-produits__item");
      fragment.appendChild(item);
    });
    conteneurAussi.appendChild(fragment);
  }

  // Demande à cart.js de synchroniser les cœurs (état wishlist persistant).
  if (window.Kymia?.reflechirCoeurs) window.Kymia.reflechirCoeurs();
}

/* --------------------------------------------------------------------------
   Bootstrap (exécuté une fois le DOM prêt)
   -------------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initHeaderColle();
  initMenuMobile();
  initRecherche();
  initHero();
  initCarrousel();
  initNewsletter();
  initFormulaires();
  initToggleMotion();
  initAnnee();
  initPageCollection();
  initPageProduit();
});

/* Exposition pour les autres scripts (cart.js, pages). */
window.Kymia = {
  COLLECTIONS,
  chargerProduits,
  chargerProduit,
  formatPrix,
  qs,
  qsa,
  creerElement,
  cheminImage,
  carteProduit,
  activerWishlist,
  initHero,
};

/* ==========================================================================
   Compression des vidéos du hero (commandes ffmpeg)
   --------------------------------------------------------------------------
   Objectif : mp4 H.264 < 3 Mo, sans audio, et un webm léger.

   # 1) MP4 H.264, sans audio, compressé (< 3 Mo pour ~10-15 s en 1080p) :
   ffmpeg -i source.mp4 \
     -an \
     -c:v libx264 -profile:v high -preset slow -crf 26 \
     -pix_fmt yuv420p -movflags +faststart \
     -vf "scale='min(1920,iw)':-2" \
     assets/video/hero.mp4

   # 2) Version portrait pour mobile (recadrage 9:16 centré) :
   ffmpeg -i source.mp4 -an \
     -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart \
     -vf "crop=ih*9/16:ih,scale=720:-2" \
     assets/video/hero-mobile.mp4

   # 3) WEBM VP9, sans audio (bonne compression, support large) :
   ffmpeg -i source.mp4 \
     -an \
     -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 \
     -vf "scale='min(1920,iw)':-2" \
     assets/video/hero.webm

   # 4) Poster (première image, JPEG) :
   ffmpeg -i source.mp4 -frames:v 1 -q:v 3 assets/img/hero-poster.jpg

   Astuce poids : viser un débit ~1,2-1,5 Mbit/s. Pour calibrer, tester
   `-b:v 1.3M -maxrate 1.6M -bufsize 2.6M` à la place du -crf.
   Vérifier la taille finale : `du -h assets/video/hero.*`
   ========================================================================== */
