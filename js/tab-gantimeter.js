/* ================= TAB 5: GANTI METER & AMRISASI ================= */
// CATATAN: fungsi indoMonthIndex(), INDO_BULAN_FULL/ABBR sudah dideklarasikan global
// di tab-p2tl.js (di-load sebelum file ini) — dipakai ulang di sini, tidak didefinisikan lagi.
let gmData = [];

function gmRender(rows){
  const bKey = findKey(rows[0], ['bulan']);
  const tKey = findKey(rows[0], ['target']);
  const rKey = findKey(rows[0], ['realisasi']);
  if(!bKey||!tKey||!rKey){ setStatus('gm_status', false, 'Kolom Bulan/Target_Kumulatif/Realisasi_Kumulatif tidak ditemukan.'); return; }
  gmData = rows.map(r=>({
    bulan:String(r[bKey]||'').trim(),
    target:num(r[tKey]), realisasi:num(r[rKey]),
    filled: num(r[rKey])>0
  })).filter(d=>d.bulan);
  gmRecalc();
  setStatus('gm_status', true, 'Data berhasil dimuat (' + gmData.length + ' bulan).');
}

function gmMaterialRow(id, defaultName, defaultSisa, defaultStatus){
  const nameEl = document.getElementById('gm_mat_'+id+'_nama');
  const sisaEl = document.getElementById('gm_mat_'+id+'_sisa');
  const statusEl = document.getElementById('gm_mat_'+id+'_status');
  return {
    nama: nameEl ? nameEl.value : defaultName,
    sisa: sisaEl ? num(sisaEl.value) : defaultSisa,
    status: statusEl ? statusEl.value : defaultStatus
  };
}
const GM_STATUS_STYLE = {
  'Aman':            {cls:'good', label:'Masih aman'},
  'Perlu Antisipasi':{cls:'bad',  label:'Perlu antisipasi'},
  'Kritis':          {cls:'bad',  label:'Kritis'},
  'Stok Habis':      {cls:'bad',  label:'Stok habis'}
};

