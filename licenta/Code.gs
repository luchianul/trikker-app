/* VerTech – server de licențe (Google Apps Script, lipit într-un Google Sheet NOU, doar al tău).
   Foaia „Licente” se creează singură. Coloane: Cod | Nume | Activ | Expiră | Max dispozitive | Dispozitive | Ultima verificare */
var FOAIA = 'Licente';

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
