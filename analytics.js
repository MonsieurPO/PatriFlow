/* ═══════════════════════════════════════════════════════════
   PATRIMOINE COCKPIT — analytics.js v0.95.1
   ───────────────────────────────────────────────────────────
   Description  : Moteur d'analytics produit — version défensive
   Corrections  : v0.95.1
     - Fix H2 : .catch() ajouté sur toutes les Promises Supabase
     - Fix H3 : guard visibilitychange pour Safari iOS < 13
     - Fix H4 : crossorigin="anonymous" recommandé dans index.html
     - Diagnostic enrichi : fichier + ligne + stack dans error.js
   Principe     : Si Supabase absent ou en erreur → échec silencieux,
                  jamais bloquant, jamais d'UnhandledPromiseRejection
   Dépendances  : data.js (STORE) — supabase.js (SUPA_CLIENT, SUPA_USER)
   Version      : 0.95.1
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────
var ANALYTICS_TABLE      = 'analytics_events';
var ANALYTICS_BATCH_SIZE = 10;
var ANALYTICS_FLUSH_MS   = 30000;
var ANALYTICS_LOCAL_KEY  = 'parc_analytics_queue';
var ANALYTICS_ENABLED    = true;

// Détection environnement (preview local vs Netlify)
var ANALYTICS_IS_LOCAL = (
  typeof window !== 'undefined' &&
  window.location &&
  (window.location.protocol === 'file:' ||
   window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1')
);

// ─────────────────────────────────────────────────────────────
// ÉTAT INTERNE
// ─────────────────────────────────────────────────────────────
var _analyticsQueue  = [];
var _currentPage     = null;
var _pageStartTime   = null;
var _sessionStart    = Date.now();
var _flushTimer      = null;
var _analyticsReady  = false;

// ─────────────────────────────────────────────────────────────
// INITIALISATION
// ─────────────────────────────────────────────────────────────

function initAnalytics(options) {
  try {
    if (options && options.enabled === false) {
      ANALYTICS_ENABLED = false;
      return;
    }

    _analyticsReady = true;

    // Restaurer la file locale (events non envoyés session précédente)
    _restoreLocalQueue();

    // Timer de flush automatique
    _startFlushTimer();

    // Tracking erreurs JS — version enrichie pour diagnostic
    _setupErrorTracking();

    // FIX H3 : visibilitychange avec guard Safari iOS
    // document.hidden peut être undefined sur Safari iOS < 10
    if (typeof document.hidden !== 'undefined' ||
        typeof document.webkitHidden !== 'undefined') {
      var visEvent = typeof document.hidden !== 'undefined'
        ? 'visibilitychange'
        : 'webkitvisibilitychange';
      document.addEventListener(visEvent, function() {
        try {
          var hidden = document.hidden || document.webkitHidden;
          if (hidden) {
            _flushEndPage();
            Analytics.flush();
          }
        } catch(e) { /* silencieux */ }
      });
    }

    // Premier event de session
    Analytics.track('session.started', {
      referrer:   document.referrer || 'direct',
      userAgent:  navigator.userAgent.slice(0, 100),
      language:   navigator.language || 'unknown',
      screenW:    window.screen ? window.screen.width  : 0,
      screenH:    window.screen ? window.screen.height : 0,
      isLocal:    ANALYTICS_IS_LOCAL,
    });

  } catch(e) {
    // initAnalytics ne doit JAMAIS planter l'app
    _logDiag('initAnalytics', e);
  }
}

