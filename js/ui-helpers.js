/* ═══════════════════════════════════════════════════════════
   PATRIMOINE COCKPIT — ui-helpers.js v0.8
   Fonctions de rendu héritées de la v2.9 — 100% conservées
   Ces fonctions sont appelées par app.js et les pages de biens
   ═══════════════════════════════════════════════════════════ */

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

// ═══════════════════════════════════════════════════
// NAVIGATION (inchangée)
// ═══════════════════════════════════════════════════
function goPage(name, btn){
  var pages = document.querySelectorAll('.page');
  for(var i=0; i<pages.length; i++) pages[i].classList.remove('on');
  var btns = document.querySelectorAll('.nb');
  for(var i=0; i<btns.length; i++) btns[i].classList.remove('on');
  var pg = gid('page-' + name);
  if(pg) pg.classList.add('on');
  if(btn) btn.classList.add('on');
  if(name === 'cockpit') refreshCockpit();
}

function addNavTab(b){
  if(gid('btn-bien-' + b.id)) return;
  var nav = gid('mainnav');
  var addBtn = gid('btn-add');
  var btn = document.createElement('button');
  btn.className = 'nb';
  btn.id = 'btn-bien-' + b.id;
  var shortName = b.nom.length > 10 ? b.nom.slice(0,10) + '...' : b.nom;
  btn.textContent = shortName;
  btn.setAttribute('data-bid', b.id);
  btn.onclick = function(){ goPage('bien-' + b.id, btn); };
  nav.insertBefore(btn, addBtn);
}

// v2.3 : met à jour le libellé de l'onglet nav après renommage d'un bien
function updateNavTabLabel(b){
  var btn = gid('btn-bien-' + b.id);
  if(!btn) return;
  var shortName = b.nom.length > 10 ? b.nom.slice(0,10) + '...' : b.nom;
  btn.textContent = shortName;
}

// ═══════════════════════════════════════════════════
// ÉTAPE 2 : HELPER CF — formule unique, un seul endroit
// Utilisée par bienHTML() ET refreshDash() ET refreshCockpit()
// ═══════════════════════════════════════════════════
function calcCF(b) {
  var mensTotal = nv(b.mens) + nv(b.assur);
  return nv(b.loyer) - mensTotal - (nv(b.tf)/12) - nv(b.pno) - nv(b.copro) - nv(b.gest) - nv(b.provisionTravaux);
}

// ═══════════════════════════════════════════════════
// CONSTANTES FISCALES
// ═══════════════════════════════════════════════════
var PRELEV_SOCIAUX = 17.2; // % — taux fixe prélèvements sociaux

// ═══════════════════════════════════════════════════
// v2.4 : TABLEAU D'AMORTISSEMENT RÉEL// Génère le tableau mensuel (capital, intérêts, CRD) à partir de
// capitalInit, taux, et durée totale déduite de date <-> finCredit.
// Ne remplace PAS capitalDu (source de vérité saisie manuellement) :
// c'est un calcul théorique complémentaire, affiché à titre informatif
// et utilisé pour fiabiliser l'estimation des intérêts annuels.
// ═══════════════════════════════════════════════════

// Retourne le nombre de mois entre deux chaînes "YYYY-MM", ou null si invalide
function moisEntre(debut, fin){
  if(!debut || !fin) return null;
  var pd = debut.split('-'); var pf = fin.split('-');
  if(pd.length!==2 || pf.length!==2) return null;
  var d = parseInt(pd[0])*12 + parseInt(pd[1]);
  var f = parseInt(pf[0])*12 + parseInt(pf[1]);
  var diff = f - d;
  return diff > 0 ? diff : null;
}

// Calcule le tableau d'amortissement complet d'un bien.
// Retourne null si les données nécessaires sont insuffisantes (pas de crash).
// Sinon : {dureeTotaleMois, dureeEcouleeMois, dureeRestanteMois, tableau:[{mois, capital, interet, crd}], crdTheorique, capitalRembTheorique}
function calcAmortissement(b){
  var capitalInit = nv(b.capitalInit);
  var taux = nv(b.taux);
  if(capitalInit <= 0) return null;

  var dureeTotaleMois = moisEntre(b.date, b.finCredit);
  if(!dureeTotaleMois) return null; // pas assez d'info (date d'achat ou fin de crédit manquante)

  var tauxMensuel = (taux/100) / 12;
  var mensHorsAssur = nv(b.mens); // mensualité crédit hors assurance (b.assur est séparé)

  var tableau = [];
  var crd = capitalInit;

  if(tauxMensuel > 0 && mensHorsAssur > 0){
    // Amortissement classique à mensualité constante
    for(var m=1; m<=dureeTotaleMois; m++){
      var interet = crd * tauxMensuel;
      var capitalPart = mensHorsAssur - interet;
      if(capitalPart > crd) capitalPart = crd; // dernière échéance
      crd = crd - capitalPart;
      tableau.push({mois:m, capital:capitalPart, interet:interet, crd:Math.max(0,crd)});
      if(crd <= 0) break;
    }
  } else {
    // Taux à 0% (ex: PTZ) ou mensualité non renseignée : amortissement linéaire
    var capitalParMois = capitalInit / dureeTotaleMois;
    for(var m=1; m<=dureeTotaleMois; m++){
      crd = Math.max(0, crd - capitalParMois);
      tableau.push({mois:m, capital:capitalParMois, interet:0, crd:crd});
      if(crd <= 0) break;
    }
  }

  // Durée écoulée depuis la date d'achat jusqu'à aujourd'hui
  var now = new Date();
  var nowStr = now.getFullYear() + '-' + (now.getMonth()+1 < 10 ? '0' : '') + (now.getMonth()+1);
  var dureeEcouleeMois = moisEntre(b.date, nowStr) || 0;
  if(dureeEcouleeMois < 0) dureeEcouleeMois = 0;
  if(dureeEcouleeMois > tableau.length) dureeEcouleeMois = tableau.length;

  var crdTheorique = dureeEcouleeMois > 0 && tableau[dureeEcouleeMois-1] ? tableau[dureeEcouleeMois-1].crd : capitalInit;
  if(dureeEcouleeMois === 0) crdTheorique = capitalInit;

  return {
    dureeTotaleMois: dureeTotaleMois,
    dureeEcouleeMois: dureeEcouleeMois,
    dureeRestanteMois: Math.max(0, dureeTotaleMois - dureeEcouleeMois),
    tableau: tableau,
    crdTheorique: crdTheorique,
    capitalRembTheorique: capitalInit - crdTheorique
  };
}

// Intérêts de l'année en cours (12 prochains mois) — utilisé pour fiabiliser le calcul fiscal.
// Fallback sur l'approximation existante (capitalDu × taux) si le tableau n'est pas calculable.
function interetsAnneeCourante(b){
  var amort = calcAmortissement(b);
  if(!amort) return nv(b.capitalDu) * (nv(b.taux)/100); // fallback (comportement v6 inchangé)

  var startIdx = amort.dureeEcouleeMois; // index 0-based du mois courant dans le tableau
  var total = 0; var count = 0;
  for(var i=startIdx; i<amort.tableau.length && count<12; i++){
    total += amort.tableau[i].interet;
    count++;
  }
  // Si moins de 12 mois restants, le total reflète juste ce qui reste (cohérent : pas d'intérêts après la fin)
  return total;
}

// Intérêts annuels moyens sur toute la durée du prêt (utile pour affichage synthétique)
function interetsTotalCredit(b){
  var amort = calcAmortissement(b);
  if(!amort) return null;
  var total = 0;
  for(var i=0; i<amort.tableau.length; i++) total += amort.tableau[i].interet;
  return total;
}

function calcImpotMensuel(b) {
  var loyerAn = nv(b.loyer) * 12;
  if(loyerAn <= 0) return 0;
  var tmi = nv(b.tmi);
  var tauxGlobal = (tmi + PRELEV_SOCIAUX) / 100;
  var assiette = 0;

  // Charges réelles annuelles (hors capital remboursé, hors provision)
  var chargesReelles = nv(b.tf) + (nv(b.pno) + nv(b.copro) + nv(b.gest)) * 12;
  // v2.4 : Intérêts d'emprunt — calcul réel via tableau d'amortissement si possible
  // (date d'achat + fin de crédit renseignées), sinon fallback sur l'approximation
  // capitalDu × taux (comportement v6 conservé pour compatibilité).
  var interetsAn = interetsAnneeCourante(b);
  var assuranceAn = nv(b.assur) * 12;

  switch(b.regimeFiscal){
    case 'micro-foncier':
      // Abattement forfaitaire 30%
      assiette = loyerAn * 0.70;
      break;
    case 'reel-foncier':
      // Loyers - charges déductibles - intérêts d'emprunt - assurance emprunteur
      assiette = loyerAn - chargesReelles - interetsAn - assuranceAn;
      break;
    case 'micro-bic':
      // LMNP micro-BIC : abattement forfaitaire 50%
      assiette = loyerAn * 0.50;
      break;
    case 'lmnp-reel':
      // LMNP réel simplifié : loyers - charges - intérêts - assurance - amortissement (3%/an du prix d'achat, forfait indicatif)
      var amortissementAn = nv(b.achat) * 0.03;
      assiette = loyerAn - chargesReelles - interetsAn - assuranceAn - amortissementAn;
      break;
    case 'sci-ir':
      // SCI à l'IR (estimation simple) : comme le réel foncier — les associés
      // sont imposés sur leur quote-part du résultat foncier. Ici, estimation
      // au niveau du bien (loyers - charges - intérêts - assurance).
      assiette = loyerAn - chargesReelles - interetsAn - assuranceAn;
      break;
    default:
      assiette = loyerAn * 0.70;
  }

  assiette = Math.max(0, assiette);
  var impotAn = assiette * tauxGlobal;
  return impotAn / 12;
}

// CF après impôt — basé sur calcCF() existant, n'écrase rien
function calcCFApresImpot(b) {
  return calcCF(b) - calcImpotMensuel(b);
}

function regimeLabel(r){
  var m = {'micro-foncier':'Micro-foncier (abt. 30%)','reel-foncier':'R\u00e9el foncier','micro-bic':'LMNP micro-BIC (abt. 50%)','lmnp-reel':'LMNP r\u00e9el (amort.)','sci-ir':'SCI \u00e0 l\'IR (estimation)'};
  return m[r] || r;
}

// ÉTAPE 8 (v6) : détail du calcul d'impôt pour affichage pédagogique
// Retourne {loyerAn, assietteAn, abattementTxt, tauxGlobal, impotAn, impotMens}
function calcImpotDetail(b){
  var loyerAn = nv(b.loyer) * 12;
  var tmi = nv(b.tmi);
  var tauxGlobal = tmi + PRELEV_SOCIAUX;
  var assietteAn = 0;
  var abattementTxt = '';
  var chargesReelles = nv(b.tf) + (nv(b.pno) + nv(b.copro) + nv(b.gest)) * 12;
  // v2.4 : intérêts réels via amortissement si possible (cf. calcImpotMensuel)
  var interetsAn = interetsAnneeCourante(b);
  var interetsEstimes = calcAmortissement(b) === null; // true si fallback approximatif utilisé
  var assuranceAn = nv(b.assur) * 12;

  switch(b.regimeFiscal){
    case 'micro-foncier':
      assietteAn = loyerAn * 0.70;
      abattementTxt = 'loyer annuel \u00d7 70% (abattement forfaitaire 30%)';
      break;
    case 'reel-foncier':
      assietteAn = loyerAn - chargesReelles - interetsAn - assuranceAn;
      abattementTxt = 'loyer annuel \u2212 charges (' + fmt(chargesReelles) + ') \u2212 int\u00e9r\u00eats (' + fmt(interetsAn) + ') \u2212 assurance (' + fmt(assuranceAn) + ')';
      break;
    case 'micro-bic':
      assietteAn = loyerAn * 0.50;
      abattementTxt = 'loyer annuel \u00d7 50% (abattement forfaitaire 50%)';
      break;
    case 'lmnp-reel':
      var amortAn = nv(b.achat) * 0.03;
      assietteAn = loyerAn - chargesReelles - interetsAn - assuranceAn - amortAn;
      abattementTxt = 'loyer annuel \u2212 charges \u2212 int\u00e9r\u00eats \u2212 assurance \u2212 amortissement (' + fmt(amortAn) + '/an)';
      break;
    case 'sci-ir':
      assietteAn = loyerAn - chargesReelles - interetsAn - assuranceAn;
      abattementTxt = 'SCI \u00e0 l\'IR : loyer annuel \u2212 charges (' + fmt(chargesReelles) + ') \u2212 int\u00e9r\u00eats (' + fmt(interetsAn) + ') \u2212 assurance (' + fmt(assuranceAn) + ')';
      break;
    default:
      assietteAn = loyerAn * 0.70;
      abattementTxt = 'loyer annuel \u00d7 70%';
  }
  assietteAn = Math.max(0, assietteAn);
  var impotAn = assietteAn * tauxGlobal / 100;
  return {
    loyerAn: loyerAn,
    assietteAn: assietteAn,
    abattementTxt: abattementTxt,
    tauxGlobal: tauxGlobal,
    tmi: tmi,
    impotAn: impotAn,
    impotMens: impotAn / 12
  };
}

// ═══════════════════════════════════════════════════
// v0.97 — RENDEMENTS (calculs purs, aucune dépendance UI)
// Toutes ces fonctions sont des ESTIMATIONS indicatives.
// ═══════════════════════════════════════════════════

// Coût total d'acquisition (base des rendements)
function coutAcquisition(b){
  return nv(b.achat) + nv(b.frais) + nv(b.travauxAchat);
}

// Rendement BRUT = (loyer annuel / coût d'acquisition) × 100
function rendementBrut(b){
  var cout = coutAcquisition(b);
  if(cout <= 0) return null;
  return nv(b.loyer) * 12 / cout * 100;
}

// Charges annuelles propriétaire (hors crédit, hors impôt)
function chargesProprioAn(b){
  return nv(b.tf) + (nv(b.pno) + nv(b.copro) + nv(b.gest)) * 12;
}

// Rendement NET = ((loyer annuel − charges propriétaire) / coût) × 100
function rendementNet(b){
  var cout = coutAcquisition(b);
  if(cout <= 0) return null;
  var net = nv(b.loyer) * 12 - chargesProprioAn(b);
  return net / cout * 100;
}

// Rendement NET-NET (après impôt estimatif) =
// ((loyer annuel − charges − impôt estimatif annuel) / coût) × 100
function rendementNetNet(b){
  var cout = coutAcquisition(b);
  if(cout <= 0) return null;
  var impotAn = calcImpotMensuel(b) * 12;
  var netnet = nv(b.loyer) * 12 - chargesProprioAn(b) - impotAn;
  return netnet / cout * 100;
}

// ═══════════════════════════════════════════════════
// AJOUTER BIEN (étendu — ordre identique à normalizeBien)
// ═══════════════════════════════════════════════════
function initLoyers(montant){
  var rows = [];
  var now = new Date();
  for(var i=11; i>=0; i--){
    var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    var mo = String(d.getMonth()+1);
    if(mo.length < 2) mo = '0' + mo;
    var key = d.getFullYear() + '-' + mo;
    rows.push({ mois: key, prevu: montant, encaisse: null, statut: 'nd' });
  }
  return rows;
}

// ═══════════════════════════════════════════════════
// PAGE BIEN (inchangée structurellement)
// ═══════════════════════════════════════════════════
function buildBienPage(b){
  var container = gid('bien-pages');
  var div = document.createElement('div');
  div.className = 'page';
  div.id = 'page-bien-' + b.id;
  div.innerHTML = bienHTML(b);
  container.appendChild(div);
  renderLoyers(b);
  renderTravaux(b);
  renderDocuments(b);
  renderAssocies(b); // render partiel de la zone associés
}

// ÉTAPE 7 (v6) : reconstruit la fiche d'un bien après modification de charges
// Préserve : page active, sections ouvertes/fermées (par index)
// v2.5d : reconstruit la fiche d'un bien après modification
// Préserve l'état ouvert/fermé des sections par data-secid (stable)
// et non par index positionnel (fragile si le nombre de sections change)
function rebuildBienPage(b){
  var oldPage = gid('page-bien-' + b.id);
  if(!oldPage) return;
  var wasActive = oldPage.classList.contains('on');

  // 1. Mémoriser l'état ouvert par data-secid (sections nommées) et year-block (par id)
  var openSecIds = {};
  var secs = oldPage.querySelectorAll('.sec[data-secid]');
  for(var i=0; i<secs.length; i++){
    if(secs[i].classList.contains('open')) openSecIds[secs[i].getAttribute('data-secid')] = true;
  }
  var openYears = getOpenYears(b.id);

  // 2. Reconstruire le HTML
  oldPage.innerHTML = bienHTML(b);
  if(wasActive) oldPage.classList.add('on');

  // 3. Restaurer les sections nommées par data-secid
  var newSecs = oldPage.querySelectorAll('.sec[data-secid]');
  for(var i=0; i<newSecs.length; i++){
    var sid = newSecs[i].getAttribute('data-secid');
    if(openSecIds[sid]) newSecs[i].classList.add('open');
  }

  // 4. Restaurer les blocs année loyers (si aucun état mémorisé : ouvre l'année en cours)
  restoreOpenYears(b.id, openYears, String(new Date().getFullYear()));

  renderLoyers(b);
  renderTravaux(b);
  renderDocuments(b);
  renderAssocies(b);
}

function statutLabel(s){
  var m = {actif:'Actif', projet:'Projet', 'a-vendre':'A vendre', vendu:'Vendu', rembourse:'Rembours\u00e9', annule:'Annul\u00e9'};
  return m[s] || s;
}
function statutClass(s){
  var m = {actif:'tg', projet:'ta', 'a-vendre':'tr2', vendu:'tp', rembourse:'tb2', annule:'tr2'};
  return m[s] || 'tb2';
}
function structureLabel(s){
  var m = {seul:'Seul', couple:'Couple', indivision:'Indivision', sci:'SCI', societe:'Societe'};
  return m[s] || s;
}