function gmRecalc(){
  if(!gmData.length) return;
  const filled = gmData.filter(d=>d.filled);
  if(!filled.length) return;

  // ---- bulan terakhir = bulan kalender SAAT INI kalau ada datanya, kalau tidak fallback
  // ke baris terisi paling akhir (pola sama seperti tab P2TL & Susut) ----
  const currentMonthIdx = new Date().getMonth();
  let last = gmData.find(d => indoMonthIndex(d.bulan) === currentMonthIdx && d.filled);
  if(!last) last = filled[filled.length-1];

  // Target Tahun 2026 = target kumulatif di baris Desember (kalau ada), fallback ke target terbesar
  const desRow = gmData.find(d => indoMonthIndex(d.bulan) === 11);
  const targetTahun = desRow ? desRow.target : Math.max(...gmData.map(d=>d.target));

  const targetSD = last.target;
  const realSD = last.realisasi;
  const capaianSD = targetSD ? (realSD/targetSD*100) : 0;
  const sisaTarget = targetTahun - realSD;
  const sisaTargetPct = targetTahun ? (sisaTarget/targetTahun*100) : 0;

  // ---- Input manual: Amrisasi ----
  const amrTarget = num(document.getElementById('gm_amr_target').value);
  const amrReal = num(document.getElementById('gm_amr_real').value);
  const amrCapaian = amrTarget ? (amrReal/amrTarget*100) : 0;
  const amrSisa = amrTarget - amrReal;

  // ---- Input manual: stok material amrisasi ----
  const stokModem = num(document.getElementById('gm_stok_modem').value);
  const stokSimcard = num(document.getElementById('gm_stok_simcard').value);
  const kebutuhanBulanan = num(document.getElementById('gm_kebutuhan_bulanan').value);
  const stokKurang = stokModem < kebutuhanBulanan;

  // ---- Input manual: 5 baris sisa material ganti meter ----
  const materials = [
    gmMaterialRow(1, 'Paska 3P 5(10)', 10, 'Perlu Antisipasi'),
    gmMaterialRow(2, 'Paska 3P 5(80)', 23, 'Perlu Antisipasi'),
    gmMaterialRow(3, 'LPB 3P 5(80)', 0, 'Stok Habis'),
    gmMaterialRow(4, 'LPB 1P', 1250, 'Aman'),
    gmMaterialRow(5, 'PASKA 1P', 4000, 'Aman'),
  ];
  const materialBermasalah = materials.filter(m=>m.status!=='Aman');

  const periodeLabel = `PERIODE ${gmData[0].bulan.toUpperCase()} &ndash; ${last.bulan.toUpperCase()} 2026`;
  document.getElementById('gm_period').innerHTML = periodeLabel;

  // ---- Sidebar ringkasan utama ----
  document.getElementById('gm_side').innerHTML = `
    <div class="exec-side-item"><div class="lbl">Target ganti meter tahun 2026</div><div class="val">${targetTahun.toLocaleString('id-ID')} unit</div></div>
    <div class="exec-side-item"><div class="lbl">Realisasi s.d ${last.bulan}</div><div class="val">${realSD.toLocaleString('id-ID')} unit</div></div>
    <div class="exec-side-item"><div class="lbl">Persentase capaian</div><div class="val">${capaianSD.toFixed(2)}%</div></div>
    <div class="exec-side-item"><div class="lbl">Sisa target s.d Desember</div><div class="val">${sisaTarget.toLocaleString('id-ID')} unit</div></div>
    <div class="exec-side-item"><div class="lbl">Target amrisasi tahun 2026</div><div class="val">${amrTarget.toLocaleString('id-ID')} unit</div></div>
    <div class="exec-side-item"><div class="lbl">Realisasi amrisasi s.d ${last.bulan}</div><div class="val">${amrReal.toLocaleString('id-ID')} unit</div></div>
    <div class="exec-side-item"><div class="lbl">Persentase capaian amrisasi</div><div class="val">${amrCapaian.toFixed(2)}%</div></div>
    <div class="exec-side-item"><div class="lbl">Sisa target amrisasi</div><div class="val">${amrSisa.toLocaleString('id-ID')} unit</div></div>`;

  // ---- KPI row atas ----
  document.getElementById('gm_kpi').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Target ganti meter tahun 2026</div><div class="kpi-value">${targetTahun.toLocaleString('id-ID')}</div><div class="kpi-sub">Unit</div></div>
    <div class="kpi-card ${capaianSD>=100?'green':'amber'}"><div class="kpi-label">Realisasi s.d ${last.bulan}</div><div class="kpi-value">${realSD.toLocaleString('id-ID')}</div><div class="kpi-sub">${capaianSD.toFixed(2)}% dari target s.d ${last.bulan}</div></div>
    <div class="kpi-card"><div class="kpi-label">Target s.d ${last.bulan}</div><div class="kpi-value">${targetSD.toLocaleString('id-ID')}</div><div class="kpi-sub">Unit</div></div>
    <div class="kpi-card green"><div class="kpi-label">Realisasi kumulatif</div><div class="kpi-value">${realSD.toLocaleString('id-ID')}</div><div class="kpi-sub">${capaianSD.toFixed(2)}% dari target tahun 2026</div></div>
    <div class="kpi-card purple"><div class="kpi-label">Sisa target s.d Desember 2026</div><div class="kpi-value">${sisaTarget.toLocaleString('id-ID')}</div><div class="kpi-sub">${Math.abs(sisaTargetPct).toFixed(2)}% dari target tahunan</div></div>
    <div class="kpi-card ${amrCapaian>=100?'green':'amber'}"><div class="kpi-label">Target amrisasi 2026</div><div class="kpi-value">${amrTarget.toLocaleString('id-ID')}</div><div class="kpi-sub">Realisasi ${amrReal.toLocaleString('id-ID')} unit &middot; capaian ${amrCapaian.toFixed(2)}%</div></div>`;

  // ---- Bar chart: Realisasi s.d bulan vs Target s.d bulan vs Target tahun ----
  destroyChart('gm_chart_bar');
  charts['gm_chart_bar'] = new Chart(document.getElementById('gm_chart_bar'), {
    type:'bar',
    data:{ labels:[`Realisasi s.d ${last.bulan}`, `Target s.d ${last.bulan}`, 'Target tahun 2026'],
      datasets:[{ data:[realSD, targetSD, targetTahun], backgroundColor:['#e0a100','#0d2a4a','#1c8a4a'], borderRadius:6, maxBarThickness:70 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} }
  });

  // ---- Tabel perbandingan kinerja ----
  document.getElementById('gm_compare_table').innerHTML = `
    <table>
      <thead><tr><th>Uraian</th><th>s.d ${last.bulan}</th><th>Target s.d ${last.bulan}</th><th>% Capaian</th><th>Target 2026</th><th>% vs Tahun</th></tr></thead>
      <tbody>
        <tr><td>Realisasi (Unit)</td><td>${realSD.toLocaleString('id-ID')}</td><td>${targetSD.toLocaleString('id-ID')}</td>
          <td><span class="pill ${capaianSD>=100?'good':'bad'}">${capaianSD.toFixed(2)}%</span></td>
          <td>${targetTahun.toLocaleString('id-ID')}</td>
          <td><span class="pill ${(realSD/targetTahun*100)>=50?'good':'bad'}">${(targetTahun?realSD/targetTahun*100:0).toFixed(2)}%</span></td></tr>
      </tbody>
    </table>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
      <div class="exec-foot-card ${capaianSD>=100?'green':'red'}" style="font-size:12px;">${capaianSD>=100?'✓':'⚠'} Realisasi s.d ${last.bulan} sebesar ${realSD.toLocaleString('id-ID')} unit, ${capaianSD>=100?`melebihi target s.d ${last.bulan} sebesar ${(realSD-targetSD).toLocaleString('id-ID')} unit`:`masih di bawah target s.d ${last.bulan} sebesar ${(targetSD-realSD).toLocaleString('id-ID')} unit`} (${capaianSD.toFixed(2)}%).</div>
      <div class="exec-foot-card blue" style="font-size:12px;">ℹ Masih terdapat sisa target <b>${sisaTarget.toLocaleString('id-ID')} unit</b> yang perlu diselesaikan pada periode setelah ${last.bulan}&ndash;Desember 2026.</div>
    </div>`;

  // ---- Line chart: realisasi kumulatif per bulan (Jan-Des) ----
  const bulanOrder = gmData.slice().sort((a,b)=>indoMonthIndex(a.bulan)-indoMonthIndex(b.bulan));
  destroyChart('gm_chart_line');
  charts['gm_chart_line'] = new Chart(document.getElementById('gm_chart_line'), {
    type:'line',
    data:{ labels:bulanOrder.map(d=>d.bulan), datasets:[
      {label:'Target kumulatif', data:bulanOrder.map(d=>d.target), borderColor:'#1f6fc6', backgroundColor:'#1f6fc6', tension:0.25, pointRadius:4},
      {label:'Realisasi kumulatif', data:bulanOrder.map(d=>d.filled?d.realisasi:null), borderColor:'#1c8a4a', backgroundColor:'#1c8a4a', tension:0.25, pointRadius:4}
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:11}}}} }
  });
  document.getElementById('gm_line_caption').innerHTML = `Realisasi s.d <b>${last.bulan} 2026</b> sebesar <b>${realSD.toLocaleString('id-ID')} unit (${capaianSD.toFixed(2)}%)</b> dari target s.d bulan tersebut.`;

  // ---- Donut Amrisasi ----
  destroyChart('gm_amr_donut');
  charts['gm_amr_donut'] = new Chart(document.getElementById('gm_amr_donut'), {
    type:'doughnut',
    data:{ labels:['Realisasi','Sisa target'], datasets:[{ data:[amrReal, Math.max(amrSisa,0)], backgroundColor:['#1f6fc6','#e4e8ed'], borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'68%', plugins:{ legend:{position:'bottom', labels:{boxWidth:10, font:{size:11}}} } }
  });
  document.getElementById('gm_amr_donut_caption').innerHTML = `Capaian amrisasi <b>${amrCapaian.toFixed(2)}%</b> — target ${amrTarget.toLocaleString('id-ID')} unit, realisasi ${amrReal.toLocaleString('id-ID')} unit, sisa ${Math.max(amrSisa,0).toLocaleString('id-ID')} unit.`;

  // ---- Material utama amrisasi ----
  document.getElementById('gm_material').innerHTML = `
    <div class="icon-kpi-row" style="margin-bottom:10px;">
      <div class="icon-kpi"><div class="circle navy">📶</div><div><div class="ik-label">Stok modem</div><div class="ik-value">${stokModem.toLocaleString('id-ID')} <small>buah</small></div></div></div>
      <div class="icon-kpi"><div class="circle teal">💳</div><div><div class="ik-label">Stok simcard</div><div class="ik-value">${stokSimcard.toLocaleString('id-ID')} <small>buah</small></div></div></div>
      <div class="icon-kpi"><div class="circle amber">🔧</div><div><div class="ik-label">Kebutuhan pemeliharaan AMR</div><div class="ik-value">${kebutuhanBulanan.toLocaleString('id-ID')} <small>buah/bulan</small></div></div></div>
    </div>
    ${stokKurang ? `<div class="exec-foot-card red" style="font-size:12px;">⚠ Stok modem (${stokModem.toLocaleString('id-ID')} buah) tidak mencukupi kebutuhan pemeliharaan &amp; amrisasi (${kebutuhanBulanan.toLocaleString('id-ID')} buah/bulan) bila dipakai bersamaan.</div>` : `<div class="exec-foot-card green" style="font-size:12px;">✓ Stok modem mencukupi kebutuhan pemeliharaan bulanan.</div>`}`;

  // ---- Sisa material ganti meter (tabel) ----
  document.getElementById('gm_sisa_table').innerHTML = `
    <table>
      <thead><tr><th>Material</th><th>Sisa (bh)</th><th>Keterangan</th></tr></thead>
      <tbody>
        ${materials.map(m=>{
          const st = GM_STATUS_STYLE[m.status] || {cls:'bad', label:m.status};
          return `<tr><td>${m.nama}</td><td>${m.sisa.toLocaleString('id-ID')}</td><td><span class="pill ${st.cls}">${st.label}</span></td></tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="legend" style="padding:8px 2px 0;">
      <b style="color:#d23b3b;">&#9632;</b> Kritis / stok habis &nbsp;
      <b style="color:#c98500;">&#9632;</b> Perlu antisipasi &nbsp;
      <b style="color:#1c8a4a;">&#9632;</b> Aman
    </div>`;

  // ---- Insight utama (otomatis) ----
  const insightPoints = [
    `Realisasi ganti meter s.d ${last.bulan} 2026 sebesar <b>${realSD.toLocaleString('id-ID')} unit (${capaianSD.toFixed(2)}%)</b> ${capaianSD>=100?'telah melampaui':'masih di bawah'} target s.d ${last.bulan} 2026.`,
    `Realisasi kumulatif s.d ${last.bulan} 2026 sebesar ${realSD.toLocaleString('id-ID')} unit (${(targetTahun?realSD/targetTahun*100:0).toFixed(2)}%) dari target tahunan ${targetTahun.toLocaleString('id-ID')} unit.`,
    `Masih terdapat sisa target <b>${sisaTarget.toLocaleString('id-ID')} unit</b> yang harus diselesaikan pada periode setelah ${last.bulan}&ndash;Desember 2026.`,
    `Kinerja amrisasi s.d ${last.bulan} 2026 mencapai ${amrReal.toLocaleString('id-ID')} unit (${amrCapaian.toFixed(2)}%) dari target ${amrTarget.toLocaleString('id-ID')} unit.`,
    stokKurang ? `Stok modem (${stokModem.toLocaleString('id-ID')} buah) tidak mencukupi kebutuhan amrisasi &amp; pemeliharaan (${kebutuhanBulanan.toLocaleString('id-ID')} buah/bulan).` : `Stok modem masih mencukupi kebutuhan pemeliharaan &amp; amrisasi bulanan.`,
    materialBermasalah.length ? `Material berikut perlu perhatian: ${materialBermasalah.map(m=>`<b>${m.nama}</b> (${GM_STATUS_STYLE[m.status]?.label||m.status})`).join(', ')}.` : `Seluruh material ganti meter dalam kondisi aman.`
  ];
  document.getElementById('gm_insight').innerHTML = insightPoints.map(p=>`<li>${p}</li>`).join('');

  showDash('gm');
}

async function gmLoad(){
  const url = document.getElementById('gm_url').value.trim();
  if(!url){ setStatus('gm_status', false, 'Masukkan link CSV terlebih dahulu.'); return; }
  setStatus('gm_status', true, 'Memuat data...');
  try{ gmRender(await fetchCSV(url)); } catch(e){ setStatus('gm_status', false, 'Gagal memuat: ' + e.message); }
}

function gmSample(){
  gmRender([
    {Bulan:'JAN', Target_Kumulatif:'1281', Realisasi_Kumulatif:'819'},
    {Bulan:'FEB', Target_Kumulatif:'3251', Realisasi_Kumulatif:'1638'},
    {Bulan:'MAR', Target_Kumulatif:'4768', Realisasi_Kumulatif:'2457'},
    {Bulan:'APR', Target_Kumulatif:'6521', Realisasi_Kumulatif:'4095'},
    {Bulan:'MEI', Target_Kumulatif:'7371', Realisasi_Kumulatif:'5733'},
    {Bulan:'JUN', Target_Kumulatif:'10942', Realisasi_Kumulatif:'10942'},
    {Bulan:'JUL', Target_Kumulatif:'11507', Realisasi_Kumulatif:'0'},
    {Bulan:'AGU', Target_Kumulatif:'12098', Realisasi_Kumulatif:'0'},
    {Bulan:'SEP', Target_Kumulatif:'12689', Realisasi_Kumulatif:'0'},
    {Bulan:'OKT', Target_Kumulatif:'13280', Realisasi_Kumulatif:'0'},
    {Bulan:'NOV', Target_Kumulatif:'13280', Realisasi_Kumulatif:'0'},
    {Bulan:'DES', Target_Kumulatif:'13280', Realisasi_Kumulatif:'0'},
  ]);
}
