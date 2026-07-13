/* ================= TAB 1: SUSUT ================= */
function susutRender(rows){
  const ulpKey = findKey(rows[0], ['ulp','unit']);
  const bulanKey = findKey(rows[0], ['bulan']);
  const tbKey = findKey(rows[0], ['targetbulanan','targetbln']);
  const rbKey = findKey(rows[0], ['realisasibulanan','realisasibln']);
  const tkKey = findKey(rows[0], ['targetkumulatif','targetkum']);
  const rkKey = findKey(rows[0], ['realisasikumulatif','realisasikum']);
  if(!ulpKey||!bulanKey||!tkKey||!rkKey){ setStatus('susut_status', false, 'Kolom ULP/Bulan/Target_Kumulatif/Realisasi_Kumulatif tidak ditemukan.'); return; }

  const isFilled = v => v!==undefined && v!==null && String(v).trim()!=='';
  const isUp3Total = ulpName => /^UP3\b/i.test(ulpName.trim());

  const dataAll = rows.map(r=>({
    ulp: String(r[ulpKey]||'').trim(), bulan: String(r[bulanKey]||'').trim(),
    tb: tbKey?num(r[tbKey]):null, rb: rbKey?num(r[rbKey]):null,
    tk:num(r[tkKey]), rk:num(r[rkKey]),
    rkFilled: isFilled(r[rkKey])
  })).filter(d=>d.ulp && d.bulan);

  // Baris "UP3 MADIUN" (atau UP3 ...) adalah total gabungan yang sudah dihitung
  // berbobot di sheet — dipisah dari data per-ULP supaya tidak ikut jadi ULP ke-8.
  const data = dataAll.filter(d=>!isUp3Total(d.ulp));
  const up3Data = dataAll.filter(d=>isUp3Total(d.ulp));

  const ulps = [...new Set(data.map(d=>d.ulp))];
  const bulans = [...new Set(data.map(d=>d.bulan))];
  // Ambil bulan terakhir yang datanya sudah lengkap terisi untuk SEMUA ULP,
  // jangan asal ambil baris paling bawah (bisa jadi bulan mendatang yang masih kosong).
  const filledBulans = bulans.filter(b=>{
    const rowsB = data.filter(d=>d.bulan===b);
    return rowsB.length>0 && rowsB.every(d=>d.rkFilled);
  });
  const lastBulan = filledBulans.length ? filledBulans[filledBulans.length-1] : bulans[bulans.length-1];
  const lastData = data.filter(d=>d.bulan===lastBulan);

  // Gunakan baris "UP3 MADIUN" (total berbobot) untuk KPI atas jika tersedia;
  // kalau tidak ada, fallback ke rata-rata sederhana antar ULP (kurang akurat).
  const up3Row = up3Data.find(d=>d.bulan===lastBulan);
  const avgT = up3Row ? up3Row.tk : lastData.reduce((s,d)=>s+d.tk,0)/lastData.length;
  const avgR = up3Row ? up3Row.rk : lastData.reduce((s,d)=>s+d.rk,0)/lastData.length;
  const pencapaian = avgR ? (avgT/avgR)*100 : 0;
  const diAtas = lastData.filter(d=>d.rk>d.tk);
  const diBawah = lastData.filter(d=>d.rk<=d.tk);

  // ranking ULP dari yang terbaik (gap paling negatif / paling di bawah target) ke terburuk
  const ranked = [...lastData].sort((a,b)=>(a.rk-a.tk)-(b.rk-b.tk));
  const best = ranked[0], worst = ranked[ranked.length-1];
  const maxScale = Math.max(...lastData.map(d=>Math.max(d.tk,d.rk))) * 1.15;

  // tren bulan terakhir vs bulan sebelumnya (level UP3) untuk narasi
  const up3Sorted = up3Data.filter(d=>d.rkFilled).sort((a,b)=>filledBulans.indexOf(a.bulan)-filledBulans.indexOf(b.bulan));
  const up3Last = up3Sorted[up3Sorted.length-1], up3Prev = up3Sorted[up3Sorted.length-2];
  const trendDiff = (up3Last && up3Prev) ? (up3Last.rk!=null?up3Last.rk:0) - (up3Prev.rk!=null?up3Prev.rk:0) : null;

  document.getElementById('susut_period').textContent = `SD ${lastBulan} 2026`;

  document.getElementById('susut_exec_summary').style.display = 'block';
  document.getElementById('susut_headline').innerHTML = `Susut UP3 Madiun s.d <b>${lastBulan} 2026</b> tercatat <b>${avgR.toFixed(2)}%</b> dari target kumulatif <b>${avgT.toFixed(2)}%</b> — ${pencapaian>=100?`<b>memenuhi target</b> (pencapaian ${pencapaian.toFixed(2)}%)`:`<b>belum memenuhi target</b> (pencapaian ${pencapaian.toFixed(2)}%)`}. ${diAtas.length>0?`Sebanyak <b>${diAtas.length} dari ${ulps.length} ULP</b> masih di atas target dan perlu perhatian.`:`Seluruh <b>${ulps.length} ULP</b> sudah berada di bawah/sesuai target.`}`;
  document.getElementById('susut_exec_grid').innerHTML = `
    <div class="exec-point"><span class="tag pos">Terbaik</span><br><b>${best.ulp}</b> — realisasi ${best.rk.toFixed(2)}% (gap ${(best.rk-best.tk).toFixed(2)} vs target)</div>
    <div class="exec-point"><span class="tag ${diAtas.length>0?'neg':'pos'}">${diAtas.length>0?'Perlu perhatian':'Aman'}</span><br><b>${worst.ulp}</b> — realisasi ${worst.rk.toFixed(2)}% (gap +${(worst.rk-worst.tk).toFixed(2)} vs target)</div>
    <div class="exec-point"><span class="tag info">Tren bulanan</span><br>${trendDiff!=null?`${trendDiff<=0?'Membaik':'Memburuk'} ${Math.abs(trendDiff).toFixed(2)} poin vs ${up3Prev.bulan}`:'Data tren belum cukup'}</div>`;

  document.getElementById('susut_side').innerHTML = `
    <div class="exec-side-item"><div class="lbl">Jumlah ULP</div><div class="val">${ulps.length} ULP</div></div>
    <div class="exec-side-item"><div class="lbl">Target kumulatif</div><div class="val">${avgT.toFixed(2)}%</div></div>
    <div class="exec-side-item"><div class="lbl">Realisasi kumulatif</div><div class="val">${avgR.toFixed(2)}%</div></div>
    <div class="exec-side-item"><div class="lbl">Pencapaian target</div><div class="val">${pencapaian.toFixed(2)}%</div></div>
    <div class="exec-side-item"><div class="lbl">ULP di atas target</div><div class="val">${diAtas.length} ULP</div></div>
    <div class="exec-side-item"><div class="lbl">ULP di bawah target</div><div class="val">${diBawah.length} ULP</div></div>
    <div class="exec-side-item"><div class="lbl">ULP performa terbaik</div><div class="val" style="font-size:13px;">${best.ulp}</div></div>
    <div class="exec-side-item"><div class="lbl">ULP perlu perhatian</div><div class="val" style="font-size:13px;">${worst.ulp}</div></div>`;

  document.getElementById('susut_kpi').innerHTML = `
    <div class="kpi-card green"><div class="kpi-label">Pencapaian target kumulatif</div><div class="kpi-value">${pencapaian.toFixed(2)}%</div><div class="kpi-sub">${pencapaian>=100?'Memenuhi target':'Belum memenuhi target'}</div></div>
    <div class="kpi-card"><div class="kpi-label">Target kumulatif</div><div class="kpi-value">${avgT.toFixed(2)}%</div><div class="kpi-sub">SD ${lastBulan} 2026</div></div>
    <div class="kpi-card green"><div class="kpi-label">Realisasi kumulatif</div><div class="kpi-value">${avgR.toFixed(2)}%</div><div class="kpi-sub">SD ${lastBulan} 2026</div></div>
    <div class="kpi-card ${diAtas.length>0?'red':'green'}"><div class="kpi-label">ULP di atas target</div><div class="kpi-value">${diAtas.length} ULP</div><div class="kpi-sub">Perlu perhatian</div></div>`;
  document.getElementById('susut_bar_head').textContent = `Target vs realisasi kumulatif per ULP — SD ${lastBulan} 2026`;

  destroyChart('susut_chart');
  charts['susut_chart'] = new Chart(document.getElementById('susut_chart'), {
    type:'bar', data:{ labels:lastData.map(d=>d.ulp), datasets:[
      {label:'Target kumulatif', data:lastData.map(d=>d.tk), backgroundColor:'#1f6fc6', borderRadius:4, maxBarThickness:22},
      {label:'Realisasi kumulatif', data:lastData.map(d=>d.rk), backgroundColor:'#1c8a4a', borderRadius:4, maxBarThickness:22}]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:11}}}}, scales:{y:{beginAtZero:true, ticks:{callback:v=>v+'%'}}} }
  });

  document.getElementById('susut_rank').innerHTML = ranked.map((d,i)=>{
    const gap = d.rk-d.tk, good = gap<=0;
    const rankClass = i===0?'top':(i===ranked.length-1 && gap>0?'bottom':'');
    const fillPct = Math.min(100,(d.rk/maxScale)*100);
    const markerPct = Math.min(100,(d.tk/maxScale)*100);
    return `<div class="rank-item">
      <div class="rank-num ${rankClass}">${i+1}</div>
      <div class="rank-name">${d.ulp}<small>Target ${d.tk.toFixed(2)}%</small></div>
      <div class="rank-bar-track"><div class="rank-bar-fill ${good?'good':'bad'}" style="width:${fillPct}%;"></div><div class="rank-marker" style="left:${markerPct}%;"></div></div>
      <div class="rank-gap ${good?'good':'bad'}">${gap>=0?'+':''}${gap.toFixed(2)}</div>
    </div>`;
  }).join('');

  document.getElementById('susut_cards').innerHTML = lastData.map(d=>{
    const gap = d.rk - d.tk, good = gap<=0;
    return `<div class="ulp-card ${good?'good':'bad'}">
      <div class="name">ULP ${d.ulp}</div>
      <div class="row">Target <b>${d.tk.toFixed(2)}%</b></div>
      <div class="row">Realisasi <b>${d.rk.toFixed(2)}%</b></div>
      <div class="gap">Gap: ${gap>=0?'+':''}${gap.toFixed(2)}</div>
    </div>`;
  }).join('');

  // trend bulanan UP3 (rata-rata semua ULP per bulan) — hanya bulan yang sudah terisi
  const trend = filledBulans.map(b=>{
    const rowsB = data.filter(d=>d.bulan===b);
    const avgRb = rowsB.reduce((s,d)=> s+(d.rb!=null?d.rb:d.rk), 0)/rowsB.length;
    return {bulan:b, value:avgRb};
  });
  destroyChart('susut_trend');
  charts['susut_trend'] = new Chart(document.getElementById('susut_trend'), {
    type:'line', data:{ labels:trend.map(t=>t.bulan), datasets:[{label:'Realisasi bulanan', data:trend.map(t=>t.value), borderColor:'#1f6fc6', backgroundColor:'#1f6fc6', tension:0.25, pointRadius:4}] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:v=>v+'%'}}} }
  });
  const lastT = trend[trend.length-1], prevT = trend[trend.length-2];
  if(prevT){
    const diff = lastT.value-prevT.value;
    document.getElementById('susut_trend_caption').innerHTML = `Realisasi susut bulan ${lastT.bulan} sebesar <b>${lastT.value.toFixed(2)}%</b>, ${diff<=0?'menurun':'meningkat'} ${Math.abs(diff).toFixed(2)} poin dibanding bulan ${prevT.bulan} (${prevT.value.toFixed(2)}%).`;
  }

  // ---- matrix bulanan per ULP: TARGET, REALISASI (tier 4-warna) + % TARGET (tier 3-warna) ----
  let thead = '<thead><tr><th>UNIT</th><th>Sat</th>' + bulans.map(b=>`<th>${b}</th>`).join('') + '</tr></thead>';
  let tbody = '<tbody>';
  // Catatan: matriks ini menampilkan nilai KUMULATIF (tk/rk), bukan bulanan (tb/rb) —
  // sesuai permintaan, tb/rb hanya dipakai sebagai fallback kalau kumulatif kosong.
  ulps.forEach(u=>{
    tbody += `<tr><td rowspan="3">${u}</td><td class="label">TARGET</td>` + bulans.map(b=>{
      const d = data.find(x=>x.ulp===u && x.bulan===b);
      if(!d) return '<td>-</td>';
      const v = d.tk!=null?d.tk:d.tb;
      return `<td class="${susutTierClass(v)}">${v.toFixed(2)}%</td>`;
    }).join('') + '</tr>';
    tbody += `<tr><td class="label">REALISASI</td>` + bulans.map(b=>{
      const d = data.find(x=>x.ulp===u && x.bulan===b);
      if(!d || !d.rkFilled) return '<td>-</td>';
      const v = d.rk!=null?d.rk:d.rb;
      return `<td class="${susutTierClass(v)}">${v.toFixed(2)}%</td>`;
    }).join('') + '</tr>';
    tbody += `<tr><td class="label">% TARGET</td>` + bulans.map(b=>{
      const d = data.find(x=>x.ulp===u && x.bulan===b);
      if(!d || !d.rkFilled) return '<td>-</td>';
      const v = d.rk!=null?d.rk:d.rb;
      const t = d.tk!=null?d.tk:d.tb;
      const ratio = v ? (t/v*100) : 0;
      return `<td class="${achievementTierClass(ratio)}">${ratio.toFixed(2)}%</td>`;
    }).join('') + '</tr>';
  });
  // UP3 total row — pakai baris "UP3 MADIUN" (berbobot) kalau tersedia, kalau tidak fallback rata-rata
  tbody += `<tr class="up3-row"><td rowspan="3">UP3 MADIUN</td><td class="label" style="color:#cfe0f0;">TARGET</td>` + bulans.map(b=>{
    const d3 = up3Data.find(d=>d.bulan===b);
    let v;
    if(d3){ v = d3.tk!=null?d3.tk:d3.tb; }
    else{
      const rowsB = data.filter(d=>d.bulan===b);
      v = rowsB.reduce((s,d)=>s+(d.tk!=null?d.tk:d.tb),0)/rowsB.length;
    }
    return `<td class="${susutTierClass(v)}">${v.toFixed(2)}%</td>`;
  }).join('') + '</tr>';
  tbody += `<tr class="up3-row"><td class="label" style="color:#cfe0f0;">REALISASI</td>` + bulans.map(b=>{
    const d3 = up3Data.find(d=>d.bulan===b);
    if(d3){
      if(!d3.rkFilled) return '<td>-</td>';
      const v = d3.rk!=null?d3.rk:d3.rb;
      return `<td class="${susutTierClass(v)}">${v.toFixed(2)}%</td>`;
    }
    const rowsB = data.filter(d=>d.bulan===b);
    if(!rowsB.every(d=>d.rkFilled)) return '<td>-</td>';
    const v = rowsB.reduce((s,d)=>s+(d.rk!=null?d.rk:d.rb),0)/rowsB.length;
    return `<td class="${susutTierClass(v)}">${v.toFixed(2)}%</td>`;
  }).join('') + '</tr>';
  tbody += `<tr class="up3-row"><td class="label" style="color:#cfe0f0;">% TARGET</td>` + bulans.map(b=>{
    const d3 = up3Data.find(d=>d.bulan===b);
    let v, t;
    if(d3){
      if(!d3.rkFilled) return '<td>-</td>';
      v = d3.rk!=null?d3.rk:d3.rb; t = d3.tk!=null?d3.tk:d3.tb;
    } else {
      const rowsB = data.filter(d=>d.bulan===b);
      if(!rowsB.every(d=>d.rkFilled)) return '<td>-</td>';
      v = rowsB.reduce((s,d)=>s+(d.rk!=null?d.rk:d.rb),0)/rowsB.length;
      t = rowsB.reduce((s,d)=>s+(d.tk!=null?d.tk:d.tb),0)/rowsB.length;
    }
    const ratio = v ? (t/v*100) : 0;
    return `<td class="${achievementTierClass(ratio)}">${ratio.toFixed(2)}%</td>`;
  }).join('') + '</tr>';
  tbody += '</tbody>';
  document.getElementById('susut_matrix').innerHTML = thead + tbody;

  document.getElementById('susut_insight').innerHTML = `
    <li><b>${best.ulp}</b> jadi ULP dengan kinerja terbaik, realisasi ${best.rk.toFixed(2)}% vs target ${best.tk.toFixed(2)}% (${(best.tk-best.rk).toFixed(2)} poin di bawah target).</li>
    <li>${diBawah.length} dari ${ulps.length} ULP sudah berada di bawah/sesuai target kumulatif s.d ${lastBulan}.</li>
    ${trendDiff!=null && trendDiff<=0 ? `<li>Tren susut UP3 membaik ${Math.abs(trendDiff).toFixed(2)} poin dibanding bulan ${up3Prev.bulan}.</li>` : ''}`;

  document.getElementById('susut_monitor').innerHTML = diAtas.length ? diAtas.map(d=>
    `<li><b>${d.ulp}</b> di atas target ${(d.rk-d.tk).toFixed(2)} poin (realisasi ${d.rk.toFixed(2)}% vs target ${d.tk.toFixed(2)}%).</li>`
  ).join('') : `<li>Tidak ada ULP yang berada di atas target bulan ini.</li>`;

  document.getElementById('susut_reco').innerHTML = diAtas.length ? `
    <li>Prioritaskan investigasi susut non-teknis di <b>${worst.ulp}</b> (gap terbesar, +${(worst.rk-worst.tk).toFixed(2)} poin).</li>
    <li>Evaluasi P2TL &amp; akurasi meter di ULP yang di atas target sebelum akhir triwulan.</li>
    <li>Replikasi praktik baik dari <b>${best.ulp}</b> ke ULP dengan gap terbesar.</li>` : `
    <li>Pertahankan momentum — seluruh ULP sudah sesuai/di bawah target.</li>
    <li>Lanjutkan monitoring bulanan agar tren tetap terjaga.</li>`;

  showDash('susut');
  setStatus('susut_status', true, 'Data berhasil dimuat (' + ulps.length + ' ULP, ' + bulans.length + ' bulan).');
}
/* ================= PARSER: CSV MENTAH SHEET "PERHITUNGAN SUSUT" (multi-blok per ULP) =================
   Dipakai kalau link CSV yang dimasukkan adalah export LANGSUNG dari sheet sumber (bukan sheet
   ringkasan rapi 1-baris-per-ULP-per-bulan). Di sheet sumber, tiap ULP (dan "UP3 MADIUN" sebagai
   total) adalah blok terpisah yang diawali baris judul "REALISASI SUSUT DISTRIBUSI TH. #### - <ULP>",
   diikuti baris-baris bulan (NO 1-12, BLN nama bulan panjang, lalu kolom PAL/P2TL/.../KWH PRODUK/
   rasio-rasio %). Posisi kolom (index) di bawah FIXED mengikuti struktur sheet sumber saat ini —
   kalau kolom di sheet sumber ditambah/dihapus/digeser, index ini harus disesuaikan ulang:
     2 PAL, 3 P2TL, 4 PESTA, 5 Lain2/Suplisi, 6 TAL-TUL, 7 Restitusi, 8 LPB, 9 PSSD,
     11 E-MIN, 12 TUL III-09, 13 KWH PRODUK,
     16 SUSUT III.09 (bulanan), 17 SUSUT III.09 (kumulatif), 20 TARGET (III.09, kumulatif) */