function bienHTML(b){
  var cout = b.achat + b.frais + b.travauxAchat;
  var equity = b.valeur - b.capitalDu;
  var loyerAn = b.loyer * 12;
  var rendBrut = cout > 0 ? (loyerAn / cout * 100) : 0;
  var chargesAn = b.tf + (b.pno + b.copro + b.gest + b.provisionTravaux) * 12;
  var loyerNet = loyerAn - chargesAn;
  var rendNet = cout > 0 ? (loyerNet / cout * 100) : 0;
  var mensTotal = b.mens + b.assur;
  // Étape 2 : CF via helper centralisé
  var cf = calcCF(b);
  var pctRemb = b.capitalInit > 0 ? ((b.capitalInit - b.capitalDu) / b.capitalInit * 100) : 0;
  var ico = b.type === 'rp' ? '\uD83C\uDFE0' : '\uD83C\uDFD8';
  var id = b.id;
  var h = '';

  // HERO
  h += '<div style="background:var(--ink2);border:1px solid var(--line);border-radius:var(--r);padding:16px;margin-bottom:10px">';
  h += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">';
  h += '<div>';
  h += '<div style="font-size:22px;margin-bottom:4px">' + ico + '</div>';
  h += '<div style="font-size:16px;font-weight:800;color:var(--white);margin-bottom:4px">' + b.nom + '</div>';
  if(b.adresse) h += '<div style="font-size:11px;color:var(--mist);margin-bottom:6px">' + b.adresse + '</div>';
  // Étape 2 : affichage statut + structure + associes
  h += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">';
  h += '<span class="tag ' + statutClass(b.statut) + '">' + statutLabel(b.statut) + '</span>';
  h += b.type==='rp' ? '<span class="tag tb2">RP</span>' : '<span class="tag tg">Locatif</span>';
  h += '<span class="tag tp">' + structureLabel(b.structureAchat) + '</span>';
  if(b.quotePart < 100) h += '<span class="tag ta">' + b.quotePart + '%</span>';
  if(b.date) h += '<span class="tag ta">' + moisLbl(b.date) + '</span>';
  if(b.banque) h += '<span class="tag tb2">' + b.banque + '</span>';
  if(!b.dashVisible) h += '<span class="tag tr2">masqu\u00e9 dashboard</span>';
  h += '</div>';
  if(b.associes) h += '<div style="font-size:11px;color:var(--fog);margin-top:5px">Associ\u00e9s : ' + b.associes + '</div>';
  h += '</div>';
  h += '<div style="text-align:right;flex-shrink:0">';
  h += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--fog)">Valeur estim\u00e9e</div>';
  h += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:22px;font-weight:500;color:var(--lime)">' + fmtK(b.valeur) + '</div>';
  h += '<div style="font-size:10px;color:var(--mist);margin-top:2px">Equity : ' + fmtK(equity) + '</div>';
  h += '</div></div></div>';

  // KPI BIEN
  h += '<div class="kgrid">';
  if(b.type === 'loc'){
    // Locatif : afficher le CF (a du sens car il y a un loyer entrant)
    h += '<div class="kcard"><div class="klbl">Cash-flow net</div><div class="kval ' + (cf>=0?'up':'dn') + '">' + fmt(cf) + '</div><div class="ksub">apr\u00e8s cr\u00e9dit + charges</div></div>';
  }
  h += '<div class="kcard"><div class="klbl">Capital restant d\u00fb</div><div class="kval">' + fmtK(b.capitalDu) + '</div><div class="ksub">' + fmtP(pctRemb) + ' rembours\u00e9</div></div>';
  if(b.type === 'loc'){
    h += '<div class="kcard"><div class="klbl">Rendement brut</div><div class="kval neu">' + fmtP(rendBrut) + '</div><div class="ksub">loyers / co\u00fbt</div></div>';
    h += '<div class="kcard"><div class="klbl">Rendement net</div><div class="kval">' + fmtP(rendNet) + '</div><div class="ksub">apr\u00e8s charges</div></div>';
  }
  h += '<div class="kcard"><div class="klbl">Mensualit\u00e9</div><div class="kval" style="color:var(--blue)">' + fmt(mensTotal) + '</div><div class="ksub">cr\u00e9dit + assurance</div></div>';
  if(b.type === 'rp'){
    // RP : afficher l'equity à la place du CF (plus pertinent)
    h += '<div class="kcard" style="--kcolor:var(--teal)"><div class="klbl">Equity</div><div class="kval" style="color:var(--teal)">' + fmtK(equity) + '</div><div class="ksub">valeur \u2212 dette</div></div>';
  }
  h += '</div>';

  // PARAMÈTRES DU BIEN — en premier pour accès rapide
  h += '<div class="sec" data-secid="params">';
  h += '<div class="shd" onclick="togSec(this)"><span class="sttl">&#9881; Param\u00e8tres du bien</span><span class="schev">&#9660;</span></div>';
  h += '<div class="sbody">';
  h += '<div class="sep2" style="margin-top:0"><span>Informations g\u00e9n\u00e9rales</span></div>';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Nom du bien</label>';
  h += '<input type="text" value="' + b.nom + '" onchange="updBienNom(\'' + id + '\',this.value)"></div>';
  h += '<div class="r2 mt10">';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Adresse</label>';
  h += '<input type="text" value="' + (b.adresse||'') + '" onchange="updBienGeneralStr(\'' + id + '\',\'adresse\',this.value)"></div>';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Date d\'achat</label>';
  h += '<input type="date" value="' + (b.date||'') + '" onchange="updBienGeneralStr(\'' + id + '\',\'date\',this.value)"></div>';
  h += '</div>';
  h += '<div class="r2 mt10">';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Prix d\'achat <em>\u20ac</em></label>';
  h += '<input type="number" value="' + b.achat + '" onchange="updBienGeneral(\'' + id + '\',\'achat\',this.value)"></div>';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Frais notaire+agence <em>\u20ac</em></label>';
  h += '<input type="number" value="' + b.frais + '" onchange="updBienGeneral(\'' + id + '\',\'frais\',this.value)"></div>';
  h += '</div>';
  h += '<div class="fg mt10"><label class="fl">Travaux \u00e0 l\'achat <em>\u20ac</em></label>';
  h += '<input type="number" value="' + b.travauxAchat + '" onchange="updBienGeneral(\'' + id + '\',\'travauxAchat\',this.value)"></div>';
  h += '<div class="sep2"><span>Cr\u00e9dit</span></div>';
  h += '<div class="r2">';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Capital initial emprunt\u00e9 <em>\u20ac</em></label>';
  h += '<input type="number" value="' + b.capitalInit + '" onchange="updBienGeneral(\'' + id + '\',\'capitalInit\',this.value)"></div>';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Banque</label>';
  h += '<input type="text" value="' + (b.banque||'') + '" onchange="updBienGeneralStr(\'' + id + '\',\'banque\',this.value)"></div>';
  h += '</div>';
  h += '<div class="fg mt10"><label class="fl">Fin de cr\u00e9dit</label>';
  h += '<input type="date" value="' + (b.finCredit||'') + '" onchange="updBienGeneralStr(\'' + id + '\',\'finCredit\',this.value)"></div>';
  h += '<div style="font-size:10px;color:var(--mist);margin-top:6px">* Modifier le prix d\'achat, les frais ou les travaux recalcule automatiquement le co\u00fbt de revient, l\'equity, le rendement et la plus-value latente.</div>';
  h += '<div class="sep2"><span>Statut &amp; structure</span></div>';
  h += '<div class="r2">';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Statut</label>';
  h += '<select onchange="updBienStr(\'' + id + '\',\'statut\',this.value)">';
  var statuts = ['actif','projet','a-vendre','vendu','rembourse','annule'];
  var statutLbls = ['Actif','Projet','A vendre','Vendu','Rembours\u00e9','Annul\u00e9'];
  for(var si=0; si<statuts.length; si++){
    h += '<option value="' + statuts[si] + '"' + (b.statut===statuts[si]?' selected':'') + '>' + statutLbls[si] + '</option>';
  }
  h += '</select></div>';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Structure</label>';
  h += '<select onchange="updBienStr(\'' + id + '\',\'structureAchat\',this.value)">';
  var structs = ['seul','couple','indivision','sci','societe'];
  var structLbls = ['Seul','Couple','Indivision','SCI','Société'];
  for(var si=0; si<structs.length; si++){
    h += '<option value="' + structs[si] + '"' + (b.structureAchat===structs[si]?' selected':'') + '>' + structLbls[si] + '</option>';
  }
  h += '</select></div>';
  h += '</div>';
  h += '<div class="r2 mt10">';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Quote-part <em>%</em></label>';
  h += '<input type="number" value="' + b.quotePart + '" oninput="updBien(\'' + id + '\',\'quotePart\',this.value)"></div>';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Provision travaux <em>\u20ac/m</em></label>';
  h += '<input type="number" value="' + b.provisionTravaux + '" oninput="updBien(\'' + id + '\',\'provisionTravaux\',this.value)"></div>';
  h += '</div>';
  h += '<div class="tog-row mt10"><span class="tog-lbl">Visible dans dashboard &amp; cockpit</span>';
  h += '<div class="tog ' + (b.dashVisible?'on':'') + '" id="dashvis-' + id + '" onclick="toggleDashVisible(\'' + id + '\')"></div></div>';
  if(b.type === 'loc'){
    h += '<div class="sep2"><span>Charges &amp; loyer</span></div>';
    h += '<div class="r2">';
    h += '<div class="fg" style="margin-top:0"><label class="fl">Loyer th\u00e9orique <em>\u20ac/m</em></label>';
    h += '<input type="number" value="' + b.loyer + '" onchange="updBienLoyer(\'' + id + '\',this.value)"></div>';
    h += '<div class="fg" style="margin-top:0"><label class="fl">Taxe fonci\u00e8re <em>\u20ac/an</em></label>';
    h += '<input type="number" value="' + b.tf + '" onchange="updBienCharge(\'' + id + '\',\'tf\',this.value)"></div>';
    h += '</div>';
    h += '<div class="r2 mt10">';
    h += '<div class="fg" style="margin-top:0"><label class="fl">PNO <em>\u20ac/m</em></label>';
    h += '<input type="number" value="' + b.pno + '" onchange="updBienCharge(\'' + id + '\',\'pno\',this.value)"></div>';
    h += '<div class="fg" style="margin-top:0"><label class="fl">Charges copropriété <em>\u20ac/m</em></label>';
    h += '<input type="number" value="' + b.copro + '" onchange="updBienCharge(\'' + id + '\',\'copro\',this.value)"></div>';
    h += '</div>';
    h += '<div class="r2 mt10">';
    h += '<div class="fg" style="margin-top:0"><label class="fl">Charges locataires <em>\u20ac/m, info</em></label>';
    h += '<input type="number" value="' + b.chargesLoc + '" onchange="updBienCharge(\'' + id + '\',\'chargesLoc\',this.value)"></div>';
    h += '<div class="fg" style="margin-top:0"><label class="fl">Gestion locative <em>% du loyer</em></label>';
    h += '<input type="number" value="' + (b.gestionPct||'') + '" placeholder="0" min="0" max="100" step="0.5" onchange="updBienCharge(\'' + id + '\',\'gestionPct\',this.value)"></div>';
    h += '</div>';
    h += '<div class="fg mt10"><label class="fl">Gestion locative <em>\u20ac/m \u2014 ' + (b.gestionPct>0 ? ('calcul\u00e9 auto : '+b.gestionPct+'% de '+fmt(b.loyer)) : 'montant fixe manuel') + '</em></label>';
    h += '<input type="number" id="chg-gest-' + id + '" value="' + b.gest.toFixed(2) + '"' + (b.gestionPct>0?' disabled':'') + ' onchange="updBienCharge(\'' + id + '\',\'gest\',this.value)"></div>';
    h += '<div style="font-size:10px;color:var(--mist);margin-top:6px">* Si "Gestion locative %" > 0, le montant \u20ac est recalcul\u00e9 auto. Mettez 0 pour saisie manuelle.</div>';
    h += '<div class="sep2"><span>Fiscalit\u00e9</span></div>';
    h += '<div class="r2">';
    h += '<div class="fg" style="margin-top:0"><label class="fl">R\u00e9gime fiscal</label>';
    h += '<select onchange="updBienStr(\'' + id + '\',\'regimeFiscal\',this.value);refreshDash()">';
    var regimes = ['micro-foncier','reel-foncier','micro-bic','lmnp-reel'];
    var regimeLbls = ['Micro-foncier (abt. 30%)','R\u00e9el foncier','LMNP micro-BIC (abt. 50%)','LMNP r\u00e9el (amort.)'];
    for(var ri=0; ri<regimes.length; ri++){
      h += '<option value="' + regimes[ri] + '"' + (b.regimeFiscal===regimes[ri]?' selected':'') + '>' + regimeLbls[ri] + '</option>';
    }
    h += '</select></div>';
    h += '<div class="fg" style="margin-top:0"><label class="fl">TMI <em>+ 17,2% PS</em></label>';
    h += '<select onchange="updBien(\'' + id + '\',\'tmi\',this.value);refreshDash()">';
    var tmis = [0,11,30,41,45];
    for(var ti=0; ti<tmis.length; ti++){
      h += '<option value="' + tmis[ti] + '"' + (b.tmi===tmis[ti]?' selected':'') + '>' + tmis[ti] + ' %</option>';
    }
    h += '</select></div>';
    h += '</div>';
    h += '<div style="font-size:10px;color:var(--mist);margin-top:6px">* Estimation indicative. Ne remplace pas une simulation fiscale r\u00e9elle.</div>';
  }
  h += '</div></div>';

  // CREDIT
  h += '<div class="sec open" data-secid="credit">';
  h += '<div class="shd" onclick="togSec(this)"><span class="sttl">Cr\u00e9dit</span><span class="schev">&#9660;</span></div>';
  h += '<div class="sbody">';
  h += '<div class="pbwrap"><div class="pblbl"><span>Rembours\u00e9 : ' + fmtK(b.capitalInit - b.capitalDu) + '</span><span>Restant : ' + fmtK(b.capitalDu) + '</span></div><div class="pb"><div class="pbf" style="width:' + pctRemb.toFixed(1) + '%;background:var(--lime)"></div></div></div>';
  h += '<table class="tbl" style="margin-top:8px">';
  h += '<tr><td>Capital initial</td><td class="mn">' + fmt(b.capitalInit) + '</td></tr>';
  h += '<tr><td>Capital restant d\u00fb</td><td class="mn neg">' + fmt(b.capitalDu) + '</td></tr>';
  h += '<tr><td>Mensualit\u00e9 cr\u00e9dit</td><td class="mn">' + fmt(b.mens) + '</td></tr>';
  h += '<tr><td>Assurance</td><td class="mn">' + fmt(b.assur) + '/mois</td></tr>';
  h += '<tr><td>Taux</td><td class="mn">' + fmtP(b.taux) + '</td></tr>';
  if(b.finCredit) h += '<tr><td>Fin de cr\u00e9dit</td><td class="mn">' + moisLbl(b.finCredit) + '</td></tr>';
  if(b.fraisDossier > 0) h += '<tr><td>Frais de dossier</td><td class="mn">' + (b.fraisDossierType === 'pct' ? fmtP(b.fraisDossier) : fmt(b.fraisDossier)) + '</td></tr>';
  h += '</table>';
  h += '<div class="sep"><span>Mettre \u00e0 jour</span></div>';
  h += '<div class="r2">';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Capital restant d\u00fb <em>\u20ac</em></label>';
  h += '<input type="number" id="upd-cap-' + id + '" value="' + b.capitalDu + '" placeholder="110000" oninput="updBien(\'' + id + '\',\'capitalDu\',this.value)"></div>';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Mensualit\u00e9 <em>\u20ac</em></label>';
  h += '<input type="number" id="upd-mens-' + id + '" value="' + b.mens + '" placeholder="650" oninput="updBien(\'' + id + '\',\'mens\',this.value)"></div>';
  h += '</div>';
  h += '<div class="r2 mt10">';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Assurance emprunteur <em>\u20ac/m</em></label>';
  h += '<input type="number" id="upd-assur-' + id + '" value="' + b.assur + '" placeholder="0" oninput="updBien(\'' + id + '\',\'assur\',this.value)"></div>';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Taux <em>%</em></label>';
  h += '<input type="number" id="upd-taux-' + id + '" value="' + b.taux + '" placeholder="3.10" step="0.01" oninput="updBien(\'' + id + '\',\'taux\',this.value)"></div>';
  h += '</div>';
  h += '</div></div></div>';

  // VALEUR
  h += '<div class="sec" data-secid="valeur">';
  h += '<div class="shd" onclick="togSec(this)"><span class="sttl">Valeur &amp; patrimoine</span><span class="schev">&#9660;</span></div>';
  h += '<div class="sbody">';
  h += '<table class="tbl">';
  h += '<tr><td>Prix d\'achat</td><td class="mn">' + fmt(b.achat) + '</td></tr>';
  h += '<tr><td>Frais (notaire + agence)</td><td class="mn">' + fmt(b.frais) + '</td></tr>';
  h += '<tr><td>Travaux \u00e0 l\'achat</td><td class="mn">' + fmt(b.travauxAchat) + '</td></tr>';
  h += '<tr><td>Co\u00fbt de revient total</td><td class="mn">' + fmt(cout) + '</td></tr>';
  h += '<tr><td>Valeur estim\u00e9e actuelle</td><td class="mn" style="color:var(--lime)">' + fmt(b.valeur) + '</td></tr>';
  h += '<tr><td>Plus-value latente</td><td class="mn ' + (b.valeur-cout>=0?'pos':'neg') + '">' + fmt(b.valeur - cout) + '</td></tr>';
  h += '<tr><td>Equity (valeur \u2212 dette)</td><td class="mn" style="color:var(--teal)">' + fmt(equity) + '</td></tr>';
  h += '</table>';
  h += '<div class="sep"><span>Mettre \u00e0 jour l\'estimation</span></div>';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Valeur estim\u00e9e actuelle <em>\u20ac</em></label>';
  h += '<input type="number" id="upd-val-' + id + '" value="' + b.valeur + '" placeholder="160000" oninput="updBien(\'' + id + '\',\'valeur\',this.value)"></div>';
  h += '</div></div>';

  // v2.4 : TABLEAU D'AMORTISSEMENT
  var amort = calcAmortissement(b);
  h += '<div class="sec" data-secid="amortissement">';
  h += '<div class="shd" onclick="togSec(this)"><span class="sttl">&#128200; Tableau d\'amortissement</span><span class="schev">&#9660;</span></div>';
  h += '<div class="sbody">';

  if(!amort){
    h += '<div class="alrt i">Pour afficher le tableau d\'amortissement, renseignez la <strong>date d\'achat</strong> et la <strong>fin de cr\u00e9dit</strong> dans Param\u00e8tres du bien.</div>';
  } else {
    // Alerte si écart > 5% entre capitalDu saisi et CRD théorique
    var ecart = Math.abs(b.capitalDu - amort.crdTheorique);
    var ecartPct = b.capitalDu > 0 ? ecart/b.capitalDu*100 : 0;
    if(ecartPct > 5 && b.capitalDu > 0){
      h += '<div class="alrt w">&#9888; \u00c9cart de '+Math.round(ecartPct)+'% entre le capital restant d\u00fb saisi ('+fmt(b.capitalDu)+') et le th\u00e9orique ('+fmt(amort.crdTheorique)+'). Vérifiez votre tableau de banque ou mettez \u00e0 jour le capital dans la section Cr\u00e9dit.</div>';
    }

    // Synthèse globale
    var totalInterets = interetsTotalCredit(b) || 0;
    var totalCapital  = nv(b.capitalInit);
    var totalRembourse = totalCapital + totalInterets;
    h += '<table class="tbl" style="margin-bottom:12px">';
    h += '<tr><td>Dur\u00e9e totale</td><td class="mn">'+ Math.round(amort.dureeTotaleMois/12*10)/10 +' ans ('+amort.dureeTotaleMois+' mois)</td></tr>';
    h += '<tr><td>Dur\u00e9e \u00e9coul\u00e9e</td><td class="mn">'+Math.floor(amort.dureeEcouleeMois/12)+' ans '+amort.dureeEcouleeMois%12+' mois</td></tr>';
    h += '<tr><td>Dur\u00e9e restante</td><td class="mn">'+Math.floor(amort.dureeRestanteMois/12)+' ans '+amort.dureeRestanteMois%12+' mois</td></tr>';
    h += '<tr><td>Capital emprunt\u00e9</td><td class="mn">'+fmt(totalCapital)+'</td></tr>';
    h += '<tr><td>Total int\u00e9r\u00eats (dur\u00e9e)</td><td class="mn neg">\u2212'+fmt(totalInterets)+'</td></tr>';
    h += '<tr><td>Co\u00fbt total du cr\u00e9dit</td><td class="mn">'+fmt(totalRembourse)+'</td></tr>';
    h += '<tr><td>CRD th\u00e9orique auj.</td><td class="mn neu">'+fmt(amort.crdTheorique)+'</td></tr>';
    h += '<tr><td>Int\u00e9r\u00eats ann\u00e9e en cours</td><td class="mn neg">\u2212'+fmt(interetsAnneeCourante(b))+'</td></tr>';
    h += '</table>';

    // Graphique barres capital/intérêts par année (SVG inline)
    h += '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.6px;color:var(--mist);margin-bottom:8px">R\u00e9partition capital / int\u00e9r\u00eats par ann\u00e9e</div>';
    var annees = [];
    var byYear = {};
    for(var mi=0; mi<amort.tableau.length; mi++){
      var yr = Math.floor(mi/12)+1;
      if(!byYear[yr]) { byYear[yr]={cap:0,int:0}; annees.push(yr); }
      byYear[yr].cap += amort.tableau[mi].capital;
      byYear[yr].int += amort.tableau[mi].interet;
    }
    var maxVal = 0;
    for(var ai=0; ai<annees.length; ai++){
      var tot = byYear[annees[ai]].cap + byYear[annees[ai]].int;
      if(tot > maxVal) maxVal = tot;
    }
    var svgW = 300; var barH = 12; var barGap = 4;
    var svgH = annees.length * (barH + barGap) + 20;
    var scaleX = maxVal > 0 ? (svgW - 60) / maxVal : 1;
    var svgStr = '<svg viewBox="0 0 '+svgW+' '+svgH+'" width="100%" style="max-width:400px;display:block;margin:0 auto 12px">';
    var currentYearIdx = Math.floor(amort.dureeEcouleeMois/12);
    for(var ai=0; ai<annees.length; ai++){
      var yr = annees[ai];
      var y = ai*(barH+barGap);
      var capW = byYear[yr].cap*scaleX;
      var intW = byYear[yr].int*scaleX;
      var isCurrentYear = (ai === currentYearIdx);
      svgStr += '<text x="0" y="'+(y+barH-1)+'" font-family="JetBrains Mono,monospace" font-size="8" fill="'+(isCurrentYear?'#b8f43a':'#4a5068')+'">'+yr+'</text>';
      svgStr += '<rect x="28" y="'+y+'" width="'+capW.toFixed(1)+'" height="'+barH+'" fill="#2dd4bf" rx="2"/>';
      svgStr += '<rect x="'+(28+capW).toFixed(1)+'" y="'+y+'" width="'+intW.toFixed(1)+'" height="'+barH+'" fill="#f87171" rx="2"/>';
    }
    svgStr += '</svg>';
    h += svgStr;
    h += '<div style="display:flex;gap:16px;font-size:11px;color:var(--silver);margin-bottom:12px">';
    h += '<span><span style="display:inline-block;width:10px;height:10px;background:var(--teal);border-radius:2px;margin-right:4px"></span>Capital</span>';
    h += '<span><span style="display:inline-block;width:10px;height:10px;background:var(--rose);border-radius:2px;margin-right:4px"></span>Int\u00e9r\u00eats</span>';
    h += '<span style="color:var(--lime)">&#9632; Ann\u00e9e en cours</span>';
    h += '</div>';

    // Tableau détaillé par année (repliable)
    h += '<div class="sec" style="background:var(--ink3);border-color:var(--line)">';
    h += '<div class="shd" onclick="togSec(this)"><span class="sttl" style="font-size:10px">D\u00e9tail par ann\u00e9e</span><span class="schev">&#9660;</span></div>';
    h += '<div class="sbody">';
    h += '<table class="tbl"><tr><th>Ann\u00e9e</th><th>Capital</th><th>Int\u00e9r\u00eats</th><th>CRD fin</th></tr>';
    for(var ai=0; ai<annees.length; ai++){
      var yr = annees[ai];
      var crdFin = amort.tableau[Math.min(yr*12-1, amort.tableau.length-1)].crd;
      var isCurrentYear = (ai === currentYearIdx);
      var rowStyle = isCurrentYear ? 'color:var(--lime)' : '';
      h += '<tr style="'+rowStyle+'"><td>An '+yr+(isCurrentYear?' &#9650;':'')+'</td>';
      h += '<td class="mn">'+fmt(byYear[yr].cap)+'</td>';
      h += '<td class="mn neg">\u2212'+fmt(byYear[yr].int)+'</td>';
      h += '<td class="mn">'+fmt(crdFin)+'</td></tr>';
    }
    h += '</table></div></div>';
  }
  h += '</div></div>';

  // RENDEMENT (locatif)
  if(b.type === 'loc'){
    h += '<div class="sec open" data-secid="rendement">';
    h += '<div class="shd" onclick="togSec(this)"><span class="sttl">Rendement locatif</span><span class="schev">&#9660;</span></div>';
    h += '<div class="sbody">';

    // ÉTAPE 8 (v6) : détail recettes/dépenses 100% mensuel, poste par poste
    var dTfMens   = nv(b.tf) / 12;
    var dPno      = nv(b.pno);
    var dCopro    = nv(b.copro);
    var dGest     = nv(b.gest);
    var dProvTrav = nv(b.provisionTravaux);
    var dMens     = nv(b.mens);
    var dAssur    = nv(b.assur);
    var dTotalDep = dMens + dAssur + dTfMens + dPno + dCopro + dGest + dProvTrav;

    h += '<table class="tbl">';
    h += '<tr><td style="font-weight:700;color:var(--lime)">&#8593; Loyer mensuel th\u00e9orique</td><td class="mn" style="font-weight:700;color:var(--lime)">+' + fmt(b.loyer) + '</td></tr>';
    if(b.chargesLoc > 0) h += '<tr><td style="color:var(--fog)">Charges locataires (info, non incluses)</td><td class="mn" style="color:var(--fog)">' + fmt(b.chargesLoc) + '/m</td></tr>';
    h += '<tr><td colspan="2" style="padding-top:12px;font-size:10px;text-transform:uppercase;letter-spacing:0.6px;color:var(--mist)">D\u00e9penses mensuelles</td></tr>';
    h += '<tr><td>&#8595; Mensualit\u00e9 cr\u00e9dit</td><td class="mn neg">\u2212' + fmt(dMens) + '</td></tr>';
    if(dAssur > 0)    h += '<tr><td>&#8595; Assurance emprunteur</td><td class="mn neg">\u2212' + fmt(dAssur) + '</td></tr>';
    if(dTfMens > 0)   h += '<tr><td>&#8595; Taxe fonci\u00e8re (' + fmt(b.tf) + '/an \u00f7 12)</td><td class="mn neg">\u2212' + fmt(dTfMens) + '</td></tr>';
    if(dPno > 0)      h += '<tr><td>&#8595; PNO (assurance propri\u00e9taire)</td><td class="mn neg">\u2212' + fmt(dPno) + '</td></tr>';
    if(dCopro > 0)    h += '<tr><td>&#8595; Charges copropriété</td><td class="mn neg">\u2212' + fmt(dCopro) + '</td></tr>';
    if(dGest > 0){
      var gestLbl = b.gestionPct > 0 ? ('&#8595; Gestion locative (' + b.gestionPct + '% du loyer)') : '&#8595; Gestion locative';
      h += '<tr><td>' + gestLbl + '</td><td class="mn neg">\u2212' + fmt(dGest) + '</td></tr>';
    }
    if(dProvTrav > 0) h += '<tr><td>&#8595; Provision travaux</td><td class="mn neg">\u2212' + fmt(dProvTrav) + '</td></tr>';
    h += '<tr><td style="font-weight:700;color:var(--white)">= Total d\u00e9penses /mois</td><td class="mn" style="font-weight:700;color:var(--rose)">\u2212' + fmt(dTotalDep) + '</td></tr>';
    h += '<tr><td colspan="2" style="padding-top:6px"></td></tr>';
    h += '<tr><td style="font-weight:700;color:var(--white);font-size:13px">CASH-FLOW AVANT IMP\u00d4T</td><td class="mn ' + (cf>=0?'pos':'neg') + '" style="font-weight:700;font-size:13px">' + fmt(cf) + '/mois</td></tr>';
    h += '</table>';

    h += '<div class="div"></div>';

    // ÉTAPE 8 (v6) : bloc impôt détaillé et pédagogique
    var idet = calcImpotDetail(b);
    h += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--mist);margin-bottom:8px">Calcul de l\'imp\u00f4t estim\u00e9</div>';
    h += '<table class="tbl">';
    h += '<tr><td>R\u00e9gime fiscal</td><td class="mn">' + regimeLabel(b.regimeFiscal) + '</td></tr>';
    h += '<tr><td>Loyers annuels</td><td class="mn">' + fmt(idet.loyerAn) + '</td></tr>';
    h += '<tr><td>Base imposable</td><td class="mn">' + fmt(idet.assietteAn) + '</td></tr>';
    h += '<tr><td colspan="2" style="font-size:10px;color:var(--fog);padding-top:0;padding-bottom:10px">= ' + idet.abattementTxt + '</td></tr>';
    h += '<tr><td>Taux d\'imposition appliqu\u00e9</td><td class="mn">' + idet.tmi + '% (TMI) + ' + PRELEV_SOCIAUX + '% (pr\u00e9l. sociaux) = ' + idet.tauxGlobal.toFixed(1) + '%</td></tr>';
    h += '<tr><td>Imp\u00f4t annuel estim\u00e9</td><td class="mn neg">' + fmt(idet.impotAn) + '</td></tr>';
    h += '<tr><td style="font-weight:700">= Imp\u00f4t mensuel estim\u00e9</td><td class="mn neg" style="font-weight:700">\u2212' + fmt(idet.impotMens) + '/mois</td></tr>';
    h += '</table>';

    h += '<div class="div"></div>';

    var cfApresImpotBien = cf - idet.impotMens;
    h += '<table class="tbl">';
    h += '<tr><td style="font-weight:700;color:var(--white);font-size:14px">CASH-FLOW APR\u00c8S IMP\u00d4T</td><td class="mn ' + (cfApresImpotBien>=0?'pos':'neg') + '" style="font-weight:700;font-size:14px">' + fmt(cfApresImpotBien) + '/mois</td></tr>';
    h += '</table>';
    h += '<div style="font-size:10px;color:var(--mist);margin-top:8px">* Estimation indicative. Pour le r\u00e9el/LMNP, les int\u00e9r\u00eats d\'emprunt sont approxim\u00e9s (capital restant d\u00fb \u00d7 taux), ce qui surestime l\u00e9g\u00e8rement l\'imp\u00f4t en fin de cr\u00e9dit.</div>';

    h += '<div class="div"></div>';
    h += '<table class="tbl">';
    h += '<tr><td>Loyers annuels bruts</td><td class="mn">' + fmt(loyerAn) + '</td></tr>';
    h += '<tr><td>Loyers nets de charges</td><td class="mn">' + fmt(loyerNet) + '</td></tr>';
    h += '<tr><td>Rendement brut</td><td class="mn neu">' + fmtP(rendBrut) + '</td></tr>';
    h += '<tr><td>Rendement net</td><td class="mn" style="color:var(--lime)">' + fmtP(rendNet) + '</td></tr>';
    h += '</table>';

    h += '</div></div>';


    // SUIVI LOYERS
    h += '<div class="sec open" data-secid="loyers">';
    h += '<div class="shd" onclick="togSec(this)"><span class="sttl">Suivi loyers</span><span class="schev">&#9660;</span></div>';
    h += '<div class="sbody">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
    h += '<span id="lrecap-' + id + '" style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:var(--fog)"></span>';
    h += '<div style="display:flex;gap:6px">';
    h += '<button class="btn bsec bsm" onclick="addMois(\'' + id + '\')">+ Mois</button>';
    h += '<button class="btn bsec bsm" onclick="toutOk(\'' + id + '\')">Tout \u2713</button>';
    h += '</div></div>';
    h += '<div id="lrows-' + id + '"></div>';
    h += '</div></div>';
  }

  // TRAVAUX
  h += '<div class="sec" data-secid="travaux">';
  h += '<div class="shd" onclick="togSec(this)"><span class="sttl">Travaux &amp; d\u00e9penses</span><span class="schev">&#9660;</span></div>';
  h += '<div class="sbody">';
  h += '<div id="tvlist-' + id + '"></div>';
  h += '<div class="sep"><span>Ajouter une d\u00e9pense</span></div>';
  // v2.4b : date complète (type="date" = compatible Firefox/Chrome/Safari) + champs facture
  h += '<div class="r2"><div class="fg" style="margin-top:0"><label class="fl">Date <em>jj/mm/aaaa</em></label><input type="date" id="tv-date-' + id + '"></div>';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Montant <em>\u20ac</em></label><input type="number" id="tv-amt-' + id + '" placeholder="500"></div></div>';
  h += '<div class="fg mt10"><label class="fl">Description des travaux</label><input type="text" id="tv-desc-' + id + '" placeholder="Chauffe-eau, peinture, plomberie..."></div>';
  h += '<div class="r2 mt10">';
  h += '<div class="fg" style="margin-top:0"><label class="fl">N\u00b0 facture <em>optionnel</em></label><input type="text" id="tv-facture-' + id + '" placeholder="FA-2024-001"></div>';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Entreprise <em>optionnel</em></label><input type="text" id="tv-entreprise-' + id + '" placeholder="Plomberie Dupont"></div>';
  h += '</div>';
  h += '<button class="btn bpri bsm mt10" onclick="addTravaux(\'' + id + '\')">+ Enregistrer</button>';
  h += '</div></div>';

  // ÉTAPE 4 (v4) : DOCUMENTS (liens vers Drive avec catégorie)
  h += '<div class="sec" data-secid="documents">';
  h += '<div class="shd" onclick="togSec(this)"><span class="sttl">Documents &amp; liens</span><span class="schev">&#9660;</span></div>';
  h += '<div class="sbody">';
  h += '<div id="doclist-' + id + '"></div>';
  h += '<div class="sep"><span>Ajouter un lien</span></div>';
  h += '<div class="r2">';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Cat\u00e9gorie</label>';
  h += '<select id="doc-cat-' + id + '">';
  var docCats = ['acte','amort','tf','dpe','assur','bail','photo','autre'];
  var docCatLbls = ['Acte/Titre','Amortissement','Taxe fonci\u00e8re','DPE','Assurance','Bail','Photo','Autre'];
  for(var dci=0; dci<docCats.length; dci++){
    h += '<option value="' + docCats[dci] + '">' + docCatLbls[dci] + '</option>';
  }
  h += '</select></div>';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Nom du document</label>';
  h += '<input type="text" id="doc-nom-' + id + '" placeholder="Tableau amortissement 2026"></div>';
  h += '</div>';
  h += '<div class="fg mt10"><label class="fl">Lien <em>Drive, iCloud...</em></label>';
  h += '<input type="text" id="doc-url-' + id + '" placeholder="https://drive.google.com/..."></div>';
  h += '<button class="btn bpri bsm mt10" onclick="addDocument(\'' + id + '\')">+ Ajouter le lien</button>';
  h += '</div></div>';

  // v2.6b : SECTION ASSOCIÉS — uniquement si indivision ou SCI
  if(b.structureAchat === 'indivision' || b.structureAchat === 'sci'){
    h += buildAssociesHTML(b, id);
  }


  // SUPPRIMER
  h += '<div class="arow"><button class="btn bdan" onclick="deleteBien(\'' + id + '\')">&#10005; Supprimer ce bien</button></div>';

  return h;
}

