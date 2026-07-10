/* ================= TAB 6: PROGNOSA SUSUT ================= */
function progRender(rows){
  const pKey = findKey(rows[0], ['periode','bulan']);
  const prodKey = findKey(rows[0], ['produksi']);
  const jualKey = findKey(rows[0], ['jual']);
  const susutKey = findKey(rows[0], ['susut']);
  const statusKey = findKey(rows[0], ['status']);
  if(!pKey||!prodKey||!jualKey||!susutKey){ setStatus('prog_status', false, 'Kolom Periode/Produksi/Jual/Susut tidak ditemukan.'); return; }
  const data = rows.map(r=>({periode:r[pKey], produksi:num(r[prodKey]), jual:num(r[jualKey]), susut:num(r[susutKey]), status: statusKey?r[statusKey]:'Realisasi'})).filter(d=>d.periode);
  const last = data[data.length-1];
  const prev = data[data.length-2];
  const prognosaRows = data.filter(d=>(d.status||'').toLowerCase().includes('prog'));
  const isProg = (d)=>(d.status||'').toLowerCase().includes('prog');
  const susutDiff = prev ? (last.susut-prev.susut) : 0;

  document.getElementById('prog_period').textContent = `${last.periode.toUpperCase()} — STATUS ${(last.status||'').toUpperCase()}`;

  document.getElementById('prog_kpi').innerHTML = `
    <div class="icon-kpi"><div class="circle navy">⚡</div><div><div class="ik-label">KWh produksi (${last.periode})</div><div class="ik-value">${(last.produksi/1e6).toFixed(2)} <small>GWh</small></div></div></div>
    <div class="icon-kpi"><div class="circle teal">🛒</div><div><div class="ik-label">KWh jual (${last.periode})</div><div class="ik-value">${(last.jual/1e6).toFixed(2)} <small>GWh</small></div></div></div>
    <div class="icon-kpi"><div class="circle ${last.susut<=8?'green':'amber'}">📉</div><div><div class="ik-label">Susut (${last.periode})</div><div class="ik-value">${last.susut.toFixed(2)}<small>%</small></div></div></div>
    <div class="icon-kpi"><div class="circle ${susutDiff<=0?'green':'amber'}">${susutDiff<=0?'⬇':'⬆'}</div><div><div class="ik-label">Perubahan susut vs bln lalu</div><div class="ik-value">${susutDiff>=0?'+':''}${susutDiff.toFixed(2)} <small>poin</small></div></div></div>
    <div class="icon-kpi"><div class="circle purple">📋</div><div><div class="ik-label">Bulan berstatus prognosa</div><div class="ik-value">${prognosaRows.length} <small>bulan</small></div></div></div>`;

  document.getElementById('prog_table').innerHTML = data.map(d=>{
    const kwhSusut = d.produksi - d.jual;
    return `<tr><td>${d.periode}</td><td><span class="pill ${isProg(d)?'bad':'good'}">${d.status}</span></td><td>${d.produksi.toLocaleString('id-ID')}</td><td>${d.jual.toLocaleString('id-ID')}</td><td>${kwhSusut.toLocaleString('id-ID')}</td><td>${d.susut.toFixed(2)}%</td></tr>`;
  }).join('');

  destroyChart('prog_chart1');
  charts['prog_chart1'] = new Chart(document.getElementById('prog_chart1'), {
    type:'bar', data:{ labels:data.map(d=>d.periode), datasets:[
      {label:'KWh produksi', data:data.map(d=>d.produksi/1e6), backgroundColor:data.map(d=>isProg(d)?'#9fc4e8':'#1f6fc6'), borderRadius:5, maxBarThickness:26},
      {label:'KWh jual', data:data.map(d=>d.jual/1e6), backgroundColor:data.map(d=>isProg(d)?'#a8d8bb':'#1c8a4a'), borderRadius:5, maxBarThickness:26}]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:11}}}}, scales:{y:{title:{display:true,text:'GWh'}}} }
  });

  destroyChart('prog_chart2');
  charts['prog_chart2'] = new Chart(document.getElementById('prog_chart2'), {
    type:'line', data:{ labels:data.map(d=>d.periode), datasets:[
      {label:'Susut %', data:data.map(d=>d.susut),
        segment:{ borderColor: ctx => isProg(data[ctx.p1DataIndex]) ? '#d23b3b' : '#1c8a4a', borderDash: ctx => isProg(data[ctx.p1DataIndex]) ? [6,4] : [] },
        pointBackgroundColor: data.map(d=>isProg(d)?'#d23b3b':'#1c8a4a'),
        borderColor:'#1c8a4a', pointRadius:5, tension:0.25 }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:v=>v+'%'}}} }
  });
  document.getElementById('prog_trend_caption').innerHTML = `Garis hijau = realisasi (sudah fix), garis putus-putus merah = prognosa (bulan berjalan, masih dapat berubah). Susut ${last.periode}: <b>${last.susut.toFixed(2)}%</b>${prev?` (${susutDiff<=0?'membaik':'memburuk'} ${Math.abs(susutDiff).toFixed(2)} poin dari ${prev.periode})`:''}.`;

  document.getElementById('prog_insight').innerHTML = `
    <div class="ki-point"><b>Status terkini:</b> ${last.periode} berstatus <b>${last.status}</b> dengan susut ${last.susut.toFixed(2)}%, KWh produksi ${(last.produksi/1e6).toFixed(2)} GWh dan KWh jual ${(last.jual/1e6).toFixed(2)} GWh.</div>
    <div class="ki-point"><b>Arah tren:</b> Susut ${susutDiff<=0?'membaik (menurun)':'memburuk (meningkat)'} ${Math.abs(susutDiff).toFixed(2)} poin dibanding bulan sebelumnya.</div>
    <div class="ki-point"><b>Status prognosa:</b> ${prognosaRows.length} bulan masih berstatus prognosa dan berpotensi berubah saat data final masuk.</div>
    <div class="ki-point"><b>Fokus tindak lanjut:</b> Pantau gap antara kWh produksi dan kWh jual untuk deteksi dini potensi kenaikan susut.</div>`;

  showDash('prog');
  setStatus('prog_status', true, 'Data berhasil dimuat (garis putus-putus merah = bulan prognosa).');
}
async function progLoad(){
  const url = document.getElementById('prog_url').value.trim();
  if(!url){ setStatus('prog_status', false, 'Masukkan link CSV terlebih dahulu.'); return; }
  setStatus('prog_status', true, 'Memuat data...');
  try{ progRender(await fetchCSV(url)); } catch(e){ setStatus('prog_status', false, 'Gagal memuat: ' + e.message); }
}
function progSample(){
  progRender([
    {Periode:'2026-01', KWh_Produksi:'145200000', KWh_Jual:'135800000', Susut_Persen:'6.47', Status:'Realisasi'},
    {Periode:'2026-02', KWh_Produksi:'148629313', KWh_Jual:'138135640', Susut_Persen:'7.07', Status:'Realisasi'},
    {Periode:'2026-03', KWh_Produksi:'150810000', KWh_Jual:'140400000', Susut_Persen:'6.91', Status:'Realisasi'},
    {Periode:'2026-04', KWh_Produksi:'151200000', KWh_Jual:'141500000', Susut_Persen:'8.36', Status:'Realisasi'},
    {Periode:'2026-05', KWh_Produksi:'165662901', KWh_Jual:'152365655', Susut_Persen:'7.48', Status:'Prognosa'},
  ]);
}

