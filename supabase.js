/* ═══════════════════════════════════════════════════════════
   PATRIMOINE COCKPIT — supabase.js v0.8
   Authentification et synchronisation cloud Supabase
   Dépend de : data.js (STORE, S, saveAll, resetUI)
   ═══════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════
// v3.0 : SUPABASE — Authentification + Synchronisation cloud
// Architecture : couche additive sur STORE existant.
// localStorage reste actif comme cache local.
// Supabase = synchronisation cloud optionnelle.
// ═══════════════════════════════════════════════════

var SUPA_CONFIG_KEY = 'parc_supa_config'; // clé localStorage pour URL+key
var SUPA_CLIENT = null;  // instance Supabase initialisée au login
var SUPA_USER   = null;  // utilisateur connecté
var SUPA_TABLE  = 'user_parc_data';
var SUPA_SYNC_PENDING = false; // évite les syncs concurrentes

// --- Initialisation ---

// Charge la config Supabase depuis localStorage et init le client si possible
function initSupabase(){
  try{
    var raw = localStorage.getItem(SUPA_CONFIG_KEY);
    if(!raw) return false;
    var cfg = JSON.parse(raw);
    if(!cfg.url || !cfg.key) return false;
    SUPA_CLIENT = window.supabase.createClient(cfg.url, cfg.key);
    return true;
  } catch(e){
    /* DEBUG: console.log('initSupabase err', e) */
    return false;
  }
}

// Vérifie si un utilisateur est déjà connecté (session persistée par Supabase)
var SUPA_CURRENT_USER_KEY = 'parc_current_user'; // stocke l'user_id du dernier utilisateur connecté

function checkSupabaseSession(){
  if(!SUPA_CLIENT) return;
  SUPA_CLIENT.auth.getSession().then(function(res){
    if(res.data && res.data.session && res.data.session.user){
      SUPA_USER = res.data.session.user;
      verifierChangementUtilisateur(SUPA_USER.id);
      majStatusAuth(true);
      syncCloudSilencieux();
    }
  }).catch(function(){ /* session check error — silencieux */ });
}

// Détecte si l'utilisateur connecté est différent du précédent
// Si oui, vide les données locales et charge celles du cloud
function verifierChangementUtilisateur(newUserId){
  var previousUserId = localStorage.getItem(SUPA_CURRENT_USER_KEY);
  if(previousUserId && previousUserId !== newUserId){
    // Utilisateur différent — vider les données locales
    /* DEBUG: console.log('Changement utilisateur détecté, vidage ) */
    STORE.remove(STORE_KEY);
    resetUI();
    S = {
      biens: [],
      config: {revenusMensuels:0,tauxEndettementMax:35,loyersPrisEnCompte:70,margeSecurite:10,tauxNotaireDefaut:8,fraisDossierDefaut:1500},
      historiquePatrimoine: [],
      _v: DATA_VERSION
    };
    refreshDash();
    // Charger depuis le cloud automatiquement
    setTimeout(function(){ chargerDepuisCloudAuLogin(); }, 500);
  }
  // Mémoriser l'utilisateur courant
  localStorage.setItem(SUPA_CURRENT_USER_KEY, newUserId);
}

// --- UI ---

function ouvrirModalAuth(){
  // Pré-remplir config si déjà sauvegardée
  try{
    var raw = localStorage.getItem(SUPA_CONFIG_KEY);
    if(raw){
      var cfg = JSON.parse(raw);
      if(gid('cfg-supa-url')) gid('cfg-supa-url').value = cfg.url || '';
      if(gid('cfg-supa-key')) gid('cfg-supa-key').value = cfg.key || '';
    }
  } catch(e){}
  // Afficher le bon panneau selon état connexion
  majAffichageModal();
  gid('modal-auth').classList.add('on');
}

function fermerModalAuth(){
  gid('modal-auth').classList.remove('on');
}

function switchAuthTab(tab){
  gid('tab-login').classList.toggle('on', tab==='login');
  gid('tab-config').classList.toggle('on', tab==='config');
  gid('auth-panel-login').style.display  = tab==='login'  ? '' : 'none';
  gid('auth-panel-config').style.display = tab==='config' ? '' : 'none';
}

