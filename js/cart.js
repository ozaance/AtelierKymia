/* ==========================================================================
   Atelier Kymia — cart.js
   Panier et wishlist persistés dans localStorage.
   Dépend de main.js (helpers Kymia.*) chargé avant ce fichier.
   ========================================================================== */

"use strict";

/* Portée isolée : main.js déclare déjà qs, qsa et formatPrix en global ;
   les redéclarer ici provoquait une SyntaxError qui bloquait tout le fichier. */
(() => {

/* --------------------------------------------------------------------------
   Constantes
   -------------------------------------------------------------------------- */
const CLE_PANIER = "kymia.panier";      /* [{ id, slug, nom, prix, image, quantite }] */
const CLE_WISHLIST = "kymia.wishlist";  /* [id, id, ...] */
const SEUIL_LIVRAISON_OFFERTE = 0;      /* en euros — livraison offerte sans minimum */
const FRAIS_LIVRAISON = 0;              /* en euros, sous le seuil */

/* Récupère les helpers depuis main.js (ou des valeurs de repli). */
const K = window.Kymia || {};
const qs = K.qs || ((s, r = document) => r.querySelector(s));
const qsa = K.qsa || ((s, r = document) => Array.from(r.querySelectorAll(s)));
const formatPrix = K.formatPrix || ((m) => `${Number(m).toFixed(2)} €`);

/* --------------------------------------------------------------------------
   Lecture / écriture sécurisées de localStorage
   -------------------------------------------------------------------------- */

/**
 * Lit une valeur JSON dans localStorage, avec repli.
 * @param {string} cle
 * @param {*} defaut
 * @returns {*}
 */
function lireStockage(cle, defaut) {
  try {
    const brut = localStorage.getItem(cle);
    return brut === null ? defaut : JSON.parse(brut);
  } catch (_) {
    return defaut;
  }
}

/**
 * Écrit une valeur JSON dans localStorage (silencieux en cas d'échec).
 * @param {string} cle
 * @param {*} valeur
 */
function ecrireStockage(cle, valeur) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch (_) {
    /* localStorage indisponible : on ignore */
  }
}

/* --------------------------------------------------------------------------
   Panier (API publique)
   -------------------------------------------------------------------------- */

const Panier = {
  /** @returns {Array<Object>} lignes du panier */
  lire() {
    const lignes = lireStockage(CLE_PANIER, []);
    return Array.isArray(lignes) ? lignes : [];
  },

  /** Sauvegarde les lignes puis notifie l'interface. */
  ecrire(lignes) {
    ecrireStockage(CLE_PANIER, lignes);
    document.dispatchEvent(new CustomEvent("panier:maj", { detail: { lignes } }));
  },

  /**
   * Ajoute un produit (ou incrémente sa quantité).
   * @param {Object} produit
   * @param {number} [quantite=1]
   */
  ajouter(produit, quantite = 1) {
    const lignes = this.lire();
    const existante = lignes.find((l) => l.id === produit.id);
    if (existante) {
      existante.quantite += quantite;
    } else {
      lignes.push({
        id: produit.id,
        slug: produit.slug,
        nom: produit.nom,
        prix: produit.prix,
        image: (produit.images && produit.images[0]) || K.cheminImage?.(produit.id, "a") || "",
        quantite,
      });
    }
    this.ecrire(lignes);
  },

  /**
   * Modifie la quantité d'une ligne (supprime si <= 0).
   * @param {number} id
   * @param {number} quantite
   */
  definirQuantite(id, quantite) {
    let lignes = this.lire();
    if (quantite <= 0) {
      lignes = lignes.filter((l) => l.id !== id);
    } else {
      const ligne = lignes.find((l) => l.id === id);
      if (ligne) ligne.quantite = quantite;
    }
    this.ecrire(lignes);
  },

  /**
   * Retire une ligne du panier.
   * @param {number} id
   */
  retirer(id) {
    this.ecrire(this.lire().filter((l) => l.id !== id));
  },

  /** Vide le panier. */
  vider() {
    this.ecrire([]);
  },

  /** @returns {number} nombre total d'articles (somme des quantités) */
  nombreArticles() {
    return this.lire().reduce((total, l) => total + l.quantite, 0);
  },

  /** @returns {number} sous-total en euros */
  sousTotal() {
    return this.lire().reduce((total, l) => total + l.prix * l.quantite, 0);
  },

  /**
   * Détail de livraison.
   * @returns {{ offerte: boolean, frais: number, manque: number }}
   */
  livraison() {
    const sousTotal = this.sousTotal();
    const offerte = sousTotal >= SEUIL_LIVRAISON_OFFERTE || sousTotal === 0;
    return {
      offerte,
      frais: offerte ? 0 : FRAIS_LIVRAISON,
      manque: Math.max(0, SEUIL_LIVRAISON_OFFERTE - sousTotal),
    };
  },

  /** @returns {number} total à payer (sous-total + frais) */
  total() {
    return this.sousTotal() + this.livraison().frais;
  },
};

/* --------------------------------------------------------------------------
   Wishlist (API publique)
   -------------------------------------------------------------------------- */

const Wishlist = {
  /** @returns {number[]} identifiants des produits aimés */
  lire() {
    const ids = lireStockage(CLE_WISHLIST, []);
    return Array.isArray(ids) ? ids : [];
  },

  /** @param {number} id @returns {boolean} */
  contient(id) {
    return this.lire().includes(id);
  },

  /**
   * Ajoute ou retire un produit de la wishlist.
   * @param {number} id
   * @returns {boolean} nouvel état (true = présent)
   */
  basculer(id) {
    const ids = this.lire();
    const index = ids.indexOf(id);
    if (index === -1) ids.push(id);
    else ids.splice(index, 1);
    ecrireStockage(CLE_WISHLIST, ids);
    document.dispatchEvent(new CustomEvent("wishlist:maj", { detail: { ids } }));
    return index === -1;
  },
};

/* --------------------------------------------------------------------------
   Pastille panier du header + mini-panier latéral
   -------------------------------------------------------------------------- */

/** Met à jour la pastille de quantité dans le header. */
function majPastille() {
  const nombre = Panier.nombreArticles();
  qsa("[data-pastille-panier]").forEach((el) => {
    el.textContent = String(nombre);
    el.hidden = nombre === 0;
  });
  qsa("[data-libelle-panier]").forEach((el) => {
    el.textContent = `${nombre} article${nombre > 1 ? "s" : ""} dans le panier`;
  });
}

/**
 * Annonce un message de panier aux lecteurs d'écran via une zone aria-live.
 * @param {string} texte
 */
function annoncer(texte) {
  const zone = qs("[data-panier-annonce]");
  if (zone) zone.textContent = texte;
  // Annonce aussi depuis le mini-panier si présent et visible.
  const zoneMini = qs("[data-mini-annonce]");
  if (zoneMini) zoneMini.textContent = texte;
}

/**
 * Construit le HTML d'une ligne de mini-panier.
 * @param {Object} ligne
 * @returns {string}
 */
function htmlLigneMini(ligne) {
  return `
    <li class="mini-ligne" data-ligne="${ligne.id}">
      <img class="mini-ligne__img" src="${ligne.image}" alt=""
        width="72" height="72" loading="lazy" />
      <div class="mini-ligne__infos">
        <a class="mini-ligne__nom" href="/produit.html?slug=${encodeURIComponent(ligne.slug)}">${ligne.nom}</a>
        <span class="mini-ligne__prix">${formatPrix(ligne.prix * ligne.quantite)}</span>
        <div class="mini-ligne__qte">
          <button type="button" class="mini-ligne__btn" data-diminuer="${ligne.id}"
            aria-label="Diminuer la quantité de ${ligne.nom}">&minus;</button>
          <span class="mini-ligne__valeur" aria-live="polite">${ligne.quantite}</span>
          <button type="button" class="mini-ligne__btn" data-augmenter="${ligne.id}"
            aria-label="Augmenter la quantité de ${ligne.nom}">+</button>
        </div>
      </div>
      <button type="button" class="mini-ligne__retirer" data-retirer="${ligne.id}"
        aria-label="Retirer ${ligne.nom} du panier">&times;</button>
    </li>
  `;
}

/** Reconstruit le contenu du mini-panier. */
function majMiniPanier() {
  const conteneur = qs("#mini-panier-contenu");
  if (!conteneur) return;

  const lignes = Panier.lire();

  if (lignes.length === 0) {
    conteneur.innerHTML =
      '<p class="mini-panier__vide">Ton panier est vide pour l\'instant.</p>';
  } else {
    const livraison = Panier.livraison();
    const noteLivraison = livraison.offerte
      ? '<p class="mini-panier__livraison">Livraison offerte.</p>'
      : `<p class="mini-panier__livraison">Plus que ${formatPrix(livraison.manque)} pour la livraison offerte.</p>`;

    conteneur.innerHTML = `
      <ul class="mini-panier__liste" role="list">
        ${lignes.map(htmlLigneMini).join("")}
      </ul>
      <div class="mini-panier__pied">
        ${noteLivraison}
        <div class="mini-panier__total">
          <span>Sous-total</span>
          <span>${formatPrix(Panier.sousTotal())}</span>
        </div>
        <a class="btn btn--bloc" href="/panier.html">Voir mon panier</a>
      </div>
    `;
  }

  majPastille();
}

/* --- Ouverture / fermeture du mini-panier --- */
function ouvrirMiniPanier() {
  const panneau = qs("#mini-panier");
  if (!panneau) return;
  panneau.hidden = false;
  document.body.classList.add("sans-scroll");
  const fermer = qs("[data-mini-fermer]", panneau);
  fermer?.focus();
}

function fermerMiniPanier() {
  const panneau = qs("#mini-panier");
  if (!panneau) return;
  panneau.hidden = true;
  document.body.classList.remove("sans-scroll");
}

/**
 * Initialise le mini-panier : rendu, écoute des événements de délégation,
 * ouverture automatique après un ajout.
 */
function initMiniPanier() {
  const panneau = qs("#mini-panier");
  if (!panneau) return;

  // Fermeture : bouton, clic sur le voile, touche Échap.
  qs("[data-mini-fermer]", panneau)?.addEventListener("click", fermerMiniPanier);
  panneau.addEventListener("click", (e) => {
    if (e.target === panneau) fermerMiniPanier();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panneau.hidden) fermerMiniPanier();
  });

  // Délégation des actions sur les lignes du mini-panier.
  panneau.addEventListener("click", (e) => {
    const cible = e.target.closest("[data-diminuer], [data-augmenter], [data-retirer]");
    if (!cible) return;
    if (cible.dataset.diminuer) {
      const id = Number(cible.dataset.diminuer);
      const ligne = Panier.lire().find((l) => l.id === id);
      Panier.definirQuantite(id, (ligne?.quantite || 1) - 1);
    } else if (cible.dataset.augmenter) {
      const id = Number(cible.dataset.augmenter);
      const ligne = Panier.lire().find((l) => l.id === id);
      Panier.definirQuantite(id, (ligne?.quantite || 0) + 1);
    } else if (cible.dataset.retirer) {
      Panier.retirer(Number(cible.dataset.retirer));
    }
  });

  // Rafraîchit le rendu à chaque mise à jour du panier.
  document.addEventListener("panier:maj", () => {
    majMiniPanier();
    const n = Panier.nombreArticles();
    annoncer(`Panier mis à jour : ${n} article(s), total ${formatPrix(Panier.total())}.`);
  });

  // Ouverture manuelle via l'icône panier du header (si bouton présent).
  qs("[data-ouvrir-panier]")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (Panier.nombreArticles() === 0) {
      window.location.href = "/panier.html";
      return;
    }
    ouvrirMiniPanier();
  });

  majMiniPanier();
}

