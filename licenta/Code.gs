/* VerTech – server de licențe (Google Apps Script, lipit într-un Google Sheet NOU, doar al tău).
   Foile „Licente” și „Jurnal” se creează singure. Administrarea se face din aplicația „VerTech Admin”. */
var FOAIA = 'Licente', JURNAL = 'Jurnal';
/* PAROLA de administrare. SCHIMB-O înainte de folosire! */
var PAROLA = 'schimba-ma';

var ANTET = ['Cod', 'Nume', 'Activ', 'Expiră', 'Max dispozitive', 'Dispozitive', 'Ultima verificare', 'Verificări', 'Notă', 'Creată', 'Ultima platformă', 'Ultima versiune'];

function foaie_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ss.getSheetByName(FOAIA);
  if (!s) { s = ss.insertSheet(FOAIA); s.appendRow(ANTET); s.setFrozenRows(1); s.setColumnWidths(1, ANTET.length, 140); }
  var h = s.getRange(1, 1, 1, ANTET.length).getValues()[0];      // adaugă coloanele noi la foile mai vechi
  for (var i = 0; i < ANTET.length; i++) if (!h[i]) s.getRange(1, i + 1).setValue(ANTET[i]);
  s.getRange(1, 1, 1, ANTET.length).setFontWeight('bold').setBackground('#e8eefc');
  return s;
}
function jurnal_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ss.getSheetByName(JURNAL);
  if (!s) { s = ss.insertSheet(JURNAL); s.appendRow(['Data și ora', 'Cod', 'Nume', 'Eveniment', 'Platformă', 'Versiune', 'Dispozitiv']); s.setFrozenRows(1); s.getRange('A1:G1').setFontWeight('bold').setBackground('#e8eefc'); s.setColumnWidths(1, 7, 150); }
  return s;
}
function log_(cod, nume, ev, plat, ver, dev) {
  try {
    var j = jurnal_(); j.appendRow([new Date(), cod, nume, ev, plat || '', ver || '', String(dev || '').slice(0, 14)]);
    var n = j.getLastRow(); if (n > 3000) j.deleteRows(2, 500);          // păstrăm ultimele ~2500 de evenimente
  } catch (e) { }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('VerTech').addItem('➕ Cod nou pentru o persoană', 'codNou').addToUi();
  foaie_(); jurnal_();
}
function cod_() {
  var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', o = '';
  for (var i = 0; i < 8; i++) { o += c.charAt(Math.floor(Math.random() * c.length)); if (i == 3) o += '-'; }
  return o;
}
function codNou() {
  var ui = SpreadsheetApp.getUi(), n = ui.prompt('Cod nou', 'Numele persoanei:', ui.ButtonSet.OK_CANCEL);
  if (n.getSelectedButton() != ui.Button.OK || !n.getResponseText().trim()) return;
  var cod = adaugaLicenta_(n.getResponseText().trim(), 0, 1, '');
  ui.alert('Cod creat: ' + cod);
}
function adaugaLicenta_(nume, luni, max, nota, expData) {
  var exp = '';
  if (expData) exp = new Date(expData + 'T12:00:00');
  else if (luni > 0) { exp = new Date(); exp.setMonth(exp.getMonth() + luni); }
  var cod = cod_();
  foaie_().appendRow([cod, nume, 'DA', exp, parseInt(max, 10) || 1, '', '', 0, nota || '', new Date(), '', '']);
  return cod;
}

function raspuns_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------------- Verificarea licenței (apelată din aplicația VerTech) ---------------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action == 'ping') return raspuns_({ ok: true });
  return raspuns_(verifica_(p.code, p.dev, p.plat, p.ver));
}

function verifica_(cod, dev, plat, ver) {
  cod = String(cod || '').trim().toUpperCase(); dev = String(dev || '').trim(); plat = String(plat || '').slice(0, 12); ver = String(ver || '').slice(0, 12);
  if (!cod || !dev) return { ok: false, reason: 'Introdu codul de licență.' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var s = foaie_(), v = s.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][0]).trim().toUpperCase() != cod) continue;
      var nume = String(v[i][1]);
      if (String(v[i][2]).trim().toUpperCase() != 'DA') { log_(cod, nume, 'refuz: dezactivată', plat, ver, dev); return { ok: false, reason: 'Licența a fost dezactivată.' }; }
      var exp = v[i][3], expTxt = '';
      if (exp instanceof Date) {
        var az = new Date(); az.setHours(0, 0, 0, 0);
        expTxt = Utilities.formatDate(exp, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (exp < az) { log_(cod, nume, 'refuz: expirată', plat, ver, dev); return { ok: false, reason: 'Licența a expirat la ' + expTxt + '.' }; }
      }
      var max = parseInt(v[i][4], 10) || 1, lista = String(v[i][5] || '').split(',').map(function (x) { return x.trim(); }).filter(String), ev = 'verificare';
      if (lista.indexOf(dev) < 0) {
        if (lista.length >= max) { log_(cod, nume, 'refuz: alt dispozitiv', plat, ver, dev); return { ok: false, reason: 'Codul e deja folosit pe alt dispozitiv.' }; }
        lista.push(dev); s.getRange(i + 1, 6).setValue(lista.join(',')); ev = 'ACTIVARE dispozitiv nou';
      }
      s.getRange(i + 1, 7).setValue(new Date());
      s.getRange(i + 1, 8).setValue((parseInt(v[i][7], 10) || 0) + 1);
      s.getRange(i + 1, 11).setValue(plat); s.getRange(i + 1, 12).setValue(ver);
      log_(cod, nume, ev, plat, ver, dev);
      return { ok: true, name: nume, expires: expTxt };
    }
    log_(cod, '', 'refuz: cod necunoscut', plat, ver, dev);
    return { ok: false, reason: 'Cod necunoscut.' };
  } finally { lock.releaseLock(); }
}