// ═══════════════════════════════════════════════════
// UPDATE BIEN
// ═══════════════════════════════════════════════════
// updBien() — définie dans index.html
// Étape 2 : update champs string (statut, structureAchat)
// updBienStr() — définie dans index.html
// Étape 2 : toggle dashVisible
// toggleDashVisible() — définie dans index.html
// ═══════════════════════════════════════════════════
// ÉTAPE 7 (v6) : CHARGES & LOYER — mise à jour centralisée
// Recalcule gest automatiquement si gestionPct > 0
// ═══════════════════════════════════════════════════
function recalcGestion(b){
  if(b.gestionPct > 0) b.gest = nv(b.loyer) * b.gestionPct / 100;
}

// Met à jour un champ numérique (loyer, tf, pno, copro, chargesLoc, gest, gestionPct)
// puis recalcule gest si nécessaire, puis reconstruit la fiche bien + dashboard
// Déclenché en onchange (à la sortie du champ) pour ne pas perdre le focus pendant la saisie
// updBienCharge() — définie dans index.html
// Mise à jour du loyer théorique : recalcule la gestion ET reconstruit la fiche
// (rendement, CF, impôt, loyers[] affichage en dépendent tous)
// updBienLoyer() — définie dans index.html
// ═══════════════════════════════════════════════════
// v2.3 : ÉDITION COMPLÈTE — informations générales
// Met à jour un champ numérique d'acquisition/crédit
// (achat, frais, travauxAchat, capitalInit) + rebuild complet
// car cout/equity/rendement/plus-value en dépendent tous.
// Déclenché en onchange (sortie du champ).
// ═══════════════════════════════════════════════════
// updBienGeneral() — définie dans index.html
// Met à jour un champ texte (adresse, banque, date, finCredit) — pas besoin de rebuild
// complet pour les champs qui n'impactent aucun calcul, mais on reconstruit pour cohérence
// d'affichage (badges, hero) avec le même garde-fou de préservation des sections ouvertes.
// updBienGeneralStr() — définie dans index.html
// Renommer un bien : met à jour le modèle, l'onglet de navigation, et reconstruit la fiche
// (le nom apparaît dans le hero, le dashboard, le cockpit)
// updBienNom() — définie dans index.html
// ═══════════════════════════════════════════════════
// LOYERS (inchangés)
// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
// ÉTAPE 4 (v4) : LOYERS — vue regroupée par année
// loyers[] inchangé, seul l'affichage change
// ═══════════════════════════════════════════════════
function tauxOccupation(loyersAnnee){
  // % de mois "ok" sur le total de mois renseignés (ok+nok), nd exclus
  var ok=0; var total=0;
  for(var i=0; i<loyersAnnee.length; i++){
    var s = loyersAnnee[i].statut;
    if(s==='ok'){ ok++; total++; }
    else if(s==='nok'){ total++; }
  }
  if(total===0) return null;
  return ok/total*100;
}

// ─── Helpers loyers ──────────────────────────────────
// Retourne la moyenne des loyers encaissés sur les N derniers mois (défaut 3)
// Si aucun mois encaissé → retourne null (on affichera le loyer théorique)
function loyerPercuMoyenne(b, n){
  if(!n) n = 3;
  var now = new Date();
  var moisRecents = [];
  // Construire la liste des N derniers mois YYYY-MM
  for(var i=0; i<n; i++){
    var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    var mo = String(d.getMonth()+1); if(mo.length<2) mo='0'+mo;
    moisRecents.push(d.getFullYear() + '-' + mo);
  }
  var total = 0; var count = 0;
  for(var i=0; i<b.loyers.length; i++){
    var l = b.loyers[i];
    var moisCle = l.mois.slice(0,7); // YYYY-MM depuis YYYY-MM ou YYYY-MM-DD
    for(var j=0; j<moisRecents.length; j++){
      if(moisCle === moisRecents[j] && l.encaisse !== null){
        total += nv(l.encaisse); count++; break;
      }
    }
  }
  return count > 0 ? total / count : null;
}

// Supprime tous les mois d'une année donnée pour un bien
function supprimerAnnee(bid, annee){
  var b = getBien(bid);
  if(!b) return;
  var nb = 0;
  var newLoyers = [];
  for(var i=0; i<b.loyers.length; i++){
    if(b.loyers[i].mois.split('-')[0] === String(annee)) nb++;
    else newLoyers.push(b.loyers[i]);
  }
  if(nb === 0) return;
  if(!confirm('Supprimer les ' + nb + ' mois de l\'ann\u00e9e ' + annee + ' ?\nCette action est irr\u00e9versible.')) return;
  b.loyers = newLoyers;
  renderLoyers(b);
  saveAll();
}
// ─────────────────────────────────────────────────────


// Retourne le Set des années dont le bloc est actuellement ouvert
function getOpenYears(bid){
  var open = {};
  var el = gid('lrows-' + bid);
  if(!el) return open;
  var blocks = el.querySelectorAll('.year-block');
  for(var i=0; i<blocks.length; i++){
    if(blocks[i].classList.contains('open')){
      // L'id est "yb-{bid}-{year}"
      var parts = blocks[i].id.split('-');
      var y = parts[parts.length-1];
      open[y] = true;
    }
  }
  return open;
}