/* --------------------------------------------------------------------------
   Bouton « Ajouter au panier » (délégation globale)
   -------------------------------------------------------------------------- */
function initAjoutAuPanier() {
  document.addEventListener("click", async (e) => {
    const bouton = e.target.closest("[data-ajouter-panier]");
    if (!bouton) return;

    e.preventDefault();
    const id = Number(bouton.dataset.ajouterPanier);
    const qteEl = qs("[data-quantite]");
    const quantite = qteEl ? Math.max(1, Number(qteEl.value) || 1) : 1;

    // Récupère le produit depuis le cache/les données.
    if (!K.chargerProduits) return;
    const produits = await K.chargerProduits();
    const produit = produits.find((p) => p.id === id);
    if (!produit) return;

    Panier.ajouter(produit, quantite);
    ouvrirMiniPanier();
    annoncer(`${produit.nom} ajouté au panier. ${Panier.nombreArticles()} article(s) au total.`);

    // Retour visuel bref sur le bouton.
    const texte = bouton.textContent;
    bouton.textContent = "Ajouté";
    bouton.disabled = true;
    setTimeout(() => {
      bouton.textContent = texte;
      bouton.disabled = false;
    }, 1200);
  });
}

/* --------------------------------------------------------------------------
   Boutons cœur (wishlist) — délégation globale
   -------------------------------------------------------------------------- */
