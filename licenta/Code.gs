/* VerTech – server de licențe (Google Apps Script, lipit într-un Google Sheet NOU, doar al tău).
   Foaia „Licente” se creează singură. Coloane: Cod | Nume | Activ | Expiră | Max dispozitive | Dispozitive | Ultima verificare */
var FOAIA = 'Licente';
/* PAROLA de administrare (pentru pagina ?admin=1). SCHIMB-O înainte de folosire! */
var PAROLA = 'schimba-ma';

function foaie_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ss.getSheetByName(FOAIA);
  if (!s) {
    s = ss.insertSheet(FOAIA);
    s.appendRow(['Cod', 'Nume', 'Activ', 'Expiră', 'Max dispozitive', 'Dispozitive', 'Ultima verificare']);
    s.setFrozenRows(1); s.getRange('A1:G1').setFontWeight('bold').setBackground('#e8eefc');
    s.setColumnWidths(1, 7, 150);
  }
  return s;
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('VerTech')
    .addItem('➕ Cod nou pentru o persoană', 'codNou')
    .addItem('♻ Șterge dispozitivele unui cod', 'resetDispozitive')
    .addToUi();
  foaie_();
}

function cod_() {
  var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', o = '';
  for (var i = 0; i < 8; i++) { o += c.charAt(Math.floor(Math.random() * c.length)); if (i == 3) o += '-'; }
  return o;
}

function codNou() {
  var ui = SpreadsheetApp.getUi();
  var n = ui.prompt('Cod nou', 'Numele persoanei (apare pe documentele ei):', ui.ButtonSet.OK_CANCEL);
  if (n.getSelectedButton() != ui.Button.OK || !n.getResponseText().trim()) return;
  var m = ui.prompt('Valabilitate', 'Câte luni e valabil codul? (gol = fără limită)', ui.ButtonSet.OK_CANCEL);
  if (m.getSelectedButton() != ui.Button.OK) return;
  var luni = parseInt(m.getResponseText(), 10), exp = '';
  if (luni > 0) { exp = new Date(); exp.setMonth(exp.getMonth() + luni); }
  var cod = cod_();
  foaie_().appendRow([cod, n.getResponseText().trim(), 'DA', exp, 1, '', '']);
  ui.alert('Cod creat', 'Dă-i persoanei acest cod:\n\n' + cod + '\n\n(Funcționează pe 1 dispozitiv. Poți schimba „Max dispozitive” în foaie.)', ui.ButtonSet.OK);
}

function resetDispozitive() {
  var ui = SpreadsheetApp.getUi(), r = ui.prompt('Șterge dispozitivele', 'Codul (ex. ABCD-2345):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() != ui.Button.OK) return;
  var s = foaie_(), v = s.getDataRange().getValues(), c = r.getResponseText().trim().toUpperCase();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim().toUpperCase() == c) { s.getRange(i + 1, 6).setValue(''); ui.alert('Gata: codul poate fi activat din nou pe dispozitive noi.'); return; }
  ui.alert('Cod negăsit.');
}

function raspuns_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action == 'ping') return raspuns_({ ok: true });
  if (p.admin) return HtmlService.createHtmlOutputFromFile('Admin').setTitle('VerTech – Licențe')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return raspuns_(verifica_(p.code, p.dev));
}

function verifica_(cod, dev) {
  cod = String(cod || '').trim().toUpperCase(); dev = String(dev || '').trim();
  if (!cod || !dev) return { ok: false, reason: 'Introdu codul de licență.' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var s = foaie_(), v = s.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][0]).trim().toUpperCase() != cod) continue;
      if (String(v[i][2]).trim().toUpperCase() != 'DA') return { ok: false, reason: 'Licența a fost dezactivată.' };
      var exp = v[i][3], expTxt = '';
      if (exp instanceof Date) {
        var az = new Date(); az.setHours(0, 0, 0, 0);
        expTxt = Utilities.formatDate(exp, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (exp < az) return { ok: false, reason: 'Licența a expirat la ' + expTxt + '.' };
      }
      var max = parseInt(v[i][4], 10) || 1, lista = String(v[i][5] || '').split(',').map(function (x) { return x.trim(); }).filter(String);
      if (lista.indexOf(dev) < 0) {
        if (lista.length >= max) return { ok: false, reason: 'Codul e deja folosit pe alt dispozitiv.' };
        lista.push(dev); s.getRange(i + 1, 6).setValue(lista.join(','));
      }
      s.getRange(i + 1, 7).setValue(new Date());
      return { ok: true, name: String(v[i][1]), expires: expTxt };
    }
    return { ok: false, reason: 'Cod necunoscut.' };
  } finally { lock.releaseLock(); }
}


/* ---------------- Administrare (apelată din pagina Admin) ---------------- */
function auth_(p) {
  if (!PAROLA || PAROLA == 'schimba-ma') throw new Error('Mai întâi schimbă PAROLA din Code.gs (prima linie), apoi publică din nou.');
  if (String(p) !== PAROLA) { Utilities.sleep(1500); throw new Error('Parolă greșită.'); }
}
function dat_(d) { return d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : ''; }
function dt_(d) { return d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm') : ''; }
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
    o.push({ code: String(v[i][0]).trim(), name: String(v[i][1]), active: String(v[i][2]).trim().toUpperCase() == 'DA',
      exp: dat_(v[i][3]), max: parseInt(v[i][4], 10) || 1, devs: String(v[i][5] || '').split(',').filter(function (x) { return x.trim(); }).length, last: dt_(v[i][6]) });
  }
  return o;
}
function admNew(p, nume, luni, max) {
  auth_(p); nume = String(nume || '').trim(); if (!nume) throw new Error('Scrie numele persoanei.');
  var exp = ''; luni = parseInt(luni, 10); if (luni > 0) { exp = new Date(); exp.setMonth(exp.getMonth() + luni); }
  var cod = cod_(); foaie_().appendRow([cod, nume, 'DA', exp, parseInt(max, 10) || 1, '', '']);
  return cod;
}
function admSet(p, cod, o) {
  auth_(p); var s = foaie_(), r = gasesteRand_(s, cod);
  if (o.active !== undefined) s.getRange(r, 3).setValue(o.active ? 'DA' : 'NU');
  if (o.exp !== undefined) { if (!o.exp) s.getRange(r, 4).setValue(''); else { var d = new Date(o.exp + 'T12:00:00'); if (isNaN(d)) throw new Error('Dată invalidă.'); s.getRange(r, 4).setValue(d); } }
  if (o.max !== undefined) s.getRange(r, 5).setValue(parseInt(o.max, 10) || 1);
  if (o.name !== undefined) s.getRange(r, 2).setValue(String(o.name).trim());
  return true;
}
function admReset(p, cod) { auth_(p); var s = foaie_(); s.getRange(gasesteRand_(s, cod), 6).setValue(''); return true; }
function admDel(p, cod) { auth_(p); var s = foaie_(); s.deleteRow(gasesteRand_(s, cod)); return true; }