// Réouvre les blocs dont l'année était dans openSet
// Si openSet est vide (premier render), ouvre uniquement l'année en cours
function restoreOpenYears(bid, openSet, currentYear){
  var el = gid('lrows-' + bid);
  if(!el) return;
  var blocks = el.querySelectorAll('.year-block');
  var hadOpen = false;
  for(var k in openSet){ if(openSet.hasOwnProperty(k)){ hadOpen = true; break; } }
  for(var i=0; i<blocks.length; i++){
    var parts = blocks[i].id.split('-');
    var y = parts[parts.length-1];
    if(hadOpen ? openSet[y] : y === currentYear){
      blocks[i].classList.add('open');
    }
  }
}
// ─────────────────────────────────────────────────────

function renderLoyers(b){
  var el = gid('lrows-' + b.id); if(!el) return;

  // Mémoriser les blocs ouverts AVANT de reconstruire
  var openBefore = getOpenYears(b.id);

  // Grouper par année
  var byYear = {};
  var years = [];
  for(var i=0; i<b.loyers.length; i++){
    var l = b.loyers[i];
    var y = l.mois.split('-')[0];
    if(!byYear[y]){ byYear[y]=[]; years.push(y); }
    byYear[y].push({l:l, idx:i});
  }
  years.sort(function(a,z){ return z < a ? -1 : 1; }); // années récentes en premier

  var encTotalGlobal=0; var prevTotalGlobal=0; var nbGlobal=0;
  var currentYear = String(new Date().getFullYear());

  var html='';
  for(var yi=0; yi<years.length; yi++){
    var y = years[yi];
    var rows = byYear[y].slice().reverse(); // mois récents en premier dans l'année

    var encY=0; var prevY=0; var nbY=0;
    for(var i=0; i<byYear[y].length; i++){
      var l = byYear[y][i].l;
      var enc = l.encaisse!==null ? nv(l.encaisse) : 0;
      var prev = nv(l.prevu);
      if(l.encaisse!==null){ encY+=enc; nbY++; encTotalGlobal+=enc; nbGlobal++; }
      prevY+=prev; prevTotalGlobal+=prev;
    }
    var occ = tauxOccupation(byYear[y]);
    var occTxt = occ===null ? '\u2014' : fmtP(occ,0);
    var occColor = occ===null ? 'var(--mist)' : occ>=95 ? 'var(--lime)' : occ>=80 ? 'var(--amber)' : 'var(--rose)';

    // Pas de classe open ici — restoreOpenYears s'en charge après injection
    html += '<div class="year-block" id="yb-' + b.id + '-' + y + '">';
    // year-hd divisé : clic gauche = toggle, bouton suppr à droite isolé
    html += '<div class="year-hd" style="cursor:default">';
    html += '<span class="year-title" onclick="this.closest(\'.year-block\').classList.toggle(\'open\')" style="cursor:pointer;flex:1">' + y + '</span>';
    html += '<span class="year-stats" onclick="this.closest(\'.year-block\').classList.toggle(\'open\')" style="cursor:pointer">';
    html += '<span style="color:' + occColor + '">' + occTxt + ' occ.</span>';
    html += '<span class="sep-dot">\u00b7</span>';
    html += '<span>' + fmt(encY) + ' / ' + fmt(prevY) + '</span>';
    html += '<span class="year-chev">\u25be</span>';
    html += '</span>';
    html += '<button class="btn bdan bico" style="margin-left:8px;width:26px;height:26px;flex-shrink:0" onclick="event.stopPropagation();supprimerAnnee(\'' + b.id + '\',\'' + y + '\')" title="Supprimer l\'ann\u00e9e ' + y + '">&#128465;</button>';
    html += '</div>';
    html += '<div class="year-body">';

    for(var i=0; i<rows.length; i++){
      var l = rows[i].l; var idx = rows[i].idx;
      var enc = l.encaisse !== null ? nv(l.encaisse) : 0;
      var prev = nv(l.prevu);
      var delta = l.encaisse !== null ? enc - prev : null;
      var sc = l.statut === 'ok' ? 'lok' : l.statut === 'nok' ? 'lnok' : 'lnd';
      var si = l.statut === 'ok' ? '\u2713' : l.statut === 'nok' ? '\u2717' : '\u00b7';
      var dClass = delta === null ? '' : (delta >= 0 ? 'up' : 'dn');
      var dTxt = delta === null ? '\u2014' : (delta >= 0 ? '+' : '') + Math.round(delta) + ' \u20ac';
      var valStr = l.encaisse !== null ? l.encaisse : '';
      html += '<div class="lrow">';
      html += '<span class="lmois">' + moisLbl(l.mois) + '</span>';
      html += '<div class="linput"><input type="number" value="' + valStr + '" placeholder="' + l.prevu + '" oninput="updLoyer(\'' + b.id + '\',' + idx + ',this.value)"></div>';
      html += '<div class="lstatus ' + sc + '" onclick="cycleLoyer(\'' + b.id + '\',' + idx + ')">' + si + '</div>';
      html += '<div class="ldelta ' + dClass + '">' + dTxt + '</div>';
      html += '</div>';
    }
    html += '</div></div>';
  }

  if(!years.length){
    html = '<div class="empty" style="padding:16px">Aucun mois enregistr\u00e9. Cliquez sur "+ Mois".</div>';
  }

  el.innerHTML = html;

  // Restaurer l'état ouvert/fermé après injection
  restoreOpenYears(b.id, openBefore, currentYear);

  var recap = gid('lrecap-' + b.id);
  if(recap) recap.textContent = nbGlobal + ' mois \u00b7 Encaiss\u00e9 : ' + fmt(encTotalGlobal) + ' \u00b7 Pr\u00e9vu : ' + fmt(prevTotalGlobal);
}

function updLoyer(bid, idx, val){
  var b = getBien(bid);
  if(!b) return;
  var l = b.loyers[idx];
  l.encaisse = val === '' ? null : nv(val);
  l.statut = val === '' ? 'nd' : (nv(val) >= nv(l.prevu) ? 'ok' : 'nok');
  // Mise à jour partielle : seulement le récap + statut de la ligne, pas tout le render
  // pour ne pas interrompre la saisie en cours
  var sc = l.statut === 'ok' ? 'lok' : l.statut === 'nok' ? 'lnok' : 'lnd';
  var si = l.statut === 'ok' ? '\u2713' : l.statut === 'nok' ? '\u2717' : '\u00b7';
  // On update le récap global seulement (render complet déclenché au saveAll)
  saveAll();
  // Refresh léger des récaps sans reconstruire le DOM complet
  var encTotal=0; var prevTotal=0; var nbTotal=0;
  for(var i=0; i<b.loyers.length; i++){
    var lo=b.loyers[i];
    if(lo.encaisse!==null){ encTotal+=nv(lo.encaisse); nbTotal++; }
    prevTotal+=nv(lo.prevu);
  }
  var recap = gid('lrecap-' + bid);
  if(recap) recap.textContent = nbTotal + ' mois \u00b7 Encaiss\u00e9 : ' + fmt(encTotal) + ' \u00b7 Pr\u00e9vu : ' + fmt(prevTotal);
}

function cycleLoyer(bid, idx){
  var b = getBien(bid);
  if(!b) return;
  var l = b.loyers[idx];
  var next = {nd:'ok', ok:'nok', nok:'nd'};
  l.statut = next[l.statut] || 'nd';
  if(l.statut === 'ok' && l.encaisse === null) l.encaisse = l.prevu;
  if(l.statut === 'nd') l.encaisse = null;
  renderLoyers(b);
  saveAll();
}

function toutOk(bid){
  var b = getBien(bid);
  if(!b) return;
  for(var i=0; i<b.loyers.length; i++){
    var l = b.loyers[i];
    if(l.statut === 'nd'){ l.encaisse = l.prevu; l.statut = 'ok'; }
  }
  renderLoyers(b);
  saveAll();
}

function addMois(bid){
  var b = getBien(bid);
  if(!b) return;
  var existing = {};
  for(var i=0; i<b.loyers.length; i++) existing[b.loyers[i].mois] = true;
  var now = new Date();
  // Cherche le prochain mois manquant dans les 36 prochains mois
  for(var i=0; i<36; i++){
    var d = new Date(now.getFullYear(), now.getMonth()+i, 1);
    var mo = String(d.getMonth()+1); if(mo.length<2) mo='0'+mo;
    var key = d.getFullYear() + '-' + mo;
    if(!existing[key]){
      b.loyers.push({mois:key, prevu:b.loyer, encaisse:null, statut:'nd'});
      b.loyers.sort(function(a,z){ return a.mois < z.mois ? -1 : 1; });
      renderLoyers(b); // préserve les blocs ouverts grâce à getOpenYears/restoreOpenYears
      saveAll();
      return;
    }
  }
}

// Génération automatique des mois manquants de l'année en cours (appelée au chargement)
function autoGenererMoisAnnee(b){
  if(b.type !== 'loc') return false;
  var now = new Date();
  var year = now.getFullYear();
  var monthNow = now.getMonth(); // 0-indexed
  var existing = {};
  for(var i=0; i<b.loyers.length; i++) existing[b.loyers[i].mois] = true;
  var added = false;
  for(var m=0; m<=monthNow; m++){
    var mo = String(m+1); if(mo.length<2) mo='0'+mo;
    var key = year + '-' + mo;
    if(!existing[key]){
      b.loyers.push({mois:key, prevu:b.loyer, encaisse:null, statut:'nd'});
      added = true;
    }
  }
  if(added) b.loyers.sort(function(a,z){ return a.mois < z.mois ? -1 : 1; });
  return added;
}

// ═══════════════════════════════════════════════════
// TRAVAUX (inchangés)
// ═══════════════════════════════════════════════════
function addTravaux(bid){
  var b = null;
  for(var i=0; i<S.biens.length; i++){ if(S.biens[i].id === bid){ b = S.biens[i]; break; } }
  if(!b) return;
  var desc      = gid('tv-desc-'       + bid) ? gid('tv-desc-'       + bid).value.trim() : '';
  var amt       = gid('tv-amt-'        + bid) ? nv(gid('tv-amt-'     + bid).value)       : 0;
  // v2.4b : date facultative (ne bloque plus si vide), facture + entreprise optionnels
  var date      = gid('tv-date-'       + bid) ? gid('tv-date-'       + bid).value        : '';
  var facture   = gid('tv-facture-'    + bid) ? gid('tv-facture-'    + bid).value.trim() : '';
  var entreprise= gid('tv-entreprise-' + bid) ? gid('tv-entreprise-' + bid).value.trim() : '';
  // Seuls la description ET le montant sont obligatoires
  if(!desc){ alert('Merci de renseigner une description.'); return; }
  if(!amt){  alert('Merci de renseigner un montant.'); return; }
  b.travaux.unshift({date:date, amt:amt, desc:desc, facture:facture, entreprise:entreprise});
  renderTravaux(b);
  if(gid('tv-date-'        + bid)) gid('tv-date-'        + bid).value = '';
  if(gid('tv-amt-'         + bid)) gid('tv-amt-'         + bid).value = '';
  if(gid('tv-desc-'        + bid)) gid('tv-desc-'        + bid).value = '';
  if(gid('tv-facture-'     + bid)) gid('tv-facture-'     + bid).value = '';
  if(gid('tv-entreprise-'  + bid)) gid('tv-entreprise-'  + bid).value = '';
  saveAll();
}

function renderTravaux(b){
  var el = gid('tvlist-' + b.id); if(!el) return;
  if(!b.travaux.length){ el.innerHTML = '<div class="empty" style="padding:16px">Aucune d\u00e9pense enregistr\u00e9e.</div>'; return; }
  var total = 0;
  for(var i=0; i<b.travaux.length; i++) total += nv(b.travaux[i].amt);
  var html = '<div style="font-family:\'JetBrains Mono\',monospace;font-size:10px;color:var(--fog);margin-bottom:6px">Total : ' + fmt(total) + '</div>';
  for(var i=0; i<b.travaux.length; i++){
    var t = b.travaux[i]; var idx = i;
    var dateLbl = '\u2014';
    if(t.date){
      if(t.date.length === 10){
        var dp = t.date.split('-');
        dateLbl = dp[2] + '/' + dp[1] + '/' + dp[0];
      } else if(t.date.length === 7){
        dateLbl = moisLbl(t.date);
      }
    }
    // Mode normal (lecture)
    html += '<div class="tv-row" id="tvrow-' + b.id + '-' + idx + '">';
    html += '<div class="tv-date" style="font-size:10px">' + dateLbl + '</div>';
    html += '<div class="tv-desc">';
    html += '<div>' + t.desc + '</div>';
    if(t.entreprise) html += '<div style="font-size:10px;color:var(--fog);margin-top:2px">' + t.entreprise + '</div>';
    if(t.facture)    html += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:9px;color:var(--mist);margin-top:1px">N\u00b0 ' + t.facture + '</div>';
    html += '</div>';
    html += '<div style="display:flex;align-items:center;gap:5px;flex-shrink:0">';
    html += '<div class="tv-amt">\u2212' + fmt(t.amt) + '</div>';
    html += '<button class="btn bsec bico" onclick="editTravaux(\'' + b.id + '\',' + idx + ')" title="Modifier">&#9998;</button>';
    html += '<button class="btn bdan bico" onclick="rmTravaux(\'' + b.id + '\',' + idx + ')" title="Supprimer">&#10005;</button>';
    html += '</div></div>';
  }
  el.innerHTML = html;
}

// Bascule une ligne travaux en mode édition inline
function editTravaux(bid, idx){
  var b = null;
  for(var i=0; i<S.biens.length; i++){ if(S.biens[i].id === bid){ b = S.biens[i]; break; } }
  if(!b) return;
  var t = b.travaux[idx];
  var row = gid('tvrow-' + bid + '-' + idx);
  if(!row) return;
  row.innerHTML =
    '<div style="width:100%;display:flex;flex-direction:column;gap:7px;padding:6px 0">' +
    '<div class="r2">' +
    '<div class="fg" style="margin-top:0"><label class="fl">Date</label>' +
    '<input type="date" id="tved-date-'+bid+'-'+idx+'" value="'+(t.date||'')+'"></div>' +
    '<div class="fg" style="margin-top:0"><label class="fl">Montant \u20ac</label>' +
    '<input type="number" id="tved-amt-'+bid+'-'+idx+'" value="'+t.amt+'"></div>' +
    '</div>' +
    '<div class="fg" style="margin-top:0"><label class="fl">Description</label>' +
    '<input type="text" id="tved-desc-'+bid+'-'+idx+'" value="'+t.desc+'"></div>' +
    '<div class="r2">' +
    '<div class="fg" style="margin-top:0"><label class="fl">Entreprise</label>' +
    '<input type="text" id="tved-entr-'+bid+'-'+idx+'" value="'+(t.entreprise||'')+'"></div>' +
    '<div class="fg" style="margin-top:0"><label class="fl">N\u00b0 facture</label>' +
    '<input type="text" id="tved-fact-'+bid+'-'+idx+'" value="'+(t.facture||'')+'"></div>' +
    '</div>' +
    '<div style="display:flex;gap:7px">' +
    '<button class="btn bpri bsm" onclick="saveEditTravaux(\''+bid+'\','+idx+')">&#10003; Enregistrer</button>' +
    '<button class="btn bsec bsm" onclick="renderTravaux(getBien(\''+bid+'\'))">Annuler</button>' +
    '</div></div>';
}

// Helper pour récupérer un bien par id
function getBien(bid){
  for(var i=0; i<S.biens.length; i++){ if(S.biens[i].id === bid) return S.biens[i]; }
  return null;
}

// ═══════════════════════════════════════════════════
// v2.6b : PROFILS ASSOCIÉS — indivision / SCI
// ═══════════════════════════════════════════════════

// Calcule la capacité d'emprunt combinée pour un bien en indivision/SCI
// Retourne un objet détaillé pour affichage pédagogique
function calcCapaciteIndivision(b, cfgTauxMax, cfgLoyersPct){
  var profiles = b.associesProfiles || [];
  if(!profiles.length) return null;

  var tauxMax  = nv(cfgTauxMax)  || 35;
  var loyPct   = nv(cfgLoyersPct)|| 70;

  var totalRevenus = 0; var totalMensualites = 0;
  for(var i=0; i<profiles.length; i++){
    totalRevenus      += nv(profiles[i].revenusMensuel);
    totalMensualites  += nv(profiles[i].mensualitesExistantes);
  }

  // Loyers retenus par la banque (70% des loyers du bien si locatif)
  var loyersBanque = b.type === 'loc' ? nv(b.loyer) * loyPct / 100 : 0;
  var revenusBanque = totalRevenus + loyersBanque;

  // Capacité d'endettement max mensuelle
  var capaciteMax = revenusBanque * tauxMax / 100;

  // Mensualités actuelles = mensualités existantes de tous + mensualité du bien courant
  var mensuellesBien = nv(b.mens) + nv(b.assur);
  var mensualitesTotales = totalMensualites + mensuellesBien;

  // Capacité restante
  var capaciteRestante = capaciteMax - mensualitesTotales;
  var tauxActuel = revenusBanque > 0 ? mensualitesTotales / revenusBanque * 100 : 0;

  return {
    profiles:           profiles,
    totalRevenus:       totalRevenus,
    totalMensualites:   totalMensualites,
    loyersBanque:       loyersBanque,
    revenusBanque:      revenusBanque,
    capaciteMax:        capaciteMax,
    mensuellesBien:     mensuellesBien,
    mensualitesTotales: mensualitesTotales,
    capaciteRestante:   capaciteRestante,
    tauxActuel:         tauxActuel,
    tauxMax:            tauxMax
  };
}

// Ajoute un associé au bien
// Ajoute un associé au bien — render partiel, pas de rebuild complet
function addAssocieProfil(bid){
  var b = getBien(bid);
  if(!b) return;
  var nom  = gid('ap-nom-'  + bid) ? gid('ap-nom-'  + bid).value.trim() : '';
  var rev  = gid('ap-rev-'  + bid) ? nv(gid('ap-rev-'  + bid).value)    : 0;
  var mens = gid('ap-mens-' + bid) ? nv(gid('ap-mens-' + bid).value)    : 0;
  var qp   = gid('ap-qp-'   + bid) ? nv(gid('ap-qp-'   + bid).value)   : 0;
  if(!nom){ alert('Le nom de l\'associ\u00e9 est obligatoire.'); return; }
  b.associesProfiles.push({ nom:nom, revenusMensuel:rev, mensualitesExistantes:mens, quotePart:qp });
  // Vider le formulaire sans toucher à la section
  if(gid('ap-nom-'  + bid)) gid('ap-nom-'  + bid).value = '';
  if(gid('ap-rev-'  + bid)) gid('ap-rev-'  + bid).value = '';
  if(gid('ap-mens-' + bid)) gid('ap-mens-' + bid).value = '';
  if(gid('ap-qp-'   + bid)) gid('ap-qp-'   + bid).value = '';
  renderAssocies(b);
  saveAll();
}

// Supprime un associé — render partiel
function rmAssocieProfil(bid, idx){
  var b = getBien(bid);
  if(!b) return;
  if(!confirm('Supprimer le profil de "' + b.associesProfiles[idx].nom + '" ?')) return;
  b.associesProfiles.splice(idx, 1);
  renderAssocies(b);
  saveAll();
}

// Génère le HTML de la section Associés pour bienHTML()
function buildAssociesHTML(b, id){
  var h = '';
  h += '<div class="sec" data-secid="associes">';
  h += '<div class="shd" onclick="togSec(this)"><span class="sttl">&#128101; Profils associ\u00e9s &amp; capacit\u00e9</span><span class="schev">&#9660;</span></div>';
  h += '<div class="sbody">';
  // Zone liste + calcul (mise à jour par renderAssocies sans toucher au formulaire)
  h += '<div id="ap-list-' + id + '"></div>';
  // Formulaire ajout (stable — jamais reconstruit)
  h += '<div class="sep"><span>Ajouter un associ\u00e9</span></div>';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Nom / pr\u00e9nom</label>';
  h += '<input type="text" id="ap-nom-' + id + '" placeholder="Sophie, Maman..."></div>';
  h += '<div class="r2 mt10">';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Revenus mensuels nets <em>\u20ac</em></label>';
  h += '<input type="number" id="ap-rev-' + id + '" placeholder="2500"></div>';
  h += '<div class="fg" style="margin-top:0"><label class="fl">Mensualit\u00e9s existantes <em>\u20ac/m</em></label>';
  h += '<input type="number" id="ap-mens-' + id + '" placeholder="0"></div>';
  h += '</div>';
  h += '<div class="fg mt10"><label class="fl">Quote-part <em>% optionnel</em></label>';
  h += '<input type="number" id="ap-qp-' + id + '" placeholder="50" min="0" max="100"></div>';
  h += '<button class="btn bpri bsm mt10" onclick="addAssocieProfil(\'' + id + '\')">+ Ajouter ce profil</button>';
  h += '<div style="font-size:10px;color:var(--mist);margin-top:8px">* Mensualit\u00e9s <strong>hors ce bien</strong> (autres cr\u00e9dits existants de chaque associ\u00e9).</div>';
  h += '</div></div>';
  return h;
}