// ─────────────────────────────────────────────────────────────
// API PUBLIQUE
// ─────────────────────────────────────────────────────────────
var Analytics = {

  /**
   * Enregistre un événement produit.
   * Ne lève jamais d'exception — échec silencieux garanti.
   */
  track: function(event, properties) {
    try {
      if (!ANALYTICS_ENABLED) return;
      if (!event || typeof event !== 'string') return;

      // FIX : accès défensif à SUPA_USER (peut être undefined si supabase.js
      // pas encore exécuté au moment du premier track)
      var userId = null;
      try {
        userId = (typeof SUPA_USER !== 'undefined' && SUPA_USER && SUPA_USER.id)
          ? SUPA_USER.id
          : null;
      } catch(e2) { /* SUPA_USER pas encore défini */ }

      var payload = {
        event:      event,
        properties: properties || {},
        timestamp:  new Date().toISOString(),
        session_ms: Date.now() - _sessionStart,
        page:       _currentPage || 'unknown',
        user_id:    userId,
      };

      _analyticsQueue.push(payload);

      if (_analyticsQueue.length >= ANALYTICS_BATCH_SIZE) {
        Analytics.flush();
      }
    } catch(e) {
      _logDiag('Analytics.track', e);
    }
  },

  /**
   * Enregistre l'entrée sur une nouvelle page et mesure le temps passé.
   */
  page: function(page) {
    try {
      if (!ANALYTICS_ENABLED) return;
      _flushEndPage();
      _currentPage   = page;
      _pageStartTime = Date.now();
      Analytics.track('page.viewed', { page: page });
    } catch(e) {
      _logDiag('Analytics.page', e);
    }
  },

  /**
   * Envoie les events en attente vers Supabase.
   * FIX H2 : .catch() systématique — plus jamais d'UnhandledPromiseRejection.
   */
  flush: function() {
    try {
      if (!_analyticsQueue.length) return;

      // En mode local (file://) : stocker seulement, ne pas appeler Supabase
      if (ANALYTICS_IS_LOCAL) {
        _saveLocalQueue();
        return;
      }

      // Guard défensif : SUPA_CLIENT peut ne pas être initialisé
      var client = null;
      try { client = (typeof SUPA_CLIENT !== 'undefined') ? SUPA_CLIENT : null; }
      catch(e2) { /* silencieux */ }

      if (!client) {
        _saveLocalQueue();
        return;
      }

      var batch = _analyticsQueue.slice();
      _analyticsQueue = [];

      // FIX H2 : .catch() obligatoire sur toute Promise Supabase
      client
        .from(ANALYTICS_TABLE)
        .insert(batch)
        .then(function(res) {
          try {
            if (res && res.error) {
              // Erreur Supabase (ex: table inexistante) → stocker localement
              _analyticsQueue = batch.concat(_analyticsQueue);
              _saveLocalQueue();
            } else {
              STORE.remove(ANALYTICS_LOCAL_KEY);
            }
          } catch(e2) { /* silencieux */ }
        })
        .catch(function(err) {
          // FIX H2 : Promise rejetée → réinjecter dans la file locale
          // Sans ce .catch(), Safari lève "Script error" sur toute rejection
          try {
            _analyticsQueue = batch.concat(_analyticsQueue);
            _saveLocalQueue();
          } catch(e2) { /* silencieux */ }
        });

    } catch(e) {
      _logDiag('Analytics.flush', e);
    }
  },

  /**
   * Désactive la collecte (respect vie privée utilisateur).
   */
  disable: function() {
    try {
      ANALYTICS_ENABLED = false;
      _analyticsQueue = [];
      STORE.remove(ANALYTICS_LOCAL_KEY);
      if (_flushTimer) { clearInterval(_flushTimer); _flushTimer = null; }
    } catch(e) { /* silencieux */ }
  },

  /**
   * Retourne l'état actuel (utile pour le dashboard admin et le debug).
   */
  getStatus: function() {
    return {
      enabled:     ANALYTICS_ENABLED,
      ready:       _analyticsReady,
      queueSize:   _analyticsQueue.length,
      currentPage: _currentPage,
      sessionMs:   Date.now() - _sessionStart,
      isLocal:     ANALYTICS_IS_LOCAL,
    };
  }
};

// ─────────────────────────────────────────────────────────────
// FONCTIONS INTERNES
// ─────────────────────────────────────────────────────────────

/** Enregistre le temps passé sur la page courante. */
function _flushEndPage() {
  try {
    if (!_currentPage || !_pageStartTime) return;
    var duration = Date.now() - _pageStartTime;
    if (duration > 1000) {
      Analytics.track('page.time_spent', {
        page:        _currentPage,
        duration_ms: duration,
        duration_s:  Math.round(duration / 1000),
      });
    }
  } catch(e) { /* silencieux */ }
}

/** Démarre le timer de flush automatique. */
function _startFlushTimer() {
  try {
    if (_flushTimer) clearInterval(_flushTimer);
    _flushTimer = setInterval(function() {
      try { Analytics.flush(); } catch(e) { /* silencieux */ }
    }, ANALYTICS_FLUSH_MS);
  } catch(e) { /* silencieux */ }
}