/**
 * Rétablit l'état visuel des cœurs selon la wishlist persistée.
 * Appelée au chargement et après un rendu de grille.
 */
function reflechirCoeurs() {
  qsa("[data-wish]").forEach((bouton) => {
    const id = Number(bouton.dataset.wish);
    if (Number.isNaN(id)) return;
    bouton.setAttribute("aria-pressed", String(Wishlist.contient(id)));
  });
}

function initWishlistGlobale() {
  reflechirCoeurs();

  document.addEventListener("click", (e) => {
    const bouton = e.target.closest("[data-wish]");
    if (!bouton) return;
    e.preventDefault();
    const id = Number(bouton.dataset.wish);
    if (Number.isNaN(id)) return;
    const actif = Wishlist.basculer(id);
    bouton.setAttribute("aria-pressed", String(actif));
  });

  // Re-synchronise les cœurs quand une grille est (re)rendue.
  document.addEventListener("grille:rendue", reflechirCoeurs);
}

/* --------------------------------------------------------------------------
   Page panier — listing complet et récapitulatif
   -------------------------------------------------------------------------- */

/** Reconstruit la page panier (liste des articles + récapitulatif). */
function majPagePanier() {
  const liste = qs("[data-panier-liste]");
  if (!liste) return;

  const lignes = Panier.lire();
  const vide = qs("[data-panier-vide]");
  const recapCommander = qs("[data-passer-commande]");

  if (lignes.length === 0) {
    liste.innerHTML = "";
    if (vide) vide.hidden = false;
    if (recapCommander) recapCommander.disabled = true;
  } else {
    if (vide) vide.hidden = true;
    if (recapCommander) recapCommander.disabled = false;

    liste.innerHTML = lignes
      .map((ligne) => {
        const finition = "";
        return `
        <li class="panier-ligne" data-ligne="${ligne.id}">
          <a class="panier-ligne__img" href="/produit.html?slug=${encodeURIComponent(ligne.slug)}">
            <img src="${ligne.image}" alt="" width="120" height="120" loading="lazy" />
          </a>
          <div class="panier-ligne__infos">
            <a class="panier-ligne__nom" href="/produit.html?slug=${encodeURIComponent(ligne.slug)}">${ligne.nom}</a>
            <span class="panier-ligne__prix-unitaire">${formatPrix(ligne.prix)}</span>
            ${finition}
            <div class="panier-ligne__actions">
              <div class="panier-ligne__qte">
                <button type="button" class="quantite__btn" data-diminuer="${ligne.id}"
                  aria-label="Diminuer la quantité de ${ligne.nom}">&minus;</button>
                <span class="panier-ligne__valeur" aria-live="polite">${ligne.quantite}</span>
                <button type="button" class="quantite__btn" data-augmenter="${ligne.id}"
                  aria-label="Augmenter la quantité de ${ligne.nom}">+</button>
              </div>
              <button type="button" class="panier-ligne__retirer lien" data-retirer="${ligne.id}">
                Retirer
              </button>
            </div>
          </div>
          <span class="panier-ligne__total">${formatPrix(ligne.prix * ligne.quantite)}</span>
        </li>`;
      })
      .join("");
  }

  // --- Récapitulatif ---
  const livraison = Panier.livraison();
  const sousTotalEl = qs("[data-recap-soustotal]");
  const livraisonEl = qs("[data-recap-livraison]");
  const totalEl = qs("[data-recap-total]");
  const noteEl = qs("[data-recap-note]");

  if (sousTotalEl) sousTotalEl.textContent = formatPrix(Panier.sousTotal());
  if (livraisonEl) {
    livraisonEl.textContent = livraison.offerte ? "Offerte" : formatPrix(livraison.frais);
  }
  if (totalEl) totalEl.textContent = formatPrix(Panier.total());
  if (noteEl) {
    noteEl.textContent =
      lignes.length > 0 && !livraison.offerte
        ? `Plus que ${formatPrix(livraison.manque)} pour la livraison offerte.`
        : lignes.length > 0
        ? "Livraison offerte."
        : "";
  }

  majPastille();
}