const MASTER_BULAN_MAP = {
  'JANUARI':'JAN','FEBRUARI':'FEB','MARET':'MAR','APRIL':'APR','MEI':'MEI','JUNI':'JUN',
  'JULI':'JUL','AGUSTUS':'AGT','SEPTEMBER':'SEP','OKTOBER':'OKT','NOPEMBER':'NOV','DESEMBER':'DES'
};

// Parser CSV sederhana yang menghormati tanda kutip (field boleh mengandung koma di dalamnya).
function masterParseCsvText(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for(let i=0;i<text.length;i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){ if(text[i+1] === '"'){ field += '"'; i++; } else { inQuotes = false; } }
      else field += c;
    } else {
      if(c === '"') inQuotes = true;
      else if(c === ','){ row.push(field); field=''; }
      else if(c === '\n'){ row.push(field); rows.push(row); row=[]; field=''; }
      else if(c === '\r'){ /* biarkan \n yang menutup baris */ }
      else field += c;
    }
  }
  if(field!=='' || row.length){ row.push(field); rows.push(row); }
  return rows;
}

// Konversi angka format Indonesia ("1.234.567,89", "(13.376,00)", "- 3.796", "44,23%", "-", "")
// menjadi Number JS. Nilai kosong/"-"/tak terbaca -> 0.
function masterNum(s){
  if(s==null) return 0;
  s = String(s).trim();
  if(s===''||s==='-') return 0;
  let neg = false;
  if(s[0]==='(' && s[s.length-1]===')'){ neg = true; s = s.slice(1,-1).trim(); }
  if(s[0]==='-'){ neg = true; s = s.slice(1).trim(); }
  s = s.replace(/%/g,'').trim();
  s = s.replace(/\./g,'').replace(',', '.');
  const v = parseFloat(s);
  if(isNaN(v)) return 0;
  return neg ? -v : v;
}

