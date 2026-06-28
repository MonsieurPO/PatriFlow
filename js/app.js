/* ═══════════════════════════════════════════════════════════
   PATRIMOINE COCKPIT — app.js v0.8
   Couche UI : navigation, rendu des pages, interactions
   Dépend de : data.js (calculs, STORE, S)
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ── HELPERS DOM ────────────────────────────────────────── */
function gid(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }

function setHTML(id, html) {
  var el = gid(id);
  if (el) el.innerHTML = html;
}

function show(id) { var el = gid(id); if (el) el.classList.remove('hidden'); }
function hide(id) { var el = gid(id); if (el) el.classList.add('hidden'); }

/* ── NAVIGATION ─────────────────────────────────────────── */
var CURRENT_PAGE = 'dashboard';
var CURRENT_BIEN_ID = null;

function navigateTo(page, bienId) {
  CURRENT_PAGE = page;
  CURRENT_BIEN_ID = bienId || null;

  // Masquer toutes les pages
  var pages = qsa('.page-view');
  for (var i = 0; i < pages.length; i++) {
    pages[i].classList.remove('active');
  }

  // Nav items
  var navItems = qsa('.nav-item');
  for (var i = 0; i < navItems.length; i++) {
    navItems[i].classList.remove('active');
  }

  // Activer la bonne page
  var target = gid('page-' + page);
  if (target) target.classList.add('active');

  // Activer le nav item correspondant
  var navActive = qs('[data-page="' + page + '"]');
  if (navActive) navActive.classList.add('active');

  // Mettre à jour le titre du header
  var titles = {
    dashboard: 'Tableau de bord',
    biens: 'Mes biens',
    bien: 'Fiche bien',
    locataires: 'Locataires',
    credits: 'Crédits',
    loyers: 'Loyers',
    documents: 'Documents',
    cockpit: 'Synthèse patrimoniale',
    parametres: 'Paramètres',
  };
  setHTML('header-title', titles[page] || page);

  // v0.95 : Analytics — mesure du temps par page
  if (typeof Analytics !== 'undefined') Analytics.page(page);

  // Rendu de la page
  renderPage(page, bienId);

  // Fermer le menu mobile
  closeMobileMenu();

  // Scroll haut
  var content = qs('.content');
  if (content) content.scrollTop = 0;
}

function renderPage(page, bienId) {
  switch (page) {
    case 'dashboard':  renderDashboard(); break;
    case 'biens':      renderBiens(); break;
    case 'bien':       renderFicheBien(bienId); break;
    case 'add':        if (typeof resetAddForm === 'function') resetAddForm(); break;
    case 'locataires': renderLocataires(); break;
    case 'credits':    renderCredits(); break;
    case 'loyers':     renderLoyers2(); break;
    case 'documents':  renderDocuments2(); break;
    case 'cockpit':    renderCockpit(); break;
    case 'parametres': renderParametres(); break;
  }
}

