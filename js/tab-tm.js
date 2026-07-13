/* ================= TAB 7: MONITORING PELANGGAN TM ================= */
/*
  Sumber data: sheet "REKAP TM" (export apa adanya, header 3 baris berlapis).
  Karena headernya berlapis (bukan 1 baris nama kolom sederhana), tab ini TIDAK
  memakai parseCSV()/findKey() biasa (yang mendeteksi 1 baris header), melainkan
  parseCSVRows() (tokenizer mentah) lalu ambil kolom berdasarkan POSISI tetap,
  persis seperti pola "urutan posisi" yang sudah dipakai di tab P2TL.

  Posisi kolom (0-based) hasil pemetaan header sheet sumber:
    0  NO
    1  IDPEL
    2  NAMA
    3  UNITUP
    4  TARIF
    7  DAYA
    43-46  blok MEI   : RPTAG, PEMKWH, JN, FAKM
    47-50  blok JUNI  : RPTAG, PEMKWH, JN, FAKM
    51-54  blok JULI  : RPTAG, PEMKWH, JN, FAKM
    75     SELISIH KWH (sudah dihitung sheet: JULI vs JUNI, ada suffix ▼/▲)
    76     PERSEN NAIK/TURUN (idem, dalam %)

  Baris data pelanggan dikenali dengan aturan: kolom IDPEL (index 1) berisi
  angka murni. Ini otomatis membuang baris judul, baris sub-header, baris
  "GRAND TOTAL", dan baris kosong di ekor sheet, tanpa perlu menghitung jumlah
  baris header secara hardcode (lebih tahan kalau sheet sumber sedikit berubah).

  Sesuai permintaan: bulan sebelum Mei (Des-Apr) & setelah Juli (Agt-Des) diabaikan
  karena datanya belum closed / masih #ERROR! di sheet sumber.
*/

const TM_COL = {
  IDPEL: 1, NAMA: 2, UNIT: 3, TARIF: 4, DAYA: 7,
  MEI_PEMKWH: 44, JUNI_PEMKWH: 48, JULI_PEMKWH: 52,
  SELISIH: 75, PERSEN: 76
};

function tmParseTrend(raw){
  const s = String(raw == null ? '' : raw);
  const dir = s.includes('▼') ? 'turun' : (s.includes('▲') ? 'naik' : '');
  return { value: num(s), dir };
}

function tmParseRows(rawRows){
  return rawRows
    .filter(r => /^[0-9]+$/.test(String(r[TM_COL.IDPEL] || '').trim()))
    .map(r => {
      const g = i => (r[i] !== undefined ? r[i] : '');
      const row = {
        idpel: String(g(TM_COL.IDPEL)).trim(),
        nama: String(g(TM_COL.NAMA)).trim(),
        unit: String(g(TM_COL.UNIT)).trim(),
        tarif: String(g(TM_COL.TARIF)).trim(),
        daya: num(g(TM_COL.DAYA)),
        mei: num(g(TM_COL.MEI_PEMKWH)),
        juni: num(g(TM_COL.JUNI_PEMKWH)),
        juli: num(g(TM_COL.JULI_PEMKWH))
      };
      row.selisih = tmParseTrend(g(TM_COL.SELISIH));
      row.persen = tmParseTrend(g(TM_COL.PERSEN));
      // fallback: kalau sheet tidak menyediakan kolom SELISIH/PERSEN yang valid
      // (mis. link CSV custom tanpa kolom itu), hitung sendiri dari Juni->Juli.
      if(!row.selisih.dir && (row.juni || row.juli)){
        const diff = row.juni - row.juli;
        row.selisih = { value: Math.abs(diff), dir: diff > 0 ? 'turun' : (diff < 0 ? 'naik' : '') };
        row.persen = { value: row.juni ? Math.abs(diff / row.juni * 100) : 0, dir: row.selisih.dir };
      }
      return row;
    })
    .filter(x => x.nama && x.tarif);
}

function tmFmt(n){ return Math.round(n).toLocaleString('id-ID'); }
function tmFmt1(n){ return n.toLocaleString('id-ID', { minimumFractionDigits:1, maximumFractionDigits:1 }); }

function tmBadge(trend){
  if(trend.dir === 'turun') return `<span class="tm-badge down">&#9660; ${tmFmt1(trend.value)}%</span>`;
  if(trend.dir === 'naik') return `<span class="tm-badge up">&#9650; ${tmFmt1(trend.value)}%</span>`;
  return `<span class="tm-badge flat">&mdash;</span>`;
}
function tmSelisihText(trend){
  if(trend.dir === 'turun') return `<span class="tm-badge down">&#9660; ${tmFmt(trend.value)} kWh</span>`;
  if(trend.dir === 'naik') return `<span class="tm-badge up">&#9650; ${tmFmt(trend.value)} kWh</span>`;
  return `<span class="tm-badge flat">&mdash;</span>`;
}