function majAffichageModal(){
  var connected = !!SUPA_USER;
  gid('auth-logged-out').style.display = connected ? 'none' : '';
  gid('auth-logged-in').style.display  = connected ? ''     : 'none';
  if(connected) gid('auth-user-email').textContent = SUPA_USER.email || '';
}

function majStatusAuth(connected, syncing){
  var dot = gid('auth-dot');
  var lbl = gid('auth-status-lbl');
  if(!dot || !lbl) return;
  if(syncing){
    dot.className = 'auth-dot syncing';
    lbl.textContent = 'Sync\u2026';
    lbl.style.color = 'var(--amber)';
  } else if(connected){
    dot.className = 'auth-dot connected';
    lbl.textContent = SUPA_USER ? SUPA_USER.email.split('@')[0] : 'Connecté';
    lbl.style.color = 'var(--lime)';
  } else {
    dot.className = 'auth-dot disconnected';
    lbl.textContent = 'Non connecté';
    lbl.style.color = 'var(--mist)';
  }
}

function afficherErreurAuth(msg){
  var el = gid('auth-error');
  if(!el) return;
  el.textContent = msg;
  el.style.display = msg ? '' : 'none';
}

// --- Configuration ---

function sauvegarderConfigSupabase(){
  var url = gid('cfg-supa-url') ? gid('cfg-supa-url').value.trim() : '';
  var key = gid('cfg-supa-key') ? gid('cfg-supa-key').value.trim() : '';
  var fb  = gid('cfg-supa-fb');
  if(!url || !key){
    if(fb) fb.innerHTML = '<span style="color:var(--rose)">URL et cl\u00e9 obligatoires.</span>';
    return;
  }
  try{
    localStorage.setItem(SUPA_CONFIG_KEY, JSON.stringify({url:url, key:key}));
    SUPA_CLIENT = window.supabase.createClient(url, key);
    if(fb) fb.innerHTML = '<span style="color:var(--lime)">&#10003; Configuration enregistr\u00e9e. Vous pouvez vous connecter.</span>';
    // Basculer sur l'onglet login
    setTimeout(function(){ switchAuthTab('login'); }, 1200);
  } catch(e){
    if(fb) fb.innerHTML = '<span style="color:var(--rose)">Erreur : ' + e.message + '</span>';
  }
}

// --- Auth ---

// Chargement silencieux depuis le cloud au login (sans confirmation)
function chargerDepuisCloudAuLogin(){
  if(!SUPA_CLIENT || !SUPA_USER) return;
  SUPA_CLIENT.from(SUPA_TABLE)
    .select('data')
    .eq('user_id', SUPA_USER.id)
    .single()
    .then(function(res){
      if(res.error || !res.data || !res.data.data) return; // pas de données = nouveau compte, page vide normale
      var cloudData = res.data.data;
      if(!cloudData.biens || !cloudData.biens.length) return;
      // Charger les données cloud
      resetUI();
      S = {biens:[],config:{revenusMensuels:0,tauxEndettementMax:35,loyersPrisEnCompte:70,margeSecurite:10,tauxNotaireDefaut:8,fraisDossierDefaut:1500},historiquePatrimoine:[],_v:DATA_VERSION};
      if(cloudData.config){
        S.config.revenusMensuels    = nv(cloudData.config.revenusMensuels);
        S.config.tauxEndettementMax = nv(cloudData.config.tauxEndettementMax) || 35;
        S.config.loyersPrisEnCompte = nv(cloudData.config.loyersPrisEnCompte) || 70;
        S.config.margeSecurite      = nv(cloudData.config.margeSecurite)      || 10;
        S.config.tauxNotaireDefaut  = nv(cloudData.config.tauxNotaireDefaut)  || 8;
        S.config.fraisDossierDefaut = nv(cloudData.config.fraisDossierDefaut) || 1500;
      }
      S.historiquePatrimoine = cloudData.historiquePatrimoine || [];
      for(var i=0; i<cloudData.biens.length; i++){
        var b = normalizeBien(cloudData.biens[i]);
        autoGenererMoisAnnee(b);
        S.biens.push(b);
        addNavTab(b);
        buildBienPage(b);
        if(b.type==='loc') renderLoyers(b);
        renderTravaux(b);
      }
      loadConfig();
      refreshDash();
      STORE.save(STORE_KEY, S);
    }).catch(function(){ majStatusAuth(SUPA_USER ? true : false, false); });
}