/** Sauvegarde la file dans localStorage si Supabase indisponible. */
function _saveLocalQueue() {
  try {
    if (!_analyticsQueue.length) return;
    if (typeof STORE === 'undefined') return;
    var existing = STORE.load(ANALYTICS_LOCAL_KEY) || [];
    var merged = existing.concat(_analyticsQueue).slice(-100);
    STORE.save(ANALYTICS_LOCAL_KEY, merged);
    _analyticsQueue = [];
  } catch(e) { /* silencieux */ }
}

/** Restaure la file locale au démarrage. */
function _restoreLocalQueue() {
  try {
    if (typeof STORE === 'undefined') return;
    var saved = STORE.load(ANALYTICS_LOCAL_KEY);
    if (saved && saved.length) {
      _analyticsQueue = saved.concat(_analyticsQueue);
      STORE.remove(ANALYTICS_LOCAL_KEY);
    }
  } catch(e) { /* silencieux */ }
}

/**
 * Capture les erreurs JS globales avec diagnostic enrichi.
 * Étape 3 de la mission : plus jamais de "Script error" sans contexte.
 * En local → console.error avec stack complète.
 * En production → Analytics.track('error.js', {...}) vers Supabase.
 */
function _setupErrorTracking() {
  try {
    var _prevOnError = window.onerror;

    window.onerror = function(message, source, lineno, colno, error) {
      try {
        // Extraire le nom de fichier depuis l'URL complète
        var fileName = 'unknown';
        try {
          fileName = source ? source.split('/').pop().split('?')[0] : 'unknown';
        } catch(e2) { /* silencieux */ }

        // Récupérer la stack trace si disponible
        var stack = '';
        try {
          stack = (error && error.stack) ? error.stack.slice(0, 500) : '';
        } catch(e2) { /* silencieux */ }

        var errorData = {
          message:  String(message || 'unknown').slice(0, 200),
          file:     fileName,
          line:     lineno || 0,
          col:      colno  || 0,
          stack:    stack,
          page:     _currentPage || 'unknown',
          ua:       navigator.userAgent.slice(0, 80),
        };

        // En développement local : afficher dans la console avec tout le contexte
        if (ANALYTICS_IS_LOCAL) {
          console.group('[Cockpit Patrimonial — Erreur JS]');
          console.error('Message :', errorData.message);
          console.error('Fichier :', errorData.file, '| Ligne :', errorData.line);
          console.error('Page active :', errorData.page);
          if (stack) console.error('Stack :', stack);
          console.groupEnd();
        }

        // En production : tracker dans analytics_events
        Analytics.track('error.js', errorData);

      } catch(e2) { /* le handler d'erreur ne doit jamais planter */ }

      // Chaîner avec l'ancien handler si existant
      if (typeof _prevOnError === 'function') {
        return _prevOnError(message, source, lineno, colno, error);
      }
      return false;
    };

    // FIX H2 bis : capturer aussi les Promise rejections non gérées
    // Disponible sur Safari iOS 11+ et tous navigateurs modernes
    if (typeof window.addEventListener === 'function') {
      window.addEventListener('unhandledrejection', function(event) {
        try {
          var reason = event && event.reason;
          var msg = reason
            ? (reason.message || String(reason)).slice(0, 200)
            : 'Unhandled Promise rejection';

          var errorData = {
            message: msg,
            file:    'promise',
            line:    0,
            col:     0,
            stack:   (reason && reason.stack) ? reason.stack.slice(0, 500) : '',
            page:    _currentPage || 'unknown',
            ua:      navigator.userAgent.slice(0, 80),
          };

          if (ANALYTICS_IS_LOCAL) {
            console.group('[Cockpit Patrimonial — Promise rejetée]');
            console.error('Reason :', msg);
            console.error('Page active :', errorData.page);
            if (errorData.stack) console.error('Stack :', errorData.stack);
            console.groupEnd();
          }

          Analytics.track('error.promise', errorData);

          // Empêcher Safari d'afficher "Script error" dans la console
          if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
        } catch(e2) { /* silencieux */ }
      });
    }

  } catch(e) {
    _logDiag('_setupErrorTracking', e);
  }
}

/** Journalise un diagnostic interne (ne touche pas Analytics pour éviter les boucles). */
function _logDiag(fn, err) {
  try {
    if (ANALYTICS_IS_LOCAL) {
      console.warn('[Analytics internal error in ' + fn + ']', err);
    }
  } catch(e) { /* silencieux absolu */ }
}