/* ---------------- Administrare (apelată din aplicația VerTech Admin, cu parolă) ---------------- */
function auth_(p) {
  if (!PAROLA || PAROLA == 'schimba-ma') throw new Error('Mai întâi schimbă PAROLA din Code.gs (a doua linie), apoi publică din nou.');
  if (String(p) !== PAROLA) { Utilities.sleep(1500); throw new Error('Parolă greșită.'); }
}
function dat_(d) { return d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : ''; }
function dt_(d) { return d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") : ''; }
function gasesteRand_(s, cod) {
  var v = s.getDataRange().getValues(); cod = String(cod).trim().toUpperCase();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim().toUpperCase() == cod) return i + 1;
  throw new Error('Cod negăsit.');
}
function admList(p) {
  auth_(p);
  var v = foaie_().getDataRange().getValues(), o = [];
  for (var i = 1; i < v.length; i++) {
    if (!String(v[i][0]).trim()) continue;
    o.push({ code: String(v[i][0]).trim(), name: String(v[i][1]), active: String(v[i][2]).trim().toUpperCase() == 'DA', exp: dat_(v[i][3]),
      max: parseInt(v[i][4], 10) || 1, devs: String(v[i][5] || '').split(',').filter(function (x) { return x.trim(); }).length,
      last: dt_(v[i][6]), checks: parseInt(v[i][7], 10) || 0, note: String(v[i][8] || ''), created: dat_(v[i][9]), plat: String(v[i][10] || ''), ver: String(v[i][11] || '') });
  }
  return o;
}
function admNew(p, f) {
  auth_(p); var nume = String((f && f.name) || '').trim(); if (!nume) throw new Error('Scrie numele persoanei.');
  return adaugaLicenta_(nume, parseInt(f.months, 10) || 0, f.max, f.note, f.exp);
}
function admSet(p, cod, o) {
  auth_(p); var s = foaie_(), r = gasesteRand_(s, cod);
  if (o.active !== undefined) s.getRange(r, 3).setValue(o.active ? 'DA' : 'NU');
  if (o.exp !== undefined) { if (!o.exp) s.getRange(r, 4).setValue(''); else { var d = new Date(o.exp + 'T12:00:00'); if (isNaN(d)) throw new Error('Dată invalidă.'); s.getRange(r, 4).setValue(d); } }
  if (o.max !== undefined) s.getRange(r, 5).setValue(parseInt(o.max, 10) || 1);
  if (o.name !== undefined) s.getRange(r, 2).setValue(String(o.name).trim());
  if (o.note !== undefined) s.getRange(r, 9).setValue(String(o.note));
  return true;
}
function admReset(p, cod) { auth_(p); var s = foaie_(); s.getRange(gasesteRand_(s, cod), 6).setValue(''); return true; }
function admDel(p, cod) { auth_(p); var s = foaie_(); s.deleteRow(gasesteRand_(s, cod)); return true; }

function admLog(p, n) {
  auth_(p); var j = jurnal_(), last = j.getLastRow(); n = Math.min(parseInt(n, 10) || 100, 500);
  if (last < 2) return [];
  var from = Math.max(2, last - n + 1), v = j.getRange(from, 1, last - from + 1, 7).getValues(), o = [];
  for (var i = v.length - 1; i >= 0; i--) o.push({ t: dt_(v[i][0]), code: String(v[i][1]), name: String(v[i][2]), ev: String(v[i][3]), plat: String(v[i][4]), ver: String(v[i][5]), dev: String(v[i][6]) });
  return o;
}

function admStats(p) {
  auth_(p);
  var lic = admList(p), az = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'), now = new Date().getTime();
  var st = { total: lic.length, active: 0, expired: 0, off: 0, devices: 0, last24: 0, last7: 0, plat: {}, days: [] };
  lic.forEach(function (l) {
    st.devices += l.devs;
    if (!l.active) st.off++; else if (l.exp && l.exp < az) st.expired++; else st.active++;
    if (l.last) { var t = new Date(l.last).getTime(); if (now - t < 864e5) st.last24++; if (now - t < 7 * 864e5) st.last7++; }
  });
  var j = jurnal_(), last = j.getLastRow(), perDay = {}, devs7 = {};
  if (last > 1) {
    var from = Math.max(2, last - 1499), v = j.getRange(from, 1, last - from + 1, 7).getValues();
    v.forEach(function (r) {
      if (!(r[0] instanceof Date)) return;
      var d = Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd'), age = now - r[0].getTime(), ev = String(r[3]);
      if (ev.indexOf('refuz') == 0) return;
      (perDay[d] = perDay[d] || {})[r[6]] = 1;
      if (age < 7 * 864e5) devs7[r[6]] = String(r[4]) || '?';
    });
  }
  Object.keys(devs7).forEach(function (k) { st.plat[devs7[k]] = (st.plat[devs7[k]] || 0) + 1; });
  for (var i = 13; i >= 0; i--) {
    var dd = new Date(now - i * 864e5), k = Utilities.formatDate(dd, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    st.days.push({ d: k, n: perDay[k] ? Object.keys(perDay[k]).length : 0 });
  }
  return st;
}

var ADM = { admList: admList, admNew: admNew, admSet: admSet, admReset: admReset, admDel: admDel, admLog: admLog, admStats: admStats };

function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return raspuns_({ error: 'Cerere invalidă.' }); }
  try {
    var f = ADM[b.fn]; if (!f) throw new Error('Funcție necunoscută.');
    return raspuns_({ ok: true, data: f.apply(null, [b.pass].concat(b.args || [])) });
  } catch (err) { return raspuns_({ error: String((err && err.message) || err) }); }
}