// Render partiel — ne touche que ap-list-{id}, preserves formulaire et scroll
function renderAssocies(b){
  var el = gid('ap-list-' + b.id);
  if(!el) return;
  var cfg = S.config;
  var id = b.id;
  var h = '';

  if(!b.associesProfiles.length){
    h += '<div class="alrt i" style="margin-bottom:10px">Ajoutez les profils de chaque associ\u00e9 pour calculer la capacit\u00e9 d\'emprunt combin\u00e9e.</div>';
    el.innerHTML = h;
    return;
  }

  // Tableau profils avec boutons ✏️ et ✗
  h += '<table class="tbl" style="margin-bottom:12px">';
  h += '<tr><th>Associ\u00e9</th><th>Revenus /m</th><th>Mens. exist.</th><th>Quote-part</th><th></th></tr>';
  for(var i=0; i<b.associesProfiles.length; i++){
    var ap = b.associesProfiles[i];
    h += '<tr id="aprow-' + id + '-' + i + '">';
    h += '<td style="font-weight:600;color:var(--snow)">' + ap.nom + '</td>';
    h += '<td class="mn">' + fmt(ap.revenusMensuel) + '</td>';
    h += '<td class="mn neg">' + fmt(ap.mensualitesExistantes) + '</td>';
    h += '<td class="mn">' + (ap.quotePart > 0 ? ap.quotePart + '%' : '\u2014') + '</td>';
    h += '<td style="display:flex;gap:4px">';
    h += '<button class="btn bsec bico" onclick="editAssocieProfil(\'' + id + '\',' + i + ')" title="Modifier">&#9998;</button>';
    h += '<button class="btn bdan bico" onclick="rmAssocieProfil(\'' + id + '\',' + i + ')" title="Supprimer">&#10005;</button>';
    h += '</td></tr>';
  }
  h += '</table>';

  // Calcul capacité combinée
  var cap = calcCapaciteIndivision(b, cfg.tauxEndettementMax, cfg.loyersPrisEnCompte);
  if(cap){
    h += '<div class="sep"><span>Capacit\u00e9 d\'emprunt combin\u00e9e</span></div>';
    h += '<div class="alrt i" style="margin-bottom:10px">Estimation indicative. Taux max : ' + cap.tauxMax + '%. Chaque banque a ses crit\u00e8res.</div>';
    h += '<table class="tbl">';
    h += '<tr><td>Revenus mensuels cumul\u00e9s</td><td class="mn">' + fmt(cap.totalRevenus) + '</td></tr>';
    if(cap.loyersBanque > 0) h += '<tr><td>Loyers retenus banque (70%)</td><td class="mn up">+' + fmt(cap.loyersBanque) + '</td></tr>';
    h += '<tr><td>Revenus bancaires totaux</td><td class="mn" style="font-weight:700">' + fmt(cap.revenusBanque) + '</td></tr>';
    h += '<tr><td>Mensualit\u00e9s existantes cumul\u00e9es</td><td class="mn neg">\u2212' + fmt(cap.totalMensualites) + '</td></tr>';
    h += '<tr><td>Mensualit\u00e9 du bien (cr\u00e9dit + assur.)</td><td class="mn neg">\u2212' + fmt(cap.mensuellesBien) + '</td></tr>';
    h += '<tr><td>Total mensualit\u00e9s</td><td class="mn neg" style="font-weight:700">' + fmt(cap.mensualitesTotales) + '</td></tr>';
    var tColor = cap.tauxActuel > cap.tauxMax ? 'var(--rose)' : cap.tauxActuel > cap.tauxMax*0.85 ? 'var(--amber)' : 'var(--lime)';
    h += '<tr><td>Taux d\'endettement actuel</td><td class="mn" style="color:' + tColor + ';font-weight:700">' + fmtP(cap.tauxActuel) + '</td></tr>';
    h += '<tr><td>Mensualit\u00e9 max (taux ' + cap.tauxMax + '%)</td><td class="mn">' + fmt(cap.capaciteMax) + '</td></tr>';
    h += '<tr><td style="font-weight:700;color:var(--white)">Capacit\u00e9 restante estim\u00e9e</td>';
    h += '<td class="mn" style="color:' + (cap.capaciteRestante>=0?'var(--teal)':'var(--rose)') + ';font-weight:700">' + fmt(Math.max(0,cap.capaciteRestante)) + '/mois</td></tr>';
    h += '</table>';
    var gPct = Math.min(100, cap.tauxActuel).toFixed(1);
    h += '<div style="font-size:11px;color:var(--fog);margin:10px 0 4px">Taux d\'endettement · objectif max ' + cap.tauxMax + '%</div>';
    h += '<div class="gauge-endo"><div class="gauge-fill" style="width:' + gPct + '%;background:' + tColor + '"></div></div>';
    if(cap.profiles.length > 1){
      h += '<div class="sep"><span>D\u00e9tail par associ\u00e9</span></div>';
      h += '<table class="tbl">';
      h += '<tr><th>Associ\u00e9</th><th>Revenus</th><th>Mens.</th><th>Taux</th></tr>';
      for(var i=0; i<cap.profiles.length; i++){
        var ap = cap.profiles[i];
        var revAp = nv(ap.revenusMensuel);
        var mensAp = nv(ap.mensualitesExistantes);
        var tauxAp = revAp > 0 ? mensAp/revAp*100 : 0;
        var tcAp = tauxAp > cap.tauxMax ? 'var(--rose)' : tauxAp > cap.tauxMax*0.85 ? 'var(--amber)' : 'var(--lime)';
        h += '<tr><td style="color:var(--snow)">' + ap.nom + '</td>';
        h += '<td class="mn">' + fmt(revAp) + '</td>';
        h += '<td class="mn neg">' + fmt(mensAp) + '</td>';
        h += '<td class="mn" style="color:' + tcAp + '">' + fmtP(tauxAp) + '</td></tr>';
      }
      h += '</table>';
    }
  }
  el.innerHTML = h;
}

// Bascule une ligne associé en mode édition inline (comme editTravaux)
function editAssocieProfil(bid, idx){
  var b = getBien(bid);
  if(!b) return;
  var ap = b.associesProfiles[idx];
  var row = gid('aprow-' + bid + '-' + idx);
  if(!row) return;
  row.innerHTML =
    '<td colspan="5" style="padding:8px 0"><div style="display:flex;flex-direction:column;gap:7px">' +
    '<div class="r2">' +
    '<div class="fg" style="margin-top:0"><label class="fl">Nom</label>' +
    '<input type="text" id="ape-nom-'+bid+'-'+idx+'" value="'+ap.nom+'"></div>' +
    '<div class="fg" style="margin-top:0"><label class="fl">Quote-part %</label>' +
    '<input type="number" id="ape-qp-'+bid+'-'+idx+'" value="'+(ap.quotePart||'')+'"></div>' +
    '</div>' +
    '<div class="r2">' +
    '<div class="fg" style="margin-top:0"><label class="fl">Revenus /mois</label>' +
    '<input type="number" id="ape-rev-'+bid+'-'+idx+'" value="'+ap.revenusMensuel+'"></div>' +
    '<div class="fg" style="margin-top:0"><label class="fl">Mens. existantes</label>' +
    '<input type="number" id="ape-mens-'+bid+'-'+idx+'" value="'+ap.mensualitesExistantes+'"></div>' +
    '</div>' +
    '<div style="display:flex;gap:7px">' +
    '<button class="btn bpri bsm" onclick="saveEditAssocieProfil(\''+bid+'\','+idx+')">&#10003; Enregistrer</button>' +
    '<button class="btn bsec bsm" onclick="renderAssocies(getBien(\''+bid+'\'))">Annuler</button>' +
    '</div></div></td>';
}

// Sauvegarde l'édition inline d'un associé
function saveEditAssocieProfil(bid, idx){
  var b = getBien(bid);
  if(!b) return;
  var nom = gid('ape-nom-' +bid+'-'+idx);
  if(!nom || !nom.value.trim()){ alert('Le nom est obligatoire.'); return; }
  b.associesProfiles[idx].nom                  = nom.value.trim();
  b.associesProfiles[idx].revenusMensuel       = nv(gid('ape-rev-' +bid+'-'+idx) ? gid('ape-rev-' +bid+'-'+idx).value  : 0);
  b.associesProfiles[idx].mensualitesExistantes= nv(gid('ape-mens-'+bid+'-'+idx) ? gid('ape-mens-'+bid+'-'+idx).value : 0);
  b.associesProfiles[idx].quotePart            = nv(gid('ape-qp-'  +bid+'-'+idx) ? gid('ape-qp-'  +bid+'-'+idx).value  : 0);
  renderAssocies(b);
  saveAll();
}

// Sauvegarde les modifications inline d'une ligne travaux
function saveEditTravaux(bid, idx){
  var b = getBien(bid);
  if(!b) return;
  var desc = gid('tved-desc-'+bid+'-'+idx);
  var amt  = gid('tved-amt-' +bid+'-'+idx);
  if(!desc || !amt) return;
  if(!desc.value.trim()){ alert('La description est obligatoire.'); return; }
  if(!nv(amt.value)){     alert('Le montant est obligatoire.'); return; }
  b.travaux[idx].date       = gid('tved-date-'+bid+'-'+idx) ? gid('tved-date-'+bid+'-'+idx).value : '';
  b.travaux[idx].amt        = nv(amt.value);
  b.travaux[idx].desc       = desc.value.trim();
  b.travaux[idx].entreprise = gid('tved-entr-'+bid+'-'+idx) ? gid('tved-entr-'+bid+'-'+idx).value.trim() : '';
  b.travaux[idx].facture    = gid('tved-fact-'+bid+'-'+idx) ? gid('tved-fact-'+bid+'-'+idx).value.trim() : '';
  renderTravaux(b);
  saveAll();
}

function rmTravaux(bid, idx){
  var b = getBien(bid);
  if(!b) return;
  if(!confirm('Supprimer cette d\u00e9pense ?')) return;
  b.travaux.splice(idx, 1);
  renderTravaux(b);
  saveAll();
}

// ═══════════════════════════════════════════════════
// ÉTAPE 4 (v4) : DOCUMENTS — liens vers Drive avec catégorie
// ═══════════════════════════════════════════════════
var DOC_CAT_LABELS = {acte:'Acte',amort:'Amort.',tf:'TF',dpe:'DPE',assur:'Assur.',bail:'Bail',photo:'Photo',autre:'Autre'};
var DOC_CAT_CLASS  = {acte:'doc-cat-acte',amort:'doc-cat-amort',tf:'doc-cat-tf',dpe:'doc-cat-dpe',assur:'doc-cat-assur',bail:'doc-cat-bail',photo:'doc-cat-photo',autre:''};

// Détecte si une URL pointe vers une image (extension ou domaine Drive avec &export=view)
function isImageUrl(url){
  if(!url) return false;
  var low = url.toLowerCase();
  // Extensions image directes
  if(/\.(jpg|jpeg|png|gif|webp|heic)(\?|$)/.test(low)) return true;
  // Google Drive avec paramètre export=view ou lh3.googleusercontent
  if(low.indexOf('lh3.googleusercontent') >= 0) return true;
  if(low.indexOf('drive.google.com') >= 0 && low.indexOf('export=view') >= 0) return true;
  // iCloud shared photo
  if(low.indexOf('icloud.com') >= 0 && low.indexOf('photo') >= 0) return true;
  return false;
}

// Convertit un lien Google Drive partagé en lien d'affichage direct
// drive.google.com/file/d/{ID}/view → drive.google.com/thumbnail?id={ID}&sz=w400
function driveThumbUrl(url){
  var m = url.match(/\/file\/d\/([^\/\?]+)/);
  if(m) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w400';
  return url;
}

function addDocument(bid){
  var b = null;
  for(var i=0; i<S.biens.length; i++){ if(S.biens[i].id === bid){ b = S.biens[i]; break; } }
  if(!b) return;
  var cat  = gid('doc-cat-' + bid) ? gid('doc-cat-' + bid).value : 'autre';
  var nom  = gid('doc-nom-' + bid) ? gid('doc-nom-' + bid).value.trim() : '';
  var url  = gid('doc-url-' + bid) ? gid('doc-url-' + bid).value.trim() : '';
  if(!nom || !url) return;
  // Sécurité basique : préfixer avec https:// si absent
  if(url.indexOf('http://')!==0 && url.indexOf('https://')!==0) url = 'https://' + url;
  b.documents.push({cat:cat, nom:nom, url:url});
  renderDocuments(b);
  if(gid('doc-nom-' + bid)) gid('doc-nom-' + bid).value = '';
  if(gid('doc-url-' + bid)) gid('doc-url-' + bid).value = '';
  saveAll();
}

function renderDocuments(b){
  var el = gid('doclist-' + b.id); if(!el) return;
  if(!b.documents.length){ el.innerHTML = '<div class="empty" style="padding:16px">Aucun document li\u00e9. Ajoutez vos liens Drive ci-dessous.</div>'; return; }

  var html = '';
  // Séparer photos et documents
  var photos = []; var docs = [];
  for(var i=0; i<b.documents.length; i++){
    if(b.documents[i].cat === 'photo') photos.push({d:b.documents[i],idx:i});
    else docs.push({d:b.documents[i],idx:i});
  }

  // Grille photos
  if(photos.length){
    html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px">';
    for(var i=0; i<photos.length; i++){
      var p = photos[i].d; var idx = photos[i].idx;
      var thumbUrl = driveThumbUrl(p.url);
      html += '<div style="position:relative;border-radius:var(--rs);overflow:hidden;border:1px solid var(--line)">';
      html += '<a href="' + p.url + '" target="_blank" rel="noopener">';
      html += '<img src="' + thumbUrl + '" alt="' + p.nom + '" style="width:100%;height:110px;object-fit:cover;display:block" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">';
      html += '<div style="display:none;height:110px;align-items:center;justify-content:center;font-size:28px;background:var(--ink3)">&#128247;</div>';
      html += '</a>';
      html += '<div style="padding:5px 8px;display:flex;align-items:center;justify-content:space-between">';
      html += '<span style="font-size:10px;color:var(--silver);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + p.nom + '</span>';
      html += '<button class="btn bdan bico" style="width:22px;height:22px;flex-shrink:0" onclick="rmDocument(\'' + b.id + '\',' + idx + ')">&#10005;</button>';
      html += '</div></div>';
    }
    html += '</div>';
  }

  // Liste documents
  for(var i=0; i<docs.length; i++){
    var d = docs[i].d; var idx = docs[i].idx;
    var catLbl = DOC_CAT_LABELS[d.cat] || 'Autre';
    var catCls = DOC_CAT_CLASS[d.cat] || '';
    html += '<div class="doc-row">';
    html += '<span class="doc-cat ' + catCls + '">' + catLbl + '</span>';
    html += '<span class="doc-name">' + d.nom + '</span>';
    html += '<a class="doc-link" href="' + d.url + '" target="_blank" rel="noopener">&#128279;</a>';
    html += '<button class="btn bdan bico" onclick="rmDocument(\'' + b.id + '\',' + idx + ')">&#10005;</button>';
    html += '</div>';
  }

  el.innerHTML = html;
}

function rmDocument(bid, idx){
  var b = null;
  for(var i=0; i<S.biens.length; i++){ if(S.biens[i].id === bid){ b = S.biens[i]; break; } }
  if(!b) return;
  b.documents.splice(idx, 1);
  renderDocuments(b);
  saveAll();
}

// ═══════════════════════════════════════════════════
// ÉTAPE 1 : SUPPRIMER BIEN — message amélioré
// ═══════════════════════════════════════════════════
// deleteBien() — définie dans index.html
// ═══════════════════════════════════════════════════
// ÉTAPE 2+8 : REFRESH DASH — filtre dashVisible + statut vendu
// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
// v2.7 : ALERTES INTELLIGENTES
// Centralisées ici, utilisées par dashboard ET cockpit
// ═══════════════════════════════════════════════════
function genererAlertes(biens, biensActifs, locatifs){
  var html = '';
  var now = new Date();
  var nowMois = now.getFullYear()*12 + now.getMonth();

  for(var i=0; i<biensActifs.length; i++){
    var b = biensActifs[i];

    // 1. Fin de crédit dans moins de 12 mois
    if(b.finCredit && b.capitalDu > 0){
      var fp = b.finCredit.slice(0,7).split('-');
      if(fp.length === 2){
        var finMois = parseInt(fp[0])*12 + parseInt(fp[1]);
        var resteMois = finMois - nowMois;
        if(resteMois > 0 && resteMois <= 12){
          html += '<div class="alrt s">&#127881; <strong>' + b.nom + '</strong> : cr\u00e9dit se termine dans ' + resteMois + ' mois \u2014 pens\u00e9z \u00e0 r\u00e9\u00e9valuer votre capacit\u00e9 d\'emprunt.</div>';
        } else if(resteMois <= 0 && b.capitalDu > 0){
          html += '<div class="alrt w">&#9888; <strong>' + b.nom + '</strong> : date de fin de cr\u00e9dit d\u00e9pass\u00e9e — mettez \u00e0 jour le capital restant d\u00fb.</div>';
        }
      }
    }

    // 2. CF après impôt négatif (locatifs seulement)
    if(b.type === 'loc'){
      var cf = calcCFApresImpot(b);
      if(cf < 0){
        html += '<div class="alrt e">&#9888; <strong>' + b.nom + '</strong> : cash-flow n\u00e9gatif apr\u00e8s imp\u00f4t (' + fmt(cf) + '/mois)</div>';
      }

      // 3. Loyers non encaissés sur les 3 derniers mois
      var nok3 = 0;
      for(var j=0; j<b.loyers.length; j++){
        var l = b.loyers[j];
        var lp = l.mois.split('-');
        var lMois = parseInt(lp[0])*12 + parseInt(lp[1]);
        if(nowMois - lMois <= 3 && l.statut === 'nok') nok3++;
      }
      if(nok3 > 0){
        html += '<div class="alrt e">&#9888; <strong>' + b.nom + '</strong> : ' + nok3 + ' loyer(s) non encaiss\u00e9(s) sur les 3 derniers mois</div>';
      }

      // 4. Taux d'occupation < 80% sur l'année en cours
      var currentYear = String(now.getFullYear());
      var loyeursAnnee = [];
      for(var j=0; j<b.loyers.length; j++){
        if(b.loyers[j].mois.split('-')[0] === currentYear) loyeursAnnee.push(b.loyers[j]);
      }
      var occ = tauxOccupation(loyeursAnnee);
      if(occ !== null && occ < 80){
        html += '<div class="alrt w">&#128200; <strong>' + b.nom + '</strong> : taux d\'occupation ' + fmtP(occ,0) + ' en ' + currentYear + '</div>';
      }
    }
  }

  // 5. Bien en statut "a-vendre" depuis longtemps (si valeur > 0)
  for(var i=0; i<biens.length; i++){
    var b = biens[i];
    if(b.statut === 'a-vendre'){
      html += '<div class="alrt w">&#127987; <strong>' + b.nom + '</strong> : en vente — pensez \u00e0 mettre \u00e0 jour la valeur estim\u00e9e.</div>';
    }
  }

  if(!html) html = '<div class="alrt s" style="opacity:.5">&#10003; Aucune alerte en cours. Tout semble en ordre.</div>';
  return html;
}

