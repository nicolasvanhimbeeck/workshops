/* ── Shared realtime sync for workshop slides ──────────────────────────
   Reusable across every workshop file. Data is namespaced per file: the
   page's filename (e.g. "20260625_FD_FG") becomes the room id, so different
   workshops never collide.

   ONE-TIME SETUP to sync across devices:
     1. Create a free Firebase project  → https://console.firebase.google.com
     2. Build → Realtime Database → Create database (start in test mode)
     3. Project settings → Your apps → Web app → copy the config
     4. Paste the values into FIREBASE_CONFIG below.
   Until that's done the page runs in LOCAL-ONLY mode: everything still
   works on a single screen, just without cross-device sync.

   API (paths are relative to this session's room):
     Sync.subscribe(path, cb)     cb(value|null) on every change
     Sync.push(path, item)        add a child with an auto id
     Sync.set(path, value)        set a value (value=null deletes)
     Sync.transaction(path, fn)   atomic update, e.g. v => (v||0)+1
     Sync.remove(path)            delete a node
     Sync.online                  true when talking to Firebase
   --------------------------------------------------------------------- */
window.Sync = (function () {
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyDI_muXqf_4Zfcpf8OdPjhp8yNp5gg6xto",
    authDomain: "workshopsf.firebaseapp.com",
    databaseURL: "https://workshopsf-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "workshopsf",
    storageBucket: "workshopsf.firebasestorage.app",
    messagingSenderId: "124582971714",
    appId: "1:124582971714:web:228c4180d66083c03020db"
  };

  function sessionId() {
    var f = (location.pathname.split('/').pop() || 'session').replace(/\.html?$/i, '');
    return f || 'session';
  }

  var configured = !!FIREBASE_CONFIG.databaseURL
    && FIREBASE_CONFIG.databaseURL.indexOf('PASTE') === -1
    && typeof firebase !== 'undefined';

  if (configured) {
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      var base = firebase.database().ref('sessions/' + sessionId());
      console.info('[Sync] Online — room "' + sessionId() + '".');
      return {
        online: true,
        sessionId: sessionId,
        subscribe: function (path, cb) { base.child(path).on('value', function (s) { cb(s.val()); }); },
        push: function (path, item) { return base.child(path).push(item); },
        set: function (path, val) { return base.child(path).set(val); },
        transaction: function (path, fn) { return base.child(path).transaction(fn); },
        remove: function (path) { return base.child(path).remove(); }
      };
    } catch (e) { console.warn('[Sync] Firebase init failed — local-only mode.', e); }
  } else {
    console.info('[Sync] Local-only mode (paste Firebase config in sync.js to sync across devices).');
  }

  /* ── Local fallback: in-memory store, single screen ── */
  var tree = {}, subs = [], seq = 0;
  function get(p) { return p.split('/').reduce(function (o, k) { return (o == null) ? undefined : o[k]; }, tree); }
  function put(p, v) {
    var ks = p.split('/'), o = tree, i;
    for (i = 0; i < ks.length - 1; i++) o = o[ks[i]] = o[ks[i]] || {};
    if (v === null || v === undefined) delete o[ks[ks.length - 1]];
    else o[ks[ks.length - 1]] = v;
  }
  function clone(v) { return v == null ? null : JSON.parse(JSON.stringify(v)); }
  function fireAll() { subs.forEach(function (s) { s.cb(clone(get(s.path))); }); }
  return {
    online: false,
    sessionId: sessionId,
    subscribe: function (path, cb) { subs.push({ path: path, cb: cb }); cb(clone(get(path))); },
    push: function (path, item) { var id = 'loc' + (++seq); put(path + '/' + id, item); fireAll(); return Promise.resolve({ key: id }); },
    set: function (path, val) { put(path, val); fireAll(); return Promise.resolve(); },
    transaction: function (path, fn) { put(path, fn(get(path))); fireAll(); return Promise.resolve(); },
    remove: function (path) { put(path, null); fireAll(); return Promise.resolve(); }
  };
})();
