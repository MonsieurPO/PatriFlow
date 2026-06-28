/* ═══════════════════════════════════════════════════════════
   PATRIMOINE COCKPIT — data.js v0.9
   Couche données : constantes, STORE, calculs, normalizeBien
   NE PAS MODIFIER sans mettre à jour normalizeBien + DATA_VERSION
   ═══════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────
// SÉCURITÉ — Échappement HTML obligatoire
// Utiliser escapeHTML() partout où des données utilisateur
// sont injectées dans le DOM via innerHTML ou h += '...'
// RÈGLE : si la valeur vient de S.biens[i].*, appeler escapeHTML()
// ─────────────────────────────────────────────────────────────
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────────────────────
// CONSTANTES DE STOCKAGE — source unique de vérité
// Ne jamais accéder localStorage directement hors de STORE
// ─────────────────────────────────────────────────────────────
var STORE_KEY             = 'parc_v2';            // Données principales (immuable)
var STORE_THEME_KEY       = 'parc_theme';          // Thème UI
var SUPA_CONFIG_KEY       = 'parc_supa_config';    // Config Supabase (URL + key)
var SUPA_CURRENT_USER_KEY = 'parc_current_user';   // User ID courant (isolation)

// STORE — abstraction localStorage (toutes les opérations passent par ici)
var STORE = {
  save:    function(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); return true; }
    catch(e) { return false; }
  },
  load:    function(key) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
    catch(e) { return null; }
  },
  saveRaw: function(key, val) {
    try { localStorage.setItem(key, val); return true; }
    catch(e) { return false; }
  },
  loadRaw: function(key) {
    try { return localStorage.getItem(key); }
    catch(e) { return null; }
  },
  remove:  function(key) {
    try { localStorage.removeItem(key); return true; }
    catch(e) { return false; }
  },
  isAvailable: function() {
    try { localStorage.setItem('_t','1'); localStorage.removeItem('_t'); return true; }
    catch(e) { return false; }
  }
};

// ═══════════════════════════════════════════════════
// ÉTAPE 1 : CONSTANTES DE VERSION
// ═══════════════════════════════════════════════════
var DATA_VERSION = 6; // Incrémenté à chaque changement de schéma

// ═══════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════

/** Retourne 0 si la valeur n'est pas un nombre valide. @param {*} v @returns {number} */
function nv(v){ var f = parseFloat(v); return isNaN(f) ? 0 : f; }

/** Formate un nombre en euros (fr-FR). @param {number} v @param {number} [d=0] décimales @returns {string} */
function fmt(v, d){
  if(d === undefined) d = 0;
  if(isNaN(v)) return '--';
  return new Intl.NumberFormat('fr-FR', {minimumFractionDigits:d, maximumFractionDigits:d}).format(v) + ' \u20ac';
}
function fmtK(v){
  if(isNaN(v)) return '--';
  var a = Math.abs(v);
  if(a >= 1000000) return (v/1000000).toFixed(2).replace('.',',') + ' M\u20ac';
  // v2.6c : affichage en € complet (plus de k€)
  return fmt(v);
}
function fmtP(v, d){
  if(d === undefined) d = 1;
  if(isNaN(v)) return '--';
  return v.toFixed(d).replace('.',',') + ' %';
}
function moisLbl(m){
  if(!m) return '--';
  var parts = m.split('-');
  var y = parts[0]; var mo = parseInt(parts[1]);
  var nms = ['jan','f\u00e9v','mar','avr','mai','jun','jul','ao\u00fb','sep','oct','nov','d\u00e9c'];
  if(parts.length === 3){
    // Format YYYY-MM-DD (nouveau format date complète)
    return parts[2] + ' ' + nms[mo-1] + ' ' + y;
  }
  // Format YYYY-MM (ancien format mois uniquement)
  return nms[mo-1] + ' ' + y.slice(2);
}
function uid(){
  return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
}
function togSec(hd){ hd.parentElement.classList.toggle('open'); }
function toggleLocFields(){
  var t = gid('nb-type').value;
  gid('sec-loc').style.display = t === 'loc' ? '' : 'none';
  if(t === 'loc') gid('sec-loc').classList.add('open');
}

