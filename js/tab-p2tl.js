/* ================= TAB 4: P2TL ================= */
let p2tlData = [];
function p2tlRender(rows){
  const bKey = findKey(rows[0], ['bulan']);
  if(!bKey){ setStatus('p2tl_status', false, 'Kolom Bulan tidak ditemukan.'); return; }
  // PENTING: nama header kolom kumulatif di sheet sumber terbukti tidak selalu bisa
  // ditebak lewat nama (dua kali salah tangkap sebelumnya) — jadi sekarang diambil
  // berdasarkan POSISI kolom setelah Bulan, sesuai konfirmasi user:
  // Bulan, [D] Target_Bulanan, [E] Realisasi_Bulanan, [F] Target_Kumulatif, [G] Realisasi_Kumulatif.
  const keys = Object.keys(rows[0]);
  const bIdx = keys.indexOf(bKey);
  const tbKey = keys[bIdx+1], rbKey = keys[bIdx+2], tkKey = keys[bIdx+3], rkKey = keys[bIdx+4];
  if(!tbKey||!rbKey||!tkKey||!rkKey){
    setStatus('p2tl_status', false, 'Kolom setelah "Bulan" kurang dari 4 (Target_Bulanan, Realisasi_Bulanan, Target_Kumulatif, Realisasi_Kumulatif). Cek urutan kolom CSV.');
    return;
  }
  // PENTING: sumber data (mis. sheet master/DASH_P2TL) bisa memuat kolom ULP dengan
  // BANYAK baris per bulan — satu baris per ULP (MADIUN KOTA, MAGETAN, NGAWI, dst) DITAMBAH
  // satu baris agregat "UP3 MADIUN". Tab evaluasi P2TL ini harus selalu memakai angka
  // UP3 MADIUN (total gabungan), bukan ULP tertentu. Kalau ada kolom ULP, filter dulu ke
  // baris yang ULP-nya "UP3 MADIUN" supaya tidak salah ambil baris ULP pertama yang
  // kebetulan match bulan yang sama (itu penyebab target Juli sebelumnya salah tampil
  // sebagai 161.878 kWh milik MADIUN KOTA, bukan 898.438 kWh milik UP3 MADIUN).
  const ulpKey = findKey(rows[0], ['ulp','unit']);
  let sourceRows = rows;
  if(ulpKey){
    const up3Rows = rows.filter(r => /^UP3\b/i.test(String(r[ulpKey]||'').trim()));
    if(up3Rows.length) sourceRows = up3Rows;
  }
  p2tlData = sourceRows.map(r=>({
    bulan:r[bKey],
    tb:num(r[tbKey]), rb:num(r[rbKey]),
    cumT:num(r[tkKey]), cumR:num(r[rkKey]),
    realisasiFilled: num(r[rkKey])>0 || num(r[rbKey])>0
  })).filter(d=>d.bulan);
  p2tlRecalc();
  setStatus('p2tl_status', true, 'Data berhasil dimuat' + (ulpKey ? ' (difilter khusus baris UP3 MADIUN dari kolom ULP)' : '') + ' — kolom: '+tbKey+', '+rbKey+', '+tkKey+', '+rkKey+'.');
}
// ---- Pemetaan nama bulan Indonesia (penuh & singkatan) ke indeks 0-11, dipakai untuk
// mencocokkan baris data P2TL dengan bulan kalender YANG SEDANG BERJALAN saat ini
// (bukan sekadar baris terakhir yang kebetulan punya nilai kumulatif > 0).
const INDO_BULAN_FULL = ["JANUARI","FEBRUARI","MARET","APRIL","MEI","JUNI","JULI","AGUSTUS","SEPTEMBER","OKTOBER","NOVEMBER","DESEMBER"];
const INDO_BULAN_ABBR = ["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"];
function indoMonthIndex(name){
  const n = String(name||'').trim().toUpperCase();
  let idx = INDO_BULAN_FULL.indexOf(n);
  if(idx === -1) idx = INDO_BULAN_ABBR.indexOf(n.slice(0,3));
  return idx; // -1 kalau tidak dikenali
}
function p2tlRecalc(){
  if(!p2tlData.length) return;
  const rows = p2tlData; // cumT & cumR sudah kumulatif langsung dari sumber, tidak di-SUM lagi di sini
  const first = rows[0];

  // ---- Tentukan "bulan berjalan" berdasarkan bulan KALENDER SAAT INI (bukan baris
  // terakhir di tabel). Ini mencegah kartu KPI menampilkan bulan yang belum berjalan
  // (mis. Desember) hanya karena baris itu punya nilai kumulatif carry-over > 0. ----
  const currentMonthIdx = new Date().getMonth(); // 0 = Januari ... 11 = Desember
  let last = rows.find(r => indoMonthIndex(r.bulan) === currentMonthIdx);
  if(!last){
    // Fallback: bulan berjalan belum ada di data yang dimuat -> pakai baris terakhir
    // yang realisasi bulanannya benar-benar terisi (rb > 0), baru fallback ke baris terakhir.
    const rowsWithReal = rows.filter(r=>r.rb>0);
    last = rowsWithReal.length ? rowsWithReal[rowsWithReal.length-1] : (rows.filter(r=>r.realisasiFilled).slice(-1)[0] || rows[rows.length-1]);
  }
  const gap = last.cumT - last.cumR;
  const gapPct = last.cumT ? (gap/last.cumT*100) : 0;
  const capaian = last.cumT ? (last.cumR/last.cumT*100) : 0;

  // ---- Gap & capaian BULANAN (realisasi bulan berjalan vs target bulanan) ----
  const gapBulanan = last.tb - last.rb;
  const gapBulananPct = last.tb ? (gapBulanan/last.tb*100) : 0;
  const pctBulanan = last.tb ? (last.rb/last.tb*100) : 0;

  // ---- 4 poin ringkasan bulan berjalan (data ter-link real-time ke sumber, sumber
  // diperbarui setiap 1 jam sehingga angka berikut mengikuti update sumber terakhir) ----
  const now = new Date();
  const tglJam = now.toLocaleDateString('id-ID', {day:'2-digit', month:'long', year:'numeric'}) + ', pukul ' + now.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) + ' WIB';
  document.getElementById('p2tl_live_caption').innerHTML = `📡 Ringkasan bulan berjalan (${last.bulan}) &mdash; data diperbarui ${tglJam}, mengikuti sumber yang ter-link langsung dan diperbarui setiap 1 jam.`;
  document.getElementById('p2tl_live_points').innerHTML = `
    <div><div style="font-size:10.5px;opacity:.75;text-transform:uppercase;letter-spacing:.3px;">Realisasi bulan (${last.bulan})</div><div style="font-size:19px;font-weight:800;">${last.rb.toLocaleString('id-ID')} kWh</div></div>
    <div><div style="font-size:10.5px;opacity:.75;text-transform:uppercase;letter-spacing:.3px;">Target bulanan (${last.bulan})</div><div style="font-size:19px;font-weight:800;">${last.tb.toLocaleString('id-ID')} kWh</div></div>
    <div><div style="font-size:10.5px;opacity:.75;text-transform:uppercase;letter-spacing:.3px;">Realisasi s.d ${last.bulan}</div><div style="font-size:19px;font-weight:800;">${last.cumR.toLocaleString('id-ID')} kWh</div></div>
    <div><div style="font-size:10.5px;opacity:.75;text-transform:uppercase;letter-spacing:.3px;">Target kumulatif s.d ${last.bulan}</div><div style="font-size:19px;font-weight:800;">${last.cumT.toLocaleString('id-ID')} kWh</div></div>`;
  const reguTad = num(document.getElementById('p2tl_regu_tad').value);
  const reguMandiri = num(document.getElementById('p2tl_regu_mandiri').value);
  const ts = num(document.getElementById('p2tl_ts').value);
  const cost = num(document.getElementById('p2tl_cost').value);
  const bcr = cost ? ts/cost : 0;
  const net = ts - cost;
  const totalRegu = reguTad+reguMandiri;
  const produktivitas = totalRegu ? (last.cumR/totalRegu) : 0;
  const periodeLabel = `PERIODE ${first.bulan.toUpperCase()} &ndash; ${last.bulan.toUpperCase()} 2026`;
  document.getElementById('p2tl_period').innerHTML = periodeLabel;
  last.capaian = capaian; // dipakai lagi di bawah

  document.getElementById('p2tl_side').innerHTML = `
    <div class="exec-side-item"><div class="lbl">Jumlah regu P2TL TAD</div><div class="val">${reguTad} Regu</div></div>
    <div class="exec-side-item"><div class="lbl">Jumlah regu P2TL Mandiri</div><div class="val">${reguMandiri} Regu</div></div>
    <div class="exec-side-item"><div class="lbl">Total regu operasional</div><div class="val">${totalRegu} Regu</div></div>
    <div class="exec-side-item"><div class="lbl">Realisasi bulan berjalan (${last.bulan})</div><div class="val">${last.rb.toLocaleString('id-ID')} kWh</div></div>
    <div class="exec-side-item"><div class="lbl">Target kumulatif s.d ${last.bulan}</div><div class="val">${last.cumT.toLocaleString('id-ID')} kWh</div></div>
    <div class="exec-side-item"><div class="lbl">Realisasi kumulatif</div><div class="val">${last.cumR.toLocaleString('id-ID')} kWh</div></div>
    <div class="exec-side-item"><div class="lbl">Persentase capaian</div><div class="val">${capaian.toFixed(2)}%</div></div>
    <div class="exec-side-item"><div class="lbl">Total TS (benefit)</div><div class="val">Rp${(ts/1e9).toFixed(2)} M</div></div>
    <div class="exec-side-item"><div class="lbl">Total biaya P2TL (cost)</div><div class="val">Rp${(cost/1e9).toFixed(2)} M</div></div>
    <div class="exec-side-item"><div class="lbl">Net benefit</div><div class="val">Rp${(net/1e6).toFixed(2)} Jt</div></div>
    <div class="exec-side-item"><div class="lbl">Benefit cost ratio</div><div class="val">${bcr.toFixed(2)}</div></div>`;

  document.getElementById('p2tl_kpi').innerHTML = `
    <div class="kpi-card ${pctBulanan>=100?'green':'amber'}"><div class="kpi-label">Realisasi bulan berjalan (${last.bulan})</div><div class="kpi-value">${last.rb.toLocaleString('id-ID')} kWh</div><div class="kpi-sub">${pctBulanan.toFixed(1)}% dari target bulanan &middot; s.d hari ini</div></div>
    <div class="kpi-card"><div class="kpi-label">Target bulanan (${last.bulan})</div><div class="kpi-value">${last.tb.toLocaleString('id-ID')} kWh</div></div>
    <div class="kpi-card ${gapBulanan>0?'amber':'green'}"><div class="kpi-label">Gap bulan berjalan vs target</div><div class="kpi-value">${gapBulanan.toLocaleString('id-ID')} kWh</div><div class="kpi-sub">${gapBulanan>0?'▼':'▲'} ${Math.abs(gapBulananPct).toFixed(2)}% ${gapBulanan>0?'belum tercapai':'melebihi target bulanan'}</div></div>
    <div class="kpi-card ${pctBulanan>=100?'green':'amber'}"><div class="kpi-label">% realisasi bulanan</div><div class="kpi-value">${pctBulanan.toFixed(2)}%</div><div class="kpi-sub">terhadap target bulan ${last.bulan}</div></div>
    <div class="kpi-card"><div class="kpi-label">Realisasi energi kumulatif</div><div class="kpi-value">${last.cumR.toLocaleString('id-ID')} kWh</div><div class="kpi-sub">${capaian.toFixed(2)}% vs target kumulatif</div></div>
    <div class="kpi-card green"><div class="kpi-label">Target kumulatif s.d ${last.bulan}</div><div class="kpi-value">${last.cumT.toLocaleString('id-ID')} kWh</div></div>
    <div class="kpi-card purple"><div class="kpi-label">Gap terhadap target</div><div class="kpi-value">${gap.toLocaleString('id-ID')} kWh</div><div class="kpi-sub">${gap>0?'▼':'▲'} ${Math.abs(gapPct).toFixed(2)}% ${gap>0?'belum tercapai':'melebihi target'}</div></div>
    <div class="kpi-card amber"><div class="kpi-label">Total TS (benefit)</div><div class="kpi-value">Rp${(ts/1e9).toFixed(2)} M</div></div>
    <div class="kpi-card ${bcr>=1?'green':'red'}"><div class="kpi-label">Benefit cost ratio (BCR)</div><div class="kpi-value">${bcr.toFixed(2)}</div><div class="kpi-sub">Setiap Rp1 biaya menghasilkan Rp${bcr.toFixed(2)} manfaat</div></div>
    <div class="kpi-card ${net>=0?'green':'red'}"><div class="kpi-label">Net benefit</div><div class="kpi-value">Rp${(net/1e6).toFixed(2)} Jt</div></div>`;

  if(ulpContribData.length) p2tlUlpRecalc();

  destroyChart('p2tl_donut');
  charts['p2tl_donut'] = new Chart(document.getElementById('p2tl_donut'), {
    type:'doughnut',
    data:{ labels:['Realisasi','Gap target'], datasets:[{ data:[last.cumR, Math.max(gap,0)], backgroundColor:['#1f6fc6','#1c8a4a'], borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'68%', plugins:{ legend:{ position:'bottom', labels:{boxWidth:10, font:{size:11}} } } }
  });
  document.getElementById('p2tl_donut_caption').innerHTML = `Realisasi mencapai <b>${capaian.toFixed(2)}%</b> dari target kumulatif s.d ${last.bulan} ${gap>0?`&mdash; terdapat gap ${gap.toLocaleString('id-ID')} kWh untuk mencapai target kumulatif.`:'&mdash; target kumulatif sudah terlampaui.'}`;

  document.getElementById('p2tl_finance').innerHTML = `
    <table class="fin-table">
      <tr><td>Total TS (Benefit)</td><td>Rp${ts.toLocaleString('id-ID')}</td></tr>
      <tr><td>Total biaya P2TL (Cost)</td><td>Rp${cost.toLocaleString('id-ID')}</td></tr>
      <tr><td>Net benefit</td><td>Rp${net.toLocaleString('id-ID')}</td></tr>
      <tr><td>Benefit cost ratio (BCR)</td><td>${bcr.toFixed(2)}</td></tr>
    </table>
    <div class="fin-box">Setiap Rp1,00 biaya P2TL menghasilkan manfaat sebesar <span class="big">Rp${bcr.toFixed(2)}</span>. Program P2TL ${bcr>=1?'layak dan memberikan keuntungan ekonomi positif':'belum mencapai titik impas, perlu efisiensi biaya'}.</div>`;

  document.getElementById('p2tl_insight').innerHTML = `
    <li>Realisasi energi mencapai ${(last.cumR/1e6).toFixed(2)} GWh atau ${capaian.toFixed(2)}% dari target kumulatif s.d ${last.bulan} 2026.</li>
    <li>Didukung oleh ${totalRegu} regu operasional (${reguTad} regu TAD dan ${reguMandiri} regu Mandiri).</li>
    <li>Total TS sebesar Rp${(ts/1e9).toFixed(2)} miliar memberikan kontribusi terhadap pemulihan potensi kehilangan energi.</li>
    <li>Net benefit sebesar Rp${(net/1e6).toFixed(2)} juta dengan BCR ${bcr.toFixed(2)}.</li>
    <li>Produktivitas rata-rata ${Math.round(produktivitas).toLocaleString('id-ID')} kWh per regu.</li>`;
  document.getElementById('p2tl_monitor').innerHTML = `
    <li>${gap>0?`Masih terdapat gap target sebesar ${gap.toLocaleString('id-ID')} kWh.`:'Target kumulatif sudah tercapai, jaga konsistensi capaian.'}</li>
    <li>Capaian kumulatif ${capaian>=100?'sudah memenuhi':'masih di bawah'} target (${capaian.toFixed(2)}%).</li>
    <li>Evaluasi produktivitas per regu dan per wilayah untuk mengidentifikasi potensi peningkatan terbesar.</li>
    <li>Pengendalian biaya operasional agar BCR tetap di atas 1.</li>`;
  document.getElementById('p2tl_rekom').innerHTML = `
    <li>Fokuskan kegiatan P2TL pada pelanggan berpotensi tinggi.</li>
    <li>Optimalkan penugasan ${reguTad} regu TAD dan ${reguMandiri} regu Mandiri.</li>
    <li>Monitoring mingguan capaian kWh dan TS untuk percepatan target.</li>
    <li>Pertahankan efisiensi biaya agar BCR tetap &gt; 1.</li>`;

  showDash('p2tl');
}
async function p2tlLoad(){
  const url = document.getElementById('p2tl_url').value.trim();
  if(!url){ setStatus('p2tl_status', false, 'Masukkan link CSV terlebih dahulu.'); return; }
  setStatus('p2tl_status', true, 'Memuat data...');
  try{ p2tlRender(await fetchCSV(url)); } catch(e){ setStatus('p2tl_status', false, 'Gagal memuat: ' + e.message); }
}
function p2tlSample(){
  // Contoh 5 kolom sesuai urutan sheet sumber: Bulan, Target_Bulanan, Realisasi_Bulanan,
  // Target_Kumulatif, Realisasi_Kumulatif (kumulatif = akumulasi bulanan, sudah dihitung di sumber).
  p2tlRender([
    {Bulan:'JANUARI', Target_Bulanan:'892857', Realisasi_Bulanan:'459652', Target_Kumulatif:'892857', Realisasi_Kumulatif:'459652'},
    {Bulan:'FEBRUARI', Target_Bulanan:'803571', Realisasi_Bulanan:'457111', Target_Kumulatif:'1696428', Realisasi_Kumulatif:'916763'},
    {Bulan:'MARET', Target_Bulanan:'758929', Realisasi_Bulanan:'511559', Target_Kumulatif:'2455357', Realisasi_Kumulatif:'1428322'},
    {Bulan:'APRIL', Target_Bulanan:'937499', Realisasi_Bulanan:'773559', Target_Kumulatif:'3392856', Realisasi_Kumulatif:'2201881'},
    {Bulan:'MEI', Target_Bulanan:'714286', Realisasi_Bulanan:'1185344', Target_Kumulatif:'4107142', Realisasi_Kumulatif:'3387225'},
    {Bulan:'JUNI', Target_Bulanan:'892858', Realisasi_Bulanan:'1042769', Target_Kumulatif:'5000000', Realisasi_Kumulatif:'4429994'},
    {Bulan:'JULI', Target_Bulanan:'898438', Realisasi_Bulanan:'70073', Target_Kumulatif:'5898438', Realisasi_Kumulatif:'4500067'},
  ]);
}

/* ---- Matriks realisasi P2TL per ULP per bulan (Target/Realisasi/% Capaian), format sama seperti tabel Susut ---- */
let ulpContribData = [];
let ulpContribUp3Data = [];
function p2tlUlpRender(rows){
  const uKey = findKey(rows[0], ['ulp','unit']);
  const bKey = findKey(rows[0], ['bulan']);
  if(!uKey||!bKey){ setStatus('p2tl_ulp_status', false, 'Kolom ULP/Bulan tidak ditemukan.'); return; }
  const keys = Object.keys(rows[0]);
  const bIdx = keys.indexOf(bKey);
  const tbKey = keys[bIdx+1], rbKey = keys[bIdx+2], tkKey = keys[bIdx+3], rkKey = keys[bIdx+4];
  if(!tbKey||!rbKey||!tkKey||!rkKey){
    setStatus('p2tl_ulp_status', false, 'Kolom setelah "Bulan" kurang dari 4 (Target_Bulanan, Realisasi_Bulanan, Target_Kumulatif, Realisasi_Kumulatif).');
    return;
  }
  const isUp3Total = ulpName => /^UP3\b/i.test(String(ulpName).trim());
  const dataAll = rows.map(r=>({
    ulp:String(r[uKey]||'').trim(), bulan:String(r[bKey]||'').trim(),
    tb:num(r[tbKey]), rb:num(r[rbKey]), tk:num(r[tkKey]), rk:num(r[rkKey]),
    rkFilled: num(r[rkKey])>0 || num(r[rbKey])>0
  })).filter(d=>d.ulp && d.bulan);
  ulpContribData = dataAll.filter(d=>!isUp3Total(d.ulp));
  ulpContribUp3Data = dataAll.filter(d=>isUp3Total(d.ulp));
  p2tlUlpRecalc();
  setStatus('p2tl_ulp_status', true, 'Data ULP berhasil dimuat.');
}
function p2tlUlpRecalc(){
  if(!ulpContribData.length) return;
  const ulps = [...new Set(ulpContribData.map(d=>d.ulp))];
  const bulans = [...new Set(ulpContribData.map(d=>d.bulan))];

  let thead = '<thead><tr><th>UNIT</th><th>Sat</th>' + bulans.map(b=>`<th>${b}</th>`).join('') + '</tr></thead>';
  let tbody = '<tbody>';
  ulps.forEach(u=>{
    tbody += `<tr><td rowspan="3">${u}</td><td class="label">TARGET</td>` + bulans.map(b=>{
      const d = ulpContribData.find(x=>x.ulp===u && x.bulan===b);
      if(!d) return '<td>-</td>';
      return `<td>${d.tb.toLocaleString('id-ID')}</td>`;
    }).join('') + '</tr>';
    tbody += `<tr><td class="label">REAL</td>` + bulans.map(b=>{
      const d = ulpContribData.find(x=>x.ulp===u && x.bulan===b);
      if(!d || !d.rkFilled) return '<td>-</td>';
      return `<td>${d.rb.toLocaleString('id-ID')}</td>`;
    }).join('') + '</tr>';
    tbody += `<tr><td class="label">%</td>` + bulans.map(b=>{
      const d = ulpContribData.find(x=>x.ulp===u && x.bulan===b);
      if(!d || !d.rkFilled) return '<td>-</td>';
      const ratio = d.tb ? (d.rb/d.tb*100) : 0;
      return `<td class="${achievementTierClass(ratio)}">${ratio.toFixed(2)}%</td>`;
    }).join('') + '</tr>';
  });
  // Baris total UP3 MADIUN, kalau ada di CSV
  if(ulpContribUp3Data.length){
    tbody += `<tr class="up3-row"><td rowspan="3">UP3 MADIUN</td><td class="label" style="color:#cfe0f0;">TARGET</td>` + bulans.map(b=>{
      const d3 = ulpContribUp3Data.find(d=>d.bulan===b);
      return d3 ? `<td>${d3.tb.toLocaleString('id-ID')}</td>` : '<td>-</td>';
    }).join('') + '</tr>';
    tbody += `<tr class="up3-row"><td class="label" style="color:#cfe0f0;">REAL</td>` + bulans.map(b=>{
      const d3 = ulpContribUp3Data.find(d=>d.bulan===b);
      if(!d3 || !d3.rkFilled) return '<td>-</td>';
      return `<td>${d3.rb.toLocaleString('id-ID')}</td>`;
    }).join('') + '</tr>';
    tbody += `<tr class="up3-row"><td class="label" style="color:#cfe0f0;">%</td>` + bulans.map(b=>{
      const d3 = ulpContribUp3Data.find(d=>d.bulan===b);
      if(!d3 || !d3.rkFilled) return '<td>-</td>';
      const ratio = d3.tb ? (d3.rb/d3.tb*100) : 0;
      return `<td class="${achievementTierClass(ratio)}">${ratio.toFixed(2)}%</td>`;
    }).join('') + '</tr>';
  }
  tbody += '</tbody>';
  document.getElementById('p2tl_ulp_matrix').innerHTML = thead + tbody;

  // Chart ringkas: target vs realisasi KUMULATIF per ULP, diambil dari bulan terakhir yang terisi
  const latestByUlp = ulps.map(u=>{
    const rowsU = ulpContribData.filter(d=>d.ulp===u && d.rkFilled);
    const d = rowsU.length ? rowsU[rowsU.length-1] : null;
    return d ? {ulp:u, tk:d.tk, rk:d.rk} : {ulp:u, tk:0, rk:0};
  }).sort((a,b)=>b.rk-a.rk);
  destroyChart('p2tl_chart');
  charts['p2tl_chart'] = new Chart(document.getElementById('p2tl_chart'), {
    type:'bar',
    data:{ labels:latestByUlp.map(d=>d.ulp), datasets:[
      {label:'Target kumulatif', data:latestByUlp.map(d=>d.tk), backgroundColor:'#1f6fc6', borderRadius:4, maxBarThickness:22},
      {label:'Realisasi kumulatif', data:latestByUlp.map(d=>d.rk), backgroundColor:'#1c8a4a', borderRadius:4, maxBarThickness:22}]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:11}}}},
      scales:{ y:{beginAtZero:true} } }
  });
}
async function p2tlUlpLoad(){
  const url = document.getElementById('p2tl_ulp_url').value.trim();
  if(!url){ setStatus('p2tl_ulp_status', false, 'Masukkan link CSV terlebih dahulu.'); return; }
  setStatus('p2tl_ulp_status', true, 'Memuat data...');
  try{ p2tlUlpRender(await fetchCSV(url)); } catch(e){ setStatus('p2tl_ulp_status', false, 'Gagal memuat: ' + e.message); }
}
function p2tlUlpSample(){
  const bulans = ['JAN','FEB','MAR','APR','MEI','JUN','JUL'];
  const tb = {
    'MADIUN KOTA':[160873,144785,136742,168916,128698,161878,161878],
    'MAGETAN':    [159735,143762,135775,167613,127632,160734,160734],
    'NGAWI':      [160873,144785,136742,168916,128698,161878,161878],
    'MAOSPATI':   [88841,79957,75515,93198,71204,89396,89396],
    'CARUBAN':    [122279,110051,103937,128213,97952,123043,123043],
    'DOLOPO':     [100114,90103,85097,104958,80200,100740,100740],
    'MANTINGAN':  [100142,90128,85121,104985,80221,100768,100768],
  };
  const rb = {
    'MADIUN KOTA':[81226,17033,29455,95840,128698,161878,10744],
    'MAGETAN':    [63408,58414,85936,96513,127632,160734,10665],
    'NGAWI':      [129417,124880,112455,162359,163361,161878,10744],
    'MAOSPATI':   [41495,42046,56412,60357,71204,89396,5940],
    'CARUBAN':    [36584,68686,73282,80964,146418,123043,8160],
    'DOLOPO':     [46296,36987,113614,46459,80200,100740,6670],
    'MANTINGAN':  [61227,109040,116635,133327,80221,100768,6670],
  };
  const rows = [];
  const cumT = {}, cumR = {};
  Object.keys(tb).forEach(u=>{ cumT[u]=0; cumR[u]=0; });
  bulans.forEach((b,i)=>{
    Object.keys(tb).forEach(u=>{
      cumT[u]+=tb[u][i]; cumR[u]+=rb[u][i];
      rows.push({ULP:u, Bulan:b, Target_Bulanan:tb[u][i], Realisasi_Bulanan:rb[u][i], Target_Kumulatif:cumT[u], Realisasi_Kumulatif:cumR[u]});
    });
  });
  p2tlUlpRender(rows);
}