// Baca teks CSV mentah sheet sumber -> { susutRows, detailRows } siap dilempar ke
// susutRender() / susutDetailRender() (nama field sengaja disamakan dengan susutSample()/
// susutDetailSample() supaya findKey() di kedua fungsi render tetap mengenalinya).
function masterParseSusutSheet(text){
  const rows = masterParseCsvText(text);
  const susutRows = [], detailRows = [];
  let currentUlp = null;
  for(const r of rows){
    const c1 = (r[1]||'').trim();
    if(/^REALISASI SUSUT DISTRIBUSI/i.test(c1)){
      const parts = c1.split(' - ');
      currentUlp = parts[parts.length-1].trim();
      continue;
    }
    if(!currentUlp) continue;
    const no = (r[0]||'').trim();
    const blnUp = c1.toUpperCase();
    if(!/^\d+$/.test(no) || !MASTER_BULAN_MAP[blnUp]) continue; // bukan baris data bulan
    const palRaw = r[2];
    if(!palRaw || !palRaw.trim()) continue; // bulan yang belum terisi di sheet -> lewati
    const bulan = MASTER_BULAN_MAP[blnUp];
    detailRows.push({
      ULP: currentUlp, Bulan: bulan,
      PAL: masterNum(r[2]), P2TL: masterNum(r[3]), PESTA: masterNum(r[4]),
      Lain2_Suplisi: masterNum(r[5]), TAL_TUL: masterNum(r[6]), Restitusi: masterNum(r[7]),
      LPB: masterNum(r[8]), PSSD: masterNum(r[9]), EMIN: masterNum(r[11]),
      TUL_III09: masterNum(r[12]), KWH_Produksi: masterNum(r[13]),
      Target_Kumulatif: masterNum(r[20])
    });
    susutRows.push({
      ULP: currentUlp, Bulan: bulan,
      Realisasi_Bulanan: masterNum(r[16]),
      Realisasi_Kumulatif: masterNum(r[17]),
      Target_Kumulatif: masterNum(r[20])
    });
  }
  return { susutRows, detailRows };
}

