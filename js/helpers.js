/* ---------- shared helpers ---------- */
function parseCSV(text){
  const rowsRaw = [];
  let row = [], field = '', inQuotes = false;
  for(let i=0;i<text.length;i++){
    const c = text[i], next = text[i+1];
    if(inQuotes){
      if(c === '"' && next === '"'){ field += '"'; i++; }
      else if(c === '"'){ inQuotes = false; }
      else { field += c; }
    } else {
      if(c === '"'){ inQuotes = true; }
      else if(c === ','){ row.push(field); field=''; }
      else if(c === '\r'){ /* skip */ }
      else if(c === '\n'){ row.push(field); rowsRaw.push(row); row=[]; field=''; }
      else { field += c; }
    }
  }
  if(field.length || row.length){ row.push(field); rowsRaw.push(row); }
  const nonEmpty = rowsRaw.filter(r => r.some(c => String(c).trim() !== ''));
  if(!nonEmpty.length) return [];

  // ---- Deteksi baris header yang sesungguhnya ----
  // Sheet sumber sering punya baris judul/deskripsi di atas baris header asli, misal:
  //   "Prognosa Historis,,,,,"
  //   "Satu baris per bulan yang sudah closed...,,,,,"
  //   "Periode,Status,KWh_Produksi,KWh_Prabayar,KWh_Paskabayar,KWh_P2TL"   <- header asli
  // Baris judul/deskripsi seperti itu biasanya cuma mengisi SATU kolom (kolom A),
  // sedangkan baris header asli mengisi BANYAK kolom sekaligus. Jadi: lewati dulu
  // baris-baris di awal yang cuma punya <=1 kolom terisi, baru anggap baris pertama
  // dengan >=2 kolom terisi sebagai header sesungguhnya. Ini mencegah bug lama di mana
  // baris judul salah ke-anggap header, sehingga kolom "Periode"/"Produksi" jadi "tidak
  // ditemukan" padahal sebenarnya ada beberapa baris di bawahnya.
  let headerIdx = nonEmpty.findIndex(r => r.filter(c => String(c).trim() !== '').length >= 2);
  if(headerIdx === -1) headerIdx = 0; // fallback: semua baris cuma 1 kolom, pakai baris pertama seperti biasa

  const headers = nonEmpty[headerIdx].map(h => h.trim());
  return nonEmpty.slice(headerIdx+1).map(cells => {
    const obj = {};
    headers.forEach((h,i) => obj[h] = (cells[i] !== undefined ? cells[i].trim() : ''));
    return obj;
  });
}
function findKey(obj, candidates){
  for(const k of Object.keys(obj)){
    const kl = k.toLowerCase().replace(/[^a-z0-9]/g,'');
    for(const c of candidates) if(kl.includes(c)) return k;
  }
  return null;
}
// Versi bertingkat: cek grup kandidat paling SPESIFIK dulu di SEMUA kolom, baru turun ke
// grup yang lebih umum kalau tidak ketemu. Ini mencegah kata umum seperti "target" salah
// menangkap kolom "Target_Bulanan" padahal yang dicari adalah "Target_Kumulatif".
function findKeyPriority(obj, candidateGroups){
  for(const group of candidateGroups){
    const found = findKey(obj, group);
    if(found) return found;
  }
  return null;
}
// ---- Parser angka yang aman untuk format Indonesia (titik = ribuan, koma = desimal)
// SEKALIGUS tetap kompatibel dengan angka gaya lama di kode (mis. "12.13" untuk susut %).
// Sebelumnya num() cuma replace(',', '.') tanpa membuang titik ribuan, sehingga angka
// besar seperti "148.629.313,00" (dari CSV sheet) salah terbaca jadi 148.629 saja.
function num(v){
  // Kalau input sudah berupa angka JS (bukan string dari CSV), langsung pakai apa
  // adanya. Ini WAJIB ada: kalau dilewatkan ke heuristik string di bawah, angka yang
  // kebetulan punya persis 3 digit desimal (mis. 8.857 hasil parse sebelumnya) akan
  // salah dikira "8.857" ala format ribuan Indonesia dan berubah jadi 8857. Bug ini
  // yang menyebabkan kolom TARGET di tabel Susut per ULP salah besar 1000x untuk
  // sebagian ULP (NGAWI, MAOSPATI, CARUBAN, DOLOPO, MANTINGAN, UP3 MADIUN) sementara
  // yang desimalnya cuma 2 digit (MADIUN KOTA, MAGETAN) kebetulan tetap tampil benar.
  if(typeof v === 'number') return isNaN(v) ? 0 : v;
  let s = String(v==null ? '' : v).trim();
  if(s === '') return 0;
  // buang karakter selain digit/titik/koma/minus (mis. "Rp", spasi, %)
  s = s.replace(/[^0-9.,-]/g, '');
  if(s === '' || s === '-') return 0;

  const hasComma = s.includes(',');
  const dotCount = (s.match(/\./g) || []).length;

  if(hasComma){
    // Format Indonesia: titik = pemisah ribuan (buang semua), koma = desimal.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if(dotCount >= 2){
    // Tidak ada koma tapi titik lebih dari satu -> pasti pemisah ribuan
    // (angka valid cuma boleh punya maksimal satu titik desimal).
    s = s.replace(/\./g, '');
  } else if(dotCount === 1){
    // Satu titik, tanpa koma: bisa jadi pemisah ribuan (mis. "20.489" = 20489)
    // atau memang angka desimal biasa (mis. "12.13" = 12.13, dipakai di banyak
    // contoh kode & kolom susut %). Heuristik: kalau digit SETELAH titik PERSIS
    // 3 angka dan digit SEBELUM titik pendek (1-3 digit), anggap pemisah ribuan
    // ala Indonesia; selain itu biarkan sebagai desimal seperti perilaku lama.
    const parts = s.split('.');
    const intPart = parts[0].replace('-', ''), fracPart = parts[1];
    if(fracPart && fracPart.length === 3 && intPart.length <= 3){
      s = s.replace(/\./g, '');
    }
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
async function fetchCSV(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('HTTP ' + res.status);
  return parseCSV(await res.text());
}
function setStatus(id, ok, msg){
  const el = document.getElementById(id);
  el.className = 'status ' + (ok ? 'ok' : 'err');
  el.textContent = msg;
}
function showDash(prefix){
  document.getElementById(prefix+'_dash').style.display = 'block';
  document.getElementById(prefix+'_empty').style.display = 'none';
}

/* ---- Tier warna susut: 4 tingkat berdasarkan nilai susut mentah (%) ----
   <6%          -> orange
   6% - 9.9%    -> hijau
   10% - 12.8%  -> merah
   >12.8%       -> hitam                                                     */
function susutTierClass(v){
  if(v < 6) return 'tier-orange';
  if(v >= 6 && v <= 9.9) return 'tier-green';
  if(v >= 10 && v <= 12.8) return 'tier-red';
  return 'tier-black';
}
/* ---- Tier warna pencapaian target: 3 tingkat berdasarkan rasio Target/Realisasi (%) ----
   >=100%        -> hijau (target tercapai / realisasi di bawah-sama target)
   95% - 99.99%  -> kuning (mendekati target, sedikit di atas)
   <95%          -> merah (jauh di atas target)                              */
function achievementTierClass(ratioPct){
  if(ratioPct >= 100) return 'ach-green';
  if(ratioPct >= 95) return 'ach-yellow';
  return 'ach-red';
}