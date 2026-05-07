// ============================================================
//  CALLPAY — DATA LAYER (Firebase Firestore)
//  Data tersimpan di cloud — sync realtime antar semua device
// ============================================================

// ── FIREBASE CONFIG ───────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey            : "AIzaSyACJjz3XP7vbzxkeZmW_sCXKurAFXZ_vwU",
  authDomain        : "testweb-9b2f8.firebaseapp.com",
  projectId         : "testweb-9b2f8",
  storageBucket     : "testweb-9b2f8.firebasestorage.app",
  messagingSenderId : "223987046525",
  appId             : "1:223987046525:web:29d1a297746cd83d685365",
  measurementId     : "G-FBKH73JQY8"
};

// ── FIREBASE INIT ─────────────────────────────────────────────
import { initializeApp }                          from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getFirestore, collection, doc,
         addDoc, getDocs, getDoc, setDoc,
         updateDoc, deleteDoc, query, where,
         orderBy, onSnapshot, Timestamp,
         serverTimestamp }                        from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const _app = initializeApp(FIREBASE_CONFIG);
const _db  = getFirestore(_app);

// ── COLLECTIONS ───────────────────────────────────────────────
const COL_ORDERS   = "orders";
const COL_SETTINGS = "settings";
const SETTINGS_DOC = "config";

// ── SESSION (tetap pakai sessionStorage) ─────────────────────
const SESSION_KEY = 'cp_admin';