async function masterFetchText(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('HTTP ' + res.status);
  return await res.text();
}

async function susutLoad(){
  const url = document.getElementById('susut_url').value.trim();
  if(!url){ setStatus('susut_status', false, 'Masukkan link CSV terlebih dahulu.'); return; }
  setStatus('susut_status', true, 'Memuat data...');
  try{ susutRender(await fetchCSV(url)); } catch(e){ setStatus('susut_status', false, 'Gagal memuat: ' + e.message); }
}
function susutSample(){
  const ulpData = {
    'MANTINGAN': [12.13,12.34,12.31,11.80,12.30],
    'MAGETAN':   [8.91,8.78,8.96,9.05,8.55],
    'NGAWI':     [8.93,8.90,8.88,8.87,8.76],
    'MAOSPATI':  [6.21,6.95,6.48,4.60,5.73],
    'CARUBAN':   [6.86,6.26,6.61,5.99,5.87],
    'DOLOPO':    [7.28,6.23,6.39,7.02,6.47],
    'MADIUN KOTA':[0.77,3.14,4.38,5.22,5.67],
  };
  const targetData = {
    'MANTINGAN': [12.35,12.34,12.31,12.30,12.30],
    'MAGETAN':   [8.66,8.63,8.61,8.60,8.55],
    'NGAWI':     [8.93,8.90,8.88,8.87,8.76],
    'MAOSPATI':  [6.21,6.95,6.85,4.60,5.73],
    'CARUBAN':   [6.06,6.00,6.15,5.99,5.87],
    'DOLOPO':    [7.28,6.23,6.39,7.02,6.47],
    'MADIUN KOTA':[5.86,5.83,5.80,6.70,5.67],
  };
  const bulans = ['JAN','FEB','MAR','APR','MEI'];
  const cumTarget = {}, cumReal = {};
  Object.keys(ulpData).forEach(u=>{ cumTarget[u]=0; cumReal[u]=0; });
  const rows = [];
  bulans.forEach((b,i)=>{
    Object.keys(ulpData).forEach(u=>{
      cumTarget[u]+=targetData[u][i]; cumReal[u]+=ulpData[u][i];
      rows.push({ULP:u, Bulan:b, Target_Bulanan:targetData[u][i], Realisasi_Bulanan:ulpData[u][i],
        Target_Kumulatif:(cumTarget[u]/(i+1)*1).toFixed(2), Realisasi_Kumulatif:(cumReal[u]/(i+1)*1).toFixed(2)});
    });
  });
  susutRender(rows);
}


/* ================= SUSUT: DETAIL PERHITUNGAN (PAL/P2TL/LPB/PSSD/E-MIN dst) =================
   Sumber: sheet "PERHITUNGAN SUSUT". Rumus di bawah sudah diverifikasi cocok persis dengan
   angka-angka di sheet sumber (dicek manual angka per angka):
     JML                  = P2TL + PESTA + Lain2/Suplisi + TAL-TUL + Restitusi + LPB
     Susut (III-07+JBST)% = (KWH_Produksi - PAL) / KWH_Produksi
     Susut III.09%        = (KWH_Produksi - TUL_III09 - PSSD) / KWH_Produksi
     Tanpa E-Min%         = (KWH_Produksi - TUL_III09 - PSSD + E-Min) / KWH_Produksi
     Versi KUMULATIF      = akumulasi pembilang ÷ akumulasi KWH_Produksi (rata-rata berbobot,
                             BUKAN rata-rata sederhana antar bulan).
   Baris "UP3 MADIUN" TIDAK diambil dari CSV — selalu dihitung otomatis sebagai penjumlahan
   seluruh baris ULP untuk bulan yang sama, baru rasio %-nya dihitung ulang dari hasil
   penjumlahan itu (sesuai permintaan: nilai UP3 = penjumlahan ULP di tabel bawahnya). */
let susutDetailData = [];
let susutDetailUlps = [];
let susutDetailBulans = [];
let susutDetailUp3Target = {};

function susutDetailToggle(){
  const sec = document.getElementById('susut_detail_section');
  const btn = document.getElementById('susutDetailToggleBtn');
  const show = sec.style.display === 'none';
  sec.style.display = show ? 'block' : 'none';
  btn.textContent = show ? '✕ Tutup data detail perhitungan susut' : '📊 Lihat data detail perhitungan susut (PAL / P2TL / LPB dst)';
}