// ═══════════════════════════════════════════════════
// ÉTAPE 1 : NORMALIZE BIEN — filet de sécurité
// Initialise TOUS les champs avec valeurs par défaut
// Ne supprime jamais un champ existant
// ═══════════════════════════════════════════════════
function normalizeBien(b) {
  // --- Champs existants (parc_v2) ---
  b.id           = b.id           || uid();
  b.nom          = b.nom          || 'Bien sans nom';
  b.type         = b.type         || 'rp';
  b.date         = b.date         || '';
  b.adresse      = b.adresse      || '';
  b.achat        = nv(b.achat);
  b.frais        = nv(b.frais);
  b.travauxAchat = nv(b.travauxAchat);
  b.valeur       = nv(b.valeur);
  b.capitalInit  = nv(b.capitalInit);
  b.capitalDu    = nv(b.capitalDu);
  b.mens         = nv(b.mens);
  b.taux         = nv(b.taux);
  b.assur        = nv(b.assur);
  b.finCredit    = b.finCredit    || '';
  b.banque       = b.banque       || '';
  b.loyer        = nv(b.loyer);
  b.chargesLoc   = nv(b.chargesLoc);
  b.tf           = nv(b.tf);
  b.pno          = nv(b.pno);
  b.copro        = nv(b.copro);
  b.gest         = nv(b.gest);
  b.loyers       = b.loyers       || [];
  b.travaux      = b.travaux      || [];
  // --- Nouveaux champs (étape 2) — valeurs par défaut rétrocompatibles ---
  b.statut          = b.statut          || 'actif';
  b.structureAchat  = b.structureAchat  || 'seul';
  b.associes        = b.associes        || '';
  b.quotePart       = b.quotePart       !== undefined ? nv(b.quotePart) : 100;
  b.dashVisible     = b.dashVisible     !== undefined ? b.dashVisible   : true;
  b.provisionTravaux= nv(b.provisionTravaux);
  b.fraisDossier    = nv(b.fraisDossier);
  b.fraisDossierType= b.fraisDossierType|| 'fixe';
  // --- ÉTAPE 4 (v4) : documents avec catégories ---
  b.documents       = b.documents       || [];
  // --- ÉTAPE 6 (v5) : fiscalité par bien ---
  b.regimeFiscal    = b.regimeFiscal    || 'micro-foncier';
  b.tmi             = b.tmi             !== undefined ? nv(b.tmi) : 11;
  // --- ÉTAPE 7 (v6) : gestion locative en % du loyer ---
  b.gestionPct      = b.gestionPct      !== undefined ? nv(b.gestionPct) : 0;
  if(b.gestionPct > 0) b.gest = nv(b.loyer) * b.gestionPct / 100;
  // --- v2.6b : profils associés (indivision / SCI) ---
  b.associesProfiles = b.associesProfiles || [];
  // --- Détail des frais d'acquisition + financement projet ---
  b.fraisNotaire  = b.fraisNotaire  !== undefined ? nv(b.fraisNotaire)  : 0;
  b.fraisAgence   = b.fraisAgence   !== undefined ? nv(b.fraisAgence)   : 0;
  b.fraisCourtier = b.fraisCourtier !== undefined ? nv(b.fraisCourtier) : 0;
  b.apport        = b.apport        !== undefined ? nv(b.apport)        : 0;
  b.duree         = b.duree         !== undefined ? nv(b.duree)         : 0;

  // Patch projet : si les frais détaillés existent, ils alimentent le total de frais.
  if (b.fraisNotaire || b.fraisAgence || b.fraisCourtier) {
    b.frais = nv(b.fraisNotaire) + nv(b.fraisAgence) + nv(b.fraisCourtier);
  }

  // Patch loyers : rétrocompatibilité avec les anciens mois sans date de paiement.
  for (var i = 0; i < b.loyers.length; i++) {
    if (b.loyers[i].datePaiement === undefined) b.loyers[i].datePaiement = '';
  }
  return b;
}

// ═══════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════
var S = {
  biens: [],
  config: {
    revenusMensuels:    0,
    tauxEndettementMax: 35,
    loyersPrisEnCompte: 70,
    margeSecurite:      10,
    tauxNotaireDefaut:  8,
    fraisDossierDefaut: 1500
  },
  historiquePatrimoine: [], // v2.8 : snapshots mensuels {date, valeurParc, capitalDu, patrimoineNet, cfMensuel}
  _v: DATA_VERSION
};