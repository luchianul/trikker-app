/* ============================================================
   px-api.js — în afara Apps Script, google.script.run vorbește cu Apps Script prin internet
   și lucrează și FĂRĂ semnal:
     • citirile (pontaje, facturi, deduceri) vin din memoria locală dacă nu e internet;
     • scrierile se aplică imediat local și se pun într-o coadă; se trimit singure când revine semnalul;
     • fiecare operație are un opId: o reîncercare nu poate dubla nimic în Sheet.
   În Apps Script (obiectul „google” real există) acest fișier nu face nimic.
   ============================================================ */
(function () {
  'use strict';
  if (window.google && window.google.script && window.google.script.run) return;

  var K_URL = 'px_url', K_CACHE = 'px_cache', K_Q = 'px_queue', K_FAIL = 'px_failed';
  var ls = window.localStorage;

  function lsGet(k) { try { return ls.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { ls.setItem(k, v); return true; } catch (e) { return false; } }
  function ld(k, d) { try { var v = JSON.parse(lsGet(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function rid(p) { return (p || 'c') + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }

  try { var qs = new URLSearchParams(location.search), uu = qs.get('u'); if (uu) { lsSet(K_URL, uu.trim()); qs.delete('u'); history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '') + location.hash); } } catch (e) {}   // adresa se poate da printr-un link: ?u=…
  var cache = ld(K_CACHE, {}); cache.an = cache.an || {}; cache.ts = cache.ts || {};
  var queue = ld(K_Q, []);
  var failed = ld(K_FAIL, []);
  function save() { lsSet(K_CACHE, JSON.stringify(cache)); lsSet(K_Q, JSON.stringify(queue)); lsSet(K_FAIL, JSON.stringify(failed)); chip(); }

  function url() { return (lsGet(K_URL) || '').trim(); }
  function online() { return navigator.onLine !== false; }
  function curYear() { return String(new Date().getFullYear()); }

  // ---------- rețea ----------
  function post(fn, args, opId) {
    var ctrl = window.AbortController ? new AbortController() : null, t = ctrl && setTimeout(function () { ctrl.abort(); }, 60000);
    return fetch(url(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
      body: JSON.stringify({ fn: fn, args: args || [], opId: opId || null }), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (j) { clearTimeout(t); if (j && j.error) { var e = new Error(j.error); e.server = true; throw e; } return j || {}; },
            function (e) { clearTimeout(t); throw e; });
  }

  // ---------- calcule locale (oglinda serverului: Code.gs) ----------
  function calculOre(s, e) {
    if (!s || !e) return 0;
    var a = new Date('2000/01/01 ' + s), b = new Date('2000/01/01 ' + e);
    if (b < a) b.setDate(b.getDate() + 1);
    return ((b - a) / 3600000).toFixed(2);
  }
  function isoOf(v) {
    var s = String(v || '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var p = s.split(/[\/\.\-]/);
    if (p.length === 3 && p[2].length === 4) return p[2] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[0]).slice(-2);
    return s;
  }
  function weekOf(iso) {
    var p = iso.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    return Math.ceil((((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 1))) / 86400000) + 1) / 7);
  }
  function num(v, d) { var n = parseFloat(String(v === null || v === undefined ? '' : v).replace(',', '.')); return isNaN(n) ? (d === undefined ? 0 : d) : n; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function splitLoc(strada, ore) {
    var out = [], parts = String(strada || '').split('+'), re = /([^\[]+)\[([\d\.,]+)h?\]/;
    var far = parts.filter(function (l) { var t = l.trim(); return t !== '' && !t.match(re); }).length;
    parts.forEach(function (loc) { var t = loc.trim(); if (!t) return; var m = t.match(re);
      out.push(m ? { nume: m[1].trim(), ore: parseFloat(m[2].replace(',', '.')) || 0 } : { nume: t, ore: far > 0 ? ore / far : 0 }); });
    return out;
  }
  function emptyYear(an) { return { istoric: [], statistici: [], santiere: [], anAfisat: Number(an) }; }
  function yearData(an) { an = String(an); if (!cache.an[an]) cache.an[an] = emptyYear(an); return cache.an[an]; }

  // recalculează săptămânile și șantierele unui an din pontajele lui (păstrează „Platit”)
  function recalc(an) {
    var D = yearData(an), rows = D.istoric.slice().reverse();     // vechi → noi
    var st = {}; D.statistici.forEach(function (s) { st[String(s[6])] = s[8]; });
    var W = {}, wOrder = [], S = {}, sOrder = [];
    rows.forEach(function (r) {
      var wk = weekOf(r[1]); if (!W[wk]) { W[wk] = { h: 0, km: 0, sH: 0, sK: 0, suma: 0 }; wOrder.push(wk); }
      var w = W[wk], h = num(r[5]), km = num(r[6]), tH = num(r[9], 30), tK = num(r[10], 0.45);
      w.h += h; w.km += km; w.sH += h * tH; w.sK += km * tK; if (!r[8]) w.suma += h * tH + km * tK;
      splitLoc(r[4], h).forEach(function (it) { var k = norm(it.nume); if (!S[k]) { S[k] = { nume: it.nume, ore: 0 }; sOrder.push(k); } S[k].ore += it.ore; });
    });
    wOrder.sort(function (a, b) { return a - b; });
    D.statistici = wOrder.map(function (wk, i) { var w = W[wk]; return [i + 1, r2(w.h), r2(w.km), r2(w.sH), r2(w.sK), r2(w.suma), wk, Number(an), st[String(wk)] || '']; }).reverse();
    D.santiere = sOrder.map(function (k) { return [S[k].nume, r2(S[k].ore), Number(an)]; }).reverse();
  }

  function insertSorted(D, row) {        // cele mai noi primele; la aceeași dată, după cele existente
    var i = 0; while (i < D.istoric.length && D.istoric[i][1] >= row[1]) i++;
    D.istoric.splice(i, 0, row);
  }
  function findRow(id) {
    for (var an in cache.an) { var L = cache.an[an].istoric; for (var i = 0; i < L.length; i++) if (String(L[i][11]) === String(id)) return { an: an, i: i }; }
    return null;
  }

  // ---------- coada de operații ----------
  function enqueue(fn, args) { queue.push({ id: rid('o'), fn: fn, args: clone(args), ts: Date.now(), tries: 0 }); save(); setTimeout(flush, 30); }

  var flushing = null;
  function sig(D) { return JSON.stringify([D.istoric, (D.statistici || []).map(function (s) { return s.slice(1); }), D.santiere]); }
  function flush() {
    if (flushing) return flushing;
    if (!url() || !online() || !queue.length) return Promise.resolve(!queue.length);
    chip('sync');
    var need = { years: {}, facturi: false, deduceri: false }, changed = false;
    function step() {
      if (!queue.length) return Promise.resolve(true);
      var op = queue[0];
      return post(op.fn, op.args, op.id).then(function (j) {
        queue.shift();
        if (op.fn === 'adaugaDate' || op.fn === 'stergeRand') {
          if (j && j.result && j.result.istoric && !queue.length) {          // ultima operație: răspunsul serverului e adevărul pentru acel an
            var an = String(j.result.anAfisat), old = cache.an[an];
            if (!old || sig(old) !== sig(j.result)) changed = true;
            cache.an[an] = j.result; cache.ts[an] = Date.now();
          } else if (j && j.dup) need.years[String(yearOfOp(op))] = 1;
        } else if (op.fn === 'marcheazaPlata' || op.fn === 'marcheazaFacturaPlatita') { need.years[String(op.args[op.fn === 'marcheazaPlata' ? 1 : 2])] = 1; if (op.fn === 'marcheazaFacturaPlatita') need.facturi = true; }
        else if (/Factura|Avans/.test(op.fn)) need.facturi = true;
        else if (/Deducere/.test(op.fn)) need.deduceri = true;
        save(); return step();
      }, function (e) {
        if (e && e.server) {                                          // serverul a refuzat operația: după 3 încercări o punem deoparte, ca să nu blocheze coada
          op.tries = (op.tries || 0) + 1;
          if (op.tries >= 3) { failed.push({ op: op, err: String(e.message), ts: Date.now() }); queue.shift(); save(); try { window.dispatchEvent(new CustomEvent('px-failed')); } catch (x) {} return step(); }
          save();
        }
        return false;                                                 // fără rețea / eroare: rămâne în coadă, se reîncearcă
      });
    }
    flushing = step().then(function (okAll) {
      flushing = null;
      if (!okAll || queue.length) { chip(); return false; }
      var jobs = Object.keys(need.years).map(function (an) { return post('getAppData', [an]).then(function (j) { if (!cache.an[an] || sig(cache.an[an]) !== sig(j.result)) changed = true; cache.an[an] = j.result; }, function () {}); });
      if (need.facturi) jobs.push(post('getFacturiGS', []).then(function (j) { if (JSON.stringify(cache.facturi) !== JSON.stringify(j.result)) changed = true; cache.facturi = j.result; }, function () {}));
      if (need.deduceri) jobs.push(post('getDeduceriGS', []).then(function (j) { if (JSON.stringify(cache.deduceri) !== JSON.stringify(j.result)) changed = true; cache.deduceri = j.result; }, function () {}));
      return Promise.all(jobs).then(function () { save(); chip('done'); if (changed) { try { window.dispatchEvent(new CustomEvent('px-synced')); } catch (x) {} } return true; });
    });
    return flushing;
  }
  function yearOfOp(op) { var o = op.args && op.args[0]; return o && o.data ? isoOf(o.data).slice(0, 4) : curYear(); }

  // ---------- citiri ----------
  function noSetup(h) { setTimeout(function () { try { if (window.pxSettings) window.pxSettings(); } catch (x) {} h.failure && h.failure(new Error('Sincronizarea nu e setată')); }, 0); }

  function readYear(an, h) {
    an = String(an || curYear());
    if (!url()) { if (cache.an[an]) return ok(h, cache.an[an]); return noSetup(h); }
    if (queue.length) { if (online()) flush(); if (cache.an[an]) return ok(h, cache.an[an]); }   // avem ceva de trimis: arătăm varianta locală, trimiterea merge în fundal
    if (!online()) return localYear(an, h);
    return post('getAppData', [an]).then(function (j) {
      if (queue.length && cache.an[an]) return ok(h, cache.an[an]);
      cache.an[an] = j.result; cache.ts[an] = Date.now(); save(); ok(h, j.result);
    }, function () { localYear(an, h); });
  }
  function localYear(an, h) {
    if (cache.an[an]) return ok(h, cache.an[an]);
    if (h.failure) h.failure(new Error('Nu ai încă date salvate pe acest dispozitiv pentru ' + an + '. Conectează-te o dată la internet.'));
  }
  function ok(h, v) { setTimeout(function () { h.success && h.success(clone(v)); }, 0); }
  function readList(key, fn, h) {
    if (!url()) { if (cache[key]) return ok(h, cache[key]); return ok(h, []); }
    if (online() && !queue.length) return post(fn, []).then(function (j) { cache[key] = j.result || []; save(); ok(h, cache[key]); }, function () { ok(h, cache[key] || []); });
    return ok(h, cache[key] || []);
  }

  // ---------- scrieri (local + coadă) ----------
  var W = {
    adaugaDate: function (h, o) {
      o = clone(o || {}); var editing = !!(o.rowIndex || o.ridx);
      if (!editing) o.clientId = o.clientId || rid('c');
      var iso = isoOf(o.data), an = iso.slice(0, 4), h1 = parseFloat(calculOre(o.oraIntrare, o.oraIesire));
      var D = yearData(an), key = o.rowIndex || o.ridx || o.clientId, old = findRow(key);
      var row = [o.ziua, iso, o.oraIntrare, o.oraIesire, o.strada, h1, num(o.km), o.nume, !!o.isCash, num(o.tarifH, 30), num(o.tarifKm, 0.45), String(old ? cache.an[old.an].istoric[old.i][11] : key)];
      if (old && old.an === an && cache.an[old.an].istoric[old.i][1] === iso) { D.istoric[old.i] = row; }
      else { if (old) { cache.an[old.an].istoric.splice(old.i, 1); recalc(old.an); } insertSorted(D, row); }
      recalc(an); enqueue('adaugaDate', [o]);
      ok(h, D);
    },
    stergeRand: function (h, key) {
      var f = findRow(key);
      if (f) { var an = f.an; cache.an[an].istoric.splice(f.i, 1); recalc(an); }
      enqueue('stergeRand', [String(key)]);
      ok(h, f ? cache.an[f.an] : emptyYear(curYear()));
    },
    marcheazaPlata: function (h, sapt, an) {
      var D = yearData(an); D.statistici.forEach(function (s) { if (String(s[6]) === String(sapt)) s[8] = 'Platit'; });
      enqueue('marcheazaPlata', [sapt, an]); ok(h, 'Succes');
    },
    marcheazaFacturaPlatita: function (h, id, saptamani, an) {
      var D = yearData(an); (saptamani || []).forEach(function (sp) { D.statistici.forEach(function (s) { if (String(s[6]) === String(sp)) s[8] = 'Platit'; }); });
      (cache.facturi || []).forEach(function (f) { if (String(f.id) === String(id)) f.avans = f.totalC; });
      enqueue('marcheazaFacturaPlatita', [id, saptamani, an]); ok(h, 'Succes');
    },
    salveazaFacturaGS: function (h, f) {
      cache.facturi = cache.facturi || [];
      if (!cache.facturi.some(function (x) { return String(x.id) === String(f.id); })) cache.facturi.push({ id: f.id, nom: f.nom, saptamani: (f.saptamani || []).map(String), totalH: num(f.totalH), totalC: num(f.totalC), avans: 0 });
      enqueue('salveazaFacturaGS', [f]); ok(h, 'OK');
    },
    stergeFacturaGS: function (h, id) {
      cache.facturi = (cache.facturi || []).filter(function (f) { return String(f.id) !== String(id); });
      enqueue('stergeFacturaGS', [id]); ok(h, 'OK');
    },
    adaugaAvansGS: function (h, id, suma) {
      var nou = null; (cache.facturi || []).forEach(function (f) { if (String(f.id) === String(id)) { f.avans = num(f.avans) + num(suma); nou = f.avans; } });
      enqueue('adaugaAvansGS', [id, suma]); ok(h, nou === null ? suma : nou);
    },
    salveazaDeducereGS: function (h, d) {
      cache.deduceri = cache.deduceri || [];
      if (!cache.deduceri.some(function (x) { return String(x.id) === String(d.id); })) cache.deduceri.push(clone(d));
      enqueue('salveazaDeducereGS', [d]); ok(h, 'OK');
    },
    stergeDeducereGS: function (h, id) {
      cache.deduceri = (cache.deduceri || []).filter(function (d) { return String(d.id) !== String(id); });
      enqueue('stergeDeducereGS', [id]); ok(h, 'OK');
    }
  };

  // ---------- obiectul google.script.run ----------
  function run() {
    var h = { success: null, failure: null }, o = {
      withSuccessHandler: function (f) { h.success = f; return o; },
      withFailureHandler: function (f) { h.failure = f; return o; },
      withUserObject: function () { return o; },
      getAppData: function (an) { readYear(an, h); },
      getFacturiGS: function () { readList('facturi', 'getFacturiGS', h); },
      getDeduceriGS: function () { readList('deduceri', 'getDeduceriGS', h); },
      getAvatarUrl: function () {
        if (cache.avatar) return ok(h, cache.avatar);
        if (url() && online()) return post('getAvatarUrl', []).then(function (j) { cache.avatar = j.result || null; save(); ok(h, cache.avatar); }, function () { ok(h, null); });
        ok(h, null);
      },
      getSuiviBadge: function () {
        if (url() && online() && !document.hidden) return post('getSuiviBadge', []).then(function (j) { cache.badge = j.result || 0; ok(h, cache.badge); }, function () { ok(h, cache.badge || 0); });
        ok(h, cache.badge || 0);
      },
      creazaBackupPDF: function (an) {
        if (!url() || !online()) return ok(h, { success: false, error: 'Backup-ul se face doar cu internet.' });
        post('creazaBackupPDF', [an]).then(function (j) { ok(h, j.result); }, function (e) { ok(h, { success: false, error: String(e.message || e) }); });
      }
    };
    Object.keys(W).forEach(function (name) {
      o[name] = function () { W[name].apply(null, [h].concat(Array.prototype.slice.call(arguments))); };
    });
    return o;
  }
  window.google = { script: { run: new Proxy({}, { get: function (t, k) { var r = run(); return r[k]; } }) } };

  // ---------- indicator mic + setări ----------
  var chipEl = null, chipTimer = null;
  function chip(state) {
    if (!document.body) return;
    if (!chipEl) {
      chipEl = document.createElement('div'); chipEl.id = 'px-chip';
      chipEl.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 74px);left:50%;transform:translateX(-50%);z-index:3000;padding:4px 12px;border-radius:999px;font:600 11px/1.4 Inter,system-ui,sans-serif;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.25);display:none;cursor:pointer';
      chipEl.onclick = function () { if (window.pxSettings) window.pxSettings(); };
      document.body.appendChild(chipEl);
    }
    var n = queue.length, bad = failed.length, txt = '', bg = '#475569';
    if (!url()) { txt = 'Setează sincronizarea'; bg = '#b45309'; }
    else if (bad) { txt = '⚠ ' + bad + ' nu s-au putut trimite'; bg = '#b91c1c'; }
    else if (!online()) { txt = '📴 Fără internet' + (n ? ' · ' + n + ' de trimis' : ''); bg = '#334155'; }
    else if (n) { txt = '⟳ Se trimit ' + n + '…'; bg = '#4338ca'; }
    else if (state === 'done') { txt = '✓ Sincronizat'; bg = '#0f766e'; }
    if (!txt) { chipEl.style.display = 'none'; return; }
    chipEl.textContent = txt; chipEl.style.background = bg; chipEl.style.display = 'block';
    clearTimeout(chipTimer);
    if (state === 'done') chipTimer = setTimeout(function () { chipEl.style.display = 'none'; }, 2500);
  }
  window.addEventListener('online', function () { chip(); flush(); });
  window.addEventListener('offline', function () { chip(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) flush(); });
  window.addEventListener('px-synced', function () { chip('done'); });
  setInterval(function () { if (queue.length) flush(); }, 30000);

  window.pxSettings = function () {
    if (!window.Swal) { var u = prompt('Adresa Apps Script (se termină cu /exec):', url()); if (u !== null) { lsSet(K_URL, u.trim()); flush(); } return; }
    var n = queue.length, bad = failed.length;
    Swal.fire({
      title: 'Sincronizare cu Google Sheet',
      html: '<div style="text-align:left;font-size:14px"><label style="font-weight:600">Adresa Apps Script (se termină cu /exec)</label>' +
            '<input id="px-url" class="swal2-input" style="margin:6px 0 10px;width:100%;font-size:13px" value="' + url().replace(/"/g, '&quot;') + '" placeholder="https://script.google.com/macros/s/…/exec">' +
            '<div id="px-st" style="min-height:20px;font-size:13px;color:#475569">' + (online() ? '🟢 Internet' : '📴 Fără internet') + ' · ' + n + ' de trimis' + (bad ? ' · <b style="color:#b91c1c">' + bad + ' eșuate</b>' : '') + '</div>' +
            '<small style="color:#64748b">Fără internet poți continua să faci pontajul: datele se păstrează pe acest dispozitiv și se trimit singure când revine semnalul.</small></div>',
      showCancelButton: true, showDenyButton: true, confirmButtonText: 'Salvează', denyButtonText: 'Testează și trimite', denyButtonColor: '#0f766e', cancelButtonText: 'Închide',
      preConfirm: function () { lsSet(K_URL, document.getElementById('px-url').value.trim()); return true; },
      preDeny: function () {
        var u = document.getElementById('px-url').value.trim(); lsSet(K_URL, u);
        var st = document.getElementById('px-st'); st.textContent = 'Se testează…';
        failed.forEach(function (f) { f.op.tries = 0; queue.push(f.op); }); failed = []; save();
        return fetch(u + (u.indexOf('?') < 0 ? '?' : '&') + 'action=ping').then(function (r) { return r.json(); }).then(function () { st.textContent = '✔ Conectat. Se trimit datele…'; return flush(); })
          .then(function () { st.textContent = '✔ Sincronizat.'; setTimeout(function () { Swal.close(); try { window.dispatchEvent(new CustomEvent('px-synced')); } catch (x) {} }, 700); return false; })
          .catch(function (e) { st.innerHTML = '<span style="color:#b91c1c">✖ ' + String(e.message || e) + '</span>'; return false; });
      }
    }).then(function (r) { if (r.isConfirmed) { chip(); flush().then(function () { try { window.dispatchEvent(new CustomEvent('px-synced')); } catch (x) {} }); } });
  };

  // la pornire
  document.addEventListener('DOMContentLoaded', function () {
    chip(); setTimeout(flush, 800);
    if (!url()) setTimeout(function () { window.pxSettings && window.pxSettings(); }, 2500);
  });
  window.__px = { cache: function () { return cache; }, queue: function () { return queue; }, failed: function () { return failed; }, flush: flush, url: url };
})();