function susutDetailJML(d){
  return d.p2tl + d.pesta + d.lain2 + d.taltul + d.restitusi + d.lpb;
}
function susutDetailRatioBulanan(d){
  const kp = d.kwhProduksi || 0;
  return {
    susutBln: kp ? (kp - d.pal) / kp * 100 : 0,
    susut09Bln: kp ? (kp - d.tul309 - d.pssd) / kp * 100 : 0,
    tanpaEminBln: kp ? (kp - d.tul309 - d.pssd + d.emin) / kp * 100 : 0
  };
}
// getRowForBulan(bulan) harus mengembalikan baris komponen (ULP tunggal ATAU hasil
// penjumlahan UP3) untuk bulan tsb, atau null kalau tidak ada. Diakumulasi mengikuti
// urutan susutDetailBulans (asumsi CSV sudah diurutkan dari bulan terlama ke terbaru).
function susutDetailRatioKumulatif(getRowForBulan, uptoBulan){
  let sumKP=0, sumNumSusut=0, sumNumSusut09=0;
  for(const b of susutDetailBulans){
    const d = getRowForBulan(b);
    if(d){
      const kp = d.kwhProduksi || 0;
      sumKP += kp;
      sumNumSusut += (kp - d.pal);
      sumNumSusut09 += (kp - d.tul309 - d.pssd);
    }
    if(b === uptoBulan) break;
  }
  return {
    susutKom: sumKP ? sumNumSusut/sumKP*100 : 0,
    susut09Kom: sumKP ? sumNumSusut09/sumKP*100 : 0
  };
}
function susutDetailTierClass(v){
  if(v <= 8) return 'ach-green';
  if(v <= 10) return 'ach-yellow';
  return 'ach-red';
}
// Penjumlahan seluruh ULP untuk satu bulan -> jadi baris "UP3 MADIUN".
function susutDetailUp3ForBulan(bulan){
  const rowsB = susutDetailData.filter(d=>d.bulan===bulan);
  if(!rowsB.length) return null;
  const sum = (key)=> rowsB.reduce((s,d)=>s+d[key],0);
  return {
    ulp:'UP3 MADIUN', bulan,
    pal:sum('pal'), p2tl:sum('p2tl'), pesta:sum('pesta'), lain2:sum('lain2'),
    taltul:sum('taltul'), restitusi:sum('restitusi'), lpb:sum('lpb'),
    pssd:sum('pssd'), emin:sum('emin'), tul309:sum('tul309'), kwhProduksi:sum('kwhProduksi')
  };
}

function susutDetailRender(rows){
  const uKey = findKey(rows[0], ['ulp','unit']);
  const bKey = findKey(rows[0], ['bulan']);
  const palKey = findKey(rows[0], ['pal']);
  const p2tlKey = findKey(rows[0], ['p2tl']);
  const pestaKey = findKey(rows[0], ['pesta']);
  const lain2Key = findKey(rows[0], ['lain2','suplisi']);
  const taltulKey = findKey(rows[0], ['taltul']);
  const restitusiKey = findKey(rows[0], ['restitusi']);
  const lpbKey = findKey(rows[0], ['lpb']);
  const pssdKey = findKey(rows[0], ['pssd']);
  const eminKey = findKey(rows[0], ['emin']);
  const tul309Key = findKey(rows[0], ['tuliii09','tuliii']);
  const kwhProdKey = findKey(rows[0], ['kwhproduksi','produksi']);
  const targetKey = findKey(rows[0], ['targetkumulatif','target']);
  if(!uKey||!bKey||!palKey||!p2tlKey||!tul309Key||!kwhProdKey){
    setStatus('susut_detail_status', false, 'Kolom wajib (ULP/Bulan/PAL/P2TL/TUL_III09/KWH_Produksi) tidak lengkap ditemukan.');
    return;
  }
  const isUp3Total = ulpName => /^UP3\b/i.test(String(ulpName).trim());

  const dataAll = rows.map(r=>({
    ulp: String(r[uKey]||'').trim(), bulan: String(r[bKey]||'').trim(),
    pal: num(r[palKey]), p2tl: num(r[p2tlKey]), pesta: pestaKey?num(r[pestaKey]):0,
    lain2: lain2Key?num(r[lain2Key]):0, taltul: taltulKey?num(r[taltulKey]):0,
    restitusi: restitusiKey?num(r[restitusiKey]):0, lpb: lpbKey?num(r[lpbKey]):0,
    pssd: pssdKey?num(r[pssdKey]):0, emin: eminKey?num(r[eminKey]):0,
    tul309: num(r[tul309Key]), kwhProduksi: num(r[kwhProdKey]),
    target: targetKey?num(r[targetKey]):null
  })).filter(d=>d.ulp && d.bulan);

  // Simpan target UP3 MADIUN per bulan terpisah (dibaca dari baris "UP3 MADIUN" sebelum
  // dibuang) — dipakai untuk kolom Target di baris total, karena target %-nya tidak bisa
  // dijumlahkan begitu saja dari target tiap ULP.
  susutDetailUp3Target = {};
  dataAll.filter(d=>isUp3Total(d.ulp)).forEach(d=>{ susutDetailUp3Target[d.bulan] = d.target; });

  // Baris "UP3 MADIUN" kalau ikut ter-upload di CSV SENGAJA dibuang (isUp3Total di atas) —
  // nilai UP3 selalu dihitung ulang dari penjumlahan ULP, bukan dipercaya dari CSV.
  susutDetailData = dataAll.filter(d=>!isUp3Total(d.ulp) && d.kwhProduksi>0); // hanya bulan yang sudah terisi
  susutDetailUlps = [...new Set(susutDetailData.map(d=>d.ulp))];
  susutDetailBulans = [...new Set(susutDetailData.map(d=>d.bulan))];

  if(!susutDetailUlps.length || !susutDetailBulans.length){
    setStatus('susut_detail_status', false, 'Tidak ada baris data yang lengkap (KWH_Produksi harus > 0).');
    return;
  }

  susutDetailRenderMatrix();
  susutDetailPopulateMonthSelect();
  susutDetailRenderBreakdown();

  document.getElementById('susut_detail_dash').style.display = 'block';
  document.getElementById('susut_detail_empty').style.display = 'none';
  setStatus('susut_detail_status', true, 'Data detail berhasil dimuat (' + susutDetailUlps.length + ' ULP, ' + susutDetailBulans.length + ' bulan). Baris UP3 MADIUN dihitung otomatis dari penjumlahan ULP.');
}
async function susutDetailLoad(){
  const url = document.getElementById('susut_detail_url').value.trim();
  if(!url){ setStatus('susut_detail_status', false, 'Masukkan link CSV terlebih dahulu.'); return; }
  setStatus('susut_detail_status', true, 'Memuat data...');
  try{
    const text = await masterFetchText(url);
    const { detailRows } = masterParseSusutSheet(text);
    if(!detailRows.length){ setStatus('susut_detail_status', false, 'Tidak ada baris data bulan yang terbaca dari CSV ini. Pastikan link mengarah ke sheet "PERHITUNGAN SUSUT" yang benar.'); return; }
    susutDetailRender(detailRows);
  } catch(e){ setStatus('susut_detail_status', false, 'Gagal memuat: ' + e.message); }
}