function tmRankRow(i, r, mode){
  const nameCell = `<td class="tm-name-cell"><b>${r.nama}</b></td>`;
  if(mode === 'top'){
    const growth = r.juni ? ((r.juli - r.juni) / r.juni * 100) : 0;
    const growthBadge = growth >= 0
      ? `<span class="tm-badge up">&#9650; ${tmFmt1(growth)}%</span>`
      : `<span class="tm-badge down">&#9660; ${tmFmt1(Math.abs(growth))}%</span>`;
    return `<tr>
      <td><span class="tm-rank-no">${i+1}</span></td>
      ${nameCell}
      <td>${r.idpel}</td><td>${r.unit}</td><td>${r.tarif}</td><td>${tmFmt(r.daya)}</td>
      <td>${tmFmt(r.mei)}</td><td>${tmFmt(r.juni)}</td><td><b>${tmFmt(r.juli)}</b></td>
      <td>${growthBadge}</td>
    </tr>`;
  }
  return `<tr>
    <td><span class="tm-rank-no">${i+1}</span></td>
    ${nameCell}
    <td>${r.idpel}</td><td>${r.unit}</td><td>${r.tarif}</td><td>${tmFmt(r.daya)}</td>
    <td>${tmFmt(r.mei)}</td><td>${tmFmt(r.juni)}</td><td>${tmFmt(r.juli)}</td>
    <td>${tmSelisihText(r.selisih)}</td>
    <td>${tmBadge(r.persen)}</td>
  </tr>`;
}

function tmRenderTable(id, rows, mode){
  document.querySelector('#'+id+' tbody').innerHTML =
    rows.map((r,i) => tmRankRow(i, r, mode)).join('') ||
    `<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:14px;">Tidak ada data yang memenuhi kriteria.</td></tr>`;
}

function tmKpiCard(label, value, sub){
  return `<div class="tm-kpi-card">
    <div class="tm-kpi-label">${label}</div>
    <div class="tm-kpi-value">${value}</div>
    ${sub ? `<div class="tm-kpi-sub">${sub}</div>` : ''}
  </div>`;
}

