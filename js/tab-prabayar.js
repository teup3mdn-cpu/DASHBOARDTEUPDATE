/* ================= TAB 3: PRABAYAR ================= */
let praData = [];
function praRender(rows){
  const ulpKey = findKey(rows[0], ['ulp','unit']);
  const pKey = findKey(rows[0], ['periode','bulan']);
  const gKey = findKey(rows[0], ['gwh']);
  if(!ulpKey||!pKey||!gKey){ setStatus('pra_status', false, 'Kolom ULP/Periode/GWh tidak ditemukan.'); return; }
  praData = rows.map(r=>({ulp:r[ulpKey], periode:r[pKey], gwh:num(r[gKey])})).filter(d=>d.ulp&&d.periode);
  praRecalcManual();
  setStatus('pra_status', true, 'Data berhasil dimuat.');
}
function praRecalcManual(){
  if(!praData.length) return;
  const periodsAll = [...new Set(praData.map(d=>d.periode))].sort();
  const periods = periodsAll.filter(p => praData.filter(d=>d.periode===p).reduce((s,d)=>s+d.gwh,0) > 0);
  if(!periods.length) return;
  const last = periods[periods.length-1], prev = periods[periods.length-2];
  const totals = periods.map(p=>praData.filter(d=>d.periode===p).reduce((s,d)=>s+d.gwh,0));
  const totalLast = totals[totals.length-1] || 0;
  const totalPrev = totals[totals.length-2] || 0;
  const growthAbs = totalLast-totalPrev;
  const growth = totalPrev ? (growthAbs/totalPrev*100) : 0;
  const avgHarian = totalLast/30;
  const komposisi = num(document.getElementById('pra_komposisi').value);
  const pctAwal = num(document.getElementById('pra_pct_awal').value);

  document.getElementById('pra_title').textContent = `KINERJA PENJUALAN KWH PRABAYAR ${last||''}`;
  document.getElementById('pra_sub').textContent = `Penjualan ${growth>=0?'meningkat':'menurun'} ${Math.abs(growth).toFixed(1)}% dibanding ${prev||'bulan sebelumnya'}`;

  document.getElementById('pra_kpi').innerHTML = `
    <div class="icon-kpi"><div class="circle navy">📈</div><div><div class="ik-label">Realisasi ${last||''}</div><div class="ik-value">${totalLast.toFixed(2)} <small>GWh</small></div></div></div>
    <div class="icon-kpi"><div class="circle teal">📅</div><div><div class="ik-label">${prev||'Bulan lalu'}</div><div class="ik-value">${totalPrev.toFixed(2)} <small>GWh</small></div></div></div>
    <div class="icon-kpi"><div class="circle ${growth>=0?'green':'amber'}">${growth>=0?'⬆':'⬇'}</div><div><div class="ik-label">Growth</div><div class="ik-value">${growth>=0?'+':''}${growth.toFixed(1)}% <small>(${growthAbs>=0?'+':''}${growthAbs.toFixed(2)} GWh)</small></div></div></div>
    <div class="icon-kpi"><div class="circle amber">⏱</div><div><div class="ik-label">Rata-rata harian</div><div class="ik-value">${avgHarian.toFixed(2)} <small>GWh/hari</small></div></div></div>
    <div class="icon-kpi"><div class="circle purple">👥</div><div><div class="ik-label">Komposisi prabayar</div><div class="ik-value">${komposisi.toFixed(2)}<small>%</small></div></div></div>`;

  const perUlp = [...new Set(praData.map(d=>d.ulp))].map(u=>{
    const vPrev = praData.find(d=>d.ulp===u && d.periode===prev)?.gwh || 0;
    const vLast = praData.find(d=>d.ulp===u && d.periode===last)?.gwh || 0;
    return {ulp:u, diff:vLast-vPrev};
  });
  const top3 = [...perUlp].sort((a,b)=>b.diff-a.diff).slice(0,3);
  document.getElementById('pra_podium').innerHTML = top3.map((d,i)=>`
    <div class="podium-item"><div class="podium-rank r${i+1}">${i+1}</div><div class="podium-name">ULP ${d.ulp}</div><div class="podium-val">${d.diff>=0?'+':''}${d.diff.toFixed(2)} GWh</div></div>`).join('');

  document.getElementById('pra_pattern').innerHTML = `
    <div style="font-size:12.5px;line-height:1.7;">
      <div>Realisasi s.d tanggal 20 &mdash; <b>${(totalLast*pctAwal/100).toFixed(2)} GWh (${pctAwal}%)</b> dari total bulan ini</div>
      <div>Realisasi tgl 21&ndash;akhir bulan &mdash; <b>${(totalLast*(100-pctAwal)/100).toFixed(2)} GWh (${(100-pctAwal).toFixed(0)}%)</b></div>
      <div style="margin-top:8px;padding:10px;background:var(--blue-bg);border-radius:8px;">Indikasi: pelanggan cenderung membeli token lebih banyak di akhir bulan sebagai antisipasi kebutuhan listrik.</div>
    </div>`;

  document.getElementById('pra_table').innerHTML = periods.map((p,i)=>{
    const g = i>0 && totals[i-1] ? ((totals[i]-totals[i-1])/totals[i-1]*100) : null;
    return `<tr><td>${p}</td><td>${totals[i].toFixed(2)}</td><td>${g==null?'-':`<span class="pill ${g>=0?'good':'bad'}">${g>=0?'+':''}${g.toFixed(1)}%</span>`}</td></tr>`;
  }).join('');

  destroyChart('pra_chart');
  charts['pra_chart'] = new Chart(document.getElementById('pra_chart'), {
    type:'bar', data:{ labels:periods, datasets:[{label:'GWh', data:totals, backgroundColor:periods.map((p,i)=>i===periods.length-1?'#0d2a4a':'#7fc4c4'), borderRadius:5, maxBarThickness:70}] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
  });

  document.getElementById('pra_insight').innerHTML = `
    <div class="ki-point">Penjualan kWh Prabayar ${last||''} <b>${growth>=0?'meningkat':'menurun'} ${Math.abs(growth).toFixed(1)}%</b> dibanding ${prev||'bulan sebelumnya'}, atau ${growth>=0?'naik':'turun'} sebesar ${Math.abs(growthAbs).toFixed(2)} GWh.</div>
    <div class="ki-point">Kontributor pertumbuhan terbesar berasal dari ULP <b>${top3.map(d=>d.ulp).join(', ')}</b>.</div>
    <div class="ki-point">Pelanggan cenderung membeli token dalam jumlah lebih besar pada akhir bulan (tgl 20 ke atas) sebagai antisipasi.</div>
    <div class="ki-point">Komposisi pelanggan prabayar saat ini <b>${komposisi.toFixed(2)}%</b> dari total pelanggan.</div>`;

  showDash('pra');
}
async function praLoad(){
  const url = document.getElementById('pra_url').value.trim();
  if(!url){ setStatus('pra_status', false, 'Masukkan link CSV terlebih dahulu.'); return; }
  setStatus('pra_status', true, 'Memuat data...');
  try{ praRender(await fetchCSV(url)); } catch(e){ setStatus('pra_status', false, 'Gagal memuat: ' + e.message); }
}
function praSample(){
  praRender([
    {ULP:'NGAWI', Periode:'APR-26', GWh_Prabayar:'13.10'},
    {ULP:'NGAWI', Periode:'MEI-26', GWh_Prabayar:'15.37'},
    {ULP:'CARUBAN', Periode:'APR-26', GWh_Prabayar:'10.20'},
    {ULP:'CARUBAN', Periode:'MEI-26', GWh_Prabayar:'11.42'},
    {ULP:'MADIUN KOTA', Periode:'APR-26', GWh_Prabayar:'9.80'},
    {ULP:'MADIUN KOTA', Periode:'MEI-26', GWh_Prabayar:'10.90'},
    {ULP:'MAGETAN', Periode:'APR-26', GWh_Prabayar:'8.50'},
    {ULP:'MAGETAN', Periode:'MEI-26', GWh_Prabayar:'9.30'},
    {ULP:'MAOSPATI', Periode:'APR-26', GWh_Prabayar:'7.30'},
    {ULP:'MAOSPATI', Periode:'MEI-26', GWh_Prabayar:'8.10'},
    {ULP:'DOLOPO', Periode:'APR-26', GWh_Prabayar:'6.67'},
    {ULP:'DOLOPO', Periode:'MEI-26', GWh_Prabayar:'8.74'},
  ]);
}