/* ── MOBILE MENU ────────────────────────────────────────── */
function toggleMobileMenu() {
  var sidebar = qs('.sidebar');
  var overlay = qs('.mobile-overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('open');
}

function closeMobileMenu() {
  var sidebar = qs('.sidebar');
  var overlay = qs('.mobile-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

/* ── FORMATAGE ─────────────────────────────────────────── */
function fmtEuro(v) {
  if (isNaN(v) || v === null || v === undefined) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(v));
}

function fmtPct(v, d) {
  if (isNaN(v) || v === null) return '—';
  return (d !== undefined ? v.toFixed(d) : v.toFixed(1)).replace('.', ',') + ' %';
}

function fmtDate(str) {
  if (!str) return '—';
  var p = str.split('-');
  if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
  if (p.length === 2) {
    var mois = ['jan.','fév.','mars','avr.','mai','juin','juil.','août','sep.','oct.','nov.','déc.'];
    return mois[parseInt(p[1]) - 1] + ' ' + p[0];
  }
  return str;
}

function delta(v, suffix) {
  if (!v && v !== 0) return '';
  var sign = v >= 0 ? '+' : '';
  var cls = v >= 0 ? 'positive' : 'negative';
  return '<span class="kpi-delta ' + cls + '">' + sign + fmtEuro(v) + (suffix || '') + '</span>';
}

/* ── BADGE STATUT ───────────────────────────────────────── */
function badgeStatut(statut) {
  var map = {
    actif:      { cls: 'badge-actif',     label: 'Actif' },
    projet:     { cls: 'badge-projet',    label: 'Projet' },
    'a-vendre': { cls: 'badge-vendre',    label: 'À vendre' },
    vendu:      { cls: 'badge-vendu',     label: 'Vendu' },
    rembourse:  { cls: 'badge-rembourse', label: 'Remboursé' },
    annule:     { cls: 'badge-annule',    label: 'Annulé' },
  };
  var s = map[statut] || { cls: '', label: statut || '—' };
  return '<span class="badge ' + s.cls + '">' + s.label + '</span>';
}

function badgeType(type) {
  var map = {
    rp:  { cls: 'badge-type-rp',   label: '🏠 RP' },
    loc: { cls: 'badge-type-loc',  label: '🏘 Locatif' },
  };
  var t = map[type] || { cls: '', label: type };
  return '<span class="badge ' + t.cls + '">' + t.label + '</span>';
}

/* ── UTILS ─────────────────────────────────────────────── */
function biensActifs() {
  var res = [];
  for (var i = 0; i < S.biens.length; i++) {
    var b = S.biens[i];
    if (b.dashVisible !== false && b.statut !== 'vendu' && b.statut !== 'annule') res.push(b);
  }
  return res;
}

function biensLocatifs(biens) {
  var res = [];
  for (var i = 0; i < biens.length; i++) {
    if (biens[i].type === 'loc') res.push(biens[i]);
  }
  return res;
}

/* ── PAGE DASHBOARD ─────────────────────────────────────── */
function renderDashboard() {
  var actifs = biensActifs();
  var locs = biensLocatifs(actifs);

  // Calcul KPIs
  var totalValeur = 0, totalDette = 0, totalMens = 0, totalLoyers = 0, totalCF = 0;
  for (var i = 0; i < actifs.length; i++) {
    var b = actifs[i];
    totalValeur += nv(b.valeur);
    totalDette  += nv(b.capitalDu);
    totalMens   += nv(b.mens) + nv(b.assur);
  }
  for (var i = 0; i < locs.length; i++) {
    totalLoyers += nv(locs[i].loyer);
    totalCF     += calcCFApresImpot(locs[i]);
  }
  var patrimoineNet = totalValeur - totalDette;
  var rendBrut = totalValeur > 0 ? (totalLoyers * 12 / totalValeur * 100) : 0;

  // KPI cards
  var kpiHtml =
    kpiCard('Patrimoine net', fmtEuro(patrimoineNet), patrimoineNet >= 0 ? 'text-green' : 'text-red',
      totalValeur > 0 ? 'Valeur ' + fmtEuro(totalValeur) + ' · Dettes ' + fmtEuro(totalDette) : '') +
    kpiCard('Cash-flow mensuel', fmtEuro(totalCF), totalCF >= 0 ? 'text-green' : 'text-red',
      'Après crédit, charges & impôt') +
    kpiCard('Rendement brut', fmtPct(rendBrut), '', 'Loyers annuels / valeur parc') +
    kpiCard('Capital restant dû', fmtEuro(totalDette), 'text-red',
      actifs.length + ' bien(s) actif(s)');

  setHTML('kpi-container', kpiHtml);

  // Flux mensuels consolidés : locatif seul + impact RP
  renderFluxMensuels(actifs, locs);

  // Alertes
  renderAlertesDash(actifs, locs);

  // Évènements récents
  renderEvenements();

  // Graphique patrimoine
  renderGraphiquePatrimoine();

  // Patch stabilité : l'aperçu "Mes biens" du dashboard doit être reconstruit
  // à chaque rendu, sinon un bien ajouté n'apparaît pas avant rechargement complet.
  if (typeof renderDashBiensApercu === 'function') renderDashBiensApercu();
}

function kpiCard(label, value, valueClass, sub) {
  return '<div class="kpi-card">' +
    '<div class="kpi-label">' + label + '</div>' +
    '<div class="kpi-value ' + (valueClass || '') + '">' + value + '</div>' +
    (sub ? '<div class="kpi-sub">' + sub + '</div>' : '') +
    '</div>';
}


function renderFluxMensuels(actifs, locs) {
  var kpi = gid('kpi-container');
  if (!kpi || !kpi.parentNode) return;

  var box = gid('dash-flux-mensuels');
  if (!box) {
    box = document.createElement('div');
    box.id = 'dash-flux-mensuels';
    box.className = 'card mb-6';
    kpi.parentNode.insertBefore(box, kpi.nextSibling);
  }

  var entreesLoc = 0;
  var sortiesLoc = 0;
  var resultatLocAvantImpot = 0;
  var impotLoc = 0;
  var resultatLocApresImpot = 0;
  var rpMensualites = 0;
  var nbLoc = 0;
  var nbRp = 0;

  for (var i = 0; i < locs.length; i++) {
    var b = locs[i];
    nbLoc++;
    var loyer = nv(b.loyer);
    var credit = nv(b.mens) + nv(b.assur);
    var charges = (nv(b.tf) / 12) + nv(b.pno) + nv(b.copro) + nv(b.gest) + nv(b.provisionTravaux);
    var impot = typeof calcImpotMensuel === 'function' ? calcImpotMensuel(b) : 0;
    var cfAvant = loyer - credit - charges;
    var cfApres = cfAvant - impot;

    entreesLoc += loyer;
    sortiesLoc += credit + charges + impot;
    resultatLocAvantImpot += cfAvant;
    impotLoc += impot;
    resultatLocApresImpot += cfApres;
  }

  for (var j = 0; j < actifs.length; j++) {
    var a = actifs[j];
    if (a.type === 'rp') {
      nbRp++;
      rpMensualites += nv(a.mens) + nv(a.assur);
    }
  }

  var resultatApresRp = resultatLocApresImpot - rpMensualites;
  var couvertureRp = rpMensualites > 0 ? Math.max(0, Math.min(100, (resultatLocApresImpot / rpMensualites) * 100)) : null;
  var resteRp = rpMensualites - Math.max(0, resultatLocApresImpot);
  if (resteRp < 0) resteRp = 0;

  var statutParc = resultatLocApresImpot >= 0 ? 'Parc locatif positif' : 'Parc locatif négatif';
  var statutCouleur = resultatLocApresImpot >= 0 ? 'var(--color-green)' : 'var(--color-red)';
  var rpTxt = rpMensualites > 0
    ? (resultatLocApresImpot >= rpMensualites
        ? 'Le locatif couvre 100 % de la RP et laisse ' + fmtEuro(resultatLocApresImpot - rpMensualites) + '/mois.'
        : 'Le locatif couvre ' + fmtPct(couvertureRp || 0, 0) + ' de la RP. Reste à financer : ' + fmtEuro(resteRp) + '/mois.')
    : 'Aucune résidence principale active renseignée.';

  box.innerHTML =
    '<div class="card-header">' +
      '<div>' +
        '<div class="card-title">Flux mensuels consolidés</div>' +
        '<div class="text-xs text-secondary">Locatif après charges et impôts, puis impact de la résidence principale.</div>' +
      '</div>' +
      '<div class="badge" style="background:' + (resultatLocApresImpot >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)') + ';color:' + statutCouleur + '">' + statutParc + '</div>' +
    '</div>' +
    '<div class="card-body-sm">' +
      '<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:0">' +
        kpiCard('Entrées locatives', fmtEuro(entreesLoc) + '/m', 'text-green', nbLoc + ' bien(s) locatif(s)') +
        kpiCard('Sorties locatives', fmtEuro(sortiesLoc) + '/m', 'text-red', 'Crédits + charges + impôts') +
        kpiCard('Résultat locatif', fmtEuro(resultatLocApresImpot) + '/m', resultatLocApresImpot >= 0 ? 'text-green' : 'text-red', 'Avant impôt : ' + fmtEuro(resultatLocAvantImpot) + ' · Impôt : ' + fmtEuro(impotLoc)) +
        kpiCard('Après crédit RP', fmtEuro(resultatApresRp) + '/m', resultatApresRp >= 0 ? 'text-green' : 'text-red', 'RP : ' + fmtEuro(rpMensualites) + '/m') +
      '</div>' +
      '<div class="alert alert-info mt-4" style="align-items:center">' +
        '<div><strong>Lecture rapide :</strong> ' + rpTxt + '</div>' +
      '</div>' +
    '</div>';
}

function renderAlertesDash(actifs, locs) {
  var html = genererAlertes(S.biens, actifs, locs);
  setHTML('dash-alertes', html ? '<div class="flex flex-col gap-2">' + html + '</div>' : '');
}

function renderEvenements() {
  // Loyers non encaissés récents
  var now = new Date();
  var events = [];
  var nowMois = now.getFullYear() * 12 + now.getMonth();

  for (var i = 0; i < S.biens.length; i++) {
    var b = S.biens[i];
    if (!b.loyers) continue;
    for (var j = 0; j < b.loyers.length; j++) {
      var l = b.loyers[j];
      var p = l.mois.split('-');
      var lMois = parseInt(p[0]) * 12 + parseInt(p[1]);
      if (nowMois - lMois <= 3 && l.encaisse !== null) {
        events.push({
          type: l.statut === 'ok' ? 'success' : 'warning',
          label: 'Loyer ' + escapeHTML(b.nom),
          detail: fmtEuro(l.encaisse) + ' · ' + fmtDate(l.mois),
        });
      }
    }
  }

  var html = '';
  for (var i = 0; i < Math.min(events.length, 5); i++) {
    var e = events[i];
    var color = e.type === 'success' ? 'var(--color-green)' : 'var(--color-amber)';
    html += '<div class="flex items-center gap-3" style="padding:8px 0;border-bottom:1px solid var(--color-border)">' +
      '<div style="width:6px;height:6px;border-radius:50%;background:' + color + ';flex-shrink:0"></div>' +
      '<span class="text-sm flex-1">' + escapeHTML(e.label) + '</span>' +
      '<span class="text-sm font-mono text-secondary">' + escapeHTML(e.detail) + '</span>' +
      '</div>';
  }
  if (!html) html = '<div class="empty-state" style="padding:var(--space-6)"><div class="empty-desc">Aucun événement récent</div></div>';
  setHTML('dash-events', html);
}

function renderGraphiquePatrimoine() {
  var hist = S.historiquePatrimoine || [];
  var el = gid('dash-graph');
  if (!el) return;

  if (hist.length < 2) {
    el.innerHTML = '<div class="empty-state"><div class="empty-desc">Le graphique apparaîtra après 2 snapshots mensuels.</div></div>';
    return;
  }

  var data = hist.slice().sort(function(a, b) { return a.date < b.date ? -1 : 1; });
  var W = 400, H = 140, pL = 10, pR = 10, pT = 10, pB = 28;
  var w = W - pL - pR, h = H - pT - pB, n = data.length;

  var allVals = [];
  for (var i = 0; i < data.length; i++) {
    allVals.push(data[i].valeurParc, data[i].capitalDu, data[i].patrimoineNet);
  }
  var maxV = Math.max.apply(null, allVals);
  var minV = Math.min.apply(null, allVals);
  if (maxV === minV) maxV = minV + 1;

  function xp(i) { return pL + (i / (n - 1)) * w; }
  function yp(v) { return pT + h - ((v - minV) / (maxV - minV)) * h; }

  function poly(key, color) {
    var pts = '';
    for (var i = 0; i < data.length; i++) pts += xp(i).toFixed(1) + ',' + yp(data[i][key]).toFixed(1) + ' ';
    return '<polyline points="' + pts.trim() + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  }

  var xlabels = '';
  var labelIdxs = [0, n - 1];
  if (n > 4) labelIdxs.push(Math.floor(n / 2));
  for (var li = 0; li < labelIdxs.length; li++) {
    var idx = labelIdxs[li];
    var dp = data[idx].date.split('-');
    var lbl = dp[1] + '/' + dp[0].slice(2);
    var anchor = idx === 0 ? 'start' : idx === n - 1 ? 'end' : 'middle';
    xlabels += '<text x="' + xp(idx).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="' + anchor +
      '" font-family="Inter,sans-serif" font-size="9" fill="#9CA3AF">' + lbl + '</text>';
  }

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" style="display:block">';
  for (var gi = 0; gi <= 3; gi++) {
    var gy = pT + (gi / 3) * h;
    svg += '<line x1="' + pL + '" y1="' + gy.toFixed(1) + '" x2="' + (pL + w) + '" y2="' + gy.toFixed(1) + '" stroke="#E5E7EB" stroke-width="1"/>';
  }
  svg += poly('valeurParc', '#3B6CF4');
  svg += poly('capitalDu', '#EF4444');
  svg += poly('patrimoineNet', '#10B981');
  svg += xlabels;
  svg += '</svg>';

  var last = data[data.length - 1];
  el.innerHTML = svg +
    '<div class="flex gap-4 mt-2">' +
    '<span class="text-xs" style="color:#3B6CF4">● Valeur brute</span>' +
    '<span class="text-xs" style="color:#EF4444">● Dettes</span>' +
    '<span class="text-xs" style="color:#10B981">● Patrimoine net</span>' +
    '</div>' +
    '<div class="text-sm font-bold mt-2" style="color:#10B981">' + fmtEuro(last.patrimoineNet) + '</div>';
}

/* ── PAGE MES BIENS ─────────────────────────────────────── */
function renderBiens() {
  var biens = S.biens;
  var el = gid('page-biens-content');
  if (!el) return;

  // Sous-titre
  var sub = gid('biens-subtitle');
  if (sub) sub.textContent = biens.length
    ? biens.length + ' bien' + (biens.length > 1 ? 's' : '')
    : '';

  if (!biens.length) {
    el.innerHTML = '<div class="empty-state">' +
      '<div class="empty-icon">🏠</div>' +
      '<div class="empty-title">Aucun bien enregistré</div>' +
      '<div class="empty-desc">Ajoutez votre premier bien immobilier.</div>' +
      '<button class="btn btn-primary mt-4" onclick="navigateTo(\'add\')">+ Ajouter un bien</button>' +
      '</div>';
    return;
  }

  // Mobile = cartes, desktop = tableau
  el.innerHTML = window.innerWidth < 768
    ? _renderBiensCartes(biens)
    : _renderBiensTableau(biens);
}

/** Cartes verticales — mobile */
function _renderBiensCartes(biens) {
  var html = '<div style="display:flex;flex-direction:column;gap:12px">';
  for (var i = 0; i < biens.length; i++) {
    var b = biens[i];
    var cf  = b.type === 'loc' ? calcCFApresImpot(b) : null;
    var mens = nv(b.mens) + nv(b.assur);
    var cfColor = cf === null ? 'var(--color-text-primary)'
                : cf >= 0    ? 'var(--color-green)'
                :              'var(--color-red)';

    // Ville depuis adresse
    var ville = '';
    if (b.adresse) {
      var parts = b.adresse.split(',');
      ville = parts[parts.length - 1].trim().replace(/^\d{5}\s*/, '');
    }

    html += '<div style="background:var(--color-surface);border:1px solid var(--color-border);' +
      'border-radius:12px;padding:16px;cursor:pointer;' +
      'box-shadow:0 1px 3px rgba(0,0,0,.06)" onclick="navigateTo(\'bien\',\'' + b.id + '\')">';

    // Ligne 1 : nom + badges
    html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;' +
      'gap:8px;margin-bottom:12px">';
    html += '<div style="flex:1;min-width:0">';
    html += '<div style="font-size:15px;font-weight:700;color:var(--color-text-primary);' +
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHTML(b.nom) + '</div>';
    if (ville) html += '<div style="font-size:12px;color:var(--color-text-muted);margin-top:2px">' +
      escapeHTML(ville) + '</div>';
    html += '</div>';
    html += '<div style="display:flex;gap:4px;align-items:center;flex-shrink:0">' +
      badgeType(b.type) + badgeStatut(b.statut) + '</div>';
    html += '</div>';

    // Ligne 2 : 3 métriques
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;' +
      'background:var(--color-bg);border-radius:8px;padding:10px;margin-bottom:12px">';
    html += _kpiMobile('Valeur', fmtEuro(b.valeur), '');
    if (b.type === 'loc') {
      html += _kpiMobile('Loyer/m', fmtEuro(b.loyer), 'var(--color-green)');
      html += _kpiMobile('CF/mois', fmtEuro(cf), cfColor);
    } else {
      html += _kpiMobile('Mensualité', fmtEuro(mens), 'var(--color-blue)');
      html += _kpiMobile('Capital dû', fmtEuro(b.capitalDu), 'var(--color-red)');
    }
    html += '</div>';

    // Ligne 3 : boutons action
    html += '<div style="display:flex;gap:8px">';
    html += '<button class="btn btn-primary" style="flex:1;font-size:13px;min-height:42px" ' +
      'onclick="event.stopPropagation();navigateTo(\'bien\',\'' + b.id + '\')">Voir la fiche →</button>';
    html += '<button class="btn btn-secondary" style="min-height:42px;min-width:42px;padding:8px" ' +
      'onclick="event.stopPropagation();navigateTo(\'bien\',\'' + b.id + '\');' +
      'switchFicheTab(\'parametres\',getBien(\'' + b.id + '\'))" title="Modifier">✏️</button>';
    html += '</div>';

    html += '</div>';
  }
  html += '</div>';
  return html;
}

/** Mini KPI pour carte bien */
function _kpiMobile(label, value, color) {
  return '<div style="text-align:center">' +
    '<div style="font-size:10px;font-weight:600;text-transform:uppercase;' +
    'letter-spacing:.04em;color:var(--color-text-muted);margin-bottom:3px">' + label + '</div>' +
    '<div style="font-size:13px;font-weight:700;font-family:var(--font-mono);' +
    'color:' + (color || 'var(--color-text-primary)') + ';white-space:nowrap">' + value + '</div>' +
    '</div>';
}

/** Tableau — desktop */
function _renderBiensTableau(biens) {
  var html = '<div class="table-wrapper"><table class="data-table"><thead><tr>' +
    '<th>Bien</th><th>Type</th><th>Statut</th>' +
    '<th class="col-number">Valeur</th><th class="col-number">Loyer/m</th>' +
    '<th class="col-number">CF/m</th><th class="col-number">Rendement</th><th></th>' +
    '</tr></thead><tbody>';

  for (var i = 0; i < biens.length; i++) {
    var b = biens[i];
    var cf   = b.type === 'loc' ? calcCFApresImpot(b) : null;
    var cout = nv(b.achat) + nv(b.frais) + nv(b.travauxAchat);
    var rend = (cout > 0 && b.type === 'loc') ? (nv(b.loyer) * 12 / cout * 100) : null;
    var cfSt = cf === null ? '' : cf >= 0
      ? 'style="color:var(--color-green)"'
      : 'style="color:var(--color-red)"';

    html += '<tr onclick="navigateTo(\'bien\',\'' + b.id + '\')">' +
      '<td><div class="font-medium">' + escapeHTML(b.nom) + '</div>' +
      (b.adresse ? '<div class="text-xs text-muted mt-1">' + escapeHTML(b.adresse) + '</div>' : '') +
      '</td>' +
      '<td>' + badgeType(b.type) + '</td>' +
      '<td>' + badgeStatut(b.statut) + '</td>' +
      '<td class="col-number font-mono">' + fmtEuro(b.valeur) + '</td>' +
      '<td class="col-number font-mono" style="color:var(--color-green)">' +
        (b.type === 'loc' ? fmtEuro(b.loyer) : '—') + '</td>' +
      '<td class="col-number font-mono" ' + cfSt + '>' +
        (cf !== null ? fmtEuro(cf) : '—') + '</td>' +
      '<td class="col-number font-mono">' + (rend !== null ? fmtPct(rend) : '—') + '</td>' +
      '<td><button class="btn btn-ghost btn-icon btn-sm" ' +
        'onclick="event.stopPropagation();navigateTo(\'bien\',\'' + b.id + '\')">→</button></td>' +
      '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}



/* ── FICHE BIEN ─────────────────────────────────────────── */
var FICHE_TAB = 'apercu';

function renderFicheBien(bienId) {
  var b = getBien(bienId);
  if (!b) { navigateTo('biens'); return; }

  setHTML('fiche-bien-header', renderFicheHeader(b));
  setHTML('fiche-bien-tabs', renderFicheTabs(b));
  switchFicheTab(FICHE_TAB, b);
}

function renderFicheHeader(b) {
  var cf = b.type === 'loc' ? calcCFApresImpot(b) : null;
  var cout = nv(b.achat) + nv(b.frais) + nv(b.travauxAchat);
  var rend = (cout > 0 && b.type === 'loc') ? (nv(b.loyer) * 12 / cout * 100) : null;
  var equity = nv(b.valeur) - nv(b.capitalDu);

  var kpis = '';
  kpis += kpiMini('Valeur estimée', fmtEuro(b.valeur), '');
  if (b.type === 'loc') kpis += kpiMini('Loyer HC/mois', fmtEuro(b.loyer), 'text-green');
  if (cf !== null) kpis += kpiMini('Cash-flow/mois', fmtEuro(cf), cf >= 0 ? 'text-green' : 'text-red');
  if (rend !== null) kpis += kpiMini('Rendement brut', fmtPct(rend), '');
  if (b.type === 'rp') kpis += kpiMini('Equity', fmtEuro(equity), 'text-blue');
  kpis += kpiMini('Mensualité', fmtEuro(nv(b.mens) + nv(b.assur)) + '/m', 'text-blue');

  return '<div class="flex items-start justify-between gap-4 mb-4">' +
    '<div>' +
    '<div class="flex items-center gap-2 mb-1">' +
    '<button class="btn btn-ghost btn-sm" onclick="navigateTo(\'biens\')" style="padding:4px 8px;font-size:11px">← Mes biens</button>' +
    '</div>' +
    '<h1 class="page-title">' + escapeHTML(b.nom) + '</h1>' +
    (b.adresse ? '<p class="page-subtitle">' + escapeHTML(b.adresse) + '</p>' : '') +
    '<div class="flex gap-2 mt-2">' + badgeType(b.type) + badgeStatut(b.statut) + '</div>' +
    '</div>' +
    '<button class="btn btn-secondary btn-sm" onclick="ouvrirEditionBien(\'' + b.id + '\')">✏️ Modifier</button>' +
    '</div>' +
    '<div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:0">' + kpis + '</div>';
}

function kpiMini(label, value, cls) {
  return '<div class="kpi-card" style="padding:var(--space-4)">' +
    '<div class="kpi-label">' + label + '</div>' +
    '<div class="kpi-value text-xl ' + cls + '">' + value + '</div>' +
    '</div>';
}

function renderFicheTabs(b) {
  var tabs = [
    { id: 'apercu',      label: 'Aperçu' },
    { id: 'financement', label: 'Financement' },
    { id: 'revenus',     label: 'Revenus & Charges', onlyLoc: true },
    { id: 'loyers',      label: 'Suivi loyers',      onlyLoc: true },
    { id: 'travaux',     label: 'Travaux' },
    { id: 'documents',   label: 'Documents' },
    { id: 'parametres',  label: 'Paramètres' },
  ];
  var html = '<div class="tabs">';
  for (var i = 0; i < tabs.length; i++) {
    var t = tabs[i];
    if (t.onlyLoc && b.type !== 'loc') continue;
    html += '<button class="tab-item' + (FICHE_TAB === t.id ? ' active' : '') + '" ' +
      'onclick="switchFicheTab(\'' + t.id + '\',getBien(\'' + b.id + '\'))">' + t.label + '</button>';
  }
  html += '</div>';
  return html;
}

function switchFicheTab(tabId, b) {
  FICHE_TAB = tabId;
  // Update tab active state
  var tabItems = qsa('.tab-item');
  for (var i = 0; i < tabItems.length; i++) {
    tabItems[i].classList.toggle('active', tabItems[i].textContent === tabLabelById(tabId));
  }

  var html = '';
  switch (tabId) {
    case 'apercu':      html = renderFicheApercu(b); break;
    case 'financement': html = renderFicheFinancement(b); break;
    case 'revenus':     html = renderFicheRevenus(b); break;
    case 'loyers':      html = renderFicheLoyers(b); break;
    case 'travaux':     html = renderFicheTravaux(b); break;
    case 'documents':   html = renderFicheDocuments(b); break;
    case 'parametres':  html = renderFicheParametres(b); break;
    default: html = '';
  }
  setHTML('fiche-bien-content', html);
}

function tabLabelById(id) {
  var map = { apercu:'Aperçu', financement:'Financement', revenus:'Revenus & Charges',
    loyers:'Suivi loyers', travaux:'Travaux', documents:'Documents', parametres:'Paramètres' };
  return map[id] || id;
}

/* Aperçu */
function renderFicheApercu(b) {
  var cout = nv(b.achat) + nv(b.frais) + nv(b.travauxAchat);
  var pv = nv(b.valeur) - cout;
  var equity = nv(b.valeur) - nv(b.capitalDu);
  var pctRemb = nv(b.capitalInit) > 0 ? ((nv(b.capitalInit) - nv(b.capitalDu)) / nv(b.capitalInit) * 100) : 0;

  var html = '<div class="flex gap-4" style="flex-wrap:wrap">';

  // Infos générales
  html += '<div class="card flex-1" style="min-width:280px">';
  html += '<div class="card-header"><div class="card-title">Informations générales</div></div>';
  html += '<div class="card-body-sm">';
  html += tableRow('Type de bien', b.type === 'rp' ? 'Résidence principale' : 'Locatif');
  if (b.adresse) tableRow('Adresse', b.adresse);
  html += tableRow('Date d\'acquisition', fmtDate(b.date));
  html += tableRow('Prix d\'achat', fmtEuro(b.achat));
  html += tableRow('Frais (notaire + agence)', fmtEuro(b.frais));
  if (nv(b.travauxAchat)) html += tableRow('Travaux à l\'achat', fmtEuro(b.travauxAchat));
  html += tableRow('Coût de revient', fmtEuro(cout));
  html += tableRow('Valeur estimée', fmtEuro(b.valeur));
  html += tableRow('Plus-value latente', '<span style="color:' + (pv >= 0 ? 'var(--color-green)' : 'var(--color-red)') + '">' + fmtEuro(pv) + '</span>');
  html += tableRow('Equity', '<span style="color:var(--color-blue)">' + fmtEuro(equity) + '</span>');
  if (b.banque) html += tableRow('Banque', b.banque);
  html += tableRow('Structure', structureLabel(b.structureAchat));
  html += tableRow('Régime fiscal', b.type === 'loc' ? regimeLabel(b.regimeFiscal) : '—');
  html += '</div></div>';

  // Crédit synthèse
  html += '<div class="card flex-1" style="min-width:280px">';
  html += '<div class="card-header"><div class="card-title">Crédit en cours</div></div>';
  html += '<div class="card-body-sm">';
  html += tableRow('Capital initial', fmtEuro(b.capitalInit));
  html += tableRow('Capital restant dû', '<span style="color:var(--color-red)">' + fmtEuro(b.capitalDu) + '</span>');
  html += tableRow('Remboursé', fmtPct(pctRemb));
  html += tableRow('Mensualité', fmtEuro(nv(b.mens) + nv(b.assur)) + '/mois');
  html += tableRow('Taux', fmtPct(b.taux));
  html += tableRow('Fin de crédit', fmtDate(b.finCredit));
  html += '</div></div>';

  html += '</div>';

  // Associés si indivision/SCI
  if (b.structureAchat === 'indivision' || b.structureAchat === 'sci') {
    html += '<div class="card mt-4"><div class="card-header"><div class="card-title">Associés & capacité d\'emprunt</div></div>';
    html += '<div class="card-body" id="ap-list-' + b.id + '"></div></div>';
    // renderAssocies sera appelé après l'injection du HTML
    setTimeout(function() { renderAssocies(b); }, 0);
  }

  return html;
}

function tableRow(label, value) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--color-border);gap:8px">' +
    '<span style="font-size:12px;color:var(--color-text-secondary);flex-shrink:0">' + label + '</span>' +
    '<span style="font-size:13px;font-weight:500;text-align:right">' + value + '</span>' +
    '</div>';
}

/* Financement */
function renderFicheFinancement(b) {
  var amort = calcAmortissement(b);
  var pctRemb = nv(b.capitalInit) > 0 ? ((nv(b.capitalInit) - nv(b.capitalDu)) / nv(b.capitalInit) * 100) : 0;
  var totalInt = amort ? interetsTotalCredit(b) : null;

  var html = '<div class="flex gap-4" style="flex-wrap:wrap">';

  // Crédit détail
  html += '<div class="card" style="flex:1;min-width:260px"><div class="card-header"><div class="card-title">Détail du crédit</div></div><div class="card-body-sm">';
  html += tableRow('Capital emprunté', fmtEuro(b.capitalInit));
  html += tableRow('Capital restant dû', '<span style="color:var(--color-red)">' + fmtEuro(b.capitalDu) + '</span>');
  html += tableRow('Remboursé', fmtPct(pctRemb, 1));
  html += tableRow('Mensualité crédit', fmtEuro(b.mens));
  html += tableRow('Assurance emprunteur', fmtEuro(b.assur) + '/mois');
  html += tableRow('Total mensualité', fmtEuro(nv(b.mens) + nv(b.assur)));
  html += tableRow('Taux d\'intérêt', fmtPct(b.taux));
  html += tableRow('Début du crédit', fmtDate(b.date));
  html += tableRow('Fin du crédit', fmtDate(b.finCredit));
  if (b.banque) html += tableRow('Banque', b.banque);
  html += '</div></div>';

  // Tableau amortissement synthèse
  if (amort) {
    html += '<div class="card" style="flex:1;min-width:260px"><div class="card-header"><div class="card-title">Amortissement</div></div><div class="card-body-sm">';
    html += tableRow('Durée totale', Math.round(amort.dureeTotaleMois / 12 * 10) / 10 + ' ans');
    html += tableRow('Durée restante', Math.floor(amort.dureeRestanteMois / 12) + ' ans ' + amort.dureeRestanteMois % 12 + ' mois');
    html += tableRow('CRD théorique', fmtEuro(amort.crdTheorique));
    html += tableRow('Total intérêts', totalInt !== null ? '<span style="color:var(--color-red)">-' + fmtEuro(totalInt) + '</span>' : '—');
    html += tableRow('Intérêts année en cours', '<span style="color:var(--color-amber)">-' + fmtEuro(interetsAnneeCourante(b)) + '</span>');
    html += tableRow('Coût total crédit', fmtEuro(nv(b.capitalInit) + (totalInt || 0)));

    // Alerte écart
    if (b.capitalDu > 0 && amort.crdTheorique > 0) {
      var ecartPct = Math.abs(b.capitalDu - amort.crdTheorique) / b.capitalDu * 100;
      if (ecartPct > 5) {
        html += '<div class="alert alert-warning mt-3" style="font-size:11px">⚠️ Écart de ' + Math.round(ecartPct) + '% entre le CRD saisi et le théorique. Vérifiez auprès de votre banque.</div>';
      }
    }
    html += '</div></div>';
  }

  html += '</div>';

  // Graphique amortissement
  if (amort && amort.tableau.length > 0) {
    html += '<div class="card mt-4"><div class="card-header"><div class="card-title">Répartition capital / intérêts par année</div></div><div class="card-body">';
    html += buildAmortGraph(b, amort);
    html += '</div></div>';
  }

  return html;
}

function buildAmortGraph(b, amort) {
  var byYear = {};
  var years = [];
  for (var mi = 0; mi < amort.tableau.length; mi++) {
    var yr = Math.floor(mi / 12) + 1;
    if (!byYear[yr]) { byYear[yr] = { cap: 0, int: 0 }; years.push(yr); }
    byYear[yr].cap += amort.tableau[mi].capital;
    byYear[yr].int += amort.tableau[mi].interet;
  }
  var maxVal = 0;
  for (var ai = 0; ai < years.length; ai++) {
    var tot = byYear[years[ai]].cap + byYear[years[ai]].int;
    if (tot > maxVal) maxVal = tot;
  }
  var svgW = 320, barH = 10, barGap = 4;
  var svgH = years.length * (barH + barGap) + 20;
  var scaleX = maxVal > 0 ? (svgW - 60) / maxVal : 1;
  var currentYearIdx = Math.floor(amort.dureeEcouleeMois / 12);
  var svgStr = '<svg viewBox="0 0 ' + svgW + ' ' + svgH + '" width="100%" style="max-width:400px;display:block;margin:0 auto 12px">';
  for (var ai = 0; ai < years.length; ai++) {
    var yr = years[ai];
    var y = ai * (barH + barGap);
    var capW = byYear[yr].cap * scaleX;
    var intW = byYear[yr].int * scaleX;
    var isCurrent = (ai === currentYearIdx);
    svgStr += '<text x="0" y="' + (y + barH - 1) + '" font-family="Inter,sans-serif" font-size="8" fill="' + (isCurrent ? '#3B6CF4' : '#9CA3AF') + '">' + yr + '</text>';
    svgStr += '<rect x="28" y="' + y + '" width="' + capW.toFixed(1) + '" height="' + barH + '" fill="#3B6CF4" rx="2"/>';
    svgStr += '<rect x="' + (28 + capW).toFixed(1) + '" y="' + y + '" width="' + intW.toFixed(1) + '" height="' + barH + '" fill="#EF4444" rx="2"/>';
  }
  svgStr += '</svg>';
  return svgStr + '<div class="flex gap-4 text-xs text-secondary">' +
    '<span style="color:#3B6CF4">● Capital</span>' +
    '<span style="color:#EF4444">● Intérêts</span>' +
    '<span style="color:#3B6CF4;font-weight:600">● Année en cours</span>' +
    '</div>';
}

/* Revenus & Charges */
function renderFicheRevenus(b) {
  if (b.type !== 'loc') return '<div class="empty-state"><div class="empty-desc">Disponible uniquement pour les biens locatifs.</div></div>';

  var cfAvant  = calcCF(b);
  var impot    = calcImpotMensuel(b);
  var cfApres  = cfAvant - impot;
  var idet     = calcImpotDetail(b);
  var mensTotal = nv(b.mens) + nv(b.assur);
  var depenses = mensTotal + nv(b.tf) / 12 + nv(b.pno) + nv(b.copro) + nv(b.gest) + nv(b.provisionTravaux);

  var html = '<div class="flex gap-4" style="flex-wrap:wrap">';

  // Recettes
  html += '<div class="card" style="flex:1;min-width:260px"><div class="card-header"><div class="card-title">Recettes mensuelles</div></div><div class="card-body-sm">';
  var percuMoy = loyerPercuMoyenne(b, 3);
  html += tableRow('Loyer théorique', '<span style="color:var(--color-green)">' + fmtEuro(b.loyer) + '</span>');
  if (percuMoy !== null) {
    html += tableRow('Loyer perçu (moy. 3 mois)', '<span style="color:var(--color-green)">' + fmtEuro(percuMoy) + '</span>');
  }
  html += '</div></div>';

  // Charges
  html += '<div class="card" style="flex:1;min-width:260px"><div class="card-header"><div class="card-title">Charges mensuelles</div></div><div class="card-body-sm">';
  html += tableRow('Mensualité (crédit + assur.)', '<span style="color:var(--color-red)">-' + fmtEuro(mensTotal) + '</span>');
  if (nv(b.tf) > 0) html += tableRow('Taxe foncière (÷12)', '<span style="color:var(--color-red)">-' + fmtEuro(nv(b.tf) / 12) + '</span>');
  if (nv(b.pno) > 0) html += tableRow('PNO', '<span style="color:var(--color-red)">-' + fmtEuro(b.pno) + '</span>');
  if (nv(b.copro) > 0) html += tableRow('Charges copropriété', '<span style="color:var(--color-red)">-' + fmtEuro(b.copro) + '</span>');
  if (nv(b.gest) > 0) html += tableRow('Gestion locative', '<span style="color:var(--color-red)">-' + fmtEuro(b.gest) + '</span>');
  if (nv(b.provisionTravaux) > 0) html += tableRow('Provision travaux', '<span style="color:var(--color-red)">-' + fmtEuro(b.provisionTravaux) + '</span>');
  html += tableRow('Total charges', '<span style="color:var(--color-red);font-weight:600">-' + fmtEuro(depenses) + '</span>');
  html += '</div></div>';

  html += '</div>';

  // CF synthèse
  html += '<div class="card mt-4"><div class="card-header"><div class="card-title">Cash-flow</div></div><div class="card-body">';
  html += '<div class="flex gap-4" style="flex-wrap:wrap">';
  html += '<div style="flex:1;padding:var(--space-4);border-radius:var(--radius-md);background:' + (cfAvant >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)') + '">' +
    '<div class="kpi-label">CF avant impôt</div>' +
    '<div class="kpi-value" style="color:' + (cfAvant >= 0 ? 'var(--color-green)' : 'var(--color-red)') + ';font-size:20px">' + fmtEuro(cfAvant) + '/mois</div>' +
    '</div>';
  html += '<div style="flex:1;padding:var(--space-4);border-radius:var(--radius-md);background:' + (cfApres >= 0 ? 'var(--color-green-light)' : 'var(--color-red-light)') + '">' +
    '<div class="kpi-label">CF après impôt</div>' +
    '<div class="kpi-value" style="color:' + (cfApres >= 0 ? 'var(--color-green)' : 'var(--color-red)') + ';font-size:20px">' + fmtEuro(cfApres) + '/mois</div>' +
    '<div class="kpi-sub">Impôt estimé : -' + fmtEuro(impot) + '/mois (' + regimeLabel(b.regimeFiscal) + ', TMI ' + b.tmi + '%)</div>' +
    '</div>';
  html += '</div></div></div>';

  return html;
}

/* Suivi loyers */
function renderFicheLoyers(b) {
  if (b.type !== 'loc') return '';
  var html = '<div id="loyers-container-' + b.id + '"></div>';
  setTimeout(function() {
    var el = gid('loyers-container-' + b.id);
    if (!el) return;
    // Injecter le conteneur puis appeler renderLoyers
    el.innerHTML = '<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:12px">' +
      '<button class="btn btn-secondary btn-sm" onclick="toutOk(\'' + b.id + '\')">✓ Tout encaissé</button>' +
      '<button class="btn btn-primary btn-sm" onclick="addMois(\'' + b.id + '\')">+ Mois</button>' +
      '</div>' +
      '<div id="lrows-' + b.id + '"></div>' +
      '<div id="lrecap-' + b.id + '" class="text-xs text-secondary mt-2"></div>';
    renderLoyers(b);
  }, 0);
  return html;
}

/* Travaux */
function renderFicheTravaux(b) {
  var html = '<div class="flex justify-between items-center mb-4">' +
    '<h3 class="font-semibold">Dépenses & travaux</h3>' +
    '</div>';

  // Formulaire ajout
  html += '<div class="card mb-4"><div class="card-header"><div class="card-title">Enregistrer une dépense</div></div><div class="card-body">';
  html += '<div class="form-row mb-3">';
  html += '<div class="form-group"><label class="form-label">Date</label><input type="date" class="form-input" id="tv-date-' + b.id + '"></div>';
  html += '<div class="form-group"><label class="form-label">Montant <em>€</em></label><input type="number" class="form-input" id="tv-amt-' + b.id + '" placeholder="500"></div>';
  html += '</div>';
  html += '<div class="form-group mb-3"><label class="form-label">Description</label><input type="text" class="form-input" id="tv-desc-' + b.id + '" placeholder="Chauffe-eau, peinture..."></div>';
  html += '<div class="form-row mb-3">';
  html += '<div class="form-group"><label class="form-label">Entreprise <em>optionnel</em></label><input type="text" class="form-input" id="tv-entreprise-' + b.id + '" placeholder="Plomberie Dupont"></div>';
  html += '<div class="form-group"><label class="form-label">N° facture <em>optionnel</em></label><input type="text" class="form-input" id="tv-facture-' + b.id + '" placeholder="FA-2024-001"></div>';
  html += '</div>';
  html += '<button class="btn btn-primary" onclick="addTravaux(\'' + b.id + '\')">+ Enregistrer</button>';
  html += '</div></div>';

  // Liste travaux
  html += '<div class="card"><div class="card-header"><div class="card-title">Historique</div></div>';
  html += '<div id="tvlist-' + b.id + '"></div></div>';

  setTimeout(function() { renderTravaux(b); }, 0);
  return html;
}

/* Documents */
function renderFicheDocuments(b) {
  var html = '<div class="card mb-4"><div class="card-header"><div class="card-title">Ajouter un document</div></div><div class="card-body">';
  html += '<div class="form-row mb-3">';
  html += '<div class="form-group"><label class="form-label">Nom du document</label><input type="text" class="form-input" id="doc-nom-' + b.id + '" placeholder="Acte de vente"></div>';
  html += '<div class="form-group"><label class="form-label">Catégorie</label>';
  html += '<select class="form-input" id="doc-cat-' + b.id + '">';
  var cats = {acte:'Acte/Titre', amort:'Amortissement', tf:'Taxe foncière', dpe:'DPE',
    assur:'Assurance', bail:'Bail', photo:'Photo', autre:'Autre'};
  for (var k in cats) html += '<option value="' + k + '">' + cats[k] + '</option>';
  html += '</select></div></div>';
  html += '<div class="form-group mb-3"><label class="form-label">URL (lien Drive, etc.)</label><input type="url" class="form-input" id="doc-url-' + b.id + '" placeholder="https://drive.google.com/..."></div>';
  html += '<button class="btn btn-primary btn-sm" onclick="addDocument(\'' + b.id + '\')">+ Ajouter</button>';
  html += '</div></div>';

  html += '<div class="card"><div class="card-header"><div class="card-title">Documents liés</div></div>';
  html += '<div id="doclist-' + b.id + '"></div></div>';

  setTimeout(function() { renderDocuments(b); }, 0);
  return html;
}

/* Paramètres */
function renderFicheParametres(b) {
  var id = b.id;
  var html = '<div class="flex gap-4" style="flex-wrap:wrap">';

  // Général
  html += '<div class="card" style="flex:1;min-width:280px"><div class="card-header"><div class="card-title">Informations générales</div></div><div class="card-body">';
  html += '<div class="form-group mb-3"><label class="form-label">Nom du bien</label><input type="text" class="form-input" value="' + b.nom + '" onchange="updBienNom(\'' + id + '\',this.value)"></div>';
  html += '<div class="form-group mb-3"><label class="form-label">Adresse</label><input type="text" class="form-input" value="' + (b.adresse || '') + '" onchange="updBienGeneralStr(\'' + id + '\',\'adresse\',this.value)"></div>';
  html += '<div class="form-row mb-3">';
  html += '<div class="form-group"><label class="form-label">Date d\'achat</label><input type="date" class="form-input" value="' + (b.date || '') + '" onchange="updBienGeneralStr(\'' + id + '\',\'date\',this.value)"></div>';
  html += '<div class="form-group"><label class="form-label">Fin de crédit</label><input type="date" class="form-input" value="' + (b.finCredit || '') + '" onchange="updBienGeneralStr(\'' + id + '\',\'finCredit\',this.value)"></div>';
  html += '</div>';
  html += '<div class="form-row mb-3">';
  html += '<div class="form-group"><label class="form-label">Prix d\'achat <em>€</em></label><input type="number" class="form-input" value="' + b.achat + '" onchange="updBienGeneral(\'' + id + '\',\'achat\',this.value)"></div>';
  html += '<div class="form-group"><label class="form-label">Frais notaire+agence <em>€</em></label><input type="number" class="form-input" value="' + b.frais + '" onchange="updBienGeneral(\'' + id + '\',\'frais\',this.value)"></div>';
  html += '</div>';
  html += '<div class="form-group mb-3"><label class="form-label">Travaux à l\'achat <em>€</em></label><input type="number" class="form-input" value="' + b.travauxAchat + '" onchange="updBienGeneral(\'' + id + '\',\'travauxAchat\',this.value)"></div>';
  html += '<div class="form-row mb-3">';
  html += '<div class="form-group"><label class="form-label">Statut</label><select class="form-input" onchange="updBienStr(\'' + id + '\',\'statut\',this.value)">';
  var statuts = ['actif','projet','a-vendre','vendu','rembourse','annule'];
  var statutLbls = ['Actif','Projet','À vendre','Vendu','Remboursé','Annulé'];
  for (var si = 0; si < statuts.length; si++) html += '<option value="' + statuts[si] + '"' + (b.statut === statuts[si] ? ' selected' : '') + '>' + statutLbls[si] + '</option>';
  html += '</select></div>';
  html += '<div class="form-group"><label class="form-label">Structure</label><select class="form-input" onchange="updBienStr(\'' + id + '\',\'structureAchat\',this.value)">';
  var structs = ['seul','couple','indivision','sci','societe'];
  var structLbls = ['Seul','Couple','Indivision','SCI','Société'];
  for (var si = 0; si < structs.length; si++) html += '<option value="' + structs[si] + '"' + (b.structureAchat === structs[si] ? ' selected' : '') + '>' + structLbls[si] + '</option>';
  html += '</select></div></div>';
  html += '</div></div>';

  // Crédit
  html += '<div class="card" style="flex:1;min-width:280px"><div class="card-header"><div class="card-title">Crédit</div></div><div class="card-body">';
  html += '<div class="form-group mb-3"><label class="form-label">Banque</label><input type="text" class="form-input" value="' + (b.banque || '') + '" onchange="updBienGeneralStr(\'' + id + '\',\'banque\',this.value)"></div>';
  html += '<div class="form-group mb-3"><label class="form-label">Capital initial <em>€</em></label><input type="number" class="form-input" value="' + b.capitalInit + '" onchange="updBienGeneral(\'' + id + '\',\'capitalInit\',this.value)"></div>';
  html += '<div class="form-row mb-3">';
  html += '<div class="form-group"><label class="form-label">Capital restant dû <em>€</em></label><input type="number" class="form-input" value="' + b.capitalDu + '" oninput="updBien(\'' + id + '\',\'capitalDu\',this.value)"></div>';
  html += '<div class="form-group"><label class="form-label">Mensualité <em>€</em></label><input type="number" class="form-input" value="' + b.mens + '" oninput="updBien(\'' + id + '\',\'mens\',this.value)"></div>';
  html += '</div>';
  html += '<div class="form-row mb-3">';
  html += '<div class="form-group"><label class="form-label">Assurance <em>€/m</em></label><input type="number" class="form-input" value="' + b.assur + '" oninput="updBien(\'' + id + '\',\'assur\',this.value)"></div>';
  html += '<div class="form-group"><label class="form-label">Taux <em>%</em></label><input type="number" class="form-input" value="' + b.taux + '" step="0.01" oninput="updBien(\'' + id + '\',\'taux\',this.value)"></div>';
  html += '</div>';
  html += '</div></div>';

  html += '</div>';

  // Charges locatives (si loc)
  if (b.type === 'loc') {
    html += '<div class="card mt-4"><div class="card-header"><div class="card-title">Charges & loyer</div></div><div class="card-body">';
    html += '<div class="form-row mb-3">';
    html += '<div class="form-group"><label class="form-label">Loyer théorique <em>€/m</em></label><input type="number" class="form-input" value="' + b.loyer + '" onchange="updBienLoyer(\'' + id + '\',this.value)"></div>';
    html += '<div class="form-group"><label class="form-label">Taxe foncière <em>€/an</em></label><input type="number" class="form-input" value="' + b.tf + '" onchange="updBienCharge(\'' + id + '\',\'tf\',this.value)"></div>';
    html += '</div>';
    html += '<div class="form-row mb-3">';
    html += '<div class="form-group"><label class="form-label">PNO <em>€/m</em></label><input type="number" class="form-input" value="' + b.pno + '" onchange="updBienCharge(\'' + id + '\',\'pno\',this.value)"></div>';
    html += '<div class="form-group"><label class="form-label">Copropriété <em>€/m</em></label><input type="number" class="form-input" value="' + b.copro + '" onchange="updBienCharge(\'' + id + '\',\'copro\',this.value)"></div>';
    html += '</div>';
    html += '<div class="form-row mb-3">';
    html += '<div class="form-group"><label class="form-label">Gestion locative <em>€/m</em></label><input type="number" class="form-input" id="chg-gest-' + id + '" value="' + b.gest.toFixed(2) + '"' + (b.gestionPct > 0 ? ' disabled' : '') + ' onchange="updBienCharge(\'' + id + '\',\'gest\',this.value)"></div>';
    html += '<div class="form-group"><label class="form-label">Gestion <em>% loyer</em></label><input type="number" class="form-input" value="' + (b.gestionPct || '') + '" placeholder="0" step="0.5" onchange="updBienCharge(\'' + id + '\',\'gestionPct\',this.value)"></div>';
    html += '</div>';
    html += '<div class="form-group mb-3"><label class="form-label">Provision travaux <em>€/m</em></label><input type="number" class="form-input" value="' + b.provisionTravaux + '" oninput="updBien(\'' + id + '\',\'provisionTravaux\',this.value)"></div>';

    // Fiscalité
    html += '<div class="divider-label">Fiscalité</div>';
    html += '<div class="form-row mb-3">';
    html += '<div class="form-group"><label class="form-label">Régime fiscal</label><select class="form-input" onchange="updBienStr(\'' + id + '\',\'regimeFiscal\',this.value);renderPage(\'bien\',\'' + id + '\')">';
    var regimes = ['micro-foncier','reel-foncier','micro-bic','lmnp-reel'];
    var rLbls = ['Micro-foncier (30%)','Réel foncier','Micro-BIC (50%)','LMNP réel'];
    for (var ri = 0; ri < regimes.length; ri++) html += '<option value="' + regimes[ri] + '"' + (b.regimeFiscal === regimes[ri] ? ' selected' : '') + '>' + rLbls[ri] + '</option>';
    html += '</select></div>';
    html += '<div class="form-group"><label class="form-label">TMI</label><select class="form-input" onchange="updBien(\'' + id + '\',\'tmi\',this.value)">';
    var tmis = [0,11,30,41,45];
    for (var ti = 0; ti < tmis.length; ti++) html += '<option value="' + tmis[ti] + '"' + (b.tmi === tmis[ti] ? ' selected' : '') + '>' + tmis[ti] + ' %</option>';
    html += '</select></div></div>';
    html += '</div></div>';
  }

  // Zone danger
  html += '<div class="card mt-4" style="border-color:var(--color-red-light)"><div class="card-header"><div class="card-title" style="color:var(--color-red)">Zone de danger</div></div>';
  html += '<div class="card-body"><button class="btn btn-danger" onclick="deleteBien(\'' + id + '\')">🗑 Supprimer ce bien définitivement</button>';
  html += '<div class="form-hint mt-2">Cette action est irréversible. Toutes les données (loyers, travaux, documents) seront perdues.</div>';
  html += '</div></div>';

  return html;
}

/* ── PAGE LOCATAIRES ─────────────────────────────────────── */
function renderLocataires() {
  var html = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">Gestion des locataires</div><div class="empty-desc">Cette section sera disponible dans la prochaine mise à jour.</div></div>';
  setHTML('page-locataires-content', html);
}

/* ── PAGE CRÉDITS ────────────────────────────────────────── */
function renderCredits() {
  var biens = S.biens;
  var html = '';
  var totalCap = 0, totalMens = 0;

  var rows = '';
  for (var i = 0; i < biens.length; i++) {
    var b = biens[i];
    if (!nv(b.capitalDu) && !nv(b.mens)) continue;
    totalCap  += nv(b.capitalDu);
    totalMens += nv(b.mens) + nv(b.assur);
    var pctRemb = nv(b.capitalInit) > 0 ? ((nv(b.capitalInit) - nv(b.capitalDu)) / nv(b.capitalInit) * 100) : 0;
    rows += '<tr onclick="navigateTo(\'bien\',\'' + b.id + '\')">' +
      '<td><div class="font-medium">' + escapeHTML(b.nom) + '</div><div class="text-xs text-muted">' + (b.banque || '—') + '</div></td>' +
      '<td class="col-number font-mono" style="color:var(--color-red)">' + fmtEuro(b.capitalDu) + '</td>' +
      '<td class="col-number">' + fmtPct(b.taux) + '</td>' +
      '<td class="col-number font-mono">' + fmtEuro(nv(b.mens) + nv(b.assur)) + '/m</td>' +
      '<td class="col-number">' + fmtDate(b.finCredit) + '</td>' +
      '<td>' +
      '<div style="width:100%;height:4px;background:var(--color-border);border-radius:2px;overflow:hidden">' +
      '<div style="width:' + pctRemb.toFixed(0) + '%;height:100%;background:var(--color-blue);border-radius:2px"></div>' +
      '</div>' +
      '<div class="text-xs text-muted mt-1">' + fmtPct(pctRemb, 0) + ' remboursé</div>' +
      '</td>' +
      '</tr>';
  }

  if (!rows) {
    html = '<div class="empty-state"><div class="empty-icon">🏦</div><div class="empty-title">Aucun crédit enregistré</div></div>';
  } else {
    html = '<div class="kpi-grid mb-6" style="grid-template-columns:repeat(2,1fr)">' +
      kpiCard('Capital restant total', fmtEuro(totalCap), 'text-red', 'Tous les crédits en cours') +
      kpiCard('Mensualités totales', fmtEuro(totalMens) + '/m', 'text-blue', 'Crédit + assurances') +
      '</div>';
    html += '<div class="table-wrapper"><table class="data-table"><thead><tr>' +
      '<th>Bien</th><th class="col-number">Capital dû</th><th class="col-number">Taux</th>' +
      '<th class="col-number">Mensualité</th><th class="col-number">Fin du crédit</th><th>Avancement</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  setHTML('page-credits-content', html);
}

/* ── PAGE LOYERS ─────────────────────────────────────────── */
function renderLoyers2() {
  var locs = biensLocatifs(S.biens);
  if (!locs.length) {
    setHTML('page-loyers-content', '<div class="empty-state"><div class="empty-icon">💶</div><div class="empty-title">Aucun bien locatif</div><div class="empty-desc">Ajoutez un bien de type locatif pour suivre les loyers.</div></div>');
    return;
  }

  var selectedId = window.SELECTED_LOYER_BIEN_ID || locs[0].id;
  var exists = false;
  for (var i = 0; i < locs.length; i++) if (locs[i].id === selectedId) exists = true;
  if (!exists) selectedId = locs[0].id;
  window.SELECTED_LOYER_BIEN_ID = selectedId;

  var bsel = getBien(selectedId) || locs[0];

  var html = '<div class="card mb-4"><div class="card-header" style="align-items:flex-end;flex-wrap:wrap;gap:12px">';
  html += '<div><div class="card-title">Suivi des loyers</div><div class="text-xs text-secondary">Sélectionnez un appartement, puis cochez les mois payés un par un.</div></div>';
  html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
  html += '<select class="form-input" style="width:auto;min-width:240px" onchange="window.SELECTED_LOYER_BIEN_ID=this.value;renderLoyers2()">';
  for (var i = 0; i < locs.length; i++) {
    var b = locs[i];
    html += '<option value="' + b.id + '"' + (b.id === selectedId ? ' selected' : '') + '>' + escapeHTML(b.nom) + '</option>';
  }
  html += '</select>';
  html += '<button class="btn btn-primary btn-sm" onclick="addMois(\'' + bsel.id + '\');renderLoyers2()">+ Mois</button>';
  html += '</div></div>';
  html += '<div class="card-body-sm">';
  html += '<div id="lrows-' + bsel.id + '"></div>';
  html += '<div id="lrecap-' + bsel.id + '" class="text-xs text-secondary mt-2"></div>';
  html += '</div></div>';
  setHTML('page-loyers-content', html);
  renderLoyers(bsel);
}

/* ── PAGE DOCUMENTS ──────────────────────────────────────── */
function renderDocuments2() {
  var html = '';
  var hasAny = false;

  for (var i = 0; i < S.biens.length; i++) {
    var b = S.biens[i];
    if (!b.documents || !b.documents.length) continue;
    hasAny = true;
    html += '<div class="card mb-4"><div class="card-header">';
    html += '<div class="card-title">' + escapeHTML(b.nom) + '</div>';
    html += '<button class="btn btn-ghost btn-sm" onclick="navigateTo(\'bien\',\'' + b.id + '\');switchFicheTab(\'documents\',getBien(\'' + b.id + '\'))">Gérer →</button>';
    html += '</div><div id="doclist-' + b.id + '"></div></div>';
  }

  if (!hasAny) {
    html = '<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-title">Aucun document</div><div class="empty-desc">Ajoutez des documents depuis la fiche de chaque bien.</div></div>';
  }

  setHTML('page-documents-content', html);
  for (var i = 0; i < S.biens.length; i++) {
    if (S.biens[i].documents && S.biens[i].documents.length) renderDocuments(S.biens[i]);
  }
}

/* ── PAGE COCKPIT / SYNTHÈSE ─────────────────────────────── */
function renderCockpit() {
  var actifs = biensActifs();
  var locs   = biensLocatifs(actifs);

  var totalValeur = 0, totalDette = 0, totalMens = 0, totalLoyers = 0, totalCF = 0;
  for (var i = 0; i < actifs.length; i++) {
    totalValeur += nv(actifs[i].valeur);
    totalDette  += nv(actifs[i].capitalDu);
    totalMens   += nv(actifs[i].mens) + nv(actifs[i].assur);
  }
  for (var i = 0; i < locs.length; i++) {
    totalLoyers += nv(locs[i].loyer);
    totalCF     += calcCFApresImpot(locs[i]);
  }
  var patrimoineNet = totalValeur - totalDette;
  var rendBrut = totalValeur > 0 ? (totalLoyers * 12 / totalValeur * 100) : 0;
  var cfg = S.config;
  var revMens = nv(cfg.revenusMensuels);
  var tauxMax = nv(cfg.tauxEndettementMax) || 35;
  var loyPct  = nv(cfg.loyersPrisEnCompte) || 70;
  var loyersBanque = totalLoyers * loyPct / 100;
  var revBanque    = revMens + loyersBanque;
  var tauxEndo     = revBanque > 0 ? totalMens / revBanque * 100 : 0;
  var capRestante  = revBanque > 0 ? revBanque * tauxMax / 100 - totalMens : 0;

  // KPIs
  var html = '<div class="kpi-grid mb-6">' +
    kpiCard('Patrimoine brut',    fmtEuro(totalValeur), '', 'Valeur estimée totale') +
    kpiCard('Dettes totales',     fmtEuro(totalDette), 'text-red', 'Capital restant dû') +
    kpiCard('Patrimoine net',     fmtEuro(patrimoineNet), patrimoineNet >= 0 ? 'text-green' : 'text-red', 'Brut − dettes') +
    kpiCard('CF mensuel net',     fmtEuro(totalCF), totalCF >= 0 ? 'text-green' : 'text-red', 'Après crédit, charges & impôt') +
    '</div>';

  // Alertes
  html += '<div class="mb-6" id="cockpit-alertes"></div>';

  // Capacité endettement
  if (revMens > 0) {
    var tendoColor = tauxEndo > tauxMax ? 'var(--color-red)' : tauxEndo > tauxMax * 0.85 ? 'var(--color-amber)' : 'var(--color-green)';
    html += '<div class="card mb-6"><div class="card-header"><div class="card-title">Capacité d\'endettement</div>';
    html += '<button class="btn btn-secondary btn-sm" onclick="exporterDossierPDF()">📄 Dossier PDF</button></div><div class="card-body">';
    html += '<div class="flex gap-4" style="flex-wrap:wrap;margin-bottom:16px">';
    html += '<div style="flex:1">';
    html += tableRow('Revenus mensuels nets', fmtEuro(revMens));
    html += tableRow('Loyers retenus (' + loyPct + '%)', '+' + fmtEuro(loyersBanque));
    html += tableRow('Revenus bancaires', fmtEuro(revBanque));
    html += tableRow('Mensualités totales', '-' + fmtEuro(totalMens));
    html += tableRow('Taux d\'endettement', '<span style="color:' + tendoColor + ';font-weight:700">' + fmtPct(tauxEndo) + '</span>');
    html += tableRow('Taux maximum', fmtPct(tauxMax));
    html += tableRow('Capacité restante', '<span style="color:' + (capRestante >= 0 ? 'var(--color-green)' : 'var(--color-red)') + ';font-weight:700">' + fmtEuro(Math.max(0, capRestante)) + '/mois</span>');
    html += '</div></div>';
    // Jauge
    var gPct = Math.min(100, tauxEndo).toFixed(1);
    html += '<div class="text-xs text-secondary mb-1">Taux d\'endettement · objectif max ' + tauxMax + '%</div>';
    html += '<div style="width:100%;height:6px;background:var(--color-border);border-radius:3px;overflow:hidden">' +
      '<div style="width:' + gPct + '%;height:100%;background:' + tendoColor + ';border-radius:3px;transition:width .5s ease"></div></div>';
    html += '</div></div>';
  }

  // Historique patrimoine
  html += '<div class="card mb-6"><div class="card-header"><div class="card-title">Évolution du patrimoine</div>';
  html += '<button class="btn btn-secondary btn-sm" onclick="snapshotPatrimoine();saveAll();renderCockpit()">📸 Snapshot</button>';
  html += '</div><div class="card-body"><div id="ck-historique"></div></div></div>';

  // Répartition par statut
  var sCount = { actif: 0, projet: 0, 'a-vendre': 0, vendu: 0, rembourse: 0, annule: 0 };
  for (var i = 0; i < S.biens.length; i++) sCount[S.biens[i].statut] = (sCount[S.biens[i].statut] || 0) + 1;
  html += '<div class="card"><div class="card-header"><div class="card-title">Biens par statut</div></div><div class="card-body">';
  html += '<div class="flex gap-3" style="flex-wrap:wrap">';
  var sLabels = { actif: 'Actif', projet: 'Projet', 'a-vendre': 'À vendre', vendu: 'Vendu', rembourse: 'Remboursé', annule: 'Annulé' };
  for (var sk in sCount) {
    if (sCount[sk] > 0) {
      html += '<div style="text-align:center;padding:12px 16px;background:var(--color-bg);border-radius:var(--radius-md);border:1px solid var(--color-border)">' +
        '<div style="font-size:20px;font-weight:700">' + sCount[sk] + '</div>' +
        '<div class="text-xs text-muted mt-1">' + (sLabels[sk] || sk) + '</div>' +
        '</div>';
    }
  }
  html += '</div></div></div>';

  setHTML('page-cockpit-content', html);

  // Alertes
  var alertHtml = genererAlertes(S.biens, actifs, locs);
  setHTML('cockpit-alertes', alertHtml || '');

  // Historique
  renderHistoriquePatrimoine();
}

/* ── PAGE PARAMÈTRES ─────────────────────────────────────── */
function renderParametres() {
  var cfg = S.config;
  var html = '<div class="flex gap-4" style="flex-wrap:wrap">';

  // Config générale
  html += '<div class="card" style="flex:1;min-width:280px"><div class="card-header"><div class="card-title">Paramètres financiers</div></div><div class="card-body">';
  html += '<div class="form-group mb-4"><label class="form-label">Revenus mensuels nets <em>€</em></label>';
  html += '<input type="number" class="form-input" id="cfg-revenus" value="' + (cfg.revenusMensuels || '') + '" placeholder="3500"></div>';
  html += '<div class="form-group mb-4"><label class="form-label">Taux d\'endettement max <em>%</em></label>';
  html += '<input type="number" class="form-input" id="cfg-taux-max" value="' + (cfg.tauxEndettementMax || 35) + '" placeholder="35"></div>';
  html += '<div class="form-group mb-4"><label class="form-label">Loyers pris en compte <em>%</em></label>';
  html += '<input type="number" class="form-input" id="cfg-loyers-pct" value="' + (cfg.loyersPrisEnCompte || 70) + '" placeholder="70"></div>';
  html += '<button class="btn btn-primary" onclick="saveConfig();renderDashboard()">Enregistrer</button>';
  html += '</div></div>';

  // Thème
  html += '<div class="card" style="flex:1;min-width:280px"><div class="card-header"><div class="card-title">Apparence</div></div><div class="card-body">';
  html += '<div class="form-group mb-4"><label class="form-label">Thème</label>';
  html += '<div class="flex gap-3 mt-2">';
  html += '<button class="btn btn-secondary" onclick="setTheme(\'light\')">☀️ Clair</button>';
  html += '<button class="btn btn-secondary" onclick="setTheme(\'dark\')">🌙 Sombre</button>';
  html += '<button class="btn btn-secondary" onclick="setTheme(\'auto\')">⚙️ Système</button>';
  html += '</div></div></div></div>';

  // Sauvegarde
  html += '<div class="card" style="flex:1;min-width:280px"><div class="card-header"><div class="card-title">Sauvegarde & export</div></div><div class="card-body">';
  html += '<div class="flex flex-col gap-3">';
  html += '<button class="btn btn-secondary btn-full" onclick="exportData()">📦 Backup JSON (export)</button>';
  html += '<button class="btn btn-secondary btn-full" onclick="gid(\'import-file-param\').click()">📂 Importer un Backup JSON</button>';
  html += '<input type="file" id="import-file-param" accept=".json" style="display:none" onchange="importData(event)">';
  html += '<button class="btn btn-secondary btn-full" onclick="exporterDossierPDF()">📄 Générer le dossier PDF</button>';
  html += '</div></div></div>';

  // Auth cloud
  html += '<div class="card" style="flex:1;min-width:280px"><div class="card-header"><div class="card-title">Synchronisation cloud</div></div><div class="card-body">';
  html += '<div id="param-auth-status" class="mb-4"></div>';
  html += '<button class="btn btn-primary btn-full" onclick="ouvrirModalAuth()">⚙️ Paramètres Supabase</button>';
  html += '</div></div>';

  html += '</div>';
  setHTML('page-parametres-content', html);
  updateParamAuthStatus();
}

function updateParamAuthStatus() {
  var el = gid('param-auth-status');
  if (!el) return;
  if (SUPA_USER) {
    el.innerHTML = '<div class="alert alert-success">✅ Connecté en tant que <strong>' + SUPA_USER.email + '</strong></div>';
  } else {
    el.innerHTML = '<div class="alert alert-info">Non connecté. Configurez Supabase pour synchroniser vos données.</div>';
  }
}

/* ── THÈME ───────────────────────────────────────────────── */
function setTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    // Auto : détecter préférence système
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  }
  // Persistance via STORE (plus de localStorage direct)
  STORE.saveRaw(STORE_THEME_KEY, theme);
}

function initTheme() {
  var saved = STORE.loadRaw(STORE_THEME_KEY);
  if (saved) setTheme(saved);
}

/* ── ACTIONS BIENS ───────────────────────────────────────── */

// Redirection vers la fiche pour édition
function ouvrirEditionBien(bienId) {
  switchFicheTab('parametres', getBien(bienId));
}

// addDocument adapté pour le nouveau HTML
function addDocument(bid) {
  var b = getBien(bid);
  if (!b) return;
  var nom = gid('doc-nom-' + bid) ? gid('doc-nom-' + bid).value.trim() : '';
  var url = gid('doc-url-' + bid) ? gid('doc-url-' + bid).value.trim() : '';
  var cat = gid('doc-cat-' + bid) ? gid('doc-cat-' + bid).value : 'autre';
  if (!nom || !url) { alert('Nom et URL obligatoires.'); return; }
  b.documents.push({ nom: nom, url: url, cat: cat });
  renderDocuments(b);
  if (gid('doc-nom-' + bid)) gid('doc-nom-' + bid).value = '';
  if (gid('doc-url-' + bid)) gid('doc-url-' + bid).value = '';
  saveAll();
}

/* ── SIDEBAR ALERTES ─────────────────────────────────────── */
function renderSidebarAlertes() {
  var actifs = biensActifs();
  var locs = biensLocatifs(actifs);
  var el = gid('sidebar-alertes');
  if (!el) return;

  var alerts = [];
  var now = new Date();
  var nowMois = now.getFullYear() * 12 + now.getMonth();

  for (var i = 0; i < actifs.length; i++) {
    var b = actifs[i];
    if (b.type === 'loc') {
      // Loyers non encaissés
      for (var j = 0; j < b.loyers.length; j++) {
        var l = b.loyers[j];
        var p = l.mois.split('-');
        var lMois = parseInt(p[0]) * 12 + parseInt(p[1]);
        if (nowMois - lMois <= 2 && l.statut === 'nok') {
          alerts.push({ cls: 'danger', title: 'Loyer impayé', desc: escapeHTML(b.nom) + ' · ' + fmtDate(l.mois) });
        }
      }
      // CF négatif
      if (calcCFApresImpot(b) < 0) {
        alerts.push({ cls: 'warning', title: 'CF négatif', desc: escapeHTML(b.nom) });
      }
    }
  }

  if (!alerts.length) { el.innerHTML = ''; return; }
  var html = '<div style="padding:0 8px 4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#4B5280">Alertes</div>';
  for (var i = 0; i < Math.min(alerts.length, 3); i++) {
    var a = alerts[i];
    html += '<div class="sidebar-alert-item ' + a.cls + '">' +
      '<div class="sidebar-alert-title">' + a.title + '</div>' +
      '<div class="sidebar-alert-date">' + a.desc + '</div>' +
      '</div>';
  }
  el.innerHTML = html;
}

/* ── ONBOARDING ──────────────────────────────────────────── */
// Clé localStorage pour savoir si l'onboarding a été complété
var ONBOARDING_KEY = 'parc_onboarding_done';

function checkOnboarding() {
  // Afficher l'onboarding uniquement si aucun bien et jamais vu
  if (S.biens.length === 0 && !STORE.loadRaw(ONBOARDING_KEY)) {
    showOnboarding();
    return true;
  }
  return false;
}

function showOnboarding() {
  var overlay = gid('onboarding-overlay');
  if (overlay) overlay.classList.add('open');
  showOnboardingStep(1);
}

function closeOnboarding(complete) {
  var overlay = gid('onboarding-overlay');
  if (overlay) overlay.classList.remove('open');
  if (complete) {
    STORE.saveRaw(ONBOARDING_KEY, '1');
    if (typeof Analytics !== 'undefined') Analytics.track('onboarding.completed');
  } else {
    if (typeof Analytics !== 'undefined') Analytics.track('onboarding.skipped');
  }
}

function showOnboardingStep(step) {
  for (var i = 1; i <= 3; i++) {
    var el = gid('onboarding-step-' + i);
    if (el) el.style.display = i === step ? 'block' : 'none';
  }
  // Progress dots
  var dots = document.querySelectorAll('.onboarding-dot');
  for (var i = 0; i < dots.length; i++) {
    dots[i].classList.toggle('active', i + 1 === step);
  }
}

function onboardingNext(step) {
  if (step >= 3) {
    closeOnboarding(true);
    navigateTo('add');
  } else {
    showOnboardingStep(step + 1);
  }
}

function onboardingDemo() {
  closeOnboarding(true);
  if (typeof Analytics !== 'undefined') Analytics.track('demo.started', { source: 'onboarding' });
  loadExemple();
  saveAll();
  navigateTo('dashboard');
}

/* ── MODE DÉMO ───────────────────────────────────────────── */
function activerModeDemo() {
  if (S.biens.length > 0) {
    if (!confirm('Activer le mode démo va remplacer vos données actuelles par des données fictives.\n\nContinuer ?')) return;
  }
  resetUI();
  // Reset S
  S = {
    biens: [],
    config: { revenusMensuels: 3200, tauxEndettementMax: 35, loyersPrisEnCompte: 70, margeSecurite: 10, tauxNotaireDefaut: 8, fraisDossierDefaut: 1500 },
    historiquePatrimoine: [],
    _v: DATA_VERSION
  };
  loadExemple();
  // Ajouter des snapshots démo pour le graphique
  var now = new Date();
  for (var i = 11; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var mo = String(d.getMonth() + 1); if (mo.length < 2) mo = '0' + mo;
    var moisCle = d.getFullYear() + '-' + mo;
    var base = 220000 + (11 - i) * 800;  // croissance simulée
    S.historiquePatrimoine.push({
      date: moisCle,
      valeurParc: base,
      capitalDu: 129000 - (11 - i) * 200,
      patrimoineNet: base - (129000 - (11 - i) * 200),
      cfMensuel: 52
    });
  }
  saveAll();
  navigateTo('dashboard');
}


function initUI() {
  // Mettre à jour le profil utilisateur dans la sidebar
  updateSidebarUser();
  renderSidebarAlertes();
}

function updateSidebarUser() {
  var nameEl = gid('sidebar-user-name');
  var statusEl = gid('sidebar-user-status-text');
  if (nameEl) nameEl.textContent = SUPA_USER ? SUPA_USER.email.split('@')[0] : 'Utilisateur';
  if (statusEl) statusEl.textContent = SUPA_USER ? 'Connecté' : 'Local uniquement';
  var dot = qs('.status-dot');
  if (dot) {
    dot.className = 'status-dot ' + (SUPA_USER ? 'connected' : '');
  }
}
