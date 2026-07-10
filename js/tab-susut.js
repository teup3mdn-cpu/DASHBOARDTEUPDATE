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