function refreshDash(){
  // Filtre : biens visibles = dashVisible ET statut != 'vendu'
  var biens = S.biens;
  var biensActifs = [];
  var locatifs = [];
  for(var i=0; i<biens.length; i++){
    var b = biens[i];
    if(b.dashVisible !== false && b.statut !== 'vendu' && b.statut !== 'annule'){
      biensActifs.push(b);
      if(b.type === 'loc') locatifs.push(b);
    }
  }

  var totalVal = 0; var totalCap = 0; var totalLoyers = 0; var totalCF = 0; var coutTotal = 0;
  for(var i=0; i<biensActifs.length; i++){
    var b = biensActifs[i];
    totalVal  += nv(b.valeur);
    totalCap  += nv(b.capitalDu);
    coutTotal += nv(b.achat) + nv(b.frais) + nv(b.travauxAchat);
  }
  for(var i=0; i<locatifs.length; i++){
    var b = locatifs[i];
    totalLoyers += nv(b.loyer);
    totalCF     += calcCFApresImpot(b); // v2.5d : CF après impôt (dépense réelle)
  }
  var pat  = totalVal - totalCap;
  var rend = coutTotal > 0 ? (totalLoyers * 12 / coutTotal * 100) : 0;

  gid('kv-val').textContent = fmtK(totalVal);
  gid('kv-cap').textContent = fmtK(totalCap);
  gid('kv-pat').textContent = fmtK(pat);
  gid('kv-pat').className   = 'kval ' + (pat>=0?'up':'dn');
  gid('kv-cf').textContent  = fmtK(totalCF);
  gid('kv-cf').className    = 'kval ' + (totalCF>=0?'up':'dn');
  gid('kv-loy').textContent = fmtK(totalLoyers);
  gid('kv-rend').textContent= fmtP(rend);

  // Liste biens (TOUS les biens, avec indicateur si masqué)
  var bl = gid('dash-biens');
  if(!biens.length){
    bl.innerHTML = '<div class="empty"><div class="eico">&#127968;</div>Aucun bien.<br><button class="btn bpri" style="margin-top:12px" onclick="goPage(\'add\',gid(\'btn-add\'))">+ Ajouter un bien</button></div>';
  } else {
    var html = '';
    for(var i=0; i<biens.length; i++){
      var b = biens[i];
      var cf = b.type === 'loc' ? calcCFApresImpot(b) : 0;
      var ico = b.type==='rp' ? '\uD83C\uDFE0' : '\uD83C\uDFD8';
      var bid = b.id;
      var isDim = (b.dashVisible === false || b.statut === 'vendu' || b.statut === 'annule');

      // v2.6a : séparateur entre biens
      if(i > 0) html += '<div style="height:1px;background:var(--line2);margin:4px 0"></div>';

      html += '<div class="brow' + (isDim?' dim':'') + '" onclick="goPage(\'bien-' + bid + '\',gid(\'btn-bien-' + bid + '\'))">';
      html += '<div class="brow-ico" style="background:' + (b.type==='rp'?'rgba(96,165,250,.1)':'rgba(184,244,58,.1)') + '">' + ico + '</div>';
      html += '<div class="brow-info"><div class="brow-name">' + b.nom + '</div>';
      html += '<div class="brow-sub">';
      html += fmtK(b.valeur) + ' \u00b7 ';
      html += '<span class="tag ' + statutClass(b.statut) + '">' + statutLabel(b.statut) + '</span>';
      if(b.structureAchat !== 'seul') html += ' <span class="tag tp">' + structureLabel(b.structureAchat) + '</span>';
      html += '</div></div>';
      html += '<div class="brow-right">';
      if(b.type==='loc'){
        var impot = calcImpotMensuel(b);
        var depenses = (nv(b.mens)+nv(b.assur)) + nv(b.tf)/12 + nv(b.pno) + nv(b.copro) + nv(b.gest) + nv(b.provisionTravaux) + impot;
        // v2.6a : loyer perçu réel (moyenne 3 derniers mois)
        var percuMoy = loyerPercuMoyenne(b, 3);
        var percuLbl = percuMoy !== null ? fmt(percuMoy) : fmt(b.loyer);
        var percuSub = percuMoy !== null ? 'moy. 3 mois' : 'th\u00e9orique';
        html += '<div style="font-size:9px;color:var(--fog);text-align:right;text-transform:uppercase;letter-spacing:0.4px">Loyer per\u00e7u</div>';
        html += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:var(--lime)">+' + percuLbl + '</div>';
        html += '<div style="font-size:9px;color:var(--mist);text-align:right">' + percuSub + '</div>';
        html += '<div style="font-family:\'JetBrains Mono\',monospace;font-size:10px;color:var(--rose);margin-top:3px">\u2212' + fmt(depenses) + '</div>';
        html += '<div class="brow-cf ' + (cf>=0?'up':'dn') + '" style="font-size:13px;border-top:1px solid rgba(255,255,255,.06);margin-top:3px;padding-top:3px">' + fmt(cf) + '/m</div>';
      } else {
        html += '<div class="brow-cf" style="color:var(--blue)">' + fmt(b.mens+b.assur) + '/m</div>';
        html += '<div style="font-size:10px;color:var(--mist);margin-top:2px">mensualit\u00e9</div>';
      }
      var bBadgeStyle = b.type==='rp' ? 'background:rgba(96,165,250,.15);color:var(--blue)' : 'background:rgba(184,244,58,.15);color:var(--lime)';
      html += '<span class="brow-badge" style="' + bBadgeStyle + '">' + (b.type==='rp'?'RP':'Locatif') + '</span>';
      html += '</div></div>';
    }
    bl.innerHTML = html;
  }

  // ÉTAPE 5 (v4) : Détail recettes/dépenses par bien locatif
  var rl = gid('dash-recettes');
  if(rl){
    var locActifs = [];
    for(var i=0; i<biensActifs.length; i++){ if(biensActifs[i].type==='loc') locActifs.push(biensActifs[i]); }
    if(!locActifs.length){
      rl.innerHTML = '<div class="empty">Aucun bien locatif actif.</div>';
    } else {
      var rHtml = '';
      for(var i=0; i<locActifs.length; i++){
        var b = locActifs[i];
        var mensTotal = nv(b.mens) + nv(b.assur);
        var tfMens    = nv(b.tf) / 12;
        var pno       = nv(b.pno);
        var copro     = nv(b.copro);
        var gest      = nv(b.gest);
        var provTrav  = nv(b.provisionTravaux);
        var totalDep  = mensTotal + tfMens + pno + copro + gest + provTrav;
        var cf        = calcCF(b);
        var impotMens = calcImpotMensuel(b);
        var cfApresImpot = cf - impotMens;
        var cfApresPositif = cfApresImpot >= 0;
        // v2.6a : loyer perçu réel
        var percuMoy = loyerPercuMoyenne(b, 3);
        var percuLbl = percuMoy !== null ? fmt(percuMoy) : fmt(b.loyer);
        var percuSub = percuMoy !== null ? 'moy. 3 derniers mois' : 'th\u00e9orique (aucun encaissement)';

        // v2.6a : carte avec en-tête distinctif par bien
        rHtml += '<div style="background:var(--ink2);border:1.5px solid var(--line2);border-radius:var(--r);margin-bottom:14px;overflow:hidden">';
        // En-tête bien
        rHtml += '<div style="background:var(--ink3);padding:10px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)">';
        rHtml += '<div style="display:flex;align-items:center;gap:8px">';
        rHtml += '<span style="font-size:18px">\uD83C\uDFD8</span>';
        rHtml += '<div><div style="font-size:13px;font-weight:700;color:var(--white)">' + b.nom + '</div>';
        if(b.adresse) rHtml += '<div style="font-size:10px;color:var(--mist)">' + b.adresse + '</div>';
        rHtml += '</div></div>';
        rHtml += '<span class="tag ' + (cfApresPositif?'tg':'tr2') + '" style="font-size:10px">CF ' + (cfApresPositif?'+':'\u2212') + ' ' + fmt(Math.abs(cfApresImpot)) + '/m</span>';
        rHtml += '</div>';
        // Corps
        rHtml += '<div style="padding:12px 14px">';
        // Loyer perçu
        rHtml += '<div class="stat-row"><span class="stat-lbl" style="color:var(--lime)">&#8593; Loyer per\u00e7u</span><span class="stat-val" style="color:var(--lime)">' + percuLbl + '</span></div>';
        rHtml += '<div style="font-size:10px;color:var(--mist);margin-top:-6px;margin-bottom:6px;text-align:right">' + percuSub + '</div>';
        // Loyer théorique si différent
        if(percuMoy !== null && Math.abs(percuMoy - b.loyer) > 0.5){
          rHtml += '<div class="stat-row"><span class="stat-lbl" style="color:var(--fog)">Loyer th\u00e9orique</span><span class="stat-val" style="color:var(--fog)">' + fmt(b.loyer) + '</span></div>';
        }
        rHtml += '<div class="div"></div>';
        // Dépenses
        rHtml += '<div class="stat-row"><span class="stat-lbl">&#8595; Mensualit\u00e9 cr\u00e9dit + assur.</span><span class="stat-val neg">\u2212' + fmt(mensTotal) + '</span></div>';
        if(tfMens > 0)   rHtml += '<div class="stat-row"><span class="stat-lbl">&#8595; Taxe fonci\u00e8re</span><span class="stat-val neg">\u2212' + fmt(tfMens) + '</span></div>';
        if(pno > 0)      rHtml += '<div class="stat-row"><span class="stat-lbl">&#8595; PNO</span><span class="stat-val neg">\u2212' + fmt(pno) + '</span></div>';
        if(copro > 0)    rHtml += '<div class="stat-row"><span class="stat-lbl">&#8595; Copropriété</span><span class="stat-val neg">\u2212' + fmt(copro) + '</span></div>';
        if(gest > 0)     rHtml += '<div class="stat-row"><span class="stat-lbl">&#8595; Gestion locative</span><span class="stat-val neg">\u2212' + fmt(gest) + '</span></div>';
        if(provTrav > 0) rHtml += '<div class="stat-row"><span class="stat-lbl">&#8595; Provision travaux</span><span class="stat-val neg">\u2212' + fmt(provTrav) + '</span></div>';
        rHtml += '<div class="stat-row"><span class="stat-lbl">&#8595; Imp\u00f4t estim\u00e9 (' + regimeLabel(b.regimeFiscal) + ' · ' + b.tmi + '%)</span><span class="stat-val neg">\u2212' + fmt(impotMens) + '</span></div>';
        rHtml += '<div class="div"></div>';
        rHtml += '<div class="stat-row"><span class="stat-lbl" style="font-weight:700;color:var(--white)">Total d\u00e9penses / mois</span><span class="stat-val" style="font-weight:700;color:var(--rose)">\u2212' + fmt(totalDep + impotMens) + '</span></div>';
        rHtml += '<div style="background:var(--ink3);border-radius:var(--rs);padding:10px 12px;margin-top:8px;display:flex;justify-content:space-between;align-items:center">';
        rHtml += '<span style="font-size:12px;font-weight:700;color:var(--white)">Cash-flow apr\u00e8s imp\u00f4t</span>';
        rHtml += '<span style="font-family:\'JetBrains Mono\',monospace;font-size:16px;font-weight:700;color:' + (cfApresPositif?'var(--lime)':'var(--rose)') + '">' + fmt(cfApresImpot) + '/m</span>';
        rHtml += '</div>';
        rHtml += '</div></div>';
      }
      rl.innerHTML = rHtml;
    }
  }

  // Crédits (biens actifs avec capital dû)
  var cl = gid('dash-credits');
  var avecCredit = [];
  for(var i=0; i<biensActifs.length; i++){ if(biensActifs[i].capitalDu > 0) avecCredit.push(biensActifs[i]); }
  if(!avecCredit.length){
    cl.innerHTML = '<div class="empty">Aucun cr\u00e9dit en cours (sur biens actifs).</div>';
  } else {
    var totalMens = 0;
    for(var i=0; i<avecCredit.length; i++) totalMens += avecCredit[i].mens + avecCredit[i].assur;
    var html = '<table class="tbl"><tr><th>Bien</th><th>Capital d\u00fb</th><th>Mens.</th><th>Taux</th></tr>';
    for(var i=0; i<avecCredit.length; i++){
      var b = avecCredit[i];
      html += '<tr><td>' + b.nom.slice(0,16) + '</td><td class="mn neg">' + fmtK(b.capitalDu) + '</td><td class="mn">' + fmt(b.mens+b.assur) + '</td><td class="mn">' + fmtP(b.taux) + '</td></tr>';
    }
    html += '<tr><td style="font-weight:700;color:var(--white)">TOTAL</td><td class="mn neg">' + fmtK(totalCap) + '</td><td class="mn">' + fmt(totalMens) + '</td><td></td></tr>';
    html += '</table>';
    cl.innerHTML = html;
  }

  // Patrimoine SVG
  var pl = gid('dash-pat');
  if(!biensActifs.length){
    pl.innerHTML = '<div class="empty">Ajoutez des biens actifs pour voir la r\u00e9partition.</div>';
  } else {
    var colors = ['#b8f43a','#60a5fa','#fbbf24','#2dd4bf','#f87171','#a78bfa'];
    var slices = [];
    for(var i=0; i<biensActifs.length; i++){
      slices.push({nom:biensActifs[i].nom.slice(0,14), val:nv(biensActifs[i].valeur), col:colors[i%colors.length]});
    }
    var total2 = 0;
    for(var i=0; i<slices.length; i++) total2 += slices[i].val;
    var startA = -Math.PI/2; var r=44; var cx=54; var cy=54; var arcs='';
    for(var i=0; i<slices.length; i++){
      var s = slices[i];
      var pct   = total2>0 ? s.val/total2 : 0;
      var angle = pct * 2 * Math.PI;
      var x1=cx+r*Math.cos(startA); var y1=cy+r*Math.sin(startA);
      startA+=angle;
      var x2=cx+r*Math.cos(startA); var y2=cy+r*Math.sin(startA);
      var large = pct>0.5?1:0;
      arcs += '<path d="M'+cx+','+cy+' L'+x1.toFixed(1)+','+y1.toFixed(1)+' A'+r+','+r+' 0 '+large+',1 '+x2.toFixed(1)+','+y2.toFixed(1)+' Z" fill="'+s.col+'" opacity=".85"/>';
    }
    var legHtml='';
    for(var i=0; i<slices.length; i++){
      legHtml+='<div class="ring-item"><div class="ring-dot" style="background:'+slices[i].col+'"></div>'+slices[i].nom+'<div class="ring-val">'+fmtK(slices[i].val)+'</div></div>';
    }
    legHtml+='<div class="ring-item" style="border-top:1px solid var(--line);padding-top:6px;margin-top:2px"><div class="ring-dot" style="background:var(--rose)"></div>Dettes<div class="ring-val" style="color:var(--rose)">'+fmtK(totalCap)+'</div></div>';
    legHtml+='<div class="ring-item"><div class="ring-dot" style="background:var(--teal)"></div><strong>Equity nette</strong><div class="ring-val" style="color:var(--teal)">'+fmtK(pat)+'</div></div>';
    pl.innerHTML='<div class="ring-wrap"><svg width="108" height="108" viewBox="0 0 108 108"><circle cx="54" cy="54" r="44" fill="var(--ink3)"/>'+arcs+'<circle cx="54" cy="54" r="26" fill="var(--ink2)"/><text x="54" y="51" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="var(--fog)">Total</text><text x="54" y="63" text-anchor="middle" font-family="JetBrains Mono" font-size="10" font-weight="500" fill="var(--snow)">'+fmtK(total2)+'</text></svg><div class="ring-leg">'+legHtml+'</div></div>';
    var pvl=0;
    for(var i=0; i<biensActifs.length; i++){
      pvl+=biensActifs[i].valeur-biensActifs[i].achat-biensActifs[i].frais-biensActifs[i].travauxAchat;
    }
    pl.innerHTML+='<div class="div"></div>';
    pl.innerHTML+='<div class="stat-row"><span class="stat-lbl">Valeur totale parc</span><span class="stat-val">'+fmtK(totalVal)+'</span></div>';
    pl.innerHTML+='<div class="stat-row"><span class="stat-lbl">Total dettes</span><span class="stat-val" style="color:var(--rose)">\u2212'+fmtK(totalCap)+'</span></div>';
    pl.innerHTML+='<div class="stat-row"><span class="stat-lbl">Patrimoine immobilier net</span><span class="stat-val" style="color:var(--teal)">'+fmtK(pat)+'</span></div>';
    pl.innerHTML+='<div class="stat-row"><span class="stat-lbl">Plus-values latentes</span><span class="stat-val" style="color:var(--lime)">'+fmtK(pvl)+'</span></div>';
  }

  // v2.7 : ALERTES INTELLIGENTES
  var alertHtml = genererAlertes(biens, biensActifs, locatifs);
  gid('dash-alertes').innerHTML = alertHtml;
}