// ============================================================
//  DB OBJECT — sama persis API-nya dengan versi localStorage
//  sehingga semua halaman admin tidak perlu diubah banyak
// ============================================================
const DB = {

  // ── SESSION ───────────────────────────────────────────────
  isLoggedIn()  { return !!localStorage.getItem(SESSION_KEY); },
  isOwner()     { return localStorage.getItem(SESSION_KEY) === 'owner'; },
  isAdmin()     { return localStorage.getItem(SESSION_KEY) === 'admin'; },
  setLogin(v, role) {
    if (v && role) localStorage.setItem(SESSION_KEY, role);
    else localStorage.removeItem(SESSION_KEY);
  },

  // ── DEFAULT SETTINGS ──────────────────────────────────────
  defaultSettings() {
    return {
      username    : 'admin',
      password    : 'callpay2021',
      ownerPassword: 'owner2021',
      waNumber    : '62895400709371',
      agencyName  : 'CallPay Agency',
      instagram   : '@callpay.id',
      agencyCut   : 40,
      pgEnabled   : false,
      waEnabled   : true,
      mtClientKey : '',
      maintenance : false,
      talentRules : '',
    };
  },

  // ── SETTINGS (Firestore + local cache) ────────────────────
  _settingsCache: null,

  async getSettingsAsync() {
    try {
      const ref  = doc(_db, COL_SETTINGS, SETTINGS_DOC);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        this._settingsCache = { ...this.defaultSettings(), ...snap.data() };
      } else {
        // First time — save defaults to Firestore
        await setDoc(ref, this.defaultSettings());
        this._settingsCache = this.defaultSettings();
      }
    } catch(e) {
      this._settingsCache = this.defaultSettings();
    }
    return this._settingsCache;
  },

  // Sync version — returns cache (call getSettingsAsync first)
  getSettings() {
    return this._settingsCache || this.defaultSettings();
  },

  async saveSettings(obj) {
    this._settingsCache = obj;
    try {
      const ref = doc(_db, COL_SETTINGS, SETTINGS_DOC);
      await setDoc(ref, obj, { merge: true });
    } catch(e) { console.error('saveSettings error:', e); }
  },

  // ── ACTIVITY LOG ──────────────────────────────────────────
  async logActivity(type, description, detail='') {
    try {
      const ref = collection(_db, 'activity_logs');
      await addDoc(ref, {
        type,
        description,
        detail,
        createdAt: new Date().toISOString(),
      });
    } catch(e) { console.warn('logActivity error:', e.message); }
  },

  // ── ORDERS ────────────────────────────────────────────────

  async addOrder(order) {
    // Quick orders go to waiting_bid, talent orders go to baru
    const initStatus = (order.orderType === 'quick' && !order.talentId) ? 'waiting_bid' : 'baru';
    const newOrder = {
      ...order,
      id        : 'ORD-' + Date.now(),
      date      : new Date().toISOString(),
      status    : initStatus,
      bids      : [],
      createdAt : serverTimestamp(),
    };
    try {
      const ref = await addDoc(collection(_db, COL_ORDERS), newOrder);
      newOrder._docId = ref.id;
    } catch(e) { console.error('addOrder error:', e); }
    return newOrder;
  },

  async getOrders() {
    try {
      const q    = query(collection(_db, COL_ORDERS), orderBy('createdAt','desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    } catch(e) {
      console.error('getOrders error:', e);
      return [];
    }
  },

  async deleteOrder(id) {
    try {
      const orders = await this.getOrders();
      const o = orders.find(x => x.id === id);
      if (o?._docId) await deleteDoc(doc(_db, COL_ORDERS, o._docId));
    } catch(e) { console.error('deleteOrder error:', e); }
  },

  async deleteAllOrders() {
    try {
      const snap = await getDocs(collection(_db, COL_ORDERS));
      const dels = snap.docs.map(d => deleteDoc(doc(_db, COL_ORDERS, d.id)));
      await Promise.all(dels);
    } catch(e) { console.error('deleteAllOrders error:', e); }
  },

  // Update langsung by Firestore document ID — paling reliable
  async updateByDocId(docId, status) {
    const updateData = { status, manualStatus: true };
    if (status === 'proses') updateData.prosesAt = new Date().toISOString();
    await updateDoc(doc(_db, COL_ORDERS, docId), updateData);
  },

  async updateOrderStatus(id, status) {
    try {
      const snap = await getDocs(query(
        collection(_db, COL_ORDERS),
        where('id','==',id)
      ));
      const updateData = { status, manualStatus: true };
      // Simpan timestamp ketika masuk ke proses
      if (status === 'proses') updateData.prosesAt = new Date().toISOString();

      if (!snap.empty) {
        await updateDoc(doc(_db, COL_ORDERS, snap.docs[0].id), updateData);
      } else {
        // Fallback: cari lewat getOrders
        const orders = await this.getOrders();
        const o = orders.find(x => x.id === id);
        if (o?._docId) await updateDoc(doc(_db, COL_ORDERS, o._docId), updateData);
      }
    } catch(e) { console.error('updateOrderStatus error:', e); }
  },

  async assignTalent(orderId, talentId, talentName) {
    try {
      const orders = await this.getOrders();
      const o = orders.find(x => x.id === orderId);
      if (o?._docId) {
        await updateDoc(doc(_db, COL_ORDERS, o._docId), {
          talentId,
          talentName,
          confirmedTalent    : talentId,
          confirmedTalentName: talentName,
          status             : 'baru',
          assignedAt         : new Date().toISOString(),
          assignedByAdmin    : true,
        });
      }
    } catch(e) { console.error('assignTalent error:', e); }
  },

  // ── REALTIME LISTENER ─────────────────────────────────────
  // Gunakan ini untuk auto-refresh halaman admin
  onOrdersChange(callback) {
    const q = query(collection(_db, COL_ORDERS), orderBy('createdAt','desc'));
    return onSnapshot(q, (snap) => {
      const orders = snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
      callback(orders);
    });
  },

  // ── AUTO STATUS ───────────────────────────────────────────
  computeStatus(order) {
    if (order.status === 'batal') return 'batal';
    if (!order.talentId && !order.talentName) return order.status;
    const now        = Date.now();
    const created    = new Date(order.date).getTime();
    const elapsedMin = (now - created) / 60000;
    const durMin     = Number(order.duration) || 60;
    if (elapsedMin < 5)          return 'baru';
    if (elapsedMin < 5 + durMin) return 'proses';
    return 'selesai';
  },

  async syncStatuses() {
    const orders = await this.getOrders();
    const updates = [];
    orders.forEach(o => {
      if (o.status === 'batal') return;
      if (!o.talentId && !o.talentName) return;
      const computed = this.computeStatus(o);
      if (o.status !== computed && o._docId) {
        updates.push(updateDoc(doc(_db, COL_ORDERS, o._docId), { status: computed }));
        o.status = computed;
      }
    });
    if (updates.length) await Promise.all(updates);
    return orders;
  },

  // ── HELPERS ───────────────────────────────────────────────
  formatRp(num) {
    return 'Rp ' + Number(num).toLocaleString('id-ID');
  },
  formatDate(iso) {
    if (!iso) return '-';
    const d    = new Date(iso);
    const date = d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
    const h    = String(d.getHours()).padStart(2,'0');
    const m    = String(d.getMinutes()).padStart(2,'0');
    return `${date}, ${h}.${m}`;
  },
  timeRemaining(order) {
    if (order.status === 'batal')       return '—';
    if (order.status === 'waiting_bid') return 'Menunggu bid';
    if (order.status === 'selesai')     return 'Selesai ✓';
    if (order.status === 'baru')        return 'Menunggu mulai';
    // Hanya tampil timer kalau status proses
    if (order.status === 'proses') {
      if (!order.prosesAt) return 'Sedang berjalan';
      const now     = Date.now();
      const prosesMs= new Date(order.prosesAt).getTime();
      const durMs   = (Number(order.duration) || 60) * 60 * 1000;
      const sisaMs  = durMs - (now - prosesMs);
      if (sisaMs <= 0) return 'Selesai ✓';
      const sisaMin = Math.ceil(sisaMs / 60000);
      const sisaSec = Math.ceil(sisaMs / 1000);
      if (sisaMin <= 1) return `${sisaSec} detik lagi`;
      return `${sisaMin} mnt lagi`;
    }
    return '—';
  },
};

// ── TALENT MASTER DATA ────────────────────────────────────────
const TALENTS = []; // Semua talent diambil dari Firestore

const PRICES = {
  'Temen Call':    {30:10000, 60:20000, 90:30000, 120:40000, 150:50000, 180:60000},
  'Sleepcall':     {30:10000, 60:20000, 90:30000, 120:40000, 150:50000, 180:60000},
  'Temen Curhat':  {30:12000, 60:24000, 90:36000, 120:48000, 150:60000, 180:72000},
  'Pacar Virtual': {30:15000, 60:30000, 90:45000, 120:60000, 150:75000, 180:90000},
  'Video Call':    {20:35000, 40:70000, 60:105000},
};

const DUR_LABEL = {20:'20 menit', 30:'30 menit', 40:'40 menit', 60:'60 menit', 90:'90 menit', 120:'2 jam', 150:'2,5 jam', 180:'3 jam'};

function requireAuth() {
  if (!DB.isLoggedIn()) window.location.href = 'index.html';
}
function requireOwner() {
  if (!DB.isOwner()) window.location.href = 'index.html';
}

export { DB, TALENTS, PRICES, DUR_LABEL, requireAuth, requireOwner };
