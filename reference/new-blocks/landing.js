(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var NB = " ";
  var fmt = function (n) { return Math.round(n).toLocaleString("ru-RU").replace(/ /g, " "); };
  var rub = function (n) { return fmt(n) + NB + "₽"; };
  var km = function (n) { return String(n).replace(".", ","); };
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var touch = window.matchMedia && matchMedia("(hover: none)").matches;
  var PRICE = 15000;

  /* Вариант первого экрана для сравнения: ?hero=led показывает LED-карточку вместо рендера */
  var params = new URLSearchParams(location.search);
  if (params.get("hero") === "led") document.body.dataset.hero = "led";

  /* ---------- русская типографика: неразрывные пробелы после коротких слов и в числах ---------- */
  var SHORT = "в|во|к|ко|с|со|у|о|об|от|до|по|на|за|из|без|для|над|под|при|про|и|а|но|да|не|ни|же|ли|бы|что|как|где|это|или";
  var reShort = new RegExp("(^|[\\s«(])(" + SHORT + ")\\s", "gi");
  function tp(s) {
    var r = s;
    for (var i = 0; i < 2; i++) r = r.replace(reShort, function (m, a, b) { return a + b + NB; });
    return r.replace(/(\d) (₽|%|мин|км|дн|шт|см|заказ|гост|точ|дней|лет|год)/g, "$1" + NB + "$2").replace(/ — /g, NB + "— ");
  }
  var busyTypo = false;
  function typo(root) {
    if (busyTypo) return;
    busyTypo = true;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = w.nextNode())) {
      var p = n.parentNode && n.parentNode.nodeName;
      if (p === "SCRIPT" || p === "STYLE" || p === "TITLE" || p === "TEXTAREA") continue;
      list.push(n);
    }
    list.forEach(function (t) { var v = tp(t.nodeValue); if (v !== t.nodeValue) t.nodeValue = v; });
    busyTypo = false;
  }

  /* ---------- общее состояние калькулятора ---------- */
  var N = { orders: 60, check: 1150, share: 55, comm: 28, ret: 10 };
  var listeners = [];
  function onCalc(f) { listeners.push(f); }
  function monthLoss() { return N.orders * 30 * (N.share / 100) * N.check * (N.comm / 100); }

  /* ---------- LED-табло (вариант ?hero=led) ---------- */
  function ledDraw(cv, cols, rows, get) {
    var w = cv.clientWidth;
    if (!w) return;
    var cell = w / cols, h = Math.round(cell * rows), dpr = window.devicePixelRatio || 1;
    cv.style.height = h + "px"; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      var col = get(x, y), cx = (x + 0.5) * cell, cy = (y + 0.5) * cell, r = cell * 0.4;
      c.beginPath(); c.arc(cx, cy, r, 0, 6.2832);
      if (col) { c.fillStyle = col; c.shadowColor = col; c.shadowBlur = cell * 0.45; c.fill(); c.shadowBlur = 0; }
      else { c.fillStyle = "#202020"; c.fill(); }
    }
  }
  var DIG = { "0": "01110,10001,10011,10101,11001,10001,01110", "1": "00100,01100,00100,00100,00100,00100,01110", "2": "01110,10001,00001,00010,00100,01000,11111", "3": "11110,00001,00001,01110,00001,00001,11110", "4": "00010,00110,01010,10010,11111,00010,00010", "5": "11111,10000,11110,00001,00001,10001,01110", "6": "00110,01000,10000,11110,10001,10001,01110", "7": "11111,00001,00010,00100,01000,01000,01000", "8": "01110,10001,10001,01110,10001,10001,01110", "9": "01110,10001,10001,01111,00001,00010,01100", "%": "11000,11001,00010,00100,01000,10011,00011", "−": "00000,00000,00000,11111,00000,00000,00000" };
  function textBits(str) {
    var cols = str.length * 6 - 1, grid = [], y;
    for (y = 0; y < 7; y++) grid.push(new Array(cols).fill(0));
    str.split("").forEach(function (ch, i) {
      var g = (DIG[ch] || DIG["0"]).split(",");
      for (var yy = 0; yy < 7; yy++) for (var x = 0; x < 5; x++) if (g[yy][x] === "1") grid[yy][i * 6 + x] = 1;
    });
    return { cols: cols, grid: grid };
  }
  function drawLeds() {
    var l = $("#led2"); if (!l) return;
    var tb = textBits("−" + N.comm + "%"), cols = 27, rows = 11, ox = Math.floor((cols - tb.cols) / 2), oy = 2;
    ledDraw(l, cols, rows, function (x, y) { var gx = x - ox, gy = y - oy; return (gx >= 0 && gx < tb.cols && gy >= 0 && gy < 7 && tb.grid[gy][gx]) ? "#FF9A2E" : null; });
  }

  /* ---------- точечные волны в блоке оффера ---------- */
  function drawWaves() {
    var cv = $("#waves"); if (!cv) return;
    var p = cv.parentNode, w = p.clientWidth, h = p.clientHeight, dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var c = cv.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    var step = 12;
    for (var y = 0; y < h; y += step) for (var x = 0; x < w; x += step) {
      var wave = Math.sin(x / 140 + y / 90) * 0.5 + Math.sin(x / 70 - y / 160) * 0.5;
      var band = Math.exp(-Math.pow((y / h - (0.55 + 0.25 * Math.sin(x / 260))) * 3.2, 2));
      var a = Math.max(0, band * (0.55 + 0.45 * wave));
      if (a < 0.06) continue;
      c.fillStyle = "rgba(0,255,255," + (a * 0.55).toFixed(3) + ")";
      var s = 1 + a * 1.6; c.fillRect(x, y, s, s);
    }
  }

  /* ---------- калькулятор ---------- */
  function calc() {
    $("#vOrders").textContent = N.orders; $("#vCheck").textContent = rub(N.check); $("#vShare").textContent = N.share + NB + "%"; $("#vComm").textContent = N.comm + NB + "%";
    var comm = N.check * N.comm / 100, month = monthLoss(), save = month * N.ret / 100;
    $("#rcSum").textContent = rub(N.check); $("#rcPct").textContent = N.comm + NB + "%"; $("#rcCom").textContent = "−" + rub(comm); $("#rcNet").textContent = rub(N.check - comm);
    $("#resMonth").textContent = rub(month); $("#resYear").textContent = rub(month * 12); $("#resRet").textContent = N.ret + NB + "%"; $("#resSave").textContent = rub(save);
    $("#heroOrders").textContent = N.orders; $("#heroLoss").textContent = "≈ " + rub(month); $("#heroLossLed").textContent = "≈ " + rub(month) + " в месяц";
    drawLeds(); price(); prefill();
    listeners.forEach(function (f) { f(); });
  }
  [["rOrders", "orders"], ["rCheck", "check"], ["rShare", "share"], ["rComm", "comm"]].forEach(function (p) {
    $("#" + p[0]).addEventListener("input", function (e) { N[p[1]] = +e.target.value; calc(); });
  });
  $$("#ret button").forEach(function (b) {
    b.addEventListener("click", function () { N.ret = +b.dataset.r; $$("#ret button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); calc(); });
  });

  /* ---------- цена и окупаемость ---------- */
  function price() {
    var save = monthLoss() * N.ret / 100, net = save - PRICE, v = $("#verdict");
    var perOrder = 30 * (N.share / 100) * N.check * (N.comm / 100) * (N.ret / 100);
    var thr = Math.ceil(PRICE / perOrder / 5) * 5;
    if (net > 0) {
      v.innerHTML = '<div class="l-verdict__big ok">+' + rub(net) + " в месяц</div><p>При " + N.orders + " заказах в день и возврате " + N.ret + " % гостей вы сохраняете ≈ " + rub(save) + " из комиссий. Это в " + (save / PRICE).toFixed(1).replace(".", ",") + " раза больше подписки в расчёте. Оценка, без учёта других расходов.</p>";
    } else {
      v.innerHTML = '<div class="l-verdict__big warn">Пока не окупается</div><p>При ' + N.orders + " заказах в день и возврате " + N.ret + " % гостей вы сохраняете ≈ " + rub(save) + ", это меньше подписки в расчёте. Окупаемость начинается примерно от " + thr + " заказов в день при ваших остальных цифрах.</p>";
    }
  }

  /* ---------- как это работает ---------- */
  var dia = $("#dia"), stepsEl = $("#steps"), curStep = 1, autoTimer = null;
  function setStep(s) {
    curStep = s; dia.dataset.step = s;
    $$(".l-stp", stepsEl).forEach(function (b) { b.setAttribute("aria-expanded", +b.dataset.s === s); });
    [1, 2, 3].forEach(function (k) {
      $$(".n" + k, dia).forEach(function (e) { e.classList.toggle("on", s === k); });
      $$(".l" + k, dia).forEach(function (e) { e.classList.toggle("on", s === k); });
      $(".lb" + k, dia).classList.toggle("on", s === k);
    });
  }
  function autoNext() { setStep(curStep % 3 + 1); restartAuto(); }
  function restartAuto() {
    clearTimeout(autoTimer); stepsEl.classList.remove("auto"); void stepsEl.offsetWidth;
    if (!stepsEl.dataset.manual && !reduced) { stepsEl.classList.add("auto"); autoTimer = setTimeout(autoNext, 6000); }
  }
  $$(".l-stp", stepsEl).forEach(function (b) {
    b.addEventListener("click", function () { stepsEl.dataset.manual = "1"; clearTimeout(autoTimer); stepsEl.classList.remove("auto"); setStep(+b.dataset.s); });
  });
  setStep(1);
  if (reduced) { stepsEl.classList.remove("auto"); }
  else {
    var ioHow = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { restartAuto(); ioHow.disconnect(); } }); }, { threshold: 0.4 });
    ioHow.observe(stepsEl);
  }

  /* ---------- демо-окно ---------- */
  var CH = { ya: { n: "Яндекс Еда", agg: 1 }, kuper: { n: "Купер", agg: 1 }, site: { n: "Свой сайт", agg: 0 }, phone: { n: "Телефон", agg: 0 } };
  function freshOrders() {
    return [
      { id: 4821, ch: "ya", items: "Пицца Пепперони 30 см, Кола 0,5", sum: 1090, km: 3.2, st: 0, c: null, inv: false, addr: "Ленина, 24" },
      { id: 4822, ch: "site", items: "Роллы Филадельфия 8 шт, Мисо-суп", sum: 1340, km: 2.1, st: 1, c: null, inv: false, addr: "Мира, 7", stopOnPeak: true },
      { id: 4823, ch: "kuper", items: "Бургер классик ×2, картофель фри", sum: 1580, km: 4.0, st: 0, c: null, inv: false, addr: "Заводская, 112" },
      { id: 4824, ch: "phone", items: "Пицца Четыре сыра, Сок", sum: 970, km: 1.4, st: 1, c: null, inv: false, addr: "Гагарина, 3" },
      { id: 4825, ch: "ya", items: "Wok с курицей, Чай", sum: 790, km: 2.8, st: 0, c: null, inv: false, addr: "Школьная, 15" },
      { id: 4826, ch: "site", items: "Шаурма XL ×2", sum: 860, km: 0.9, st: 2, c: 0, inv: false, addr: "Парковая, 9" },
      { id: 4827, ch: "ya", items: "Сет Калифорния 24 шт", sum: 2190, km: 5.1, st: 0, c: null, inv: false, addr: "Садовая, 31" },
      { id: 4828, ch: "kuper", items: "Пицца Маргарита", sum: 650, km: 3.3, st: 1, c: null, inv: false, addr: "Южная, 58" }
    ];
  }
  var COURIERS = [{ n: "Артём", pick: 4 }, { n: "Дина", pick: 7 }, { n: "Макс", pick: 11 }];
  var SPEED = { foot: 5, bike: 15, car: 25 };
  var TRN = { foot: "пешком", bike: "вело", car: "авто" };
  var STAT = ["Новый", "Принят кухней", "Курьер назначен", "В пути"];
  var SEGS = [
    { k: "all", n: "Все гости", c: 1284, t: "Акция выходного дня: −10 % на всё меню", r: 0.04 },
    { k: "new", n: "Новые", c: 212, t: "300 бонусов на второй заказ", r: 0.09 },
    { k: "reg", n: "Постоянные", c: 346, t: "Двойные бонусы за заказ в приложении", r: 0.12 },
    { k: "sleep", n: "Не заказывали 30+ дней", c: 418, t: "Скидка 15 % на любимое блюдо", r: 0.06 },
    { k: "agg", n: "Пришли через агрегаторы", c: 308, t: "300 бонусов за первый заказ в своём приложении", r: 0.07 }
  ];
  var S;
  function reset() { S = { orders: freshOrders(), sel: null, filter: "all", tr: "bike", cSel: 4821, seg: "agg", base: 1284, log: [], period: 7, busy: {}, peak: false, reportsSeen: S ? S.reportsSeen : false }; }
  reset();
  var win = $("#win");

  function setTab(t) {
    $$(".tab").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.tab === t); });
    $$(".pane").forEach(function (p) { p.hidden = p.id !== "pane-" + t; });
    if (t === "reports") showReports();
    if (t === "couriers") renderCouriers();
    if (t === "guests") renderGuests();
  }
  $$(".tab").forEach(function (b) { b.addEventListener("click", function () { setTab(b.dataset.tab); }); });
  function eta(o, i) { return Math.round(COURIERS[i].pick + o.km / SPEED[S.tr] * 60) + (S.peak ? 15 : 0); }
  function visible() { return S.orders.filter(function (o) { return !(S.peak && o.stopOnPeak) && (S.filter === "all" || o.ch === S.filter); }); }
  function renderFilters() {
    var f = $("#filters"); f.innerHTML = "";
    var all = S.orders.filter(function (o) { return !(S.peak && o.stopOnPeak); });
    [["all", "Все"]].concat(Object.keys(CH).map(function (k) { return [k, CH[k].n]; })).forEach(function (p) {
      var n = p[0] === "all" ? all.length : all.filter(function (o) { return o.ch === p[0]; }).length;
      var b = document.createElement("button"); b.type = "button"; b.dataset.f = p[0];
      b.setAttribute("aria-pressed", S.filter === p[0]); b.innerHTML = p[1] + "<i>" + n + "</i>";
      b.addEventListener("click", function () { S.filter = p[0]; renderFilters(); renderOrders(); });
      f.appendChild(b);
    });
  }
  function renderOrders() {
    var box = $("#orders"); box.innerHTML = "";
    var list = visible();
    list.forEach(function (o, idx) {
      var b = document.createElement("button"); b.type = "button"; b.className = "order"; b.dataset.id = o.id;
      b.setAttribute("aria-selected", S.sel === o.id);
      b.innerHTML = '<span class="id">#' + o.id + '</span><span><span class="ttl">' + o.items + '</span><span class="meta"><span class="pl ' + (CH[o.ch].agg ? "agg" : "own") + '">' + CH[o.ch].n + '</span><span class="st s' + o.st + '">' + STAT[o.st] + '</span></span></span><span class="sum">' + rub(o.sum) + "<span>" + km(o.km) + " км</span></span>" + (idx === 0 && S.sel === null ? '<span class="hintdot"></span>' : "");
      b.addEventListener("click", function () { S.sel = o.id; S.cSel = o.id; renderOrders(); renderDetail(); });
      box.appendChild(b);
    });
    if (!list.length) box.innerHTML = '<div class="wempty">В этом канале заказов нет.</div>';
    $("#peakbar").hidden = !S.peak;
  }
  function selOrder() { return S.orders.filter(function (o) { return o.id === S.sel; })[0]; }
  function renderDetail() {
    var d = $("#detail"), o = selOrder();
    if (o && S.peak && o.stopOnPeak) { S.sel = null; o = null; }
    if (!o) { d.innerHTML = '<h3>Заказ</h3><p class="note">Нажмите на заказ слева: откроется карточка.</p>'; return; }
    var c = CH[o.ch], comm = o.sum * N.comm / 100;
    var h = "<h3>#" + o.id + '<span class="pl ' + (c.agg ? "agg" : "own") + '">' + c.n + "</span></h3>";
    h += '<dl class="kv"><dt>Состав</dt><dd>' + o.items + "</dd><dt>Сумма</dt><dd>" + rub(o.sum) + "</dd><dt>Адрес</dt><dd>" + o.addr + ", " + km(o.km) + " км</dd></dl>";
    h += '<div><span class="st s' + o.st + '">' + STAT[o.st] + (o.c !== null && o.st >= 2 ? " · " + COURIERS[o.c].n + ", ≈ " + eta(o, o.c) + " мин" : "") + "</span></div>";
    if (o.st === 1) h += '<div><div class="lbl">Курьер, ' + TRN[S.tr] + '</div><div class="opts">' + COURIERS.map(function (k, i) { return '<button type="button" class="opt" data-c="' + i + '" aria-pressed="' + (o.c === i) + '"><span>' + k.n + "</span><span>" + eta(o, i) + " мин</span></button>"; }).join("") + "</div></div>";
    h += '<button type="button" class="wbtn" id="act"' + (o.st === 3 ? " disabled" : "") + ">" + ["Принять на кухню", "Назначить курьера", "Отправить в путь", "Заказ в пути"][o.st] + "</button>";
    if (o.st === 3) h += '<p class="note">Заказ уже в пути, изменить его нельзя.</p>';
    if (c.agg) {
      h += '<div class="callout' + (o.inv ? " okc" : "") + '"><span>' + (o.inv ? "<b>Приглашение отправлено.</b> Гость в вашей базе." : "Агрегатор удержит ≈ <b>" + rub(comm) + "</b> (" + N.comm + " %). Гость пришёл не к вам.") + "</span>";
      if (!o.inv) h += '<button type="button" class="wbtn2" id="inv"' + (S.busy.inv ? " disabled" : "") + ">" + (S.busy.inv ? "Отправляем…" : "Пригласить в своё приложение") + "</button>";
      h += "</div>";
    }
    d.innerHTML = h;
    $$("[data-c]", d).forEach(function (b) { b.addEventListener("click", function () { o.c = +b.dataset.c; renderDetail(); }); });
    var act = $("#act", d); if (act) act.addEventListener("click", function () { if (o.st === 1 && o.c === null) o.c = 0; if (o.st < 3) o.st++; renderOrders(); renderFilters(); renderDetail(); });
    var inv = $("#inv", d); if (inv) inv.addEventListener("click", function () {
      S.busy.inv = true; renderDetail();
      setTimeout(function () {
        S.busy.inv = false; o.inv = true; S.base += 1; $("#baseN").textContent = fmt(S.base); renderDetail();
        toast("Гость добавлен в вашу базу.", function () { o.inv = false; S.base -= 1; $("#baseN").textContent = fmt(S.base); renderDetail(); });
      }, reduced ? 0 : 600);
    });
  }
  function renderCouriers() {
    $$("#transport button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.t === S.tr); });
    var o = S.orders.filter(function (x) { return x.id === S.cSel; })[0] || S.orders[0];
    var rows = COURIERS.map(function (k, i) { return { n: k.n, pick: k.pick, e: eta(o, i) }; });
    var best = rows.reduce(function (a, b) { return b.e < a.e ? b : a; });
    $("#clist").innerHTML = rows.map(function (r) { return '<div class="crow' + (r === best ? " best" : "") + '"><div>' + r.n + '<span class="muted">до точки ' + r.pick + ' мин</span></div><div class="meter"><i style="width:' + Math.min(100, r.e / 85 * 100) + '%"></i></div><div class="eta">' + r.e + " мин</div></div>"; }).join("");
    $("#cOrderInfo").textContent = "#" + o.id + " · " + km(o.km) + " км";
    var co = $("#cOrders"); co.innerHTML = "";
    S.orders.slice(0, 6).forEach(function (x) { var b = document.createElement("button"); b.type = "button"; b.className = "opt"; b.setAttribute("aria-pressed", x.id === o.id); b.innerHTML = "<span>#" + x.id + "</span><span>" + km(x.km) + " км</span>"; b.addEventListener("click", function () { S.cSel = x.id; renderCouriers(); }); co.appendChild(b); });
  }
  $$("#transport button").forEach(function (b) { b.addEventListener("click", function () { S.tr = b.dataset.t; renderCouriers(); renderDetail(); }); });
  function renderGuests() {
    var box = $("#segs"); box.innerHTML = "";
    SEGS.forEach(function (s) { var b = document.createElement("button"); b.type = "button"; b.className = "seg-item"; b.setAttribute("aria-pressed", S.seg === s.k); b.innerHTML = "<span>" + s.n + "</span><b>" + fmt(s.c) + '</b><span class="bar2"><i style="width:' + (s.c / 1284 * 100) + '%"></i></span>'; b.addEventListener("click", function () { S.seg = s.k; renderGuests(); }); box.appendChild(b); });
    var s = SEGS.filter(function (x) { return x.k === S.seg; })[0];
    $("#gTitle").textContent = s.n; $("#gOffer").textContent = s.t; $("#gReach").textContent = fmt(s.c) + " гостей"; $("#gReturn").textContent = "≈ " + fmt(s.c * s.r) + " заказов";
    var L = $("#gLaunch"); L.disabled = !!S.busy.launch; L.textContent = S.busy.launch ? "Запускаем…" : "Запустить рассылку";
    $("#gLog").innerHTML = S.log.length ? S.log.map(function (l) { return "<li>" + l + "</li>"; }).join("") : "<li>Рассылок пока не было.</li>";
  }
  $("#gLaunch").addEventListener("click", function () {
    var s = SEGS.filter(function (x) { return x.k === S.seg; })[0]; S.busy.launch = true; renderGuests();
    setTimeout(function () { S.busy.launch = false; var d = new Date(), t = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); S.log.unshift(t + " · " + s.n + ", охват " + fmt(s.c)); renderGuests(); toast("Рассылка запущена."); }, reduced ? 0 : 700);
  });
  var DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  function showReports() {
    var box = $("#chartBox");
    if (!reduced && !S.reportsSeen) {
      S.reportsSeen = true; box.innerHTML = '<div class="skel" style="height:208px;margin-left:56px"></div>';
      $("#sOrders").textContent = "…"; $("#sRev").textContent = "…"; $("#sComm").textContent = "…"; setTimeout(renderReports, 500);
    } else renderReports();
  }
  function renderReports() {
    if ($("#pane-reports").hidden) return;
    $$("#period button").forEach(function (b) { b.setAttribute("aria-pressed", +b.dataset.p === S.period); });
    var days = S.period, f = +$("#point").value, tot = 0, aggTot = 0, series = [];
    for (var i = 0; i < days; i++) { var wave = 1 + 0.28 * Math.sin(i * 1.3 + 1) + (((i + 1) % 7 === 5 || (i + 1) % 7 === 6) ? 0.22 : 0); var o = Math.max(1, Math.round(N.orders * f * wave)), a = Math.round(o * N.share / 100); series.push([o, a]); tot += o; aggTot += a; }
    var mx = Math.max.apply(null, series.map(function (s) { return s[0]; })), top = Math.ceil(mx / 10) * 10;
    var h = '<div class="plot">'; [0, 0.5, 1].forEach(function (p) { h += '<div class="gridl" style="bottom:' + (p * 100) + '%"><span>' + fmt(top * p) + "</span></div>"; });
    h += '<div class="bars">' + series.map(function (s, i) { var label = days === 7 ? DAYS[i] : (i + 1); return '<div class="col" tabindex="0" data-i="' + i + '" aria-label="' + label + ": " + s[0] + " заказов, из них через агрегаторы " + s[1] + '"><i class="agg-bar" style="height:' + (s[1] / top * 100) + '%"></i><i class="own-bar" style="height:' + ((s[0] - s[1]) / top * 100) + '%"></i></div>'; }).join("") + "</div></div>";
    h += '<div class="xl">' + series.map(function (s, i) { return "<span>" + (days === 7 ? DAYS[i] : ((i + 1) % 5 === 0 || i === 0 ? (i + 1) : "")) + "</span>"; }).join("") + "</div>";
    $("#chartBox").innerHTML = h;
    var total = "Всего за период: <b>" + fmt(tot) + " заказов</b>, из них через агрегаторы <b>" + fmt(aggTot) + "</b> (" + Math.round(aggTot / tot * 100) + " %). Наведите на столбик.";
    var ro = $("#readout"); ro.innerHTML = total;
    $$(".col", $("#chartBox")).forEach(function (c) {
      var show = function () { var s = series[+c.dataset.i], lab = days === 7 ? DAYS[+c.dataset.i] : ("день " + (+c.dataset.i + 1)); ro.innerHTML = "<b>" + lab + "</b> · " + s[0] + " заказов · через агрегаторы " + s[1] + " · комиссия ≈ " + rub(s[1] * N.check * N.comm / 100); };
      c.addEventListener("mouseenter", show); c.addEventListener("focus", show); c.addEventListener("mouseleave", function () { ro.innerHTML = total; });
    });
    $("#sOrders").textContent = fmt(tot); $("#sRev").textContent = rub(tot * N.check); $("#sComm").textContent = rub(aggTot * N.check * N.comm / 100);
  }
  $$("#period button").forEach(function (b) { b.addEventListener("click", function () { S.period = +b.dataset.p; renderReports(); }); });
  $("#point").addEventListener("change", renderReports);
  $("#peak").addEventListener("change", function (e) { S.peak = e.target.checked; renderFilters(); renderOrders(); renderDetail(); });
  onCalc(function () { renderDetail(); if (!$("#pane-reports").hidden) renderReports(); });

  var tt;
  function toast(m, undo) {
    var t = $("#toast"); t.innerHTML = "<span></span>"; t.firstChild.textContent = m; t.classList.remove("act");
    if (undo) { var b = document.createElement("button"); b.type = "button"; b.textContent = "Отменить"; b.addEventListener("click", function () { undo(); t.classList.remove("show", "act"); }); t.appendChild(b); t.classList.add("act"); }
    t.classList.add("show"); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove("show", "act"); }, undo ? 4500 : 2200);
  }
  function ripple(x, y) { var r = document.createElement("span"); r.className = "ripple"; r.style.left = x + "px"; r.style.top = y + "px"; win.appendChild(r); setTimeout(function () { r.remove(); }, 600); }
  win.addEventListener("pointerdown", function (e) { if (!e.isTrusted) return; var wr = win.getBoundingClientRect(); ripple(e.clientX - wr.left, e.clientY - wr.top); });

  /* курсор-призрак */
  var g = $("#ghostA"), stopped = false, running = false, runId = 0;
  g.querySelector("svg").innerHTML = '<path d="M2 2 L2 20 L6.8 15.8 L10 23 L13.4 21.5 L10.2 14.6 L16.5 14.6 Z" fill="#1B1E24" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round"/>';
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function alive(id) { return !stopped && id === runId; }
  function pos(el) { var r = el.getBoundingClientRect(), w = win.getBoundingClientRect(); return [r.left - w.left + r.width * 0.5, r.top - w.top + r.height * 0.5]; }
  async function go(el, id) { if (!el || !alive(id)) return false; var p = pos(el); g.classList.add("show"); g.style.transform = "translate(" + p[0] + "px," + p[1] + "px)"; await sleep(reduced ? 0 : 950); return alive(id); }
  async function click(el, id) { if (!el || !alive(id)) return false; var p = pos(el); g.classList.add("press"); ripple(p[0], p[1]); await sleep(160); g.classList.remove("press"); if (!alive(id)) return false; el.click(); await sleep(760); return alive(id); }
  async function step(sel, id) { return (await go($(sel), id)) && (await click($(sel), id)); }
  function hint(t) { $("#hint").textContent = t; }
  async function scenario() {
    var id = ++runId; running = true; stopped = false;
    hint(touch ? "Идёт показ. Нажмите на окно, чтобы взять управление." : "Идёт показ. Двигайте мышь по окну, чтобы взять управление.");
    while (alive(id)) {
      reset(); renderAll(); setTab("orders"); $("#peak").checked = false;
      var s0 = pos($(".wtabs")); g.style.transition = "none"; g.style.transform = "translate(" + (s0[0] * 1.6) + "px," + (s0[1] + 120) + "px)"; g.offsetHeight; g.style.transition = "";
      await sleep(500); if (!alive(id)) break;
      if (!(await step('[data-f="ya"]', id))) break;
      if (!(await step(".order", id))) break;
      if (!(await step("#act", id))) break;
      if (!(await step('[data-c="0"]', id))) break;
      if (!(await step("#act", id))) break;
      if (!(await step("#inv", id))) break;
      await sleep(1000); if (!alive(id)) break;
      if (!(await step('[data-tab="reports"]', id))) break;
      await sleep(2200); if (!alive(id)) break;
      if (!(await step('[data-tab="orders"]', id))) break;
      await sleep(1200);
    }
    running = false;
  }
  function stopGhost() { stopped = true; runId++; g.classList.remove("show"); hint("Теперь управляете вы: нажимайте на заказы, вкладки и кнопки, включите пик."); }
  win.addEventListener("pointermove", function (e) { if (e.isTrusted && e.pointerType === "mouse" && running) stopGhost(); });
  win.addEventListener("pointerdown", function (e) { if (e.isTrusted && running) stopGhost(); });
  win.addEventListener("keydown", function (e) { if (e.isTrusted && running) stopGhost(); });
  $("#replay").addEventListener("click", function () { stopped = true; runId++; S.reportsSeen = false; setTimeout(function () { stopped = false; scenario(); }, 60); });
  function renderAll() { renderFilters(); renderOrders(); renderDetail(); $("#baseN").textContent = fmt(S.base); }
  renderAll();
  if (reduced) { hint("Автопоказ отключён настройкой «уменьшить движение». Нажимайте на заказы, вкладки и кнопки."); $("#replay").hidden = true; }
  else if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !running && !stopped && !window.__started) { window.__started = true; scenario(); io.disconnect(); } }); }, { threshold: 0.5 });
    io.observe(win);
  } else { scenario(); }

  /* ---------- форма ---------- */
  var form = $("#form"), offer = $("#apply"), fName = $("#fName"), fPhone = $("#fPhone"), fCity = $("#fCity"), fOrders = $("#fOrders"), fOk = $("#fOk");
  var ordersTouched = false;
  fOrders.addEventListener("input", function () { ordersTouched = true; });
  function prefill() {
    if (!ordersTouched) fOrders.value = N.orders;
    $("#prefillNote").textContent = "Подставлено из калькулятора: " + N.orders + " заказов в день, " + N.share + " % через агрегаторы, комиссия " + N.comm + " %, средний чек " + rub(N.check) + ". Оценка потерь ≈ " + rub(monthLoss()) + " в месяц.";
  }
  function digits(s) { return s.replace(/\D/g, ""); }
  fPhone.addEventListener("input", function () {
    var d = digits(fPhone.value); if (d[0] === "7" || d[0] === "8") d = d.slice(1); d = d.slice(0, 10);
    var o = ""; if (d.length) o = "+7 (" + d.slice(0, 3); if (d.length >= 3) o += ") " + d.slice(3, 6); if (d.length >= 6) o += "-" + d.slice(6, 8); if (d.length >= 8) o += "-" + d.slice(8, 10);
    fPhone.value = o;
  });
  var rules = {
    name: function () { return fName.value.trim().length >= 2; },
    phone: function () { var d = digits(fPhone.value); if (d[0] === "7") d = d.slice(1); return d.length === 10; },
    city: function () { return fCity.value.trim().length >= 2; },
    orders: function () { var n = +fOrders.value; return n >= 1 && n <= 1000 && fOrders.value !== ""; }
  };
  var fields = { name: fName, phone: fPhone, city: fCity, orders: fOrders };
  function setBad(key, bad) { var box = $('[data-fld="' + key + '"]'); box.classList.toggle("bad", bad); $("input,select", box).setAttribute("aria-invalid", bad ? "true" : "false"); }
  Object.keys(rules).forEach(function (k) {
    var el = fields[k];
    el.addEventListener("blur", function () { if (el.value !== "") setBad(k, !rules[k]()); });
    el.addEventListener("input", function () { var box = $('[data-fld="' + k + '"]'); if (box.classList.contains("bad") && rules[k]()) setBad(k, false); });
  });
  fOk.addEventListener("change", function () { $("#chk").classList.remove("bad"); $("#eOk").style.display = "none"; });
  function validateAll() {
    var first = null, okAll = true;
    Object.keys(rules).forEach(function (k) { var ok = rules[k](); setBad(k, !ok); if (!ok) { okAll = false; if (!first) first = fields[k]; } });
    if (!fOk.checked) { okAll = false; $("#chk").classList.add("bad"); $("#eOk").style.display = "block"; if (!first) first = fOk; }
    if (first) first.focus();
    return okAll;
  }
  function setState(s) { form.dataset.state = s; $("#submit").disabled = (s === "loading"); $("#sbmText").textContent = s === "loading" ? "Отправляем…" : "Получить расчёт"; }
  function send() {
    setState("loading");
    setTimeout(function () {
      if ($("#simFail").checked || navigator.onLine === false) { setState("error"); $("#banner").scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" }); return; }
      setState("idle"); offer.dataset.done = "true";
      $("#okText").textContent = "Спасибо, " + fName.value.trim() + ". Свяжемся по номеру " + fPhone.value + " и посчитаем на ваших цифрах: " + fOrders.value + " заказов в день, ориентир потерь ≈ " + rub(monthLoss()) + " в месяц.";
      $("#okPanel").setAttribute("tabindex", "-1"); $("#okPanel").focus({ preventScroll: true });
    }, reduced ? 0 : 1300);
  }
  form.addEventListener("submit", function (e) { e.preventDefault(); if (form.dataset.state === "loading") return; if (validateAll()) send(); });
  $("#retry").addEventListener("click", function () { if (validateAll()) send(); });
  $("#again").addEventListener("click", function () { offer.dataset.done = "false"; form.reset(); ordersTouched = false; $("#simFail").checked = false; prefill(); setState("idle"); $$(".l-f").forEach(function (f) { f.classList.remove("bad"); }); fName.focus(); });

  /* ---------- шапка, FAQ, якоря, липкая кнопка ---------- */
  var header = $("[data-g2-header]");
  if (header) { var onScroll = function () { header.classList.toggle("is-stuck", window.scrollY > 8); }; onScroll(); window.addEventListener("scroll", onScroll, { passive: true }); }
  var items = $$(".g2-accordion__item");
  items.forEach(function (item) {
    var head = $(".g2-accordion__head", item);
    head.addEventListener("click", function () {
      var willOpen = !item.classList.contains("is-open");
      items.forEach(function (el) { var open = el === item && willOpen; el.classList.toggle("is-open", open); $(".g2-accordion__head", el).setAttribute("aria-expanded", open ? "true" : "false"); });
    });
  });
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href"); if (id.length < 2) return;
      var t = $(id); if (!t) return; e.preventDefault();
      window.scrollTo({ top: id === "#hero" ? 0 : t.getBoundingClientRect().top + window.scrollY - 72, behavior: reduced ? "auto" : "smooth" });
      if (id === "#apply") setTimeout(function () { if (offer.dataset.done === "false") fName.focus({ preventScroll: true }); }, reduced ? 0 : 700);
    });
  });
  var bar = $("#bar");
  new IntersectionObserver(function (es) { es.forEach(function (e) { bar.classList.toggle("show", !e.isIntersecting); }); }, { threshold: 0 }).observe($("#hero"));
  new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { bar.classList.remove("show"); bar.style.display = "none"; } else bar.style.display = ""; }); }, { threshold: 0.2 }).observe(offer);

  /* ---------- запуск ---------- */
  calc();
  drawWaves();
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { drawLeds(); drawWaves(); }, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawLeds);
  typo(document.body);
  new MutationObserver(function () { typo(document.body); }).observe(document.body, { childList: true, subtree: true, characterData: true });
})();
