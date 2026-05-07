// ============================================================
//  CALLPAY — MAIN SCRIPT
// ============================================================
import { DB, TALENTS, PRICES as DEFAULT_PRICES, DUR_LABEL } from './admin/data.js';
// ── TAG COLOR HELPER ──────────────────────────────────────
let _services = [];
let _servicesLoaded = false;
function tagClass(s) {
  const svc = _services.find(x => x.name === s);
  return svc ? `svc-dyn-${svc.id}` : 'svc-dyn-default';
}
function injectServiceStyles() {
  let style = document.getElementById('svc-dyn-styles');
  if (!style) { style = document.createElement('style'); style.id = 'svc-dyn-styles'; document.head.appendChild(style); }
  const COLOR_MAP = {
    pink:   { bg:'rgba(249,168,201,.12)', color:'#F9A8C9', border:'rgba(249,168,201,.3)' },
    blue:   { bg:'rgba(77,166,232,.12)',  color:'#7EC8F5', border:'rgba(77,166,232,.25)' },
    purple: { bg:'rgba(167,139,250,.12)', color:'#c4b5fd', border:'rgba(167,139,250,.25)' },
    green:  { bg:'rgba(52,211,153,.08)',  color:'#34d399', border:'rgba(52,211,153,.3)' },
    red:    { bg:'rgba(249,115,148,.15)', color:'#fb7185', border:'rgba(249,115,148,.3)' },
    yellow: { bg:'rgba(255,184,0,.1)',    color:'#FFB800', border:'rgba(255,184,0,.3)' },
    teal:   { bg:'rgba(20,184,166,.1)',   color:'#2dd4bf', border:'rgba(20,184,166,.3)' },
  };
  style.textContent = _services.map(s => {
    const c = COLOR_MAP[s.color] || COLOR_MAP.pink;
    return `.svc-dyn-${s.id}{background:${c.bg};color:${c.color};border:1px solid ${c.border}}`;
  }).join('\n') + '\n.svc-dyn-default{background:rgba(255,255,255,.06);color:rgba(240,235,248,.6);border:1px solid rgba(255,255,255,.1)}';
}
async function loadServicesFromFirestore() {
  return new Promise(async (resolve) => {
    try {
      const { collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js');
      const db = await getFirebase();
      let _firstLoad = true;
      onSnapshot(collection(db, 'services'), snap => {
        _services = [];
        snap.forEach(d => _services.push({ id: d.id, ...d.data() }));
        _services.sort((a,b) => (a.order||99) - (b.order||99));
        injectServiceStyles();
        SVC_LABEL_TO_KEY = {};
        SVC_ICON = {};
        Object.keys(SVC_KEY_TO_LABEL).forEach(k => delete SVC_KEY_TO_LABEL[k]);
        _services.forEach(s => {
          SVC_LABEL_TO_KEY[s.name] = s.id;
          SVC_KEY_TO_LABEL[s.id]   = s.name;
          SVC_ICON[s.name]         = s.icon || '🎯';
        });
        _servicesLoaded = true;
        if (_firstLoad) { _firstLoad = false; resolve(); }
        else { if (TALENTS.length) renderTalents(); }
      });
    } catch(e) { console.warn('Gagal load services:', e); resolve(); }
  });
}
// ── STATE ─────────────────────────────────────────────────
let currentFilter = 'all';
let showAll       = false;
let activeTalent  = null;
const ACTIVE_IDS  = new Set([1,2,3,4,9,10,11,12]);
const DEFAULT_IDS = ACTIVE_IDS;
let PRICES = { ...DEFAULT_PRICES };
async function loadPricesFromFirestore() {
  try {
    const { getFirestore, doc, getDoc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js');
    const db = await getFirebase();
    const _priceMap = { 'callpay':'admin1', 'sleepcallpay':'admin2', 'scallpayz':'admin3' };
    const docId = _priceMap[_adminParam] || 'admin1';
    const snap = await getDoc(doc(db, 'pricelist', docId));
    if (snap.exists()) { PRICES = snap.data(); window.PRICES = PRICES; }
    onSnapshot(doc(db, 'pricelist', docId), s => {
      if (s.exists()) { PRICES = s.data(); window.PRICES = PRICES; }
    });
  } catch(e) { console.warn('Gagal load pricelist:', e); }
}
const WA_NUMBERS = {
  'callpay'     : '62895400709371',
  'sleepcallpay': '6283832404667',
  'scallpayz'   : '6283832550027',
};
const _legacyMap = { '1':'callpay', '2':'sleepcallpay', '3':'scallpayz' };
const _pathMap    = { 'spy':'sleepcallpay', 'z':'scallpayz' };
const _pathSlug   = window.location.pathname.replace(/^\//, '').split('/')[0];
const _rawParam   = new URLSearchParams(window.location.search).get('admin')
                    || _pathMap[_pathSlug]
                    || 'callpay';
const _adminParam = _legacyMap[_rawParam] || _rawParam;
window._adminParam = _adminParam;
const WA_NUMBER   = WA_NUMBERS[_adminParam] || WA_NUMBERS['callpay'];
const SVC_KEY_TO_LABEL = {
  'temen-call'   : 'Temen Call',
  'sleepcall'    : 'Sleepcall',
  'temen-curhat' : 'Temen Curhat',
  'pacar-virtual': 'Pacar Virtual',
  'video-call'   : 'Video Call',
};
window.SVC_KEY_TO_LABEL = SVC_KEY_TO_LABEL;
let SVC_LABEL_TO_KEY = {
  'Temen Call'   : 'temen-call',
  'Sleepcall'    : 'sleepcall',
  'Temen Curhat' : 'temen-curhat',
  'Pacar Virtual': 'pacar-virtual',
  'Video Call'   : 'video-call',
};
let SVC_ICON = {
  'Temen Call'   : '📞',
  'Sleepcall'    : '🌙',
  'Temen Curhat' : '🫂',
  'Pacar Virtual': '💕',
  'Video Call'   : '📹',
};
// ============================================================
//  TALENT RENDER
// ============================================================
function renderTalents() {
  const grid = document.getElementById('talent-grid');
  if (!grid) return;
  const allActive = TALENTS;
  const unsorted  = currentFilter === 'all' ? allActive : allActive.filter(t => t.gender === currentFilter);

  // Sort: online dulu → abjad nama; offline ke bawah → abjad nama
  const list = [...unsorted].sort((a, b) => {
    const aOnline = a.online !== false;
    const bOnline = b.online !== false;
    if (aOnline !== bOnline) return bOnline ? 1 : -1; // online di atas
    return (a.name || '').localeCompare(b.name || '', 'id'); // abjad nama
  });

  grid.innerHTML = list.map(t => {
    const hasAudio = t.audio && t.audio.trim() !== '';
    return `
    <div class="talent-card" data-talent-id="${t.id}" onclick="${t.online === false ? `alert('Talent tidak available')` : `openModal('${t.id}')`}">
      <div class="talent-photo">
        <img src="${t.img ? t.img.replace('/upload/', '/upload/w_300,h_300,c_fill,f_auto,q_auto/') : ''}" alt="${t.name}" loading="lazy" width="300" height="300" style="width:100%;height:100%;object-fit:cover;object-position:top">
        <span class="gender-pill ${t.gender}">${t.gender === 'female' ? '🌸 Wanita' : '💙 Pria'}</span>
      </div>
      <div class="talent-body">
        <div class="talent-top">
          <div class="talent-name">${t.name}</div>
          <div class="talent-age">${t.age} tahun</div>
        </div>
        <div class="talent-tags">${(t.services||[]).filter(s => !(t.lockedServices||[]).includes(s)).map(s => `<span class="talent-tag ${tagClass(s)}">${s}</span>`).join('')}</div>
        <div class="talent-bio">${t.bio || 'Hai! Senang bisa menemani hari-harimu 💕'}</div>
        <div class="talent-footer">
          <button class="pesan-btn ${t.online === false ? 'offline' : ''}" onclick="event.stopPropagation();${t.online === false ? `alert('Talent tidak available')` : `openModal('${t.id}')`}">${t.online === false ? 'Tidak Available' : 'Pesan Sekarang'}</button>
          <button class="play-audio-btn ${hasAudio ? '' : 'no-audio'}" id="play-btn-${t.id}" onclick="event.stopPropagation();toggleAudio('${t.id}','${t.audio || ''}',this)" title="${hasAudio ? 'Preview Suara' : 'Audio belum tersedia'}">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div class="talent-status"><span class="status-dot${t.online === false ? ' offline' : ''}"></span> <span class="status-txt">${t.online === false ? 'OFFLINE' : 'ONLINE'}</span></div>
        </div>
      </div>
    </div>`;
  }).join('');
  updateSeeMoreBtn(list);
}
function updateSeeMoreBtn(list) {
  const wrap = document.getElementById('see-more-wrap');
  if (wrap) wrap.style.display = 'none';
}
window.setFilter = function(type, el) {
  currentFilter = type;
  showAll = false;
  document.querySelectorAll('.gf-btn').forEach(b => { b.className = 'gf-btn'; });
  if (type === 'all')    el.classList.add('fa');
  if (type === 'female') el.classList.add('fp');
  if (type === 'male')   el.classList.add('fm');
  renderTalents();
};
window.toggleSeeMore = function() {
  showAll = !showAll;
  document.querySelectorAll('.talent-card.extra').forEach(c => c.classList.toggle('show', showAll));
  const btn = document.getElementById('see-more-btn');
  const allActive = TALENTS;
  const list = currentFilter === 'all' ? allActive : allActive.filter(t => t.gender === currentFilter);
  const extraCount = currentFilter === 'all'
    ? list.filter(t => !DEFAULT_IDS.has(t.id)).length
    : list.slice(8).length;
  if (btn) {
    btn.classList.toggle('open', showAll);
    btn.innerHTML = showAll
      ? `Sembunyikan <span class="arr">▲</span>`
      : `Lihat ${extraCount} Talent Lainnya <span class="arr">▼</span>`;
  }
  if (!showAll) document.getElementById('talent').scrollIntoView({ behavior: 'smooth' });
};
// ============================================================
//  ORDER MODAL
// ============================================================
window.openModal = function(id) {
  activeTalent = TALENTS.find(t => String(t.id) === String(id));
  if (!activeTalent) return;
  window.activeTalent = activeTalent;
  document.getElementById('modal-img').src           = activeTalent.img;
  document.getElementById('modal-tname').textContent = activeTalent.name;
  document.getElementById('modal-tmeta').textContent = `${activeTalent.age} tahun · Indonesia`;
  const svcSel = document.getElementById('modal-service');
  const services = activeTalent.services || [];
  const activeServices = (services||[]).filter(s => !(activeTalent.lockedServices||[]).includes(s));
  const sortedServices = [...activeServices].sort((a,b) => {
    const ai = _services.findIndex(x => x.name === a);
    const bi = _services.findIndex(x => x.name === b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  svcSel.innerHTML = '<option value="">— Pilih Layanan —</option>' +
    sortedServices.map(svc => {
      const key  = SVC_LABEL_TO_KEY[svc] || '';
      const icon = SVC_ICON[svc] || '';
      return key ? `<option value="${key}">${icon} ${svc}</option>` : '';
    }).join('');
  document.getElementById('modal-duration').innerHTML = '<option value="">— Pilih Layanan Dulu —</option>';
  document.getElementById('modal-note').value = '';
  const adminCheck = document.getElementById('admin-fee-check');
  if (adminCheck) adminCheck.checked = false;
  const btn = document.getElementById('modal-wa-btn');
  if (btn) btn.disabled = true;
  document.getElementById('order-modal').classList.add('open');
};
window.closeModal = function() {
  document.getElementById('order-modal').classList.remove('open');
};
window.updateDurations = function() {
  const svcRaw   = document.getElementById('modal-service').value;
  const durSel   = document.getElementById('modal-duration');
  const svcLabel = SVC_KEY_TO_LABEL[svcRaw];
  const priceMap = svcLabel ? PRICES[svcLabel] : null;
  durSel.innerHTML = '<option value="">— Pilih Durasi —</option>';
  if (priceMap) {
    Object.entries(priceMap).forEach(([min, price]) => {
      const opt = document.createElement('option');
      opt.value = min;
      const label = DUR_LABEL[min] || min + ' menit';
      opt.textContent = label + '  —  Rp ' + Number(price).toLocaleString('id-ID');
      durSel.appendChild(opt);
    });
  } else {
    durSel.innerHTML = '<option value="">— Pilih Layanan Dulu —</option>';
  }
};
window.updateModalPrice = function() {
  const svcRaw   = document.getElementById('modal-service').value;
  const dur      = parseInt(document.getElementById('modal-duration').value);
  const btn      = document.getElementById('modal-wa-btn');
  const svcLabel = SVC_KEY_TO_LABEL[svcRaw];
  const price    = (svcLabel && dur) ? PRICES[svcLabel]?.[dur] : null;
  const checked  = document.getElementById('admin-fee-check')?.checked || false;
  if (btn) btn.disabled = !(price && checked);
};
window.confirmViaWA = function() {
  const svcRaw   = document.getElementById('modal-service').value;
  const dur      = parseInt(document.getElementById('modal-duration').value);
  const note     = document.getElementById('modal-note').value.trim();
  const svcLabel = SVC_KEY_TO_LABEL[svcRaw];
  const price    = PRICES[svcLabel]?.[dur] ?? 0;
  const durLabel = DUR_LABEL[dur] || dur + ' menit';
  if (!svcLabel || !dur) { alert('Mohon pilih layanan dan durasi terlebih dahulu!'); return; }
  const msg = [
    `Halo Admin! 👋`, ``,
    `Saya ingin memesan layanan:`,
    `👤 Talent: ${activeTalent.name}`,
    `🎯 Layanan: ${svcLabel}`,
    `⏱ Durasi: ${durLabel}`,
    `💰 Harga: Rp ${price.toLocaleString('id-ID')}`,
    note ? `📝 Catatan: ${note}` : '',
    ``, `Mohon konfirmasinya, terima kasih! 🙏`,
  ].filter(l => l !== undefined).join('\n');
  const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  location.href = url;
  closeModal();
  DB.addOrder({
    talentId: String(activeTalent.id), talentName: activeTalent.name,
    service: svcLabel, duration: dur, price, note, orderType: 'direct',
  }).catch(e => console.warn('Gagal simpan order:', e));
};
// ============================================================
//  AUDIO PREVIEW
// ============================================================
let _activeAudio = null;
let _activeBtn   = null;
window.playTalentAudio = function(btn) {
  const tid = btn.dataset.tid;
  const t   = TALENTS.find(x => String(x.id) === String(tid));
  const url = t?.audio || '';
  toggleAudio(tid, url, btn);
};
window.toggleAudio = function(id, url, btn) {
  if (!url || url.trim() === '') {
    btn.classList.add('shake');
    setTimeout(() => btn.classList.remove('shake'), 500);
    return;
  }
  if (_activeAudio && _activeBtn === btn) {
    _activeAudio.pause(); _activeAudio.currentTime = 0;
    _activeAudio = null; _activeBtn = null;
    btn.classList.remove('playing');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    return;
  }
  if (_activeAudio) {
    _activeAudio.pause(); _activeAudio.currentTime = 0;
    _activeBtn.classList.remove('playing');
    _activeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  }
  const audio = new Audio(url);
  btn.classList.add('playing');
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
  _activeAudio = audio; _activeBtn = btn;
  audio.play().catch(() => {
    btn.classList.remove('playing');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    _activeAudio = null; _activeBtn = null;
  });
  audio.onended = () => {
    btn.classList.remove('playing');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    _activeAudio = null; _activeBtn = null;
  };
};
// ============================================================
//  SCROLL ANIMATIONS
// ============================================================
function initScrollAnimations() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  function observeCards() {
    document.querySelectorAll('.service-card,.testi-card,.talent-card').forEach(el => {
      el.classList.add('anim-card'); observer.observe(el);
    });
  }
  observeCards();
  const grid = document.getElementById('talent-grid');
  if (grid) new MutationObserver(observeCards).observe(grid, { childList: true });
}
// ============================================================
//  SECRET ADMIN ACCESS
// ============================================================
(function() {
  let buf = '';
  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    buf += e.key.toLowerCase();
    if (buf.length > 5) buf = buf.slice(-5);
    if (buf.includes('admin')) { buf = ''; window.location.href = 'admin/index.html'; }
  });
  let clicks = 0, timer;
  document.addEventListener('DOMContentLoaded', () => {
    const logo = document.querySelector('.nav-logo');
    if (!logo) return;
    logo.addEventListener('click', () => {
      clicks++; clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 2000);
      if (clicks >= 5) { clicks = 0; window.location.href = 'admin/index.html'; }
    });
  });
})();
// ── Firebase init ─────────────────────────────────────────
let _fbApp = null, _fbDb = null;
async function getFirebase() {
  if (_fbDb) return _fbDb;
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js');
  const { getFirestore } = await import('https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js');
  const FIREBASE_CONFIG = {
    apiKey:'AIzaSyACJjz3XP7vbzxkeZmW_sCXKurAFXZ_vwU',
    authDomain:'testweb-9b2f8.firebaseapp.com',
    projectId:'testweb-9b2f8',
    storageBucket:'testweb-9b2f8.firebasestorage.app',
    messagingSenderId:'223987046525',
    appId:'1:223987046525:web:29d1a297746cd83d685365'
  };
  _fbApp = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  _fbDb  = getFirestore(_fbApp);
  return _fbDb;
}
async function loadAudioFromFirestore() {
  try {
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js');
    const db   = await getFirebase();
    const snap = await getDocs(collection(db, 'talents'));
    snap.forEach(d => {
      const data = d.data();
      const t = TALENTS.find(x => x.name.toLowerCase() === d.id || String(x.id) === d.id);
      if (t) {
        t.audio    = data.audio    || t.audio || '';
        t.online   = data.online   !== false;
        t.img      = data.img      || t.img;
        t.bio      = data.bio      || '';
        t.services = data.services && data.services.length ? data.services : t.services;
        t.approved = data.status === 'approved' || !data.status;
      }
      if (data.status === 'approved') {
        const exists = TALENTS.find(x => x.name.toLowerCase() === d.id || String(x.id) === d.id);
        if (!exists) {
          TALENTS.push({
            id: d.id, name: data.name||d.id, age: data.age||20,
            gender: data.gender||'female', img: data.img||'',
            audio: data.audio||'', online: data.online!==false,
            bio: data.bio||'', services: data.services||[],
            lockedServices: data.lockedServices||[], approved: true,
          });
        }
      }
    });
  } catch(e) { console.warn('Gagal load data talent:', e); }
}
// Realtime — re-render grid saat status berubah agar urutan otomatis update
async function listenTalentStatus() {
  try {
    const { collection, onSnapshot } = await import('https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js');
    const db = await getFirebase();
    onSnapshot(collection(db, 'talents'), snap => {
      let needRerender = false;
      snap.docChanges().forEach(change => {
        const d    = change.doc;
        const data = d.data();
        const idx  = TALENTS.findIndex(x => x.name.toLowerCase() === d.id || String(x.id) === d.id);
        if (change.type === 'removed') {
          if (idx !== -1) { TALENTS.splice(idx, 1); needRerender = true; }
          return;
        }
        if (data.status !== 'approved') {
          if (idx !== -1) { TALENTS.splice(idx, 1); needRerender = true; }
          return;
        }
        if (idx !== -1) {
          const t = TALENTS[idx];
          const wasOnline = t.online;
          t.online         = data.online !== false;
          t.audio          = data.audio || t.audio || '';
          t.bio            = data.bio || t.bio || '';
          t.services       = data.services && data.services.length ? data.services : t.services;
          t.lockedServices = data.lockedServices || [];
          t.approved       = true;
          // Kalau status online berubah → re-render agar urutan update
          if (wasOnline !== t.online) needRerender = true;
          else {
            // Hanya update DOM tanpa reorder
            const card = document.querySelector(`[data-talent-id="${t.id}"]`);
            if (card) {
              const dot = card.querySelector('.status-dot');
              const txt = card.querySelector('.status-txt');
              if (dot) dot.className = 'status-dot' + (t.online ? '' : ' offline');
              if (txt) txt.textContent = t.online ? 'ONLINE' : 'OFFLINE';
              const btn = card.querySelector('.pesan-btn');
              if (btn) {
                if (t.online) {
                  btn.textContent = 'Pesan Sekarang';
                  btn.className   = 'pesan-btn';
                  btn.onclick     = (e) => { e.stopPropagation(); openModal(String(t.id)); };
                } else {
                  btn.textContent = 'Tidak Available';
                  btn.className   = 'pesan-btn offline';
                  btn.onclick     = (e) => { e.stopPropagation(); alert('Talent tidak available'); };
                }
                card.onclick = t.online ? () => openModal(String(t.id)) : () => alert('Talent tidak available');
              }
              const tagsEl = card.querySelector('.talent-tags');
              if (tagsEl) tagsEl.innerHTML = (t.services||[]).filter(s => !(t.lockedServices||[]).includes(s)).map(s => `<span class="talent-tag ${tagClass(s)}">${s}</span>`).join('');
            }
          }
        } else {
          TALENTS.push({
            id: d.id, name: data.name||d.id, age: data.age||20,
            gender: data.gender||'female', img: data.img||'',
            audio: data.audio||'', online: data.online!==false,
            bio: data.bio||'', services: data.services||[], approved: true,
          });
          needRerender = true;
        }
      });
      if (needRerender) renderTalents();
    });
  } catch(e) { console.warn('Gagal listen status:', e); }
}
// ============================================================
//  TESTIMONI
// ============================================================
window.openTestiModal = function() {
  const sel = document.getElementById('testi-target');
  sel.innerHTML = '<option value="">— Pilih —</option><option value="CallPay Agency">🏢 CallPay Agency (umum)</option>';
  TALENTS.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.name; opt.textContent = '👤 ' + t.name;
    sel.appendChild(opt);
  });
  document.getElementById('testi-text').value = '';
  document.getElementById('testi-name').value = '';
  document.getElementById('testi-err').style.display = 'none';
  document.getElementById('testi-count').textContent = '(0/600 kata)';
  document.getElementById('testi-modal').classList.add('open');
};
window.closeTestiModal = function() { document.getElementById('testi-modal').classList.remove('open'); };
window.countTestiWords = function(el) {
  const chars = el.value.length;
  document.getElementById('testi-count').textContent = `(${chars}/600 karakter)`;
  if (chars > 600) el.value = el.value.slice(0, 600);
};
window.submitTesti = async function() {
  const target = document.getElementById('testi-target').value.trim();
  const text   = document.getElementById('testi-text').value.trim();
  const name   = document.getElementById('testi-name').value.trim() || 'Anonim';
  const errEl  = document.getElementById('testi-err');
  const btn    = document.getElementById('testi-submit-btn');
  errEl.style.display = 'none';
  if (!target) { errEl.textContent = 'Pilih dulu untuk siapa testimoni ini.'; errEl.style.display = 'block'; return; }
  if (!text || text.length < 10) { errEl.textContent = 'Testimoni terlalu pendek, minimal 10 karakter.'; errEl.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Mengirim...';
  try {
    const db = await getFirebase();
    const { addDoc, collection, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js');
    await addDoc(collection(db, 'pending_testimoni'), { target, text, name, status:'pending', createdAt:serverTimestamp() });
    closeTestiModal();
    const t = document.getElementById('toast') || (() => { const d=document.createElement('div');d.className='toast';d.id='toast';document.body.appendChild(d);return d; })();
    t.textContent = '✅ Testimoni terkirim! Menunggu review admin.';
    t.className = 'toast show';
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 4000);
  } catch(e) { errEl.textContent = 'Gagal: ' + e.message; errEl.style.display = 'block'; }
  btn.disabled = false; btn.textContent = 'Kirim Testimoni 🚀';
};
async function loadApprovedTestimoni() {
  try {
    const db = await getFirebase();
    const { collection, query, where, onSnapshot } = await import('https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js');
    const q = query(collection(db, 'pending_testimoni'), where('status','==','approved'));
    onSnapshot(q, snap => {
      const grid = document.getElementById('testi-grid');
      if (!grid) return;
      const approved = [];
      snap.forEach(d => approved.push(d.data()));
      const totalSlot = 6;
      if (approved.length === 0) {
        grid.querySelectorAll('.testi-card:not(.testi-card-dynamic)').forEach(c => c.style.display = '');
        grid.querySelectorAll('.testi-card-dynamic').forEach(el => el.remove());
        return;
      }
      const hideCount = Math.min(approved.length, totalSlot);
      const hardcodeCards = grid.querySelectorAll('.testi-card:not(.testi-card-dynamic)');
      hardcodeCards.forEach((c, i) => { c.style.display = (i >= totalSlot - hideCount) ? 'none' : ''; });
      grid.querySelectorAll('.testi-card-dynamic').forEach(el => el.remove());
      approved.slice(0, totalSlot).forEach(data => {
        const initial    = (data.name || 'A')[0].toUpperCase();
        const colorClass = ['pk','bl'][Math.floor(Math.random()*2)];
        const date       = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString('id-ID',{month:'long',year:'numeric'}) : '';
        const card       = document.createElement('div');
        card.className   = 'testi-card testi-card-dynamic';
        let talentBadge = '';
        if (data.target && data.target !== 'CallPay Agency') {
          const talentData = TALENTS.find(t => t.name === data.target);
          const isFemale   = !talentData || talentData.gender === 'female';
          const badgeColor = isFemale
            ? 'background:rgba(232,98,138,.12);border:1px solid rgba(232,98,138,.35);color:#E8628A'
            : 'background:rgba(168,213,249,.1);border:1px solid rgba(168,213,249,.3);color:#A8D5F9';
          talentBadge = `<span style="display:inline-block;${badgeColor};font-size:.68rem;font-weight:800;padding:2px 8px;border-radius:99px;margin-left:6px">untuk ${data.target}</span>`;
        }
        card.innerHTML = `<div class="testi-qmark">"</div><div class="testi-stars">★★★★★</div><p class="testi-text">${data.text}</p><div class="testi-user"><div class="testi-avatar ${colorClass}">${initial}</div><div><div class="testi-uname" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px">${data.name || 'Anonim'}${talentBadge}</div><div class="testi-date">${date}</div></div></div>`;
        grid.appendChild(card);
      });
    });
  } catch(e) { console.warn('loadApprovedTestimoni:', e); }
}
// ============================================================
//  MAINTENANCE PAGE
// ============================================================
function showMaintenancePage(waNumber) {
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.innerHTML = `
  <div style="
    position:fixed;inset:0;
    background:linear-gradient(135deg,#FF6B9D 0%,#FF8FB1 30%,#FFB3C6 60%,#FFCCD5 100%);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:'Nunito',sans-serif;text-align:center;padding:24px;
    overflow:hidden;
  ">

    <!-- Bubble dekorasi -->
    <div style="position:absolute;top:-60px;left:-60px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.12)"></div>
    <div style="position:absolute;bottom:-80px;right:-80px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,.08)"></div>
    <div style="position:absolute;top:40px;right:30px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.15)"></div>
    <div style="position:absolute;bottom:60px;left:20px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.2)"></div>

    <!-- Ilustrasi SVG lucu -->
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:8px;filter:drop-shadow(0 8px 24px rgba(0,0,0,.15))">
      <!-- Body kucing -->
      <ellipse cx="80" cy="105" rx="42" ry="36" fill="#fff" opacity=".95"/>
      <!-- Kepala -->
      <circle cx="80" cy="68" r="34" fill="#fff" opacity=".95"/>
      <!-- Telinga kiri -->
      <polygon points="50,42 42,18 66,36" fill="#fff" opacity=".95"/>
      <polygon points="52,40 46,24 64,36" fill="#FFB3C6"/>
      <!-- Telinga kanan -->
      <polygon points="110,42 118,18 94,36" fill="#fff" opacity=".95"/>
      <polygon points="108,40 114,24 96,36" fill="#FFB3C6"/>
      <!-- Mata kiri — bintang lucu -->
      <text x="63" y="72" font-size="14" text-anchor="middle" fill="#E8628A">★</text>
      <!-- Mata kanan — bintang lucu -->
      <text x="97" y="72" font-size="14" text-anchor="middle" fill="#E8628A">★</text>
      <!-- Hidung -->
      <ellipse cx="80" cy="78" rx="4" ry="3" fill="#FFB3C6"/>
      <!-- Mulut senyum -->
      <path d="M72 84 Q80 92 88 84" stroke="#E8628A" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <!-- Kumis kiri -->
      <line x1="52" y1="78" x2="72" y2="80" stroke="#E8628A" stroke-width="1.5" opacity=".6"/>
      <line x1="50" y1="83" x2="70" y2="82" stroke="#E8628A" stroke-width="1.5" opacity=".6"/>
      <!-- Kumis kanan -->
      <line x1="108" y1="78" x2="88" y2="80" stroke="#E8628A" stroke-width="1.5" opacity=".6"/>
      <line x1="110" y1="83" x2="90" y2="82" stroke="#E8628A" stroke-width="1.5" opacity=".6"/>
      <!-- Kunci inggris (maintenance) -->
      <g transform="translate(54,98) rotate(-30)">
        <rect x="0" y="0" width="36" height="10" rx="5" fill="#FFB3C6"/>
        <circle cx="34" cy="5" r="9" fill="#FFB3C6" stroke="#fff" stroke-width="2"/>
        <circle cx="34" cy="5" r="5" fill="#fff"/>
      </g>
      <!-- Bintang kecil dekorasi -->
      <text x="22" y="55" font-size="10" fill="#FF6B9D" opacity=".7">✦</text>
      <text x="128" y="50" font-size="8" fill="#FF6B9D" opacity=".6">✦</text>
      <text x="135" y="100" font-size="6" fill="#FF6B9D" opacity=".5">✦</text>
    </svg>

    <!-- Logo -->
    <div style="font-family:'Pacifico',cursive;font-size:2rem;color:#fff;letter-spacing:.02em;margin-bottom:16px;text-shadow:0 2px 12px rgba(200,50,90,.25)">
      CallPay
    </div>

    <!-- Card pesan -->
    <div style="
      background:rgba(255,255,255,.85);
      backdrop-filter:blur(12px);
      border-radius:24px;
      padding:28px 32px;
      max-width:360px;
      width:100%;
      box-shadow:0 8px 32px rgba(200,50,90,.15);
    ">
      <div style="font-size:1.5rem;margin-bottom:8px">🔧</div>
      <div style="font-size:1.15rem;font-weight:900;color:#C2185B;margin-bottom:10px;line-height:1.4">
        Maaf, kami sedang perbaikan!
      </div>
      <div style="font-size:.88rem;font-weight:700;color:#888;line-height:1.7;margin-bottom:20px">
        Website sedang dalam maintenance.<br>
        Kamu masih bisa order melalui Admin ya 😊
      </div>
      <a href="https://wa.me/${waNumber.replace(/\D/g,'')}"
        target="_blank"
        style="
          display:block;
          background:linear-gradient(135deg,#E8628A,#FF8FB1);
          color:#fff;
          text-decoration:none;
          padding:13px 24px;
          border-radius:99px;
          font-weight:900;
          font-size:.92rem;
          box-shadow:0 4px 16px rgba(232,98,138,.35);
          transition:opacity .2s;
        "
        onmouseover="this.style.opacity='.85'"
        onmouseout="this.style.opacity='1'"
      >
        💬 Hubungi Admin via WhatsApp
      </a>
    </div>

    <!-- Footer -->
    <div style="margin-top:20px;font-size:.75rem;color:rgba(255,255,255,.7);font-weight:700">
      Terima kasih atas kesabaranmu 🩷
    </div>
  </div>`;

  // Load font Pacifico kalau belum ada
  if (!document.querySelector('link[href*="Pacifico"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap';
    document.head.appendChild(link);
  }
}

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await DB.getSettingsAsync();
  const cfg = DB.getSettings();

  // ── Cek mode maintenance ──────────────────────────────────
  if (cfg.maintenance === true) {
    showMaintenancePage(cfg.waNumber || '62895400709371');
    return; // stop — jangan render website
  }

  loadPricesFromFirestore();
  await loadServicesFromFirestore();
  await loadAudioFromFirestore();
  renderTalents();
  listenTalentStatus();
  const modal = document.getElementById('order-modal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  initScrollAnimations();
  loadApprovedTestimoni();
  document.getElementById('testi-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('testi-modal')) closeTestiModal();
  });
});
