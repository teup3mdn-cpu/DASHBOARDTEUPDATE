/* ================= TAB 8: REALISASI PEMERIKSAAN PELANGGAN (P2TL) ================= */
/* Sumber: export CSV sheet "epm" (Google Sheets "EVALUASI LAPORAN HARIAN") — delimiter KOMA (,),
   157 kolom, BARIS PERTAMA = header nama kolom asli (NO, ID_P2TL, IDPEL, DAYA, ...).
   Kolom diambil berdasarkan NAMA HEADER (bukan index tetap) supaya tetap jalan walau urutan
   kolom di sheet sumber berubah, selama nama headernya tidak diganti:
     IDPEL, DAYA, UPDATE_STATUS  -> "Periksa - Sesuai" = normal; "Temuan - K1/K2/P1/P2/P3/P4" = pelanggaran
     KWH_TS          -> kWh tagihan susulan (hanya terisi kalau ada temuan)
     WAKTU_PERIKSA   -> format "YYYY-MM-DD HH:MM:SS +07:00", dipakai utk clock-in/out per hari
     REGU
     DURASI_PERIKSA  -> menit, dipakai utk rata-rata waktu periksa per pelanggan
   Kalau nama kolom di sheet sumber berganti nama, sesuaikan PERIKSA_HEADER_NAMES di bawah. */
const PERIKSA_HEADER_NAMES = {
  idpel: 'IDPEL', daya: 'DAYA', updateStatus: 'UPDATE_STATUS',
  kwhTs: 'KWH_TS', waktu: 'WAKTU_PERIKSA', regu: 'REGU', durasi: 'DURASI_PERIKSA'
};
const PERIKSA_KATEGORI = ['K1','K2','K3','K4','P1','P2','P3','P4'];