function susutDetailRenderMatrix(){
  let thead = '<thead><tr><th>ULP</th>' + susutDetailBulans.map(b=>`<th>${b}</th>`).join('') + '</tr></thead>';
  let tbody = '<tbody>';
  susutDetailUlps.forEach(u=>{
    const getRow = (b)=> susutDetailData.find(d=>d.ulp===u && d.bulan===b);
    tbody += `<tr><td>${u}</td>` + susutDetailBulans.map(b=>{
      const d = getRow(b);
      if(!d) return '<td>-</td>';
      const { susut09Kom } = susutDetailRatioKumulatif(getRow, b);
      return `<td class="${susutDetailTierClass(susut09Kom)}">${susut09Kom.toFixed(2)}%</td>`;
    }).join('') + '</tr>';
  });
  const getRowUp3 = (b)=> susutDetailUp3ForBulan(b);
  tbody += `<tr class="up3-row"><td>UP3 MADIUN</td>` + susutDetailBulans.map(b=>{
    const d = getRowUp3(b);
    if(!d) return '<td>-</td>';
    const { susut09Kom } = susutDetailRatioKumulatif(getRowUp3, b);
    return `<td class="${susutDetailTierClass(susut09Kom)}">${susut09Kom.toFixed(2)}%</td>`;
  }).join('') + '</tr>';
  tbody += '</tbody>';
  document.getElementById('susut_detail_matrix').innerHTML = thead + tbody;
}

function susutDetailPopulateMonthSelect(){
  const sel = document.getElementById('susut_detail_month_select');
  sel.innerHTML = susutDetailBulans.map(b=>`<option value="${b}">${b}</option>`).join('');
  sel.value = susutDetailBulans[susutDetailBulans.length-1];
}

function susutDetailRenderBreakdown(){
  const sel = document.getElementById('susut_detail_month_select');
  const bulan = sel.value || susutDetailBulans[susutDetailBulans.length-1];
  const cols = [
    {k:'pal', label:'PAL'}, {k:'p2tl', label:'P2TL'}, {k:'pesta', label:'PESTA'},
    {k:'lain2', label:'Lain2/Suplisi'}, {k:'taltul', label:'TAL-TUL'}, {k:'restitusi', label:'Restitusi'},
    {k:'lpb', label:'LPB'}, {k:'jml', label:'JML'}, {k:'pssd', label:'PSSD'}, {k:'emin', label:'E-MIN'},
    {k:'tul309', label:'TUL III-09'}, {k:'kwhProduksi', label:'KWh Produksi'}
  ];
  let thead = '<thead><tr><th>ULP</th>' + cols.map(c=>`<th>${c.label}</th>`).join('') +
    '<th>Susut Bulanan</th><th>Susut Kumulatif</th><th>Target</th><th>Tanpa E-Min Bln</th></tr></thead>';
  let tbody = '<tbody>';
  susutDetailUlps.forEach(u=>{
    const getRow = (b)=> susutDetailData.find(d=>d.ulp===u && d.bulan===b);
    const d = getRow(bulan);
    if(!d){ tbody += `<tr><td>${u}</td>${cols.map(()=>'<td>-</td>').join('')}<td>-</td><td>-</td><td>-</td><td>-</td></tr>`; return; }
    const jml = susutDetailJML(d);
    const { susut09Bln, tanpaEminBln } = susutDetailRatioBulanan(d);
    const { susut09Kom } = susutDetailRatioKumulatif(getRow, bulan);
    const targetCell = d.target!=null ? `${d.target.toFixed(2)}%` : '-';
    tbody += `<tr><td>${u}</td>` + cols.map(c=>{
      const v = c.k==='jml' ? jml : d[c.k];
      return `<td>${Math.round(v).toLocaleString('id-ID')}</td>`;
    }).join('') +
      `<td class="${susutDetailTierClass(susut09Bln)}">${susut09Bln.toFixed(2)}%</td>` +
      `<td class="${susutDetailTierClass(susut09Kom)}">${susut09Kom.toFixed(2)}%</td>` +
      `<td class="target-cell">${targetCell}</td>` +
      `<td class="${susutDetailTierClass(tanpaEminBln)}">${tanpaEminBln.toFixed(2)}%</td></tr>`;
  });
  const getRowUp3 = (b)=> susutDetailUp3ForBulan(b);
  const d3 = getRowUp3(bulan);
  if(d3){
    const jml3 = susutDetailJML(d3);
    const ratioBln3 = susutDetailRatioBulanan(d3);
    const { susutKom, susut09Kom } = susutDetailRatioKumulatif(getRowUp3, bulan);
    const up3Target = susutDetailUp3Target[bulan];
    const up3TargetCell = up3Target!=null ? `${up3Target.toFixed(2)}%` : '-';
    tbody += `<tr class="up3-row"><td>UP3 MADIUN</td>` + cols.map(c=>{
      const v = c.k==='jml' ? jml3 : d3[c.k];
      return `<td>${Math.round(v).toLocaleString('id-ID')}</td>`;
    }).join('') +
      `<td>${ratioBln3.susut09Bln.toFixed(2)}%</td><td>${susut09Kom.toFixed(2)}%</td><td>${up3TargetCell}</td><td>${ratioBln3.tanpaEminBln.toFixed(2)}%</td></tr>`;

    document.getElementById('susut_detail_kpi').innerHTML = `
      <div class="kpi-card"><div class="kpi-label">KWh produksi UP3 (${bulan})</div><div class="kpi-value">${(d3.kwhProduksi/1e6).toFixed(2)}</div><div class="kpi-sub">GWh</div></div>
      <div class="kpi-card ${susutKom<=8?'green':(susutKom<=10?'amber':'red')}"><div class="kpi-label">Susut (III-07+JBST) kumulatif</div><div class="kpi-value">${susutKom.toFixed(2)}%</div><div class="kpi-sub">s.d ${bulan}</div></div>
      <div class="kpi-card ${susut09Kom<=8?'green':(susut09Kom<=10?'amber':'red')}"><div class="kpi-label">Susut III.09 kumulatif</div><div class="kpi-value">${susut09Kom.toFixed(2)}%</div><div class="kpi-sub">s.d ${bulan}</div></div>
      <div class="kpi-card purple"><div class="kpi-label">Tanpa E-Min (bulan ${bulan})</div><div class="kpi-value">${ratioBln3.tanpaEminBln.toFixed(2)}%</div></div>`;
  }
  tbody += '</tbody>';
  document.getElementById('susut_detail_breakdown').innerHTML = thead + tbody;
}