// ═══════════════════════════════════════════════════
// ÉTAPE 3 : COCKPIT
// ═══════════════════════════════════════════════════
function refreshCockpit(){
  var biens = S.biens;
  var cfg   = S.config;

  // Biens inclus dans le cockpit : dashVisible ET pas vendu
  var actifs = [];
  for(var i=0; i<biens.length; i++){
    if(biens[i].dashVisible!==false && biens[i].statut!=='vendu' && biens[i].statut!=='annule') actifs.push(biens[i]);
  }
  var locatifs=[];
  for(var i=0; i<actifs.length; i++){ if(actifs[i].type==='loc') locatifs.push(actifs[i]); }

  // Calculs globaux
  var brut=0; var dette=0; var mens=0; var loyers=0; var cf=0;
  for(var i=0; i<actifs.length; i++){
    var b=actifs[i];
    brut  +=nv(b.valeur);
    dette +=nv(b.capitalDu);
    mens  +=nv(b.mens)+nv(b.assur);
  }
  for(var i=0; i<locatifs.length; i++){
    loyers+=nv(locatifs[i].loyer);
    cf    +=calcCFApresImpot(locatifs[i]); // v2.5d : après impôt
  }
  var net=brut-dette;

  // KPI
  gid('ck-brut').textContent  = fmtK(brut);
  gid('ck-dette').textContent = fmtK(dette);
  gid('ck-net').textContent   = fmtK(net);
  gid('ck-net').className     = 'ck-val '+(net>=0?'up':'dn');
  gid('ck-mens').textContent  = fmtK(mens);
  gid('ck-loyers').textContent= fmtK(loyers);
  gid('ck-cf').textContent    = fmtK(cf);
  gid('ck-cf').className      = 'ck-val '+(cf>=0?'up':'dn');

  // Statuts
  var sCount={actif:0,projet:0,'a-vendre':0,vendu:0,rembourse:0,annule:0};
  for(var i=0; i<biens.length; i++){ var s=biens[i].statut; if(sCount[s]!==undefined) sCount[s]++; }
  var sg=gid('ck-statuts');
  if(sg){
    var sKeys=['actif','projet','a-vendre','vendu','rembourse','annule'];
    var sLbls=['Actif','Projet','A vendre','Vendu','Rembours\u00e9','Annul\u00e9'];
    var sHtml='';
    for(var i=0; i<sKeys.length; i++){
      if(sCount[sKeys[i]]>0||i<3){
        sHtml+='<div class="statut-pill"><div class="sp-n">'+sCount[sKeys[i]]+'</div><div class="sp-l">'+sLbls[i]+'</div></div>';
      }
    }
    sg.innerHTML=sHtml;
  }

  // ÉTAPE 4 (v4) : Taux d'occupation locative — par bien + global, année en cours
  var occEl = gid('ck-occupation');
  if(occEl){
    var currentYear = String(new Date().getFullYear());
    var rows = '';
    var globalOk = 0; var globalTotal = 0;
    for(var i=0; i<locatifs.length; i++){
      var b = locatifs[i];
      var yearLoyers = [];
      for(var j=0; j<b.loyers.length; j++){
        if(b.loyers[j].mois.split('-')[0] === currentYear) yearLoyers.push(b.loyers[j]);
      }
      var occ = tauxOccupation(yearLoyers);
      var ok=0; var tot=0;
      for(var j=0; j<yearLoyers.length; j++){
        if(yearLoyers[j].statut==='ok'){ ok++; tot++; }
        else if(yearLoyers[j].statut==='nok'){ tot++; }
      }
      globalOk += ok; globalTotal += tot;
      var occTxt = occ===null ? '\u2014' : fmtP(occ,0);
      var occColor = occ===null ? 'var(--mist)' : occ>=95 ? 'var(--lime)' : occ>=80 ? 'var(--amber)' : 'var(--rose)';
      rows += '<tr><td>'+b.nom.slice(0,18)+'</td><td class="mn" style="color:'+occColor+'">'+occTxt+'</td><td class="mn">'+ok+' / '+tot+' mois</td></tr>';
    }
    if(!locatifs.length){
      occEl.innerHTML = '<div class="empty">Aucun bien locatif actif.</div>';
    } else {
      var globalOcc = globalTotal>0 ? (globalOk/globalTotal*100) : null;
      var globalTxt = globalOcc===null ? '\u2014' : fmtP(globalOcc,1);
      var html = '<table class="tbl">';
      html += '<tr><th>Bien</th><th>Taux occ. '+currentYear+'</th><th>D\u00e9tail</th></tr>';
      html += rows;
      html += '<tr><td style="font-weight:700;color:var(--white)">GLOBAL</td><td class="mn" style="font-weight:700;color:var(--snow)">'+globalTxt+'</td><td class="mn">'+globalOk+' / '+globalTotal+' mois</td></tr>';
      html += '</table>';
      html += '<div style="font-size:10px;color:var(--mist);margin-top:8px">* Bas\u00e9 sur le statut des loyers (\u2713 occup\u00e9 / \u2717 vacant) de l\'ann\u00e9e '+currentYear+'. Les mois non renseign\u00e9s (\u00b7) sont exclus du calcul.</div>';
      occEl.innerHTML = html;
    }
  }

  // Capacité d'endettement
  var revMens = nv(cfg.revenusMensuels);
  var tauxMax = nv(cfg.tauxEndettementMax) || 35;
  var marge   = nv(cfg.margeSecurite) || 10;
  var loyPct  = nv(cfg.loyersPrisEnCompte) || 70;
  var loyersBanque = loyers * loyPct / 100;
  var revBanque    = revMens + loyersBanque;
  var capaciteMax  = revBanque * tauxMax / 100;
  var capaciteRestante = capaciteMax - mens;
  var tauxActuel   = revBanque > 0 ? mens / revBanque * 100 : 0;
  var tauxAvecMarge= tauxMax * (1 - marge/100);
  var eZone = gid('ck-endo-zone');
  if(eZone){
    if(revMens === 0){
      eZone.innerHTML = '<div class="alrt w">Renseignez vos revenus mensuels ci-dessous pour voir votre capacit\u00e9.</div>';
    } else {
      var gColor = tauxActuel > tauxMax ? 'var(--rose)' : tauxActuel > tauxAvecMarge ? 'var(--amber)' : 'var(--lime)';
      var gPct   = Math.min(100, tauxActuel).toFixed(1);
      var html='';
      html+='<table class="tbl" style="margin-bottom:10px">';
      html+='<tr><td>Revenus bancaires retenus</td><td class="mn">'+fmt(revBanque)+'</td></tr>';
      html+='<tr><td>Mensualit\u00e9s actuelles</td><td class="mn neg">'+fmt(mens)+'</td></tr>';
      html+='<tr><td>Loyers retenus ('+loyPct+'%)</td><td class="mn up">+'+fmt(loyersBanque)+'</td></tr>';
      html+='<tr><td>Taux d\'endettement actuel</td><td class="mn" style="color:'+gColor+'">'+fmtP(tauxActuel)+'</td></tr>';
      html+='<tr><td>Mensualit\u00e9 max disponible</td><td class="mn" style="color:var(--teal);font-weight:700">'+fmt(Math.max(0,capaciteRestante))+'</td></tr>';
      html+='</table>';
      html+='<div style="font-size:11px;color:var(--fog);margin-bottom:4px">Taux d\'endettement · objectif max '+tauxMax+' %</div>';
      html+='<div class="gauge-endo"><div class="gauge-fill" style="width:'+gPct+'%;background:'+gColor+'"></div></div>';
      html+='<div style="font-size:10px;color:var(--mist);margin-top:6px">* Estimation indicative. Chaque banque a ses propres crit\u00e8res.</div>';
      eZone.innerHTML=html;
    }
  }

  // Alertes cockpit — alertes endettement spécifiques au cockpit + alertes générales
  var aHtml = '';
  if(revMens > 0 && tauxActuel > tauxMax){
    aHtml += '<div class="alrt e">&#9888; Taux d\'endettement d\u00e9pass\u00e9 : ' + fmtP(tauxActuel) + ' > ' + tauxMax + '%</div>';
  }
  if(revMens > 0 && capaciteRestante > 0){
    aHtml += '<div class="alrt s">&#10003; Capacit\u00e9 restante estim\u00e9e : ' + fmt(capaciteRestante) + '/mois</div>';
  }
  // v2.7 : alertes intelligentes centralisées
  aHtml += genererAlertes(biens, actifs, locatifs);
  gid('ck-alertes').innerHTML = aHtml;

  // v2.8 : graphique évolution patrimoine
  renderHistoriquePatrimoine();
}

// ═══════════════════════════════════════════════════
// v2.8 : GRAPHIQUE ÉVOLUTION PATRIMOINE
// ═══════════════════════════════════════════════════
function renderHistoriquePatrimoine(){
  var el = gid('ck-historique');
  if(!el) return;
  var hist = S.historiquePatrimoine || [];

  if(hist.length < 2){
    el.innerHTML = '<div class="alrt i">Pas encore assez de donn\u00e9es pour afficher un graphique. Le premier snapshot sera pris automatiquement ce mois-ci. Revenez le mois prochain pour voir l\u2019\u00e9volution !</div>';
    return;
  }

  // Trier par date
  var data = hist.slice().sort(function(a,b){ return a.date < b.date ? -1 : 1; });

  // Valeurs min/max pour l'échelle
  var allVals = [];
  for(var i=0; i<data.length; i++){
    allVals.push(data[i].valeurParc);
    allVals.push(data[i].capitalDu);
    allVals.push(data[i].patrimoineNet);
  }
  var maxV = Math.max.apply(null, allVals);
  var minV = Math.min.apply(null, allVals);
  if(maxV === minV) maxV = minV + 1; // éviter division par zéro

  // Dimensions SVG
  var svgW = 320; var svgH = 180;
  var padL = 12; var padR = 8; var padT = 10; var padB = 24;
  var w = svgW - padL - padR;
  var h = svgH - padT - padB;
  var n = data.length;

  function xPos(i){ return padL + (i/(n-1))*w; }
  function yPos(v){ return padT + h - ((v - minV)/(maxV - minV))*h; }

  // Générer les polylines
  function makePoly(key, color){
    var pts = '';
    for(var i=0; i<data.length; i++){
      pts += xPos(i).toFixed(1) + ',' + yPos(data[i][key]).toFixed(1) + ' ';
    }
    return '<polyline points="'+pts.trim()+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  }

  // Cercles sur le dernier point
  function lastDot(key, color){
    var last = data[data.length-1];
    return '<circle cx="'+xPos(n-1).toFixed(1)+'" cy="'+yPos(last[key]).toFixed(1)+'" r="3" fill="'+color+'"/>';
  }

  // Labels axe X (premier + dernier + milieu si > 4 points)
  var xlabels = '';
  var labelIdx = [0, n-1];
  if(n > 4) labelIdx.push(Math.floor(n/2));
  for(var li=0; li<labelIdx.length; li++){
    var i = labelIdx[li];
    var dp = data[i].date.split('-');
    var lbl = dp[1]+'/'+dp[0].slice(2);
    var x = xPos(i);
    var anchor = i===0?'start': i===n-1?'end':'middle';
    xlabels += '<text x="'+x.toFixed(1)+'" y="'+(svgH-6)+'" text-anchor="'+anchor+'" font-family="JetBrains Mono,monospace" font-size="8" fill="#4a5068">'+lbl+'</text>';
  }

  var svg = '<svg viewBox="0 0 '+svgW+' '+svgH+'" width="100%" style="display:block;max-width:400px;margin:0 auto 8px">';
  // Grille horizontale légère
  for(var gi=0; gi<=4; gi++){
    var gy = padT + (gi/4)*h;
    svg += '<line x1="'+padL+'" y1="'+gy.toFixed(1)+'" x2="'+(padL+w)+'" y2="'+gy.toFixed(1)+'" stroke="#252a3a" stroke-width="1"/>';
  }
  svg += makePoly('valeurParc',    '#60a5fa'); // bleu = valeur brute
  svg += makePoly('capitalDu',     '#f87171'); // rouge = dettes
  svg += makePoly('patrimoineNet', '#2dd4bf'); // teal = net
  svg += lastDot('valeurParc',    '#60a5fa');
  svg += lastDot('capitalDu',     '#f87171');
  svg += lastDot('patrimoineNet', '#2dd4bf');
  svg += xlabels;
  svg += '</svg>';

  // Légende + dernières valeurs
  var last = data[data.length-1];
  var prev = data.length > 1 ? data[data.length-2] : null;
  function delta(key){
    if(!prev) return '';
    var d = last[key] - prev[key];
    var s = d >= 0 ? '+' : '';
    return '<span style="font-size:9px;color:'+(d>=0?'var(--lime)':'var(--rose)')+'"> '+s+fmt(d)+'</span>';
  }

  var legend = '<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px">';
  legend += '<div style="display:flex;align-items:center;justify-content:space-between"><span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:3px;background:#60a5fa;border-radius:2px;display:inline-block"></span><span style="font-size:11px;color:var(--silver)">Valeur brute</span></span><span style="font-family:JetBrains Mono,monospace;font-size:11px;color:var(--snow)">'+fmt(last.valeurParc)+delta('valeurParc')+'</span></div>';
  legend += '<div style="display:flex;align-items:center;justify-content:space-between"><span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:3px;background:#f87171;border-radius:2px;display:inline-block"></span><span style="font-size:11px;color:var(--silver)">Dettes</span></span><span style="font-family:JetBrains Mono,monospace;font-size:11px;color:var(--snow)">'+fmt(last.capitalDu)+delta('capitalDu')+'</span></div>';
  legend += '<div style="display:flex;align-items:center;justify-content:space-between"><span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:3px;background:#2dd4bf;border-radius:2px;display:inline-block"></span><span style="font-weight:700;font-size:11px;color:var(--white)">Patrimoine net</span></span><span style="font-family:JetBrains Mono,monospace;font-size:12px;font-weight:700;color:var(--teal)">'+fmt(last.patrimoineNet)+delta('patrimoineNet')+'</span></div>';
  legend += '</div>';

  legend += '<div style="font-size:10px;color:var(--mist)">'+data.length+' snapshot(s) · '+data[0].date+' → '+last.date+'</div>';

  el.innerHTML = svg + legend;
}

// ═══════════════════════════════════════════════════
// ÉTAPE 3 : CONFIG (S.config)
// ═══════════════════════════════════════════════════
function loadConfig(){
  var cfg=S.config;
  if(gid('cfg-revenus'))    gid('cfg-revenus').value    = cfg.revenusMensuels    ||'';
  if(gid('cfg-taux-endo'))  gid('cfg-taux-endo').value  = cfg.tauxEndettementMax ||35;
  if(gid('cfg-loyers-pct')) gid('cfg-loyers-pct').value = cfg.loyersPrisEnCompte ||70;
  if(gid('cfg-marge'))      gid('cfg-marge').value      = cfg.margeSecurite      ||10;
  if(gid('cfg-notaire'))    gid('cfg-notaire').value    = cfg.tauxNotaireDefaut  ||8;
  if(gid('cfg-frais-dos'))  gid('cfg-frais-dos').value  = cfg.fraisDossierDefaut ||1500;
}

function saveConfig(){
  S.config.revenusMensuels    = nv(gid('cfg-revenus')?.value||gid('cfg-revenus')&&gid('cfg-revenus').value);
  S.config.tauxEndettementMax = nv(gid('cfg-taux-endo') ? gid('cfg-taux-endo').value : 35);
  S.config.loyersPrisEnCompte = nv(gid('cfg-loyers-pct') ? gid('cfg-loyers-pct').value : 70);
  S.config.margeSecurite      = nv(gid('cfg-marge') ? gid('cfg-marge').value : 10);
  S.config.tauxNotaireDefaut  = nv(gid('cfg-notaire') ? gid('cfg-notaire').value : 8);
  S.config.fraisDossierDefaut = nv(gid('cfg-frais-dos') ? gid('cfg-frais-dos').value : 1500);
  saveAll();
}

// Wrapper simple pour éviter optional chaining (ES5)
function cfgVal(id, defVal){
  var el=gid(id);
  return el ? nv(el.value) : defVal;
}