function authLogin(){
  if(!SUPA_CLIENT){ alert('Configurez d\'abord l\'URL et la cl\u00e9 Supabase dans l\'onglet Configuration.'); switchAuthTab('config'); return; }
  var email = gid('auth-email') ? gid('auth-email').value.trim() : '';
  var pwd   = gid('auth-password') ? gid('auth-password').value : '';
  if(!email || !pwd){ afficherErreurAuth('Email et mot de passe requis.'); return; }
  afficherErreurAuth('');
  SUPA_CLIENT.auth.signInWithPassword({email:email, password:pwd}).then(function(res){
    if(res.error){ afficherErreurAuth(res.error.message); return; }
    SUPA_USER = res.data.user;
    // v3.0 : vérifier si c'est un utilisateur différent → isolation des données
    verifierChangementUtilisateur(SUPA_USER.id);
    majStatusAuth(true);
    majAffichageModal();
    syncCloudSilencieux();
  }).catch(function(err){ afficherErreurAuth(err && err.message ? err.message : 'Erreur réseau'); });
}

function authSignup(){
  if(!SUPA_CLIENT){ switchAuthTab('config'); return; }
  var email = gid('auth-email') ? gid('auth-email').value.trim() : '';
  var pwd   = gid('auth-password') ? gid('auth-password').value : '';
  if(!email || !pwd){ afficherErreurAuth('Email et mot de passe requis.'); return; }
  afficherErreurAuth('');
  SUPA_CLIENT.auth.signUp({email:email, password:pwd}).then(function(res){
    if(res.error){ afficherErreurAuth(res.error.message); return; }
    afficherErreurAuth('');
    // Supabase envoie un email de confirmation selon la config
    var sub = gid('auth-modal-sub');
    if(sub) sub.innerHTML = '<strong>✅ Compte créé !</strong><br>Un email de confirmation a été envoyé à <strong>' + email + '</strong>.<br>Cliquez sur le lien dans cet email, puis revenez vous connecter.';
    if(res.data && res.data.user && res.data.user.confirmed_at){
      SUPA_USER = res.data.user;
      majStatusAuth(true);
      majAffichageModal();
    }
  }).catch(function(err){ afficherErreurAuth(err && err.message ? err.message : 'Erreur réseau'); });
}

function authLogout(){
  if(!SUPA_CLIENT) return;
  SUPA_CLIENT.auth.signOut().then(function(){
    SUPA_USER = null;
    localStorage.removeItem(SUPA_CURRENT_USER_KEY);
    majStatusAuth(false);
    majAffichageModal();
    fermerModalAuth();
  }).catch(function(){ /* signout error */ });
}

function authResetPassword(){
  if(!SUPA_CLIENT){ switchAuthTab('config'); return; }
  var email = gid('auth-email') ? gid('auth-email').value.trim() : '';
  if(!email){ afficherErreurAuth('Entrez votre email d\'abord.'); return; }
  SUPA_CLIENT.auth.resetPasswordForEmail(email).then(function(res){
    if(res.error){ afficherErreurAuth(res.error.message); return; }
    afficherErreurAuth('');
    var sub = gid('auth-modal-sub');
    if(sub) sub.textContent = 'Email de réinitialisation envoyé à ' + email;
  }).catch(function(err){ afficherErreurAuth(err && err.message ? err.message : 'Erreur réseau'); });
}

// --- Synchronisation cloud ---