function susutDetailSample(){
  susutDetailRender([
    {ULP:'MADIUN KOTA', Bulan:'JAN', PAL:20786258, P2TL:81066, PESTA:18837, Lain2_Suplisi:17827.94, TAL_TUL:-3800, Restitusi:0, LPB:9416810, PSSD:312510.06, EMIN:396411, TUL_III09:31628297.14, KWH_Produksi:31788491.8},
    {ULP:'MADIUN KOTA', Bulan:'FEB', PAL:18595456, P2TL:17033, PESTA:13111, Lain2_Suplisi:17703.43, TAL_TUL:-3120, Restitusi:0, LPB:8333523.6, PSSD:282563.77, EMIN:494061, TUL_III09:27148169.32, KWH_Produksi:28587945.9},
    {ULP:'MADIUN KOTA', Bulan:'MAR', PAL:20233701, P2TL:29495, PESTA:26512, Lain2_Suplisi:21162.09, TAL_TUL:-2593, Restitusi:0, LPB:9651808.6, PSSD:313146.48, EMIN:490178, TUL_III09:29954690.23, KWH_Produksi:31904945},
    {ULP:'MADIUN KOTA', Bulan:'APR', PAL:21202846, P2TL:95895, PESTA:26165, Lain2_Suplisi:134269.01, TAL_TUL:-2961, Restitusi:0, LPB:9888661.3, PSSD:303415.7, EMIN:347964, TUL_III09:31219919.74, KWH_Produksi:33733851.5},
    {ULP:'MADIUN KOTA', Bulan:'MEI', PAL:22020862, P2TL:186394, PESTA:36260, Lain2_Suplisi:145706.64, TAL_TUL:-1582, Restitusi:0, LPB:10989614, PSSD:344642.75, EMIN:358937, TUL_III09:33243187.43, KWH_Produksi:35256238.3},
    {ULP:'MADIUN KOTA', Bulan:'JUN', PAL:21114861, P2TL:449651, PESTA:40962, Lain2_Suplisi:18241.71, TAL_TUL:-1107, Restitusi:0, LPB:10582130, PSSD:329216.62, EMIN:371606, TUL_III09:32288350.38, KWH_Produksi:33716012},
    {ULP:'MAGETAN', Bulan:'JAN', PAL:12935109, P2TL:63408, PESTA:22022, Lain2_Suplisi:7433, TAL_TUL:-3796, Restitusi:0, LPB:8800702, PSSD:333273.61, EMIN:209698, TUL_III09:21943866.18, KWH_Produksi:24495672.52},
    {ULP:'MAGETAN', Bulan:'FEB', PAL:11711723, P2TL:58414, PESTA:31436, Lain2_Suplisi:4377, TAL_TUL:-1819, Restitusi:0, LPB:7792159.5, PSSD:301591.79, EMIN:244027, TUL_III09:19651632.06, KWH_Produksi:21297838.6},
    {ULP:'MAGETAN', Bulan:'MAR', PAL:13206540, P2TL:85305, PESTA:35846, Lain2_Suplisi:7571.54, TAL_TUL:-2152, Restitusi:0, LPB:9440662, PSSD:334364.91, EMIN:260914, TUL_III09:22650103.23, KWH_Produksi:24949619.88},
    {ULP:'MAGETAN', Bulan:'APR', PAL:13126031, P2TL:96758, PESTA:33722, Lain2_Suplisi:8481.01, TAL_TUL:-2710, Restitusi:0, LPB:9390033.2, PSSD:324081.79, EMIN:180208, TUL_III09:22637466.63, KWH_Produksi:25194335},
    {ULP:'MAGETAN', Bulan:'MEI', PAL:13544954, P2TL:146418, PESTA:17139, Lain2_Suplisi:4396.81, TAL_TUL:-1448, Restitusi:0, LPB:10427171, PSSD:384162.17, EMIN:177355, TUL_III09:24038998.27, KWH_Produksi:26591407},
    {ULP:'MAGETAN', Bulan:'JUN', PAL:13391666, P2TL:88602, PESTA:13322, Lain2_Suplisi:5962, TAL_TUL:-2564, Restitusi:0, LPB:10522526, PSSD:368356.82, EMIN:192974, TUL_III09:24030766.47, KWH_Produksi:26215888},
    {ULP:'NGAWI', Bulan:'JAN', PAL:17777503, P2TL:129417, PESTA:39920, Lain2_Suplisi:34992.13, TAL_TUL:-2617, Restitusi:0, LPB:13711285, PSSD:454890.45, EMIN:298900, TUL_III09:31701321.39, KWH_Produksi:34965545.48},
    {ULP:'NGAWI', Bulan:'FEB', PAL:17134244, P2TL:124880, PESTA:42116, Lain2_Suplisi:11715.88, TAL_TUL:-6707, Restitusi:0, LPB:12329000.9, PSSD:411696.9, EMIN:323025, TUL_III09:29687985.13, KWH_Produksi:31985931.4},
    {ULP:'NGAWI', Bulan:'MAR', PAL:19629827, P2TL:112455, PESTA:31941, Lain2_Suplisi:6426, TAL_TUL:-1574, Restitusi:0, LPB:15248470.9, PSSD:456286.94, EMIN:477159, TUL_III09:34821656.91, KWH_Produksi:37674884.12},
    {ULP:'NGAWI', Bulan:'APR', PAL:19457394, P2TL:239317, PESTA:31960, Lain2_Suplisi:13064.43, TAL_TUL:-1515, Restitusi:0, LPB:14604004.6, PSSD:442870.78, EMIN:372644, TUL_III09:34369984.8, KWH_Produksi:37845273.0},
    {ULP:'NGAWI', Bulan:'MEI', PAL:19520774, P2TL:163361, PESTA:33600, Lain2_Suplisi:10249, TAL_TUL:-3800, Restitusi:0, LPB:16870817, PSSD:510621.08, EMIN:345445, TUL_III09:36313917.57, KWH_Produksi:40074818},
    {ULP:'NGAWI', Bulan:'JUN', PAL:19539600, P2TL:220053, PESTA:32956, Lain2_Suplisi:12392, TAL_TUL:-3677, Restitusi:0, LPB:19598600, PSSD:486504.07, EMIN:287211, TUL_III09:38727643.78, KWH_Produksi:42573837},
    {ULP:'MAOSPATI', Bulan:'JAN', PAL:7549513, P2TL:50409, PESTA:8721, Lain2_Suplisi:8603.46, TAL_TUL:-1748, Restitusi:0, LPB:4967929, PSSD:177626.88, EMIN:106199, TUL_III09:12664353.32, KWH_Produksi:13529091},
    {ULP:'MAOSPATI', Bulan:'FEB', PAL:6896789, P2TL:47726, PESTA:9580, Lain2_Suplisi:2391.43, TAL_TUL:-36, Restitusi:0, LPB:4204032.2, PSSD:160635.28, EMIN:119592, TUL_III09:11289488.01, KWH_Produksi:11871662.0},
    {ULP:'MAOSPATI', Bulan:'MAR', PAL:7795837, P2TL:60375, PESTA:15313, Lain2_Suplisi:4330.4, TAL_TUL:-1973, Restitusi:0, LPB:4863137.47, PSSD:178503.23, EMIN:115079, TUL_III09:12737019.87, KWH_Produksi:13605447.0},
    {ULP:'MAOSPATI', Bulan:'APR', PAL:7786121, P2TL:65100, PESTA:15789, Lain2_Suplisi:7988.64, TAL_TUL:-382, Restitusi:0, LPB:5435728.7, PSSD:173044.3, EMIN:105765, TUL_III09:13218721.62, KWH_Produksi:13563627.0},
    {ULP:'MAOSPATI', Bulan:'MEI', PAL:8637228, P2TL:34321, PESTA:14946, Lain2_Suplisi:6321.29, TAL_TUL:-1874, Restitusi:0, LPB:6225700, PSSD:200569.1, EMIN:112717, TUL_III09:14836096.8, KWH_Produksi:16218224},
    {ULP:'MAOSPATI', Bulan:'JUN', PAL:8606894, P2TL:57175, PESTA:10667, Lain2_Suplisi:13572.91, TAL_TUL:-1680, Restitusi:0, LPB:6590198, PSSD:193752.14, EMIN:92597, TUL_III09:15217416.08, KWH_Produksi:16424757},
    {ULP:'CARUBAN', Bulan:'JAN', PAL:11177442, P2TL:36584, PESTA:6323, Lain2_Suplisi:37576.75, TAL_TUL:-966, Restitusi:0, LPB:6294785, PSSD:248889.87, EMIN:179901, TUL_III09:17699219.48, KWH_Produksi:19043008.0},
    {ULP:'CARUBAN', Bulan:'FEB', PAL:10297568, P2TL:68738, PESTA:10049, Lain2_Suplisi:29183.76, TAL_TUL:-918, Restitusi:0, LPB:5480778.8, PSSD:225121.55, EMIN:187311, TUL_III09:15913947.6, KWH_Produksi:16977706.0},
    {ULP:'CARUBAN', Bulan:'MAR', PAL:10979644, P2TL:73521, PESTA:10221, Lain2_Suplisi:43695.71, TAL_TUL:-607, Restitusi:0, LPB:6416278.7, PSSD:249491.17, EMIN:138332, TUL_III09:17448280.23, KWH_Produksi:18827035.0},
    {ULP:'CARUBAN', Bulan:'APR', PAL:10485243, P2TL:90606, PESTA:11091, Lain2_Suplisi:38753.22, TAL_TUL:-1108, Restitusi:0, LPB:6644149.6, PSSD:241693.7, EMIN:98085, TUL_III09:17175926.3, KWH_Produksi:19237285},
    {ULP:'CARUBAN', Bulan:'MEI', PAL:11047177, P2TL:534967, PESTA:14888, Lain2_Suplisi:47163.75, TAL_TUL:-832, Restitusi:0, LPB:7862124, PSSD:279415.32, EMIN:107248, TUL_III09:19308273.07, KWH_Produksi:20267474},
    {ULP:'CARUBAN', Bulan:'JUN', PAL:10940059, P2TL:56719, PESTA:31852, Lain2_Suplisi:50276.38, TAL_TUL:-1374, Restitusi:0, LPB:8736196, PSSD:267426.14, EMIN:119509, TUL_III09:19787643.26, KWH_Produksi:20930730},
    {ULP:'DOLOPO', Bulan:'JAN', PAL:7544556, P2TL:46895, PESTA:6770, Lain2_Suplisi:5146, TAL_TUL:-208, Restitusi:0, LPB:5413967, PSSD:199960.42, EMIN:107033, TUL_III09:13059812.78, KWH_Produksi:14185575.2},
    {ULP:'DOLOPO', Bulan:'FEB', PAL:6765188, P2TL:36968, PESTA:6129, Lain2_Suplisi:6047, TAL_TUL:-585, Restitusi:0, LPB:4570698.4, PSSD:180923.23, EMIN:139886, TUL_III09:11515047.76, KWH_Produksi:12165718.1},
    {ULP:'DOLOPO', Bulan:'MAR', PAL:7684357, P2TL:38992, PESTA:6230, Lain2_Suplisi:5288.16, TAL_TUL:-426, Restitusi:0, LPB:5572498.7, PSSD:200553.76, EMIN:126374, TUL_III09:13210934.74, KWH_Produksi:14426893.0},
    {ULP:'DOLOPO', Bulan:'APR', PAL:7481300, P2TL:46225, PESTA:13398, Lain2_Suplisi:5250.43, TAL_TUL:-272, Restitusi:0, LPB:5624214.8, PSSD:194556.1, EMIN:108317, TUL_III09:13124592.66, KWH_Produksi:14290732.5},
    {ULP:'DOLOPO', Bulan:'MEI', PAL:7820050, P2TL:22550, PESTA:8149, Lain2_Suplisi:7048.62, TAL_TUL:-4212, Restitusi:0, LPB:6608266, PSSD:229953.39, EMIN:99549, TUL_III09:14308663.72, KWH_Produksi:15499817.7},
    {ULP:'DOLOPO', Bulan:'JUN', PAL:7558844, P2TL:74580, PESTA:9656, Lain2_Suplisi:4636, TAL_TUL:-1345, Restitusi:0, LPB:6663650, PSSD:221727.31, EMIN:116168, TUL_III09:14348055.8, KWH_Produksi:15129322},
    {ULP:'MANTINGAN', Bulan:'JAN', PAL:5118797, P2TL:62247, PESTA:2000, Lain2_Suplisi:2589, TAL_TUL:-241, Restitusi:0, LPB:4097969, PSSD:162616.75, EMIN:38425, TUL_III09:9438769.47, KWH_Produksi:10621929},
    {ULP:'MANTINGAN', Bulan:'FEB', PAL:4629159, P2TL:109928, PESTA:8919, Lain2_Suplisi:2068.13, TAL_TUL:-228, Restitusi:0, LPB:3435827.9, PSSD:147270.21, EMIN:40840, TUL_III09:8209972.12, KWH_Produksi:9438846.0},
    {ULP:'MANTINGAN', Bulan:'MAR', PAL:5429135, P2TL:116693, PESTA:12259, Lain2_Suplisi:1096.73, TAL_TUL:-164, Restitusi:0, LPB:4354156.9, PSSD:163320.95, EMIN:35681, TUL_III09:9806706.28, KWH_Produksi:11475098},
    {ULP:'MANTINGAN', Bulan:'APR', PAL:5185402, P2TL:140920, PESTA:11409, Lain2_Suplisi:2767.33, TAL_TUL:-531, Restitusi:0, LPB:3981221.9, PSSD:158465.74, EMIN:35487, TUL_III09:9368789.56, KWH_Produksi:10770544.4},
    {ULP:'MANTINGAN', Bulan:'MEI', PAL:5424375, P2TL:97807, PESTA:5500, Lain2_Suplisi:3499.01, TAL_TUL:-508, Restitusi:0, LPB:4844476, PSSD:187023.93, EMIN:37121, TUL_III09:10316518.38, KWH_Produksi:11754922},
    {ULP:'MANTINGAN', Bulan:'JUN', PAL:5155305, P2TL:95989, PESTA:4793, Lain2_Suplisi:3021.55, TAL_TUL:-809, Restitusi:0, LPB:5437274, PSSD:177154.27, EMIN:41032, TUL_III09:10560855.97, KWH_Produksi:11857670},
  ]);
}