// ═══════════════════════════════════════════════════
// v2.1 : ADAPTATEUR DE STOCKAGE
// Couche d'abstraction unique pour toute la persistance.
// Aujourd'hui : implémentation localStorage.
// Demain (pivot SaaS) : il suffira d'écrire une implémentation
// Supabase derrière la MÊME interface, sans toucher au reste du code.
//
// Interface : STORE.save(key,data) / STORE.load(key) /
//             STORE.remove(key) / STORE.isAvailable()
// ═══════════════════════════════════════════════════
var STORE = {
  // Vérifie si le backend de stockage est disponible et fonctionnel
  // (Safari navigation privée bloque localStorage -> détection nécessaire)
  isAvailable: function(){
    try{
      var t = '__store_test__';
      localStorage.setItem(t, '1');
      localStorage.removeItem(t);
      return true;
    } catch(e){ return false; }
  },
  // Sauvegarde une valeur (objet -> JSON). Retourne true/false.
  save: function(key, data){
    try{
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch(e){
      /* DEBUG: console.log('STORE.save err', e) */
      return false;
    }
  },
  // Charge une valeur (JSON -> objet). Retourne l'objet ou null.
  load: function(key){
    try{
      var raw = localStorage.getItem(key);
      if(!raw) return null;
      return JSON.parse(raw);
    } catch(e){
      /* DEBUG: console.log('STORE.load err', e) */
      return null;
    }
  },
  // Charge la valeur brute (string) sans parser — utile pour export JSON
  loadRaw: function(key){
    try{ return localStorage.getItem(key); }
    catch(e){ return null; }
  },
  // Sauvegarde une valeur brute (string) sans JSON.stringify — utile pour le stamp
  saveRaw: function(key, str){
    try{ localStorage.setItem(key, str); return true; }
    catch(e){ return false; }
  },
  // Supprime une clé
  remove: function(key){
    try{ localStorage.removeItem(key); return true; }
    catch(e){ return false; }
  }
};

// Clé de stockage principale — centralisée pour faciliter une future migration
// STORE_KEY définie dans data.js — ne pas redéclarer ici

// ═══════════════════════════════════════════════════
// PERSISTANCE (via adaptateur STORE)
// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
// v2.8 : HISTORIQUE PATRIMOINE
// Snapshot mensuel automatique du patrimoine net global
// ═══════════════════════════════════════════════════
function snapshotPatrimoine(){
  if(!S.biens.length) return;
  if(!S.historiquePatrimoine) S.historiquePatrimoine = [];

  // Clé du mois en cours YYYY-MM
  var now = new Date();
  var mo = String(now.getMonth()+1); if(mo.length<2) mo='0'+mo;
  var moisCle = now.getFullYear() + '-' + mo;

  // Ne prendre qu'un snapshot par mois
  for(var i=0; i<S.historiquePatrimoine.length; i++){
    if(S.historiquePatrimoine[i].date === moisCle) return;
  }

  // Calculer les agrégats sur les biens actifs + visibles
  var valeurParc=0; var capitalDu=0; var cfMensuel=0;
  for(var i=0; i<S.biens.length; i++){
    var b = S.biens[i];
    if(b.dashVisible===false || b.statut==='vendu' || b.statut==='annule') continue;
    valeurParc += nv(b.valeur);
    capitalDu  += nv(b.capitalDu);
    if(b.type==='loc') cfMensuel += calcCFApresImpot(b);
  }

  S.historiquePatrimoine.push({
    date:          moisCle,
    valeurParc:    Math.round(valeurParc),
    capitalDu:     Math.round(capitalDu),
    patrimoineNet: Math.round(valeurParc - capitalDu),
    cfMensuel:     Math.round(cfMensuel)
  });

  // Garder max 60 mois (5 ans)
  if(S.historiquePatrimoine.length > 60){
    S.historiquePatrimoine = S.historiquePatrimoine.slice(-60);
  }
}

function saveAll(){
  // v2.8 : snapshot mensuel automatique avant sauvegarde
  snapshotPatrimoine();
  S._v = DATA_VERSION;
  var ok = STORE.save(STORE_KEY, S);
  if(ok){
    var lbl=gid('data-version-lbl');
    if(lbl) lbl.textContent='SUIVI \u00b7 RENDEMENT \u00b7 v'+DATA_VERSION+' \u00b7 '+S.biens.length+' bien(s)';
    // v3.0 : sync cloud silencieuse après sauvegarde locale
    syncCloudSilencieux();
  } else {
    if(!window._storeWarned){
      window._storeWarned = true;
      alert('Attention : la sauvegarde automatique ne fonctionne pas (navigation priv\u00e9e ou stockage plein). Pensez \u00e0 exporter un Backup JSON r\u00e9guli\u00e8rement.');
    }
  }
}

function loadAll(){
  try{
    var data = STORE.load(STORE_KEY);
    if(!data || !data.biens) return;

    // Étape 1 : vérification version
    if(data._v && data._v > DATA_VERSION){
      alert('Attention : les donn\u00e9es sauvegard\u00e9es sont plus r\u00e9centes que cette version de l\'application (v'+data._v+' > v'+DATA_VERSION+'). Veuillez utiliser la derni\u00e8re version du fichier HTML.');
    }

    // Étape 3 : charger S.config si présent
    if(data.config){
      S.config.revenusMensuels    = nv(data.config.revenusMensuels);
      S.config.tauxEndettementMax = nv(data.config.tauxEndettementMax) || 35;
      S.config.loyersPrisEnCompte = nv(data.config.loyersPrisEnCompte) || 70;
      S.config.margeSecurite      = nv(data.config.margeSecurite)      || 10;
      S.config.tauxNotaireDefaut  = nv(data.config.tauxNotaireDefaut)  || 8;
      S.config.fraisDossierDefaut = nv(data.config.fraisDossierDefaut) || 1500;
    }
    // v2.8 : charger l'historique patrimoine (rétrocompat : vide si absent)
    S.historiquePatrimoine = data.historiquePatrimoine || [];

    // Étape 1 : normalizeBien sur chaque bien au chargement
    for(var i=0; i<data.biens.length; i++){
      var b = normalizeBien(data.biens[i]);  // filet de sécurité
      // ÉTAPE 4 (v4) : génération auto des mois manquants de l'année en cours
      autoGenererMoisAnnee(b);
      S.biens.push(b);
      addNavTab(b);
      buildBienPage(b);
      if(b.type === 'loc') renderLoyers(b);
      renderTravaux(b);
    }

    loadConfig();
    refreshDash();
  } catch(e) { /* load error */ }
}

function exportData(){
  try{
    saveAll();
    var data = STORE.loadRaw(STORE_KEY) || '{}';
    var blob=new Blob([data],{type:'application/json'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url;
    a.download='parc_immobilier_backup_v'+DATA_VERSION+'_'+new Date().toISOString().slice(0,10)+'.json';
    a.click();
  } catch(e){ alert('Export impossible : '+e.message); }
}

// ═══════════════════════════════════════════════════
// v2.2 : RESTAURATION JSON
// ═══════════════════════════════════════════════════

// Nettoie complètement l'UI dynamique (onglets biens + pages biens)
// avant de recharger un nouvel état. Ne touche pas aux pages statiques
// (dash, cockpit, add, params).
// resetUI() — définie dans index.html
// Importe un fichier JSON (Backup généré par exportData, ou ancien format)
// 1) Lecture + parse  2) Validation minimale  3) Confirmation utilisateur
// 4) Reset UI  5) Remplacement de S  6) Sauvegarde  7) Reconstruction UI
function importData(event){
  var file = event.target.files && event.target.files[0];
  if(!file) return;

  var reader = new FileReader();
  reader.onload = function(e){
    var data;
    try{
      data = JSON.parse(e.target.result);
    } catch(err){
      alert('Fichier invalide : ce n\'est pas un JSON valide.');
      event.target.value = '';
      return;
    }

    // Validation minimale de structure
    if(!data || typeof data !== 'object' || !data.biens || !data.biens.length){
      alert('Fichier invalide : structure de donn\u00e9es non reconnue (champ "biens" manquant ou vide).');
      event.target.value = '';
      return;
    }

    // Avertissement version future
    if(data._v && data._v > DATA_VERSION){
      var proceedFuture = confirm('Ce fichier provient d\'une version plus r\u00e9cente (v'+data._v+' > v'+DATA_VERSION+').\nL\'import peut perdre des informations propres \u00e0 cette version future.\n\nContinuer quand m\u00eame ?');
      if(!proceedFuture){ event.target.value=''; return; }
    }

    // Confirmation destructive
    var nbActuels = S.biens.length;
    var nbNouveaux = data.biens.length;
    var msg = 'Importer ce fichier remplacera TOUTES les donn\u00e9es actuelles ('+nbActuels+' bien(s)) par celles du fichier ('+nbNouveaux+' bien(s)).\n\nCette action est irr\u00e9versible (sauf si vous avez un autre backup).\n\nContinuer ?';
    if(!confirm(msg)){ event.target.value=''; return; }

    // --- Remplacement de l'état ---
    resetUI();

    // Réinitialiser S avec les valeurs par défaut, puis fusionner config
    S = {
      biens: [],
      config: {
        revenusMensuels:    0,
        tauxEndettementMax: 35,
        loyersPrisEnCompte: 70,
        margeSecurite:      10,
        tauxNotaireDefaut:  8,
        fraisDossierDefaut: 1500
      },
      _v: DATA_VERSION
    };

    if(data.config){
      S.config.revenusMensuels    = nv(data.config.revenusMensuels);
      S.config.tauxEndettementMax = nv(data.config.tauxEndettementMax) || 35;
      S.config.loyersPrisEnCompte = nv(data.config.loyersPrisEnCompte) || 70;
      S.config.margeSecurite      = nv(data.config.margeSecurite)      || 10;
      S.config.tauxNotaireDefaut  = nv(data.config.tauxNotaireDefaut)  || 8;
      S.config.fraisDossierDefaut = nv(data.config.fraisDossierDefaut) || 1500;
    }
    // v2.8 : restaurer l'historique patrimoine depuis le backup
    S.historiquePatrimoine = data.historiquePatrimoine || [];

    // normalizeBien sur chaque bien importé (migration de schema)
    for(var i=0; i<data.biens.length; i++){
      var b = normalizeBien(data.biens[i]);
      autoGenererMoisAnnee(b);
      S.biens.push(b);
      addNavTab(b);
      buildBienPage(b);
      if(b.type === 'loc') renderLoyers(b);
      renderTravaux(b);
    }

    loadConfig();
    refreshDash();
    saveAll();

    alert('Import r\u00e9ussi : '+nbNouveaux+' bien(s) charg\u00e9(s).');
    event.target.value = '';
  };
  reader.onerror = function(){
    alert('Erreur de lecture du fichier.');
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ═══════════════════════════════════════════════════
// EXEMPLE — données réelles Mathieu
// ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════
// v2.9 : DOSSIER BANQUIER PDF
// Génère une page HTML imprimable, ouverte dans un nouvel onglet.
// L'utilisateur fait Ctrl+P / Cmd+P ou utilise le bouton "Imprimer"
// pour obtenir un PDF propre. Aucune dépendance externe.
// ═══════════════════════════════════════════════════
function exporterDossierPDF(){
  if (typeof Analytics !== 'undefined') Analytics.track('pdf.exported', { biens: S.biens.length });
  var html = genererDossierHTML();
  var win = window.open('', '_blank');
  if(!win){ alert('Autoriser les popups pour générer le PDF.'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = function(){ win.print(); };
}

function genererDossierHTML(){
  var now = new Date();
  var dateStr = now.getDate() + '/' + (now.getMonth()+1) + '/' + now.getFullYear();

  // Agréger les données
  var biens = S.biens;
  var actifs = [];
  for(var i=0; i<biens.length; i++){
    if(biens[i].dashVisible!==false && biens[i].statut!=='vendu' && biens[i].statut!=='annule') actifs.push(biens[i]);
  }
  var locatifs = [];
  for(var i=0; i<actifs.length; i++){ if(actifs[i].type==='loc') locatifs.push(actifs[i]); }

  var totalValeur=0; var totalCap=0; var totalMens=0; var totalLoyers=0; var totalCF=0;
  for(var i=0; i<actifs.length; i++){
    totalValeur += nv(actifs[i].valeur);
    totalCap    += nv(actifs[i].capitalDu);
    totalMens   += nv(actifs[i].mens) + nv(actifs[i].assur);
  }
  for(var i=0; i<locatifs.length; i++){
    totalLoyers += nv(locatifs[i].loyer);
    totalCF     += calcCFApresImpot(locatifs[i]);
  }
  var patrimoineNet = totalValeur - totalCap;
  var cfg = S.config;
  var revMens = nv(cfg.revenusMensuels);
  var tauxMax = nv(cfg.tauxEndettementMax) || 35;
  var loyPct  = nv(cfg.loyersPrisEnCompte) || 70;
  var loyersBanque = totalLoyers * loyPct / 100;
  var revBanque    = revMens + loyersBanque;
  var tauxEndo     = revBanque > 0 ? (totalMens / revBanque * 100) : 0;
  var capRestante  = revBanque > 0 ? (revBanque * tauxMax / 100) - totalMens : 0;

  function f(v){ return new Intl.NumberFormat('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:0}).format(Math.round(v)) + ' \u20ac'; }
  function fp(v){ return v.toFixed(1).replace('.',',') + ' %'; }
  function row(label, val, bold, color){
    var s = bold ? 'font-weight:700;' : '';
    var c = color ? 'color:'+color+';' : '';
    return '<tr><td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;'+s+'">'+label+'</td><td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-family:monospace;'+s+c+'">'+val+'</td></tr>';
  }

  var biensSections = '';
  for(var i=0; i<actifs.length; i++){
    var b = actifs[i];
    var cout = b.achat + b.frais + b.travauxAchat;
    var pv = b.valeur - cout;
    var equity = b.valeur - b.capitalDu;
    var pctRemb = b.capitalInit > 0 ? ((b.capitalInit - b.capitalDu)/b.capitalInit*100) : 0;

    biensSections += '<div style="margin-bottom:24px;page-break-inside:avoid">';
    biensSections += '<h3 style="font-size:13px;font-weight:700;color:#1e293b;border-bottom:2px solid #3b82f6;padding-bottom:4px;margin-bottom:8px">';
    biensSections += (b.type==='rp'?'🏠':'🏘') + ' ' + b.nom;
    if(b.adresse) biensSections += '<span style="font-weight:400;font-size:11px;color:#6b7280;margin-left:8px">'+b.adresse+'</span>';
    biensSections += '</h3>';
    biensSections += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';

    // Colonne gauche : acquisition
    biensSections += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
    biensSections += '<tr><th colspan="2" style="text-align:left;padding:4px 8px;background:#f8fafc;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b">Acquisition</th></tr>';
    biensSections += row('Prix d\'achat', f(b.achat));
    biensSections += row('Frais notaire + agence', f(b.frais));
    if(b.travauxAchat > 0) biensSections += row('Travaux à l\'achat', f(b.travauxAchat));
    biensSections += row('Coût de revient', f(cout), true);
    biensSections += row('Valeur estimée actuelle', f(b.valeur));
    biensSections += row('Plus-value latente', f(pv), false, pv>=0?'#16a34a':'#dc2626');
    biensSections += row('Equity (valeur − dette)', f(equity), true, '#0891b2');
    biensSections += '</table>';

    // Colonne droite : crédit
    biensSections += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
    biensSections += '<tr><th colspan="2" style="text-align:left;padding:4px 8px;background:#f8fafc;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b">Crédit</th></tr>';
    if(b.banque) biensSections += row('Banque', b.banque);
    biensSections += row('Capital emprunté', f(b.capitalInit));
    biensSections += row('Capital restant dû', f(b.capitalDu), true, '#dc2626');
    biensSections += row('Remboursé', fp(pctRemb));
    biensSections += row('Mensualité crédit', f(b.mens));
    if(b.assur > 0) biensSections += row('Assurance emprunteur', f(b.assur)+'/mois');
    biensSections += row('Total mensualité', f(b.mens+b.assur), true);
    biensSections += row('Taux', fp(b.taux));
    if(b.finCredit) biensSections += row('Fin de crédit', moisLbl(b.finCredit));
    biensSections += '</table>';
    biensSections += '</div>';

    // Locatif : section CF
    if(b.type === 'loc'){
      var cfAvant = calcCF(b);
      var impot   = calcImpotMensuel(b);
      var cfApres = cfAvant - impot;
      var loyerAn = b.loyer * 12;
      var cout2   = b.achat + b.frais + b.travauxAchat;
      var rendBrut = cout2 > 0 ? loyerAn/cout2*100 : 0;

      biensSections += '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px">';
      biensSections += '<tr><th colspan="2" style="text-align:left;padding:4px 8px;background:#f0fdf4;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#16a34a">Rendement locatif</th></tr>';
      biensSections += row('Loyer mensuel', f(b.loyer));
      biensSections += row('Taxe foncière (mensualisée)', f(b.tf/12));
      biensSections += row('PNO + Copro + Gestion', f(nv(b.pno)+nv(b.copro)+nv(b.gest)));
      if(b.provisionTravaux > 0) biensSections += row('Provision travaux', f(b.provisionTravaux)+'/mois');
      biensSections += row('Cash-flow avant impôt', f(cfAvant), false, cfAvant>=0?'#16a34a':'#dc2626');
      biensSections += row('Impôt estimé ('+regimeLabel(b.regimeFiscal)+', TMI '+b.tmi+'%)', '-'+f(impot));
      biensSections += row('Cash-flow après impôt', f(cfApres), true, cfApres>=0?'#16a34a':'#dc2626');
      biensSections += row('Rendement brut', fp(rendBrut));
      biensSections += row('Régime fiscal', regimeLabel(b.regimeFiscal));
      biensSections += '</table>';
    }

    // Documents liés
    if(b.documents && b.documents.length){
      biensSections += '<div style="margin-top:8px;font-size:10px;color:#6b7280">';
      biensSections += '<strong>Documents :</strong> ';
      var docList = [];
      for(var j=0; j<b.documents.length; j++){
        docList.push('<a href="'+b.documents[j].url+'" style="color:#3b82f6">'+b.documents[j].nom+'</a> ('+DOC_CAT_LABELS[b.documents[j].cat]+')');
      }
      biensSections += docList.join(' · ') + '</div>';
    }
    biensSections += '</div>';
  }

  return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'+
    '<title>Dossier Patrimoine Immobilier — '+dateStr+'</title>'+
    '<style>'+
    'body{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;margin:0;padding:20px;max-width:800px;margin:0 auto}'+
    'h1{font-size:20px;color:#1e293b;margin-bottom:4px}'+
    'h2{font-size:14px;color:#1e293b;margin:20px 0 8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}'+
    'h3{font-size:13px}'+
    '.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #1e293b}'+
    '.subtitle{font-size:11px;color:#6b7280}'+
    '.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}'+
    '.kpi{background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:10px;text-align:center}'+
    '.kpi-label{font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;margin-bottom:4px}'+
    '.kpi-value{font-size:16px;font-weight:700;font-family:monospace;color:#1e293b}'+
    '.positive{color:#16a34a}.negative{color:#dc2626}'+
    'table{border-collapse:collapse;width:100%}'+
    'th{background:#f8fafc;text-align:left;font-weight:600}'+
    '@media print{body{padding:0}@page{margin:15mm;size:A4}.no-print{display:none}page-break-inside:avoid}'+
    '</style></head><body>'+

    // En-tete
    '<div class="header">'+
    '<div>'+
    '<h1>Dossier Patrimoine Immobilier</h1>'+
    '<div class="subtitle">Généré le '+dateStr+' · '+actifs.length+' bien(s) actif(s)</div>'+
    '</div>'+
    '<div class="no-print" style="text-align:right">'+
    '<button onclick="window.print()" style="background:#1e293b;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:12px">&#128196; Imprimer / Enregistrer PDF</button>'+
    '</div></div>'+

    // Synthese KPI
    '<h2>Synthèse globale</h2>'+
    '<div class="kpi-grid">'+
    '<div class="kpi"><div class="kpi-label">Valeur du parc</div><div class="kpi-value">'+f(totalValeur)+'</div></div>'+
    '<div class="kpi"><div class="kpi-label">Capital restant dû</div><div class="kpi-value negative">'+f(totalCap)+'</div></div>'+
    '<div class="kpi"><div class="kpi-label">Patrimoine net</div><div class="kpi-value '+(patrimoineNet>=0?'positive':'negative')+'">'+f(patrimoineNet)+'</div></div>'+
    '<div class="kpi"><div class="kpi-label">Mensualités totales</div><div class="kpi-value">'+f(totalMens)+'/m</div></div>'+
    '<div class="kpi"><div class="kpi-label">Loyers bruts</div><div class="kpi-value positive">'+f(totalLoyers)+'/m</div></div>'+
    '<div class="kpi"><div class="kpi-label">CF après impôt</div><div class="kpi-value '+(totalCF>=0?'positive':'negative')+'">'+f(totalCF)+'/m</div></div>'+
    '</div>'+

    // Capacite d endettement
    (revMens > 0 ?
    '<h2>Capacité d\'endettement</h2>'+
    '<table style="font-size:11px;margin-bottom:20px">'+
    row('Revenus mensuels nets', f(revMens))+
    row('Loyers retenus par la banque ('+loyPct+'%)', '+'+f(loyersBanque))+
    row('Revenus bancaires totaux', f(revBanque), true)+
    row('Mensualités actuelles totales', f(totalMens))+
    row('Taux d\'endettement actuel', fp(tauxEndo), false, tauxEndo>tauxMax?'#dc2626':'#16a34a')+
    row('Taux d\'endettement maximum', fp(tauxMax))+
    row('Capacité de mensualité restante', f(Math.max(0,capRestante)), true, capRestante>=0?'#16a34a':'#dc2626')+
    '</table>'
    : '<div style="font-size:11px;color:#6b7280;margin-bottom:20px;font-style:italic">Renseignez vos revenus mensuels dans le Cockpit pour afficher la capacité d\'endettement.</div>') +

    // Detail des biens
    '<h2>Détail des biens</h2>'+
    biensSections+

    // Pied de page
    '<div style="margin-top:30px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:9px;color:#9ca3af;text-align:center">'+
    'Document généré par Parc Immobilier · '+dateStr+' · Estimations indicatives, ne remplace pas un conseil professionnel'+
    '</div>'+
    '</body></html>';
}

function loadExemple(){
  var now=new Date();
  function mkLoyers(loyer, n){
    var rows=[];
    for(var i=n-1; i>=0; i--){
      var d=new Date(now.getFullYear(),now.getMonth()-i,1);
      var mo=String(d.getMonth()+1); if(mo.length<2) mo='0'+mo;
      var key=d.getFullYear()+'-'+mo;
      var ok=i>1;
      rows.push({mois:key,prevu:loyer,encaisse:ok?loyer:null,statut:ok?'ok':'nd'});
    }
    return rows;
  }

  // ─── BIEN 1 : Résidence principale — Objat (Maison 110m²) ───
  // 3 crédits combinés en un seul bien pour simplicité d'affichage
  // Crédit 1 principal : 535,24€ · Crédit 2 PTZ 0% : 151,52€ · Crédit 3 complémentaire : 62,05€
  var b1={
    id:uid(),
    nom:'RP Maison Objat — 110m²',
    type:'rp',
    date:'2022-01',
    adresse:'Fontaine, Objat 19130 — Maison 3ch, garage, buanderie, 2 WC',
    achat:142000,
    frais:0,
    travauxAchat:0,
    valeur:220000,
    // Total 3 crédits : 74 560,15 + 40 000 + 14 608,35
    capitalInit:142000,
    capitalDu:129168,
    // Mensualités : 535,24 (principal) + 151,52 (PTZ 0%) + 62,05 (complémentaire)
    mens:748,
    // Taux moyen pondéré indicatif
    taux:2.80,
    assur:0,
    finCredit:'2046-01',
    banque:'3 crédits (principal 4,10% + PTZ 0% + compl. 1,50%)',
    loyer:0,chargesLoc:0,tf:1200,pno:0,copro:0,gest:0,
    statut:'actif',
    structureAchat:'seul',
    associes:'',
    quotePart:100,
    dashVisible:true,
    provisionTravaux:0,
    fraisDossier:0,
    fraisDossierType:'fixe',
    loyers:[],
    travaux:[]
  };

  // ─── BIEN 2 : Studio Allassac — Projet locatif ───
  // Prix net vendeur : 35 000 € | Agence : 4 900 € | Notaire : 4 220 € | Travaux : 3 000 €
  // Capital total : 47 120 € | Taux : 3,10% | 20 ans | Assurance : 0,30%
  // Mensualité crédit : 263,69 € | Assurance : 11,78 € | TOTAL : 275,47 €/mois
  // Loyer estimé : 395 €/mois | TF estimée : 324 €/an
  // CF estimé : 395 - 275,47 - 27 = +92,53 €/mois
  var b2={
    id:uid(),
    nom:'Studio Allassac 19240 — Projet locatif',
    type:'loc',
    date:'',
    adresse:'Allassac, Corrèze 19240',
    achat:35000,
    frais:9120,
    travauxAchat:3000,
    valeur:35000,
    capitalInit:47120,
    capitalDu:47120,
    mens:264,
    taux:3.10,
    assur:12,
    finCredit:'2046-01',
    banque:'En cours de simulation',
    loyer:395,
    chargesLoc:0,
    tf:324,
    pno:10,
    copro:0,
    gest:0,
    statut:'projet',
    structureAchat:'seul',
    associes:'',
    quotePart:100,
    dashVisible:true,
    provisionTravaux:30,
    fraisDossier:1000,
    fraisDossierType:'fixe',
    loyers:mkLoyers(395,6),
    travaux:[]
  };

  normalizeBien(b1); normalizeBien(b2);
  S.biens.push(b1); S.biens.push(b2);
  addNavTab(b1); buildBienPage(b1);
  addNavTab(b2); buildBienPage(b2);
  renderLoyers(b2);
  renderTravaux(b1); renderTravaux(b2);

  // Config cockpit : à ajuster selon tes revenus réels
  S.config.revenusMensuels=0;
  S.config.tauxEndettementMax=35;
  S.config.loyersPrisEnCompte=70;
  S.config.margeSecurite=10;
  loadConfig();
  refreshDash();
  saveAll();
}

// ═══════════════════════════════════════════════════
// INIT — chargement automatique des données
// ═══════════════════════════════════════════════════