// Sync silencieuse (appelée automatiquement après saveAll et au démarrage)
function syncCloudSilencieux(){
  if(!SUPA_CLIENT || !SUPA_USER) return;
  if(SUPA_SYNC_PENDING) return;
  SUPA_SYNC_PENDING = true;
  majStatusAuth(true, true);

  var payload = { user_id: SUPA_USER.id, data: S };

  SUPA_CLIENT.from(SUPA_TABLE)
    .upsert(payload, { onConflict: 'user_id' })
    .then(function(res){
      SUPA_SYNC_PENDING = false;
      majStatusAuth(true, false);
      if (!res.error && typeof Analytics !== 'undefined') {
        Analytics.track('cloud.synced', { biens: S.biens.length });
      }
    }).catch(function(){ SUPA_SYNC_PENDING = false; majStatusAuth(!!SUPA_USER, false); });
}

// Sync manuelle (bouton dans le modal)
function syncCloud(){
  if(!SUPA_CLIENT || !SUPA_USER){ alert('Connectez-vous d\'abord.'); return; }
  saveAll(); // saveAll déclenche syncCloudSilencieux automatiquement
}

// Restaurer depuis le cloud (écrase les données locales après confirmation)
function restaurerDepuisCloud(){
  if(!SUPA_CLIENT || !SUPA_USER){ alert('Connectez-vous d\'abord.'); return; }
  if(!confirm('Restaurer les donn\u00e9es depuis le cloud ?\n\nCela remplacera toutes les donn\u00e9es locales actuelles.\n\nConseil : faites un Backup JSON avant.')) return;

  majStatusAuth(true, true);
  SUPA_CLIENT.from(SUPA_TABLE)
    .select('data')
    .eq('user_id', SUPA_USER.id)
    .single()
    .then(function(res){
      majStatusAuth(true, false);
      if(res.error || !res.data || !res.data.data){
        alert('Aucune donn\u00e9e trouv\u00e9e dans le cloud pour ce compte.');
        return;
      }
      var cloudData = res.data.data;
      if(!cloudData.biens || !cloudData.biens.length){
        alert('Les donn\u00e9es cloud sont vides ou invalides.');
        return;
      }
      // Même logique que importData mais depuis le cloud
      resetUI();
      S = {
        biens: [],
        config: {revenusMensuels:0,tauxEndettementMax:35,loyersPrisEnCompte:70,margeSecurite:10,tauxNotaireDefaut:8,fraisDossierDefaut:1500},
        historiquePatrimoine: [],
        _v: DATA_VERSION
      };
      if(cloudData.config){
        S.config.revenusMensuels    = nv(cloudData.config.revenusMensuels);
        S.config.tauxEndettementMax = nv(cloudData.config.tauxEndettementMax) || 35;
        S.config.loyersPrisEnCompte = nv(cloudData.config.loyersPrisEnCompte) || 70;
        S.config.margeSecurite      = nv(cloudData.config.margeSecurite)      || 10;
        S.config.tauxNotaireDefaut  = nv(cloudData.config.tauxNotaireDefaut)  || 8;
        S.config.fraisDossierDefaut = nv(cloudData.config.fraisDossierDefaut) || 1500;
      }
      S.historiquePatrimoine = cloudData.historiquePatrimoine || [];
      for(var i=0; i<cloudData.biens.length; i++){
        var b = normalizeBien(cloudData.biens[i]);
        autoGenererMoisAnnee(b);
        S.biens.push(b);
        addNavTab(b);
        buildBienPage(b);
        if(b.type === 'loc') renderLoyers(b);
        renderTravaux(b);
      }
      loadConfig();
      refreshDash();
      STORE.save(STORE_KEY, S); // aussi en local
      fermerModalAuth();
      /* success */ alert('Restauration r\u00e9ussie : ' + S.biens.length + ' bien(s) charg\u00e9(s) depuis le cloud.');
    }).catch(function(){ majStatusAuth(!!SUPA_USER, false); });
}

window.onload=function(){
  if(!STORE.isAvailable()){
    alert('Stockage local indisponible (navigation priv\u00e9e ?). Vos donn\u00e9es ne seront pas sauvegard\u00e9es automatiquement. Utilisez Backup JSON pour conserver vos donn\u00e9es.');
  }

  // v3.0 : initialiser Supabase si config disponible, vérifier session
  if(initSupabase()) checkSupabaseSession();

  loadAll();
  if(!S.biens.length){
    loadExemple();
  }
  setInterval(saveAll, 30000);
};