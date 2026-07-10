/* ================= TAB 6: PROGNOSA SUSUT ================= */
/* Perubahan dari versi sebelumnya:
   1. KWh Jual dipecah jadi 3: Prabayar, Paskabayar, P2TL.
   2. Bulan berjalan diinput lewat 3 checkpoint: Hari ke-10, ke-20, ke-28 (tabel terpisah).
   3. Ditambahkan narasi: rata-rata pemakaian harian, selisih vs bulan lalu, % kenaikan/penurunan.
   4. Aturan prognosa: data s.d. H-23 ke bawah -> metode "Forecast Tren" (ekstrapolasi antar checkpoint).
      Data di atas H-23 -> metode "Rata-rata Harian" (rata2 harian x jumlah hari sebulan).
   Elemen HTML baru yang perlu ditambahkan (lihat catatan di bagian bawah file):
     - input url kedua: #prog_ckp_url (CSV checkpoint bulan berjalan)
     - tabel checkpoint: #prog_table_checkpoint (tbody)
     - (opsional) canvas: #prog_chart3 (grafik rata-rata harian per checkpoint)
*/

const BULAN_ID_SHORT = ['JAN','FEB','MAR','APR','MEI','JUN','JUL','AGU','SEP','OKT','NOV','DES'];
const BULAN_ID_LONG  = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];

function progParsePeriode(str){
  if(!str) return null;
  const s = String(str).trim();
  let m = s.match(/^(\d{4})[-\/](\d{1,2})$/);
  if(m) return { year:+m[1], month:+m[2] };
  m = s.match(/(\d{4})/);
  const year = m ? +m[1] : new Date().getFullYear();
  const upper = s.toUpperCase();
  for(let i=0;i<12;i++){
    if(upper.includes(BULAN_ID_LONG[i]) || upper.includes(BULAN_ID_SHORT[i])) return { year, month:i+1 };
  }
  const d = new Date(s);
  if(!isNaN(d)) return { year:d.getFullYear(), month:d.getMonth()+1 };
  return null;
}

function progDaysInMonth(periodeStr){
  const p = progParsePeriode(periodeStr);
  if(!p) return 30;
  return new Date(p.year, p.month, 0).getDate();
}

