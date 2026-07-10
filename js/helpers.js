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
  const headers = nonEmpty[0].map(h => h.trim());
  return nonEmpty.slice(1).map(cells => {
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
function num(v){ return parseFloat(String(v||'0').replace(',','.')) || 0; }
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

