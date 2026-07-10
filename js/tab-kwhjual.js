/* ================= TAB 2: KWH JUAL ================= */
function kwhRender(rows){
  const ulpKey = findKey(rows[0], ['ulp']);
  const kodeKey = findKey(rows[0], ['kode','proses']);
  const uKey = findKey(rows[0], ['unit']);
  const pKey = findKey(rows[0], ['periode','bulan']);
  const vKey = findKey(rows[0], ['kwh','jual','nilai']);
  if((!ulpKey && !uKey)||!pKey||!vKey){ setStatus('kwh_status', false, 'Kolom ULP/Kode/Periode/KWh tidak ditemukan.'); return; }
  const data = rows.map(r=>({
    ulp: ulpKey ? String(r[ulpKey]||'').trim() : '',
    kode: kodeKey ? String(r[kodeKey]||'').trim() : String(r[uKey]||'').trim(),
    periode: r[pKey], kwh: num(r[vKey])
  })).filter(d=>d.kode && d.periode);
  const hasUlp = ulpKey && data.some(d=>d.ulp);

  const periodsAll = [...new Set(data.map(d=>d.periode))].sort();
  const periods = periodsAll.filter(p => data.filter(d=>d.periode===p).reduce((s,d)=>s+d.kwh,0) > 0);
  if(!periods.length){ setStatus('kwh_status', false, 'Belum ada periode dengan data KWh_Jual terisi.'); return; }
  const last = periods[periods.length-1], prev = periods[periods.length-2];
  const totals = periods.map(p=>data.filter(d=>d.periode===p).reduce((s,d)=>s+d.kwh,0));
  const totalLast = totals[totals.length-1] || 0;
  const totalPrev = totals[totals.length-2] || 0;
  const growthAbs = totalLast-totalPrev;
  const growth = totalPrev ? (growthAbs/totalPrev*100) : 0;
  const ulps = hasUlp ? [...new Set(data.map(d=>d.ulp))] : [];
  const kodeUnits = [...new Set(data.map(d=>d.kode + (hasUlp?'|'+d.ulp:'')))];
  const avgHarian = totalLast/30;

  document.getElementById('kwh_title').textContent = `EVALUASI KWH JUAL UP3 MADIUN — ${last||''}`;
  document.getElementById('kwh_sub').textContent = `Penjualan ${growth>=0?'meningkat':'menurun'} ${Math.abs(growth).toFixed(1)}% dibanding ${prev||'bulan sebelumnya'}`;

  document.getElementById('kwh_kpi').innerHTML = `
    <div class="icon-kpi"><div class="circle navy">📈</div><div><div class="ik-label">Realisasi ${last||''}</div><div class="ik-value">${(totalLast/1e6).toFixed(2)} <small>GWh</small></div></div></div>
    <div class="icon-kpi"><div class="circle teal">📅</div><div><div class="ik-label">${prev||'Bulan lalu'}</div><div class="ik-value">${(totalPrev/1e6).toFixed(2)} <small>GWh</small></div></div></div>
    <div class="icon-kpi"><div class="circle ${growth>=0?'green':'amber'}">${growth>=0?'⬆':'⬇'}</div><div><div class="ik-label">Growth</div><div class="ik-value">${growth>=0?'+':''}${growth.toFixed(1)}% <small>(${growthAbs>=0?'+':''}${(growthAbs/1e6).toFixed(2)} GWh)</small></div></div></div>
    <div class="icon-kpi"><div class="circle amber">⏱</div><div><div class="ik-label">Rata-rata harian</div><div class="ik-value">${(avgHarian/1e6).toFixed(2)} <small>GWh/hari</small></div></div></div>
    <div class="icon-kpi"><div class="circle purple">🏢</div><div><div class="ik-label">${hasUlp?'Jumlah ULP':'Jumlah kode proses'}</div><div class="ik-value">${(hasUlp?ulps.length:kodeUnits.length)} <small>${hasUlp?'ULP':'kode'}</small></div></div></div>`;

  document.getElementById('kwh_th_prev').textContent = prev || 'Bln -1';
  document.getElementById('kwh_th_last').textContent = last || 'Bln terakhir';

  const perItem = kodeUnits.map(key=>{
    const [kode, ulp] = hasUlp ? key.split('|') : [key, ''];
    const rowsK = data.filter(d=>d.kode===kode && (!hasUlp || d.ulp===ulp));
    const vPrev = rowsK.find(d=>d.periode===prev)?.kwh || 0;
    const vLast = rowsK.find(d=>d.periode===last)?.kwh || 0;
    return {ulp, kode, vPrev, vLast, diff: vLast-vPrev};
  });

  const sorted = hasUlp ? [...perItem].sort((a,b)=> a.ulp.localeCompare(b.ulp) || a.kode.localeCompare(b.kode)) : perItem;
  let lastUlpSeen = null;
  document.getElementById('kwh_table').innerHTML = sorted.map(d=>{
    const g = d.vPrev ? (d.diff/d.vPrev*100) : 0;
    const showUlp = hasUlp && d.ulp !== lastUlpSeen;
    lastUlpSeen = d.ulp;
    return `<tr><td style="font-weight:${showUlp?800:400};color:${showUlp?'var(--navy)':'var(--muted)'};">${showUlp?d.ulp:''}</td><td>${d.kode}</td><td>${d.vPrev.toLocaleString('id-ID')}</td><td>${d.vLast.toLocaleString('id-ID')}</td><td><span class="pill ${g>=0?'good':'bad'}">${g>=0?'+':''}${g.toFixed(2)}%</span></td></tr>`;
  }).join('');

  const contribGroup = hasUlp
    ? ulps.map(u=>{
        const rowsU = data.filter(d=>d.ulp===u);
        const vP = rowsU.filter(d=>d.periode===prev).reduce((s,d)=>s+d.kwh,0);
        const vL = rowsU.filter(d=>d.periode===last).reduce((s,d)=>s+d.kwh,0);
        return {label:u, diff:vL-vP};
      })
    : perItem.map(d=>({label:d.kode, diff:d.diff}));
  const top3 = [...contribGroup].sort((a,b)=>b.diff-a.diff).slice(0,3);
  document.getElementById('kwh_podium').innerHTML = top3.map((d,i)=>`
    <div class="podium-item"><div class="podium-rank r${i+1}">${i+1}</div><div class="podium-name">${d.label}</div><div class="podium-val">${d.diff>=0?'+':''}${(d.diff/1e6).toFixed(2)} GWh</div></div>`).join('');

  destroyChart('kwh_chart');
  charts['kwh_chart'] = new Chart(document.getElementById('kwh_chart'), {
    type:'bar', data:{ labels:periods, datasets:[{label:'Total kWh jual (GWh)', data:totals.map(v=>v/1e6), backgroundColor:periods.map((p,i)=>i===periods.length-1?'#0d2a4a':'#9fc4e8'), borderRadius:5, maxBarThickness:60}] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
  });

  document.getElementById('kwh_insight').innerHTML = `
    <div class="ki-point"><b>Tren ${growth>=0?'positif':'negatif'}:</b> Energi siap jual ${growth>=0?'mencapai':'turun ke'} ${(totalLast/1e6).toFixed(2)} GWh, ${growth>=0?'meningkat':'menurun'} ${Math.abs(growth).toFixed(1)}% dibanding ${prev||'bulan sebelumnya'}.</div>
    <div class="ki-point"><b>Kontributor utama:</b> ${top3.map(d=>d.label).join(', ')} menjadi kontributor pertumbuhan terbesar bulan ini.</div>
    <div class="ki-point"><b>Cakupan data:</b> ${hasUlp?`${ulps.length} ULP dengan total ${kodeUnits.length} baris kode proses billing`:`${kodeUnits.length} kode proses billing`} tercatat pada periode ${last||''}.</div>
    <div class="ki-point"><b>Tindak lanjut:</b> Evaluasi lebih lanjut pada ULP/kode proses yang mengalami penurunan untuk penguatan kualitas billing.</div>`;

  showDash('kwh');
  setStatus('kwh_status', true, 'Data berhasil dimuat (' + (hasUlp?ulps.length+' ULP, ':'') + kodeUnits.length + ' kode proses).');
}
async function kwhLoad(){
  const url = document.getElementById('kwh_url').value.trim();
  if(!url){ setStatus('kwh_status', false, 'Masukkan link CSV terlebih dahulu.'); return; }
  setStatus('kwh_status', true, 'Memuat data...');
  try{ kwhRender(await fetchCSV(url)); } catch(e){ setStatus('kwh_status', false, 'Gagal memuat: ' + e.message); }
}
function kwhSample(){
  kwhRender([
    {ULP:'MADIUN KOTA', Kode:'51MDNAI-TM', Periode:'2026-04', KWh_Jual:'5366934'},
    {ULP:'MADIUN KOTA', Kode:'51MDNAI-TM', Periode:'2026-05', KWh_Jual:'5591527'},
    {ULP:'MADIUN KOTA', Kode:'51MDNAR', Periode:'2026-04', KWh_Jual:'2894845'},
    {ULP:'MADIUN KOTA', Kode:'51MDNAR', Periode:'2026-05', KWh_Jual:'3035297'},
    {ULP:'MADIUN KOTA', Kode:'51MDNBA', Periode:'2026-04', KWh_Jual:'4691024'},
    {ULP:'MADIUN KOTA', Kode:'51MDNBA', Periode:'2026-05', KWh_Jual:'4973431'},
    {ULP:'MAGETAN', Kode:'51MDNAR', Periode:'2026-04', KWh_Jual:'1271288'},
    {ULP:'MAGETAN', Kode:'51MDNAR', Periode:'2026-05', KWh_Jual:'1334962'},
    {ULP:'MAGETAN', Kode:'51MDNBA', Periode:'2026-04', KWh_Jual:'5276267'},
    {ULP:'MAGETAN', Kode:'51MDNBA', Periode:'2026-05', KWh_Jual:'5501676'},
  ]);
}

/* ---- komponen kWh jual: PAL prognosa, realisasi P2TL, prabayar ---- */
function compRender(rows){
  const pKey = findKey(rows[0], ['periode','bulan']);
  const palKey = findKey(rows[0], ['pal']);
  const p2tlKey = findKey(rows[0], ['p2tl']);
  const praKey = findKey(rows[0], ['prabayar']);
  if(!pKey||!palKey||!p2tlKey||!praKey){ setStatus('comp_status', false, 'Kolom Periode/PAL_Prognosa/Realisasi_P2TL/Prabayar tidak ditemukan.'); return; }
  const data = rows.map(r=>({periode:r[pKey], pal:num(r[palKey]), p2tl:num(r[p2tlKey]), prabayar:num(r[praKey])})).filter(d=>d.periode);
  const filled = data.filter(d => (d.pal + d.p2tl + d.prabayar) > 0);
  if(!filled.length){ setStatus('comp_status', false, 'Belum ada periode dengan data komponen terisi.'); return; }
  const last = filled[filled.length-1];
  const total = last.pal + last.p2tl + last.prabayar;
  // Label "(Prognosa)" hanya relevan untuk bulan yang SEDANG berjalan (belum selesai).
  // Untuk bulan yang sudah lewat, datanya sudah final/realisasi — jadi label ini dihapus
  // supaya tidak menyesatkan (mis. "PAL (Prognosa) 2026-06" padahal sekarang sudah Juli).
  const now = new Date();
  const currentYYYYMM = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  const isRunningMonth = last.periode === currentYYYYMM;
  const palLabel = isRunningMonth ? 'PAL (Prognosa)' : 'PAL';
  document.getElementById('comp_kpi').innerHTML = `
    <div class="icon-kpi"><div class="circle navy">🏗</div><div><div class="ik-label">${palLabel} ${last.periode}</div><div class="ik-value">${(last.pal/1e6).toFixed(2)} <small>GWh</small></div></div></div>
    <div class="icon-kpi"><div class="circle red">🔍</div><div><div class="ik-label">Realisasi P2TL ${last.periode}</div><div class="ik-value">${(last.p2tl/1e6).toFixed(2)} <small>GWh</small></div></div></div>
    <div class="icon-kpi"><div class="circle purple">💳</div><div><div class="ik-label">Prabayar ${last.periode}</div><div class="ik-value">${(last.prabayar/1e6).toFixed(2)} <small>GWh</small></div></div></div>
    <div class="icon-kpi"><div class="circle green">Σ</div><div><div class="ik-label">Total komponen</div><div class="ik-value">${(total/1e6).toFixed(2)} <small>GWh</small></div></div></div>`;
  destroyChart('comp_chart');
  charts['comp_chart'] = new Chart(document.getElementById('comp_chart'), {
    type:'bar', data:{ labels:data.map(d=>d.periode), datasets:[
      {label:'PAL', data:data.map(d=>d.pal/1e6), backgroundColor:'#0d2a4a', stack:'s', borderRadius:3},
      {label:'Realisasi P2TL', data:data.map(d=>d.p2tl/1e6), backgroundColor:'#d23b3b', stack:'s', borderRadius:3},
      {label:'Prabayar', data:data.map(d=>d.prabayar/1e6), backgroundColor:'#7a4ec9', stack:'s', borderRadius:3}]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:11}}}}, scales:{x:{stacked:true}, y:{stacked:true, title:{display:true,text:'GWh'}}} }
  });
  document.getElementById('comp_dash').style.display='block';
  document.getElementById('comp_empty').style.display='none';
  setStatus('comp_status', true, 'Data komponen berhasil dimuat.');
}
async function compLoad(){
  const url = document.getElementById('comp_url').value.trim();
  if(!url){ setStatus('comp_status', false, 'Masukkan link CSV terlebih dahulu.'); return; }
  setStatus('comp_status', true, 'Memuat data...');
  try{ compRender(await fetchCSV(url)); } catch(e){ setStatus('comp_status', false, 'Gagal memuat: ' + e.message); }
}
function compSample(){
  compRender([
    {Periode:'2026-03', PAL_Prognosa:'22020862', Realisasi_P2TL:'1428322', Prabayar:'55570000'},
    {Periode:'2026-04', PAL_Prognosa:'22829039', Realisasi_P2TL:'2201881', Prabayar:'55570000'},
    {Periode:'2026-05', PAL_Prognosa:'21833204', Realisasi_P2TL:'3387225', Prabayar:'63830000'},
  ]);
}