/**
 * Initialise la page panier : rendu, actions sur les lignes.
 */
function initPagePanier() {
  const conteneur = qs("[data-panier-page]");
  if (!conteneur) return;

  conteneur.addEventListener("click", (e) => {
    const cible = e.target.closest("[data-diminuer], [data-augmenter], [data-retirer]");
    if (!cible) return;
    if (cible.dataset.diminuer) {
      const id = Number(cible.dataset.diminuer);
      const ligne = Panier.lire().find((l) => l.id === id);
      Panier.definirQuantite(id, (ligne?.quantite || 1) - 1);
    } else if (cible.dataset.augmenter) {
      const id = Number(cible.dataset.augmenter);
      const ligne = Panier.lire().find((l) => l.id === id);
      Panier.definirQuantite(id, (ligne?.quantite || 0) + 1);
    } else if (cible.dataset.retirer) {
      Panier.retirer(Number(cible.dataset.retirer));
    }
  });

  document.addEventListener("panier:maj", majPagePanier);
  majPagePanier();
}

/* --------------------------------------------------------------------------
   Commande
   -------------------------------------------------------------------------- */

/**
 * Lance le tunnel de commande via les liens de paiement Stripe
 * (champ `lien_paiement` de data/products.json).
 *
 * Un lien Stripe ne contient qu'un seul bijou : le panier ne peut donc
 * contenir qu'une référence. La quantité se règle sur la page Stripe.
 * Pour un panier multi-produits, il faudra une Checkout Session côté serveur
 * (POST /api/checkout → stripe.checkout.sessions.create({ line_items })).
 */