// Parser CSV delimiter "," yang menghormati tanda kutip. Baris pertama SELALU dianggap
// header berisi nama kolom (dicocokkan ke PERIKSA_HEADER_NAMES di atas oleh periksaParseRaw()).
function periksaParseCsvText(text){
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
// Cari index kolom berdasarkan nama header persis (case-insensitive).
function periksaFindColIndex(headerRow, name){
  const idx = headerRow.findIndex(h => String(h).trim().toUpperCase() === name.toUpperCase());
  return idx === -1 ? null : idx;
}
// Parsing WAKTU_PERIKSA format "YYYY-MM-DD HH:MM:SS +07:00" — ada SPASI sebelum offset
// zona waktu, yang membuat `new Date()` bawaan gagal (Invalid Date) kalau cuma spasi
// pertama yang diganti 'T'. Di sini spasi sebelum offset (+07:00 / -07:00) dibuang dulu,
// baru spasi pemisah tanggal-jam diganti 'T'.
function periksaParseWaktu(raw){
  if(!raw) return null;
  let s = String(raw).trim();
  if(!s) return null;
  s = s.replace(/ (?=[+-]\d{2}:\d{2}$)/, ''); // buang spasi sebelum offset timezone
  s = s.replace(' ', 'T');                    // pemisah tanggal & jam -> ISO
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function periksaNum(s){
  if(s==null) return 0;
  const v = parseFloat(String(s).trim().replace(',', '.'));
  return isNaN(v) ? 0 : v;
}
// Label REGU lebih ringkas: buang kode unit di depan titik, ganti underscore jadi spasi.
function periksaReguLabel(regu){
  if(!regu || regu === '000000000000') return 'TIDAK TERIDENTIFIKASI';
  const afterDot = regu.includes('.') ? regu.split('.').slice(1).join('.') : regu;
  return afterDot.replace(/_/g,' ');
}
function periksaKategori(status){
  const m = /^Temuan\s*-\s*(\w+)/i.exec(status||'');
  return m ? m[1].toUpperCase() : null;
}

let periksaData = [];

function periksaParseRaw(text){
  const rows = periksaParseCsvText(text);
  if(!rows.length) return [];

  // Baris pertama = header nama kolom. Bangun peta index dinamis dari situ, supaya
  // tetap bekerja walau urutan kolom sheet sumber berubah.
  const headerRow = rows[0];
  const col = {};
  for(const key in PERIKSA_HEADER_NAMES){
    col[key] = periksaFindColIndex(headerRow, PERIKSA_HEADER_NAMES[key]);
  }

  const data = [];
  for(let i=1;i<rows.length;i++){
    const r = rows[i];
    const idpel = (r[col.idpel]||'').trim();
    if(!idpel || !/^\d+$/.test(idpel)) continue; // lewati baris kosong/rusak (IDPEL selalu angka)
    const status = (r[col.updateStatus]||'').trim();
    data.push({
      idpel,
      daya: periksaNum(r[col.daya]),
      status,
      kategori: periksaKategori(status), // null = normal
      kwhTs: periksaNum(r[col.kwhTs]),
      waktu: periksaParseWaktu(r[col.waktu]),
      regu: (r[col.regu]||'').trim(),
      durasi: periksaNum(r[col.durasi])
    });
  }
  return data;
}

function periksaSummarize(rows){
  const total = rows.length;
  const normal = rows.filter(d=>!d.kategori).length;
  const temuan = total - normal;
  const kwhTs = rows.filter(d=>d.kategori).reduce((s,d)=>s+d.kwhTs,0);
  const kat = {};
  PERIKSA_KATEGORI.forEach(k=> kat[k] = rows.filter(d=>d.kategori===k).length);
  return { total, normal, temuan, kwhTs, kat };
}

function periksaRender(text){
  const data = periksaParseRaw(text);
  if(!data.length){ setStatus('periksa_status', false, 'Tidak ada baris pemeriksaan yang terbaca. Pastikan link mengarah ke export CSV "Realisasi P2TL" apa adanya.'); return; }
  periksaData = data;

  const overall = periksaSummarize(data);
  const rataDurasiAll = data.length ? data.reduce((s,d)=>s+d.durasi,0)/data.length : 0;

  document.getElementById('periksa_kpi').innerHTML = `
    <div class="icon-kpi"><div class="circle navy">🔍</div><div><div class="ik-label">Total diperiksa</div><div class="ik-value">${overall.total.toLocaleString('id-ID')} <small>IDPEL</small></div></div></div>
    <div class="icon-kpi"><div class="circle green">✓</div><div><div class="ik-label">Normal</div><div class="ik-value">${overall.normal.toLocaleString('id-ID')} <small>(${(overall.normal/overall.total*100).toFixed(1)}%)</small></div></div></div>
    <div class="icon-kpi"><div class="circle red">⚠</div><div><div class="ik-label">Temuan</div><div class="ik-value">${overall.temuan.toLocaleString('id-ID')} <small>(${(overall.temuan/overall.total*100).toFixed(1)}%)</small></div></div></div>
    <div class="icon-kpi"><div class="circle amber">⚡</div><div><div class="ik-label">Total kWh TS (temuan)</div><div class="ik-value">${overall.kwhTs.toLocaleString('id-ID')} <small>kWh</small></div></div></div>
    <div class="icon-kpi"><div class="circle purple">⏱</div><div><div class="ik-label">Rata-rata durasi periksa</div><div class="ik-value">${rataDurasiAll.toFixed(1)} <small>menit</small></div></div></div>`;

  /* ---- 1. Realisasi per REGU ---- */
  const regus = [...new Set(data.map(d=>d.regu))].sort((a,b)=> periksaReguLabel(a).localeCompare(periksaReguLabel(b)));
  document.getElementById('periksa_table_regu').innerHTML = regus.map(regu=>{
    const rows = data.filter(d=>d.regu===regu);
    const s = periksaSummarize(rows);
    return `<tr><td style="font-weight:700;">${periksaReguLabel(regu)}</td><td>${s.total.toLocaleString('id-ID')}</td><td>${s.normal.toLocaleString('id-ID')}</td>` +
      PERIKSA_KATEGORI.map(k=> `<td>${s.kat[k] || '-'}</td>`).join('') +
      `<td><span class="pill ${s.kwhTs>0?'bad':'good'}">${s.kwhTs.toLocaleString('id-ID')} kWh</span></td></tr>`;
  }).join('');

  /* ---- 2. Realisasi per DAYA ---- */
  const dayas = [...new Set(data.map(d=>d.daya))].sort((a,b)=>a-b);
  document.getElementById('periksa_table_daya').innerHTML = dayas.map(daya=>{
    const rows = data.filter(d=>d.daya===daya);
    const s = periksaSummarize(rows);
    return `<tr><td style="font-weight:700;">${daya.toLocaleString('id-ID')} VA</td><td>${s.total.toLocaleString('id-ID')}</td>` +
      `<td><span class="pill good">${s.normal.toLocaleString('id-ID')}</span></td>` +
      `<td><span class="pill ${s.temuan>0?'bad':'good'}">${s.temuan.toLocaleString('id-ID')}</span></td>` +
      `<td>${s.kwhTs.toLocaleString('id-ID')} kWh</td>` +
      `<td style="font-size:11px;">${PERIKSA_KATEGORI.filter(k=>s.kat[k]).map(k=>`${k}:${s.kat[k]}`).join(', ') || '-'}</td></tr>`;
  }).join('');

  /* ---- 3. Clock-in / clock-out per REGU per hari (kolom V = WAKTU_PERIKSA) ----
     Ditampilkan sebagai tabel PIVOT: satu baris per REGU, kolom TANGGAL bergeser
     ke kanan (scroll horizontal), dan tiap tanggal punya 2 sub-kolom: In / Out. */
  const withWaktu = data.filter(d=>d.waktu && !isNaN(d.waktu));
  const dayKey = (d)=> d.waktu.toISOString().slice(0,10);
  const fmtJam = (dt)=> dt.toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});

  const clockDates = [...new Set(withWaktu.map(d=>dayKey(d)))].sort();
  const clockRegus = [...new Set(withWaktu.map(d=>d.regu))].sort((a,b)=> periksaReguLabel(a).localeCompare(periksaReguLabel(b)));

  const clockMap = {};
  clockRegus.forEach(regu=>{
    clockMap[regu] = {};
    clockDates.forEach(tgl=>{
      const rows = withWaktu.filter(d=> d.regu===regu && dayKey(d)===tgl).sort((a,b)=>a.waktu-b.waktu);
      if(rows.length){
        const first = rows[0].waktu, last = rows[rows.length-1].waktu;
        clockMap[regu][tgl] = {
          in: fmtJam(first), out: fmtJam(last),
          inMin: first.getHours()*60 + first.getMinutes(),
          outMin: last.getHours()*60 + last.getMinutes()
        };
      }
    });
  });

  const clockThead = '<thead>' +
      '<tr><th rowspan="2" style="vertical-align:middle;position:sticky;left:0;background:#0d2a4a;color:#fff;">Regu</th>' +
        clockDates.map(tgl=>`<th colspan="2" style="text-align:center;">${tgl}</th>`).join('') +
      '</tr>' +
      '<tr>' + clockDates.map(()=>'<th style="text-align:center;">In</th><th style="text-align:center;">Out</th>').join('') + '</tr>' +
    '</thead>';

  const clockTbody = '<tbody>' + clockRegus.map(regu=>{
    const cells = clockDates.map(tgl=>{
      const c = clockMap[regu][tgl];
      return c
        ? `<td style="text-align:center;">${c.in}</td><td style="text-align:center;">${c.out}</td>`
        : `<td style="text-align:center;color:#c7ccd4;">-</td><td style="text-align:center;color:#c7ccd4;">-</td>`;
    }).join('');
    return `<tr><td style="font-weight:700;white-space:nowrap;position:sticky;left:0;background:#fff;">${periksaReguLabel(regu)}</td>${cells}</tr>`;
  }).join('') + '</tbody>';

  document.getElementById('periksa_clock_table').innerHTML = clockThead + clockTbody;

  /* ---- Highlight: regu paling awal/telat masuk & paling awal/akhir pulang ----
     Dihitung dari rata-rata jam masuk (inMin) & jam pulang (outMin) per regu
     across semua hari yang ada datanya, lalu diambil nilai ekstremnya. */
  const minToTime = (min)=>{
    const h = Math.floor(min/60), m = Math.round(min%60);
    return String(h).padStart(2,'0') + '.' + String(m).padStart(2,'0');
  };
  const reguAvg = clockRegus.map(regu=>{
    const days = clockDates.filter(tgl=> clockMap[regu][tgl]);
    const insMin = days.map(tgl=> clockMap[regu][tgl].inMin);
    const outsMin = days.map(tgl=> clockMap[regu][tgl].outMin);
    return {
      regu,
      avgIn: insMin.reduce((a,b)=>a+b,0)/insMin.length,
      avgOut: outsMin.reduce((a,b)=>a+b,0)/outsMin.length
    };
  });

  if(reguAvg.length){
    const palingAwalMasuk = reguAvg.reduce((a,b)=> b.avgIn < a.avgIn ? b : a);
    const palingTelatMasuk = reguAvg.reduce((a,b)=> b.avgIn > a.avgIn ? b : a);
    const palingAkhirPulang = reguAvg.reduce((a,b)=> b.avgOut > a.avgOut ? b : a);
    const palingAwalPulang = reguAvg.reduce((a,b)=> b.avgOut < a.avgOut ? b : a);

    document.getElementById('periksa_top_highlight').innerHTML = `
      <div class="icon-kpi"><div class="circle green">🌅</div><div><div class="ik-label">Regu paling awal masuk (rata-rata)</div><div class="ik-value" style="font-size:15px;">${periksaReguLabel(palingAwalMasuk.regu)}</div><div class="ik-sub">${minToTime(palingAwalMasuk.avgIn)}</div></div></div>
      <div class="icon-kpi"><div class="circle red">⏰</div><div><div class="ik-label">Regu paling telat masuk (rata-rata)</div><div class="ik-value" style="font-size:15px;">${periksaReguLabel(palingTelatMasuk.regu)}</div><div class="ik-sub">${minToTime(palingTelatMasuk.avgIn)}</div></div></div>
      <div class="icon-kpi"><div class="circle navy">🌙</div><div><div class="ik-label">Regu paling akhir pulang (rata-rata)</div><div class="ik-value" style="font-size:15px;">${periksaReguLabel(palingAkhirPulang.regu)}</div><div class="ik-sub">${minToTime(palingAkhirPulang.avgOut)}</div></div></div>
      <div class="icon-kpi"><div class="circle amber">🏃</div><div><div class="ik-label">Regu paling awal pulang (rata-rata)</div><div class="ik-value" style="font-size:15px;">${periksaReguLabel(palingAwalPulang.regu)}</div><div class="ik-sub">${minToTime(palingAwalPulang.avgOut)}</div></div></div>`;
  } else {
    document.getElementById('periksa_top_highlight').innerHTML = '';
  }

  /* ---- 4. Rata-rata durasi pemeriksaan per pelanggan per REGU ---- */
  document.getElementById('periksa_table_durasi').innerHTML = regus.map(regu=>{
    const rows = data.filter(d=>d.regu===regu);
    const rata = rows.length ? rows.reduce((s,d)=>s+d.durasi,0)/rows.length : 0;
    const median = (()=>{ const v=[...rows.map(d=>d.durasi)].sort((a,b)=>a-b); const n=v.length; if(!n) return 0; return n%2 ? v[(n-1)/2] : (v[n/2-1]+v[n/2])/2; })();
    return `<tr><td style="font-weight:700;">${periksaReguLabel(regu)}</td><td>${rows.length.toLocaleString('id-ID')}</td><td>${rata.toFixed(1)} menit</td><td>${median.toFixed(1)} menit</td></tr>`;
  }).join('');

  document.getElementById('periksa_dash').style.display = 'block';
  document.getElementById('periksa_empty').style.display = 'none';
  setStatus('periksa_status', true, 'Data berhasil dimuat (' + data.length.toLocaleString('id-ID') + ' baris pemeriksaan, ' + regus.length + ' regu).');
}