function tmRender(rawRows){
  const rows = tmParseRows(rawRows);
  if(!rows.length){
    setStatus('tm_status', false, 'Tidak ada baris pelanggan TM yang valid ditemukan pada CSV ini.');
    return;
  }

  const totalJuli = rows.reduce((a,r)=>a+r.juli,0);
  const totalJuni = rows.reduce((a,r)=>a+r.juni,0);
  const turunRows = rows.filter(r => r.selisih.dir === 'turun');
  const naikRows = rows.filter(r => r.selisih.dir === 'naik');
  const totalTurunKwh = turunRows.reduce((a,r)=>a+r.selisih.value,0);

  const top10TurunKwh = [...turunRows].sort((a,b)=>b.selisih.value-a.selisih.value).slice(0,10);
  const top10TurunPersen = [...turunRows].sort((a,b)=>b.persen.value-a.persen.value).slice(0,10);
  const top10Kwh = [...rows].sort((a,b)=>b.juli-a.juli).slice(0,10);

  tmRenderTable('tm_table_turun_kwh', top10TurunKwh, 'turun');
  tmRenderTable('tm_table_turun_persen', top10TurunPersen, 'turun');
  tmRenderTable('tm_table_top_kwh', top10Kwh, 'top');

  // ---- KPI ringkas ----
  const growthTotal = totalJuni ? ((totalJuli-totalJuni)/totalJuni*100) : 0;
  document.getElementById('tm_kpi').innerHTML = [
    tmKpiCard('Jumlah pelanggan TM', rows.length, `Tarif: ${[...new Set(rows.map(r=>r.tarif))].join(', ')}`),
    tmKpiCard('Total kWh jual (Juli)', tmFmt(totalJuli)+' kWh', (growthTotal>=0?'▲ ':'▼ ')+tmFmt1(Math.abs(growthTotal))+'% vs Juni'),
    tmKpiCard('Pelanggan turun', turunRows.length, `Total penurunan ${tmFmt(totalTurunKwh)} kWh`),
    tmKpiCard('Pelanggan naik', naikRows.length, ''),
  ].join('');

  // ---- Chart pemakaian per tarif (Mei/Juni/Juli) ----
  const tarifList = [...new Set(rows.map(r=>r.tarif))].sort();
  const sumByTarifMonth = (month) => tarifList.map(t =>
    rows.filter(r=>r.tarif===t).reduce((a,r)=>a+r[month],0)
  );
  destroyChart('tm_tarif_chart');
  charts['tm_tarif_chart'] = new Chart(document.getElementById('tm_tarif_chart'), {
    type:'bar',
    data:{
      labels: tarifList,
      datasets:[
        { label:'Mei',  data: sumByTarifMonth('mei'),  backgroundColor:'#8aa8c9' },
        { label:'Juni', data: sumByTarifMonth('juni'), backgroundColor:'#2f6fa8' },
        { label:'Juli', data: sumByTarifMonth('juli'), backgroundColor:'#0d3a5c' }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom' } },
      scales:{ y:{ beginAtZero:true, ticks:{ callback:v=>tmFmt(v) } } }
    }
  });
  const tarifTop = tarifList.map(t=>({t, v: rows.filter(r=>r.tarif===t).reduce((a,r)=>a+r.juli,0)})).sort((a,b)=>b.v-a.v)[0];
  document.getElementById('tm_tarif_caption').textContent = tarifTop
    ? `Golongan tarif dengan kontribusi kWh jual TM terbesar bulan Juli: ${tarifTop.t} (${tmFmt(tarifTop.v)} kWh).`
    : '';

  // ---- Insight ----
  const insights = [];
  if(top10TurunKwh[0]) insights.push(`Penurunan kWh terbesar: <b>${top10TurunKwh[0].nama}</b> (${top10TurunKwh[0].idpel}, ${top10TurunKwh[0].tarif}) turun ${tmFmt(top10TurunKwh[0].selisih.value)} kWh dari Juni ke Juli.`);
  if(top10TurunPersen[0]) insights.push(`Penurunan persentase terbesar: <b>${top10TurunPersen[0].nama}</b> turun ${tmFmt1(top10TurunPersen[0].persen.value)}% (dari ${tmFmt(top10TurunPersen[0].juni)} ke ${tmFmt(top10TurunPersen[0].juli)} kWh).`);
  if(top10Kwh[0]) insights.push(`Pelanggan dengan kWh jual tertinggi bulan Juli: <b>${top10Kwh[0].nama}</b> sebesar ${tmFmt(top10Kwh[0].juli)} kWh.`);
  insights.push(`Dari ${rows.length} pelanggan TM, ${turunRows.length} mengalami penurunan pemakaian dan ${naikRows.length} mengalami kenaikan (Juni&rarr;Juli).`);
  document.getElementById('tm_insight').innerHTML = insights.map(t=>`<div>${t}</div>`).join('');

  showDash('tm');
  setStatus('tm_status', true, `Berhasil memuat ${rows.length} pelanggan TM.`);
}

async function tmLoad(){
  const url = document.getElementById('tm_url').value.trim();
  if(!url){ setStatus('tm_status', false, 'Masukkan link CSV terlebih dahulu.'); return; }
  try{
    setStatus('tm_status', true, 'Memuat data...');
    const rows = await fetchCSVRaw(url);
    tmRender(rows);
  }catch(e){
    setStatus('tm_status', false, 'Gagal memuat data: ' + e.message);
  }
}

// Contoh diambil dari struktur & pola kolom sheet REKAP TM yang sesungguhnya (nama
// pelanggan diseragamkan sebagai institusi contoh) supaya jumlah kolom & posisi
// SELISIH KWH / PERSEN NAIK-TURUN PERSIS sama dengan data live.
const TM_SAMPLE_CSV = `,,BULAN REKENING,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
NO,IDPEL,NAMA,UNITUP,TARIF,,, DAYA,,,,,,,,,,,,,,,,DES 2026,,,, JANUARI,,,, FEBRUARI,,,, MARET,,,, APRIL,,,, MEI,,,, JUNI,,,, JULI,,,, AGUSTUS,,,, SEPTEMBER,,,, oktober,,,, november,,,, des,,,,SELISIH KWH,PERSEN NAIK / TURUN,,,,Terlampir Pelanggan TM I3 pemakaian turun ULP Madiun Kota,, Emin,Selisih Pekai - Emin,PEMBATAS,RATIO CT,,RATIO PT,RATA2 PEMAKAIAN,CT DAYA,SELISIH DAYA-DIL,FKM DAYA,FKM DIL,SELISIH
,,,,,KDPT,KDPT_2,,KDPROSESKLP,POSTINGBILLING,MSG,RPPTL,RPTB,RPPPN,RPBPJU,RPBPTRAFO,RPSEWATRAFO,RPSEWAKAP,RPANGSA,RPANGSB,RPANGSC,RPMAT,RPPLN, RPTAG, PEMKWH, JN, FAKM, RPTAG, PEMKWH, JN, FAKM, RPTAG, PEMKWH, JN, FAKM, RPTAG, PEMKWH, JN, FAKM, RPTAG, PEMKWH, JN, FAKM, RPTAG, PEMKWH, JN, FAKM, RPTAG, PEMKWH, JN, FAKM, RPTAG, PEMKWH, JN, FAKM, RPTAG, PEMKWH, JN, FAKM, RPTAG, PEMKWH, JN, FAKM, RPTAG, PEMKWH, JN, FAKM, RPTAG, PEMKWH, JN, FAKM, RPTAG, PEMKWH, JN, FAKM,, PEMKWH,JN,CT,,PT,FKM,,,,PRIM,SEK,20 kV / 100 V,,,,,,
1,515011367671,CONTOH RS A,51501,S2K,,,1110000,51MDNAI,3,0,112445629,,0,11244563,0,0,0,0,0,0,10000,112455629,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,  127.680.504 ,  111.984 ,  101 ,  1.600 ,  136.559.248 ,  119.765 ,  108 ,  1.600 ,  122.971.274 ,  107.917 ,  97 ,  1.600 ,,,,,,,,,,,,,,,,,,,,,11.848▼,"9,89%▼",#ERROR!,"32,0","6,4",200,1282,  44.400 ,  63.517 ,  32 ,#ERROR!,5,200,#ERROR!,  32 ,#ERROR!,  1.282 ,#ERROR!,#ERROR!
2,515010632917,CONTOH PUSDIK B,51501,P2,,,  240.000 ,51MDNAI,3,0,26884778,,0,0,0,0,0,0,0,0,10000,26894778,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,  20.847.343 ,  13.679 ,  57 ,  400 ,  17.895.631 ,  11.670 ,  49 ,  400 ,  18.907.363 ,  12.346 ,  51 ,  400 ,,,,,,,,,,,,,,,,,,,,,676▲,"5,79%▲",#ERROR!,"6,9","1,4",201,279,  9.600 ,  2.746 ,  7 ,#ERROR!,5,200,#ERROR!,  7 ,#ERROR!,  277 ,#ERROR!,#ERROR!
3,515010840145,CONTOH RS C,51501,S2K,,,  690.000 ,51MDNAI,3,0,37570467,,0,3757047,0,0,0,0,0,0,10000,37580467,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,  212.789.278 ,  187.507 ,  272 ,  800 ,  223.166.294 ,  196.685 ,  285 ,  800 ,  198.491.844 ,  174.928 ,  254 ,  800 ,,,,,,,,,,,,,,,,,,,,,21.757▼,"11,06%▼",#ERROR!,"19,9","4,0",202,805,  27.600 ,  147.328 ,  20 ,#ERROR!,5,200,#ERROR!,  20 ,#ERROR!,  797 ,#ERROR!,#ERROR!
4,515010804633,CONTOH PT D,51501,B3,,,  345.000 ,51MDNAI,3,0,53111691,,0,5311169,0,0,0,0,0,0,10000,53121691,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,  67.663.860 ,  54.609 ,  158 ,  400 ,  74.417.454 ,  59.380 ,  172 ,  400 ,  73.489.954 ,  57.388 ,  166 ,  400 ,,,,,,,,,,,,,,,,,,,,,1.992▼,"3,35%▼",#ERROR!,"10,0","2,0",203,404,  13.800 ,  43.588 ,  10 ,#ERROR!,5,200,#ERROR!,  10 ,#ERROR!,  398 ,#ERROR!,#ERROR!
5,515011351949,CONTOH PT E,51501,I3,,,  1.730.000 ,51MDNAI,3,0,113229398,,0,3396882,0,0,0,0,0,0,10000,113239398,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,  372.022.449 ,  321.648 ,  93 ,  4.000 ,  559.110.129 ,  483.924 ,  140 ,  4.000 ,  384.933.509 ,  331.732 ,  96 ,  4.000 ,,,,,,,,,,,,,,,,,,,,,152.192▼,"31,45%▼",#ERROR!,"49,9","10,0",204,2038,  69.200 ,  262.532 ,  50 ,#ERROR!,5,200,#ERROR!,  50 ,#ERROR!,  1.998 ,#ERROR!,#ERROR!
6,515010930230,CONTOH PERKERETAAPIAN F,51501,S2,,,  1.600.000 ,51MDNAI,3,0,167170605,,0,0,0,0,0,0,0,0,10000,167180605,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,#ERROR!,  170.784.600 ,  215.020 ,  134 ,  2.000 ,  155.364.300 ,  195.742 ,  122 ,  2.000 ,  183.841.140 ,  231.036 ,  144 ,  2.000 ,,,,,,,,,,,,,,,,,,,,,35.294▲,"18,03%▲",#ERROR!,"46,2","9,2",205,1894,  64.000 ,  167.036 ,  46 ,#ERROR!,5,200,#ERROR!,  46 ,#ERROR!,  1.848 ,#ERROR!,#ERROR!
`;

function tmSample(){
  document.getElementById('tm_url').value = '';
  setStatus('tm_status', true, 'Menampilkan data contoh (bukan data live).');
  const rows = parseCSVRows(TM_SAMPLE_CSV);
  tmRender(rows);
}