function progRender(mainRows, checkpointRows){
  checkpointRows = checkpointRows || [];
  if(!mainRows || !mainRows[0]){ setStatus('prog_status', false, 'Data historis kosong.'); return; }

  const pKey = findKey(mainRows[0], ['periode','bulan']);
  const prodKey = findKey(mainRows[0], ['produksi']);
  const preKey = findKey(mainRows[0], ['prabayar']);
  const pascaKey = findKey(mainRows[0], ['paskabayar','pascabayar','pasca']);
  const p2tlKey = findKey(mainRows[0], ['p2tl']);
  const jualKey = findKey(mainRows[0], ['jual']); // fallback data lama (satu kolom jual saja)
  const susutKey = findKey(mainRows[0], ['susut']);
  const statusKey = findKey(mainRows[0], ['status']);

  if(!pKey || !prodKey){ setStatus('prog_status', false, 'Kolom Periode/Produksi tidak ditemukan.'); return; }
  if(!preKey && !pascaKey && !p2tlKey && !jualKey){ setStatus('prog_status', false, 'Kolom KWh Jual (Prabayar/Paskabayar/P2TL) tidak ditemukan.'); return; }

  const data = mainRows.map(r=>{
    const prabayar = preKey ? num(r[preKey]) : (jualKey ? num(r[jualKey]) : 0);
    const paskabayar = pascaKey ? num(r[pascaKey]) : 0;
    const p2tl = p2tlKey ? num(r[p2tlKey]) : 0;
    const jualTotal = prabayar + paskabayar + p2tl;
    const produksi = num(r[prodKey]);
    const susut = susutKey ? num(r[susutKey]) : (produksi ? (produksi - jualTotal) / produksi * 100 : 0);
    return {
      periode: r[pKey], produksi, prabayar, paskabayar, p2tl, jualTotal, susut,
      status: statusKey ? (r[statusKey] || 'Realisasi') : 'Realisasi',
      isForecastRow: false
    };
  }).filter(d=>d.periode);

  const isProg = (d)=>(d.status||'').toLowerCase().includes('prog');

  // ---------- Proses checkpoint bulan berjalan (H-10 / H-20 / H-28) ----------
  let runningRow = null, checkpointCalc = [], methodLabel = '';
  let avgDailyThis = 0, avgDailyPrev = 0, selisihHarian = 0, pctHarian = 0, hariKeLatest = 0, runningPeriode = '';

  if(checkpointRows.length){
    const cPeriodeKey = findKey(checkpointRows[0], ['periode','bulan']);
    const hariKey = findKey(checkpointRows[0], ['hari','tanggal']);
    const cProdKey = findKey(checkpointRows[0], ['produksi']);
    const cPreKey = findKey(checkpointRows[0], ['prabayar']);
    const cPascaKey = findKey(checkpointRows[0], ['paskabayar','pascabayar','pasca']);
    const cP2tlKey = findKey(checkpointRows[0], ['p2tl']);

    const cData = checkpointRows.map(r=>{
      const prabayar = cPreKey ? num(r[cPreKey]) : 0;
      const paskabayar = cPascaKey ? num(r[cPascaKey]) : 0;
      const p2tl = cP2tlKey ? num(r[cP2tlKey]) : 0;
      return {
        periode: cPeriodeKey ? r[cPeriodeKey] : '',
        hari: hariKey ? num(r[hariKey]) : 0,
        produksi: cProdKey ? num(r[cProdKey]) : 0,
        prabayar, paskabayar, p2tl,
        jualTotal: prabayar + paskabayar + p2tl
      };
    }).filter(d=>d.hari>0).sort((a,b)=>a.hari-b.hari);

    if(cData.length){
      const latest = cData[cData.length-1];
      hariKeLatest = latest.hari;
      runningPeriode = latest.periode || '';
      avgDailyThis = latest.jualTotal / latest.hari;
      const avgDailyProdThis = latest.produksi / latest.hari;

      // bulan lalu = baris terakhir pada data historis (bulan yang sudah closed)
      const prevMonthRow = data[data.length-1];
      const daysPrevMonth = prevMonthRow ? progDaysInMonth(prevMonthRow.periode) : 30;
      avgDailyPrev = prevMonthRow ? prevMonthRow.jualTotal / daysPrevMonth : 0;

      selisihHarian = avgDailyThis - avgDailyPrev;
      pctHarian = avgDailyPrev ? (selisihHarian / avgDailyPrev * 100) : 0;

      const daysThisMonth = runningPeriode ? progDaysInMonth(runningPeriode) : 30;
      const useTrend = hariKeLatest <= 23; // aturan: s.d. tgl 23 pakai forecast tren, di atasnya pakai rata2 harian
      methodLabel = useTrend ? 'Forecast Tren' : 'Rata-rata Harian';

      let jualForecastTotal, prodForecastTotal;
      if(useTrend && cData.length >= 2){
        const first = cData[0];
        const rateJual = (latest.jualTotal - first.jualTotal) / (latest.hari - first.hari);
        const rateProd = (latest.produksi - first.produksi) / (latest.hari - first.hari);
        jualForecastTotal = latest.jualTotal + rateJual * (daysThisMonth - latest.hari);
        prodForecastTotal = latest.produksi + rateProd * (daysThisMonth - latest.hari);
      } else {
        jualForecastTotal = avgDailyThis * daysThisMonth;
        prodForecastTotal = avgDailyProdThis * daysThisMonth;
      }

      // pecah kembali forecast jual total ke 3 kategori mengikuti proporsi checkpoint terakhir
      const shareP = latest.jualTotal ? latest.prabayar / latest.jualTotal : 0;
      const shareA = latest.jualTotal ? latest.paskabayar / latest.jualTotal : 0;
      const shareT = latest.jualTotal ? latest.p2tl / latest.jualTotal : 0;
      const susutForecast = prodForecastTotal ? (prodForecastTotal - jualForecastTotal) / prodForecastTotal * 100 : 0;

      runningRow = {
        periode: runningPeriode,
        produksi: prodForecastTotal,
        prabayar: jualForecastTotal * shareP,
        paskabayar: jualForecastTotal * shareA,
        p2tl: jualForecastTotal * shareT,
        jualTotal: jualForecastTotal,
        susut: susutForecast,
        status: 'Prognosa',
        isForecastRow: true
      };

      checkpointCalc = cData.map(d=>({
        ...d,
        rataHarian: d.jualTotal / d.hari,
        susutSementara: d.produksi ? (d.produksi - d.jualTotal) / d.produksi * 100 : 0
      }));
    }
  }

  const fullData = runningRow ? [...data, runningRow] : data;
  const last = fullData[fullData.length-1];
  const prev = fullData[fullData.length-2];
  const prognosaRows = fullData.filter(d=>isProg(d));
  const susutDiff = prev ? (last.susut - prev.susut) : 0;

  document.getElementById('prog_period').textContent = `${(last.periode||'').toString().toUpperCase()} — STATUS ${(last.status||'').toUpperCase()}`;

  document.getElementById('prog_kpi').innerHTML = `
    <div class="icon-kpi"><div class="circle navy">⚡</div><div><div class="ik-label">KWh produksi (${last.periode})</div><div class="ik-value">${(last.produksi/1e6).toFixed(2)} <small>GWh</small></div></div></div>
    <div class="icon-kpi"><div class="circle teal">🛒</div><div><div class="ik-label">KWh jual total (${last.periode})</div><div class="ik-value">${(last.jualTotal/1e6).toFixed(2)} <small>GWh</small></div><div class="ik-sub">Prabayar ${(last.prabayar/1e6).toFixed(2)} • Paskabayar ${(last.paskabayar/1e6).toFixed(2)} • P2TL ${(last.p2tl/1e6).toFixed(2)} GWh</div></div></div>
    <div class="icon-kpi"><div class="circle ${last.susut<=8?'green':'amber'}">📉</div><div><div class="ik-label">Susut (${last.periode})</div><div class="ik-value">${last.susut.toFixed(2)}<small>%</small></div></div></div>
    <div class="icon-kpi"><div class="circle ${susutDiff<=0?'green':'amber'}">${susutDiff<=0?'⬇':'⬆'}</div><div><div class="ik-label">Perubahan susut vs bln lalu</div><div class="ik-value">${susutDiff>=0?'+':''}${susutDiff.toFixed(2)} <small>poin</small></div></div></div>
    <div class="icon-kpi"><div class="circle purple">📋</div><div><div class="ik-label">Bulan berstatus prognosa</div><div class="ik-value">${prognosaRows.length} <small>bulan</small></div></div></div>
    ${runningRow ? `
    <div class="icon-kpi"><div class="circle blue">📆</div><div><div class="ik-label">Rata-rata pemakaian harian (H-${hariKeLatest})</div><div class="ik-value">${(avgDailyThis/1e3).toFixed(1)} <small>MWh/hari</small></div><div class="ik-sub">Bln lalu ${(avgDailyPrev/1e3).toFixed(1)} MWh/hari • Selisih ${selisihHarian>=0?'+':''}${(selisihHarian/1e3).toFixed(1)} MWh (${pctHarian>=0?'+':''}${pctHarian.toFixed(1)}%)</div></div></div>
    <div class="icon-kpi"><div class="circle ${hariKeLatest<=23?'amber':'navy'}">🧮</div><div><div class="ik-label">Metode prognosa dipakai</div><div class="ik-value" style="font-size:16px">${methodLabel}</div><div class="ik-sub">Data s.d. H-${hariKeLatest} (${hariKeLatest<=23?'≤ tgl 23':'> tgl 23'})</div></div></div>` : ''}`;

  // ---------- Tabel historis + prognosa bulan berjalan ----------
  document.getElementById('prog_table').innerHTML = fullData.map(d=>{
    const kwhSusut = d.produksi - d.jualTotal;
    return `<tr${d.isForecastRow ? ' class="row-forecast"' : ''}><td>${d.periode}</td><td><span class="pill ${isProg(d)?'bad':'good'}">${d.status}</span></td><td>${Math.round(d.produksi).toLocaleString('id-ID')}</td><td>${Math.round(d.prabayar).toLocaleString('id-ID')}</td><td>${Math.round(d.paskabayar).toLocaleString('id-ID')}</td><td>${Math.round(d.p2tl).toLocaleString('id-ID')}</td><td>${Math.round(d.jualTotal).toLocaleString('id-ID')}</td><td>${Math.round(kwhSusut).toLocaleString('id-ID')}</td><td>${d.susut.toFixed(2)}%</td></tr>`;
  }).join('');

  // ---------- Tabel checkpoint bulan berjalan (H-10 / H-20 / H-28) ----------
  const ckTblEl = document.getElementById('prog_table_checkpoint');
  if(ckTblEl){
    ckTblEl.innerHTML = checkpointCalc.length ? checkpointCalc.map(d=>{
      const kwhSusutSementara = d.produksi - d.jualTotal;
      return `<tr><td>Hari ke-${d.hari}</td><td>${Math.round(d.produksi).toLocaleString('id-ID')}</td><td>${Math.round(d.prabayar).toLocaleString('id-ID')}</td><td>${Math.round(d.paskabayar).toLocaleString('id-ID')}</td><td>${Math.round(d.p2tl).toLocaleString('id-ID')}</td><td>${Math.round(d.jualTotal).toLocaleString('id-ID')}</td><td>${Math.round(kwhSusutSementara).toLocaleString('id-ID')}</td><td>${(d.rataHarian/1e3).toFixed(1)} MWh</td><td>${d.susutSementara.toFixed(2)}%</td></tr>`;
    }).join('') : `<tr><td colspan="9" style="text-align:center;color:#999">Belum ada data checkpoint bulan berjalan</td></tr>`;
  }

  // ---------- Chart 1: Produksi vs Jual (stacked breakdown) ----------
  destroyChart('prog_chart1');
  charts['prog_chart1'] = new Chart(document.getElementById('prog_chart1'), {
    type:'bar',
    data:{ labels: fullData.map(d=>d.periode), datasets:[
      { label:'KWh Produksi', data: fullData.map(d=>d.produksi/1e6), backgroundColor: fullData.map(d=>isProg(d)?'#9fc4e8':'#1f6fc6'), borderRadius:5, maxBarThickness:26, stack:'produksi' },
      { label:'Jual Prabayar', data: fullData.map(d=>d.prabayar/1e6), backgroundColor:'#1c8a4a', maxBarThickness:26, stack:'jual' },
      { label:'Jual Paskabayar', data: fullData.map(d=>d.paskabayar/1e6), backgroundColor:'#3fae6c', maxBarThickness:26, stack:'jual' },
      { label:'Jual P2TL', data: fullData.map(d=>d.p2tl/1e6), backgroundColor:'#f2a93b', maxBarThickness:26, stack:'jual' }
    ]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10}}}}, scales:{ x:{stacked:true}, y:{stacked:true, title:{display:true,text:'GWh'}} } }
  });

  // ---------- Chart 2: Tren susut (realisasi vs prognosa) ----------
  destroyChart('prog_chart2');
  charts['prog_chart2'] = new Chart(document.getElementById('prog_chart2'), {
    type:'line', data:{ labels:fullData.map(d=>d.periode), datasets:[
      {label:'Susut %', data:fullData.map(d=>d.susut),
        segment:{ borderColor: ctx => isProg(fullData[ctx.p1DataIndex]) ? '#d23b3b' : '#1c8a4a', borderDash: ctx => isProg(fullData[ctx.p1DataIndex]) ? [6,4] : [] },
        pointBackgroundColor: fullData.map(d=>isProg(d)?'#d23b3b':'#1c8a4a'),
        borderColor:'#1c8a4a', pointRadius:5, tension:0.25 }]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{ticks:{callback:v=>v+'%'}}} }
  });
  document.getElementById('prog_trend_caption').innerHTML = `Garis hijau = realisasi (sudah fix), garis putus-putus merah = prognosa (bulan berjalan, masih dapat berubah). Susut ${last.periode}: <b>${last.susut.toFixed(2)}%</b>${prev?` (${susutDiff<=0?'membaik':'memburuk'} ${Math.abs(susutDiff).toFixed(2)} poin dari ${prev.periode})`:''}.`;

  // ---------- Chart 3 (opsional): rata-rata harian per checkpoint vs bulan lalu ----------
  const ck3El = document.getElementById('prog_chart3');
  if(ck3El && checkpointCalc.length){
    destroyChart('prog_chart3');
    charts['prog_chart3'] = new Chart(ck3El, {
      type:'line',
      data:{ labels: checkpointCalc.map(d=>'H-'+d.hari), datasets:[
        { label:'Rata-rata harian bulan ini (MWh)', data: checkpointCalc.map(d=>d.rataHarian/1e3), borderColor:'#1f6fc6', backgroundColor:'#1f6fc6', pointRadius:5, tension:0.25 },
        { label:'Rata-rata harian bulan lalu (MWh)', data: checkpointCalc.map(_=>avgDailyPrev/1e3), borderColor:'#d23b3b', borderDash:[6,4], pointRadius:0 }
      ]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{boxWidth:10, font:{size:10}}}} }
    });
  }

  // ---------- Narasi / insight ----------
  document.getElementById('prog_insight').innerHTML = `
    <div class="ki-point"><b>Status terkini:</b> ${last.periode} berstatus <b>${last.status}</b> dengan susut ${last.susut.toFixed(2)}%, KWh produksi ${(last.produksi/1e6).toFixed(2)} GWh dan KWh jual total ${(last.jualTotal/1e6).toFixed(2)} GWh (Prabayar ${(last.prabayar/1e6).toFixed(2)} GWh, Paskabayar ${(last.paskabayar/1e6).toFixed(2)} GWh, P2TL ${(last.p2tl/1e6).toFixed(2)} GWh).</div>
    <div class="ki-point"><b>Arah tren:</b> Susut ${susutDiff<=0?'membaik (menurun)':'memburuk (meningkat)'} ${Math.abs(susutDiff).toFixed(2)} poin dibanding bulan sebelumnya.</div>
    ${runningRow ? `
    <div class="ki-point"><b>Rata-rata pemakaian harian:</b> ${(avgDailyThis/1e3).toFixed(1)} MWh/hari sampai dengan H-${hariKeLatest}, dibanding ${(avgDailyPrev/1e3).toFixed(1)} MWh/hari bulan lalu — selisih ${selisihHarian>=0?'+':''}${(selisihHarian/1e3).toFixed(1)} MWh/hari atau ${pctHarian>=0?'+':''}${pctHarian.toFixed(1)}% (${pctHarian>=0?'naik':'turun'} dibanding bulan lalu).</div>
    <div class="ki-point"><b>Metode prognosa:</b> Karena data terbaru berada di H-${hariKeLatest} (${hariKeLatest<=23?'≤ tanggal 23':'> tanggal 23'}), prognosa bulan berjalan dihitung menggunakan <b>${methodLabel}</b>${hariKeLatest<=23?' — ekstrapolasi tren antar checkpoint yang sudah tersedia.':' — rata-rata pemakaian harian dikalikan jumlah hari sebulan.'}</div>` : ''}
    <div class="ki-point"><b>Status prognosa:</b> ${prognosaRows.length} bulan masih berstatus prognosa dan berpotensi berubah saat data final masuk.</div>
    <div class="ki-point"><b>Fokus tindak lanjut:</b> Pantau gap antara kWh produksi dan kWh jual (Prabayar/Paskabayar/P2TL) untuk deteksi dini potensi kenaikan susut.</div>`;

  showDash('prog');
  setStatus('prog_status', true, 'Data berhasil dimuat (garis putus-putus merah = bulan prognosa).');
}