async function periksaLoad(){
  const url = document.getElementById('periksa_url').value.trim();
  if(!url){ setStatus('periksa_status', false, 'Masukkan link CSV terlebih dahulu.'); return; }
  setStatus('periksa_status', true, 'Memuat data...');
  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    periksaRender(await res.text());
  } catch(e){ setStatus('periksa_status', false, 'Gagal memuat: ' + e.message); }
}

function periksaSample(){
  const rows = [
    {no:1, idpel:'515010156590', daya:'1300', status:'Periksa - Sesuai', kwhts:'0', waktu:'2026-07-01 08:15:00 +07:00', regu:'51501.ULP_MADIUN_KOTA_REGU_1', durasi:15},
    {no:2, idpel:'515010156591', daya:'900',  status:'Temuan - K2',      kwhts:'440', waktu:'2026-07-01 09:05:00 +07:00', regu:'51501.ULP_MADIUN_KOTA_REGU_1', durasi:42},
    {no:3, idpel:'515010156592', daya:'450',  status:'Periksa - Sesuai', kwhts:'0', waktu:'2026-07-01 14:40:00 +07:00', regu:'51501.ULP_MADIUN_KOTA_REGU_1', durasi:8},
    {no:4, idpel:'515030156593', daya:'2200', status:'Temuan - P4',      kwhts:'2479', waktu:'2026-07-01 10:20:00 +07:00', regu:'51503.ULP_MAGETAN_REGU_1', durasi:30},
    {no:5, idpel:'515030156594', daya:'900',  status:'Periksa - Sesuai', kwhts:'0', waktu:'2026-07-01 15:10:00 +07:00', regu:'51503.ULP_MAGETAN_REGU_1', durasi:20},
  ];
  const header = ['NO','ID_P2TL','IDPEL','DAYA','UPDATE_STATUS','KWH_TS','WAKTU_PERIKSA','REGU','DURASI_PERIKSA'];
  const lines = [header.join(',')];
  rows.forEach(r=>{
    lines.push([r.no, '', r.idpel, r.daya, r.status, r.kwhts, r.waktu, r.regu, r.durasi].join(','));
  });
  periksaRender(lines.join('\n'));
}