async function checkout() {
  const lignes = Panier.lire();
  if (lignes.length === 0) {
    return;
  }

  const note = qs("[data-recap-note]");

  if (lignes.length > 1) {
    const message =
      "Pour l'instant, le paiement se fait bijou par bijou : garde une seule création dans ton panier pour commander.";
    if (note) note.textContent = message;
    annoncer(message);
    return;
  }

  const produits = K.chargerProduits ? await K.chargerProduits() : [];
  const produit = produits.find((p) => p.id === lignes[0].id);
  if (!produit?.lien_paiement) {
    if (note) note.textContent = "Le paiement est momentanément indisponible.";
    return;
  }

  window.location.href = produit.lien_paiement;
}

/* --------------------------------------------------------------------------
   Bootstrap
   -------------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  initMiniPanier();
  initAjoutAuPanier();
  initWishlistGlobale();
  initPagePanier();
  majPastille();

  // Bouton « Passer commande » sur panier.html
  qs("[data-passer-commande]")?.addEventListener("click", (e) => {
    e.preventDefault();
    checkout();
  });
});

/* Exposition publique. */
window.Kymia = Object.assign(window.Kymia || {}, {
  Panier,
  Wishlist,
  reflechirCoeurs,
  majPastille,
  ouvrirMiniPanier,
  fermerMiniPanier,
  checkout,
  SEUIL_LIVRAISON_OFFERTE,
});
})();