async function progLoad(){
  const url = document.getElementById('prog_url').value.trim();
  const url2El = document.getElementById('prog_ckp_url');
  const url2 = url2El ? url2El.value.trim() : '';
  if(!url){ setStatus('prog_status', false, 'Masukkan link CSV data historis terlebih dahulu.'); return; }
  setStatus('prog_status', true, 'Memuat data...');
  try{
    const mainRows = await fetchCSV(url);
    const checkpointRows = url2 ? await fetchCSV(url2) : [];
    progRender(mainRows, checkpointRows);
  } catch(e){ setStatus('prog_status', false, 'Gagal memuat: ' + e.message); }
}

function progSample(){
  const mainRows = [
    {Periode:'2026-01', Status:'Realisasi', KWh_Produksi:'145200000', KWh_Prabayar:'118000000', KWh_Paskabayar:'15300000', KWh_P2TL:'2500000'},
    {Periode:'2026-02', Status:'Realisasi', KWh_Produksi:'148629313', KWh_Prabayar:'120100000', KWh_Paskabayar:'15600000', KWh_P2TL:'2435640'},
    {Periode:'2026-03', Status:'Realisasi', KWh_Produksi:'150810000', KWh_Prabayar:'121900000', KWh_Paskabayar:'15900000', KWh_P2TL:'2600000'},
    {Periode:'2026-04', Status:'Realisasi', KWh_Produksi:'151200000', KWh_Prabayar:'122800000', KWh_Paskabayar:'16100000', KWh_P2TL:'2600000'},
    {Periode:'2026-05', Status:'Realisasi', KWh_Produksi:'165662901', KWh_Prabayar:'132000000', KWh_Paskabayar:'17565655', KWh_P2TL:'2800000'},
  ];
  const checkpointRows = [
    {Periode:'2026-06', Hari:'10', KWh_Produksi:'54000000',  KWh_Prabayar:'43500000', KWh_Paskabayar:'5700000',  KWh_P2TL:'900000'},
    {Periode:'2026-06', Hari:'20', KWh_Produksi:'109500000', KWh_Prabayar:'88200000', KWh_Paskabayar:'11500000', KWh_P2TL:'1820000'},
    {Periode:'2026-06', Hari:'28', KWh_Produksi:'153800000', KWh_Prabayar:'123900000', KWh_Paskabayar:'16150000', KWh_P2TL:'2550000'},
  ];
  progRender(mainRows, checkpointRows);
}
