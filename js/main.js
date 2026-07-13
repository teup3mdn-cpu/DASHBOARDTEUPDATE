/* ================= AUTO-SAVE LINK & AUTO-REFRESH ================= */
const AUTO_STORAGE_KEY = 'up3madiun_dash_links_v1';
const AUTO_REFRESH_MS = 5 * 60 * 1000; // refresh data setiap 5 menit

const AUTO_TABS = [
  { urlId:'susut_url', loadFn:()=>susutLoad() },
  { urlId:'susut_detail_url', loadFn:()=>susutDetailLoad() },
  { urlId:'kwh_url',   loadFn:()=>kwhLoad() },
  { urlId:'comp_url',  loadFn:()=>compLoad() },
  { urlId:'p2tl_url',     loadFn:()=>p2tlLoad() },
  { urlId:'p2tl_ulp_url', loadFn:()=>p2tlUlpLoad() },
  { urlId:'gm_url',    loadFn:()=>gmLoad() },
  { urlId:'prog_url',  loadFn:()=>progLoad() },
  { urlId:'tm_url',    loadFn:()=>tmLoad() },
];

function getSavedLinks(){
  try{ return JSON.parse(localStorage.getItem(AUTO_STORAGE_KEY) || '{}'); }
  catch(e){ return {}; }
}
function saveLink(urlId, url){
  const links = getSavedLinks();
  if(url){ links[urlId] = url; } else { delete links[urlId]; }
  localStorage.setItem(AUTO_STORAGE_KEY, JSON.stringify(links));
}

let charts = {};
function destroyChart(id){ if(charts[id]){ charts[id].destroy(); delete charts[id]; } }

document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
  });
});

AUTO_TABS.forEach(({urlId})=>{
  const input = document.getElementById(urlId);
  if(!input) return;
  input.addEventListener('change', ()=> saveLink(urlId, input.value.trim()));
});

// Input pendamping yang bukan pemicu loadFn sendiri (nilainya dibaca di dalam loadFn
// tab lain), tapi tetap perlu disimpan & dipulihkan otomatis seperti input "_url" lain.
const EXTRA_URL_IDS = ['prog_ckp_url'];
EXTRA_URL_IDS.forEach(id=>{
  const input = document.getElementById(id);
  if(!input) return;
  input.addEventListener('change', ()=> saveLink(id, input.value.trim()));
});
document.querySelectorAll('.config button:not(.secondary)').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    // Cari input "_url" TERDEKAT SEBELUM tombol ini (bukan sekadar input pertama di
    // parent .config), supaya panel yang berisi lebih dari 1 pasang input+tombol
    // (mis. tab P2TL: p2tl_url dan p2tl_ulp_url dalam satu .config) tetap menyimpan
    // link yang benar sesuai tombol yang benar-benar diklik.
    let el = btn.previousElementSibling;
    let input = null;
    while(el){
      if(el.tagName === 'INPUT' && /_url$/.test(el.id)){ input = el; break; }
      el = el.previousElementSibling;
    }
    if(input && input.value.trim()) saveLink(input.id, input.value.trim());
  });
});

function refreshBadge(msg){
  let el = document.getElementById('auto_refresh_badge');
  if(!el){
    el = document.createElement('div');
    el.id = 'auto_refresh_badge';
    el.style.cssText = 'position:fixed;bottom:14px;right:14px;background:#0d2a4a;color:#fff;font-size:11px;font-weight:600;padding:7px 12px;border-radius:20px;box-shadow:0 4px 14px rgba(13,42,74,.25);z-index:999;font-family:Inter,sans-serif;opacity:.92;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
}

/* ---- Tampilkan/sembunyikan seluruh panel "Muat data" (input link CSV + tombol) ----
   Setelah link sekali dimasukkan & tersimpan, panel ini otomatis disembunyikan supaya
   tampilan dashboard bersih. Tombol ⚙ di header dipakai untuk membuka lagi kalau perlu
   mengganti link sumber. Kotak input manual (regu, TS, biaya, dsb) TIDAK ikut disembunyikan
   karena itu memang harus diisi/diubah manual tiap periode, bukan bagian dari "muat data". */
function toggleConfigVisibility(force){
  const shouldHide = force !== undefined ? force : !document.body.classList.contains('hide-config');
  document.body.classList.toggle('hide-config', shouldHide);
  const btn = document.getElementById('toggleConfigBtn');
  const note = document.getElementById('configStatusNote');
  if(shouldHide){
    btn.textContent = '⚙ Ubah link sumber data';
    note.style.display = 'block';
    note.textContent = 'Link sumber data tersimpan di browser ini dan otomatis dimuat ulang tiap 5 menit — tidak perlu klik "Muat data" lagi.';
  } else {
    btn.textContent = '✕ Tutup pengaturan';
    note.style.display = 'none';
  }
}

async function autoLoadAll(isInitial){
  const links = getSavedLinks();
  const tabsWithLink = AUTO_TABS.filter(t => links[t.urlId]);
  if(!tabsWithLink.length){
    // Belum ada link tersimpan sama sekali -> tampilkan panel "Muat data" agar user bisa setup pertama kali.
    toggleConfigVisibility(false);
    return;
  }
  if(isInitial){
    tabsWithLink.forEach(({urlId})=>{
      const input = document.getElementById(urlId);
      if(input) input.value = links[urlId];
    });
    EXTRA_URL_IDS.forEach(id=>{
      const input = document.getElementById(id);
      if(input && links[id]) input.value = links[id];
    });
    // Sudah ada link tersimpan dari sesi sebelumnya -> sembunyikan panel "Muat data" secara default.
    toggleConfigVisibility(true);
  }
  refreshBadge('🔄 Memuat ulang data...');
  for(const {urlId, loadFn} of tabsWithLink){
    try{ await loadFn(); } catch(e){ /* status sudah ditangani masing-masing Load() */ }
  }
  const now = new Date();
  refreshBadge('✓ Data terbaru — ' + now.toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'}));
}

window.addEventListener('DOMContentLoaded', ()=>{ autoLoadAll(true); });
// Auto-refresh: selama tab/halaman ini tetap terbuka di browser, data dimuat ulang otomatis
// tiap AUTO_REFRESH_MS (5 menit) TANPA perlu klik apa pun, dan juga langsung dimuat ulang
// begitu user kembali membuka tab ini (visibilitychange). Jadi cukup masukkan link CSV
// SEKALI di awal (atau klik "Lihat contoh"); setelahnya dashboard mengikuti perubahan di
// sumber (Google Sheet) secara otomatis selama halaman ini masih terbuka.
setInterval(()=>autoLoadAll(false), AUTO_REFRESH_MS);
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') autoLoadAll(false); });