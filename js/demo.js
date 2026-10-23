// Демо интерфейса Goulash: окно смены с живыми заказами. Все данные выдуманы.
(function () {
  const root = document.getElementById("gp");
  if (!root) return;

  const $ = (id) => document.getElementById(id);
  const NB = " ";
  const STAGES = ["Отложенные", "Принятые", "Кухня", "Приготовлено", "В пути"];
  const STEP_NAMES = ["Принят", "Передан на кухню", "Приготовлен", "Передан курьеру", "Доставлен"];
  const SOURCES = ["Яндекс Еда", "Свой сайт", "Телефон", "Delivery Club"];
  const UNITS = [
    { id: "all", name: "Все подразделения", promise: 35 },
    { id: "center", name: "Центр", promise: 32 },
    { id: "south", name: "Юго-запад", promise: 40 },
  ];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let uid = 1;
  function mk(id, t, sum, old, stage, late, extra) {
    return Object.assign(
      {
        uid: uid++,
        id,
        t,
        sum,
        old: old || null,
        stage,
        late: late || 0,
        pre: /^[ПТ]-/.test(id),
        src: SOURCES[uid % SOURCES.length],
        unit: uid % 2 ? "center" : "south",
        phone: "+7 9" + String(10 + (uid * 7) % 90) + " " + String(100 + (uid * 37) % 900) + "-" + String(10 + (uid * 13) % 90) + "-" + String(10 + (uid * 29) % 90),
      },
      extra || {}
    );
  }

  const orders = [
    mk("0004", "16:50", 648, 1249, 0), mk("0008", "15:15", 1837, 2378, 0), mk("0016", "16:45", 1258, 1792, 0),
    mk("0002", "17:05", 1834, 0, 0), mk("П-0003", "18:20", 3485, 4000, 0),
    mk("0011", "13:30", 648, 1249, 1), mk("0018", "13:30", 1837, 0, 1), mk("0026", "13:20", 1792, 0, 1),
    mk("0012", "13:45", 1834, 3001, 1), mk("П-0013", "13:30", 3485, 0, 1),
    mk("0022", "12:30", 110234, 235234, 2, 10), mk("0023", "12:30", 1234, 2234, 2, 10), mk("4253", "12:30", 234, 2234, 2, 10),
    mk("П-4255", "12:30", 1234, 0, 2, 20), mk("0024", "13:00", 648, 0, 2),
    mk("Т-4256", "12:20", 9234, 12234, 3, 1), mk("0031", "12:30", 2384, 0, 3), mk("П-0037", "12:30", 668, 0, 3), mk("0038", "12:30", 3871, 0, 3),
    mk("4263", "12:00", 1234, 2234, 4, 2), mk("0044", "12:30", 2665, 0, 4), mk("0047", "12:10", 2668, 2668, 4), mk("0048", "12:25", 1846, 0, 4), mk("0046", "12:00", 1547, 0, 4),
  ];

  const state = {
    unit: "all",
    force: false,
    q: "",
    sort: "new",
    onlyLate: false,
    onlyPre: false,
    open: null,
    dialog: null,
    stage: null,
    collapsed: false,
    screen: "Главная",
    payPick: null,
    clock: 13 * 3600 + 57 * 60 + 44,
    rev: 1123000,
    pay: [247060, 494120, 381820],
    cash: 115038,
    total: 2909,
    seq: 5000,
  };

  const money = (n) => Math.round(n).toLocaleString("ru-RU").replace(/\s/g, NB);
  const hhmm = (s) => String(Math.floor(s / 3600)).padStart(2, "0") + ":" + String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const hhmmss = (s) => hhmm(s) + ":" + String(s % 60).padStart(2, "0");
  const plural = (n, a, b, c) => {
    const m = Math.abs(n) % 100, d = m % 10;
    if (m > 10 && m < 20) return c;
    if (d > 1 && d < 5) return b;
    return d === 1 ? a : c;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // фильтрация и сортировка
  function visible() {
    const q = state.q.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return orders.filter((o) => {
      if (state.unit !== "all" && o.unit !== state.unit) return false;
      if (state.onlyLate && !o.late) return false;
      if (state.onlyPre && !o.pre) return false;
      if (q) {
        const byId = o.id.toLowerCase().includes(q);
        const byPhone = qd.length > 1 && o.phone.replace(/\D/g, "").includes(qd);
        if (!byId && !byPhone) return false;
      }
      return true;
    });
  }
  const bySort = (a, b) => (state.sort === "new" ? b.t.localeCompare(a.t) : a.t.localeCompare(b.t));

  // доска
  function renderBoard() {
    const list = visible();
    const kb = $("gp-kanban");
    const cols = STAGES.map((name, i) => {
      const items = list.filter((o) => o.stage === i).sort(bySort);
      const cards = items.length
        ? items.map(cardHtml).join("")
        : '<li class="gp__empty">Нет заказов</li>';
      return { name, n: items.length, html: cards };
    });
    kb.innerHTML =
      cols.map((c, i) => `<div class="gp__col-h${state.stage === i ? " is-on" : ""}" data-colstage="${i}" role="button" tabindex="0">${c.name} <em>${c.n}</em></div>`).join("") +
      `<div class="gp__group" data-group role="button" tabindex="0"><i></i><b>Доставка</b> (${list.length} ${plural(list.length, "заказ", "заказа", "заказов")}) ${state.collapsed ? "▸" : "▾"}</div>` +
      cols.map((c, i) => `<ul class="gp__list${state.collapsed ? " is-collapsed" : ""}" data-stage="${i}">${c.html}</ul>`).join("");
    kb.classList.toggle("has-stage", state.stage !== null);
    kb.querySelectorAll(".gp__list").forEach((ul) => {
      if (Number(ul.dataset.stage) === state.stage) ul.querySelectorAll("li").forEach((li) => li.classList.add("is-stage"));
    });
    list.forEach((o) => seen.add(o.uid + ":" + o.stage));
    const lateAll = orders.filter((o) => o.late && (state.unit === "all" || o.unit === state.unit)).length;
    $("gp-count").textContent = String(list.length);
    $("gp-late-badge").textContent = "Опаздывает " + lateAll;
  }

  const seen = new Set();
  function cardHtml(o) {
    const warn = o.late >= 10 ? "⚠ " : "";
    const late = o.late ? `<small>−${o.late}${NB}мин</small>` : "";
    const old = o.old ? `<s>${money(o.old)}${NB}₽</s>` : "";
    return `<li><button type="button" class="gp__card${o.late ? " is-late" : ""}${seen.has(o.uid + ":" + o.stage) ? "" : " is-new"}" data-uid="${o.uid}">
      <strong>${warn}${esc(o.id)}${late}</strong><time>${o.t}</time>
      <span>${money(o.sum)}${NB}₽${old}</span><span></span>
    </button></li>`;
  }

  // панели кухни и доставки
  function paintCells(key, items) {
    const cells = root.querySelectorAll(`[data-cells="${key}"] span`);
    cells.forEach((c, i) => {
      const o = items[i];
      c.className = o ? (o.late >= 10 ? "r" : o.late ? "y" : "g") : "";
      if (o) c.dataset.uid = o.uid; else delete c.dataset.uid;
    });
  }
  function renderPanels() {
    const scope = orders.filter((o) => state.unit === "all" || o.unit === state.unit);
    const st = (n) => scope.filter((o) => o.stage === n);
    const maxLate = (arr) => arr.reduce((m, o) => Math.max(m, o.late), 0);
    const kitchen = st(2), ready = st(3), road = st(4);
    $("gp-k-late").textContent = String(maxLate(kitchen));
    $("gp-k-box").classList.toggle("is-warn", maxLate(kitchen) > 0);
    $("gp-d-late").textContent = String(maxLate(ready));
    const roadLate = [...ready, ...road].filter((o) => o.late);
    $("gp-c-all").textContent = String(roadLate.length);
    $("gp-c-max").textContent = String(maxLate([...ready, ...road]));
    $("gp-c-box").classList.toggle("is-warn", roadLate.length > 0);
    $("gp-k-avg").textContent = String(state.force ? 19 : 12);
    $("gp-c-avg").textContent = String(state.force ? 48 : 35);
    paintCells("kitchen", kitchen);
    paintCells("drinks", ready);
    paintCells("walk", road.filter((_, i) => i % 3 === 0));
    paintCells("bike", road.filter((_, i) => i % 3 === 1));
    paintCells("car", road.filter((_, i) => i % 3 === 2));
  }

  function renderTop() {
    const u = UNITS.find((x) => x.id === state.unit);
    const base = u.promise + (state.force ? 15 : 0);
    $("gp-promise").textContent = String(base);
    $("gp-calc").textContent = String(base - 1 + (orders.filter((o) => o.late).length > 8 ? 1 : 0));
    $("gp-unit-name").textContent = u.name;
    $("gp-cash").innerHTML = money(state.cash) + NB + "₽";
    const sum = state.pay[0] + state.pay[1] + state.pay[2];
    $("gp-rev").innerHTML = money(state.rev) + NB + "₽";
    $("gp-plan").textContent = Math.round((state.rev / 2000000) * 100) + "%";
    $("gp-total").innerHTML = money(state.total);
    [1, 2, 3].forEach((n) => {
      $("gp-p" + n).innerHTML = money(state.pay[n - 1]);
      $("gp-m" + n).style.width = (state.pay[n - 1] / sum) * 100 + "%";
    });
    const tr = root.querySelectorAll(".gp__pay > div");
    tr.forEach((row, i) => {
      row.children[1].textContent = Math.round((state.pay[i] / sum) * 100) + "%";
    });
  }

  function renderChrome() {
    root.querySelectorAll(".gp__stat").forEach((s) => s.classList.toggle("is-on", Number(s.dataset.stage) === state.stage));
    root.querySelector(".gp__stats").classList.toggle("has-stage", state.stage !== null);
    const pay = root.querySelector(".gp__pay");
    pay.classList.toggle("has-pick", state.payPick !== null);
    pay.querySelectorAll(".gp__payrow").forEach((r) => r.classList.toggle("is-on", Number(r.dataset.pay) === state.payPick));
    [1, 2, 3].forEach((n) => { $("gp-m" + n).style.opacity = state.payPick === null || state.payPick === n - 1 ? 1 : 0.25; });
    root.querySelectorAll(".gp__menu li").forEach((li) => li.classList.toggle("is-on", li.firstChild.dataset.screen === state.screen));
  }

  function renderAll() {
    renderChrome();
    renderBoard();
    renderPanels();
    renderTop();
    if (state.screen === "Станция кухни") renderScreen(state.screen);
    if (state.open) renderSheet();
    else if (state.dialog) renderDialog();
  }

  // часы и обновление
  function tickClock() {
    state.clock = (state.clock + 1) % 86400;
  }
  let lastUpd = state.clock;
  function stampUpdate() {
    lastUpd = state.clock;
    $("gp-upd").textContent = hhmmss(lastUpd);
  }

  // событие: новый заказ или движение по этапам
  function simulate() {
    const r = Math.random();
    if (r < 0.34) {
      state.seq += 1;
      const sums = [648, 890, 1240, 1560, 2120, 2480];
      const o = mk(String(state.seq % 10000).padStart(4, "0"), hhmm(state.clock), sums[Math.floor(Math.random() * sums.length)], 0, 1);
      if (state.force && Math.random() < 0.6) o.late = 5;
      orders.push(o);
    } else {
      const movable = orders.filter((o) => o.uid !== state.open);
      if (!movable.length) return;
      const o = movable[Math.floor(Math.random() * movable.length)];
      advance(o, true);
    }
    // небольшая динамика опозданий
    orders.forEach((o) => {
      if (o.late && o.late < 30 && Math.random() < 0.12) o.late += 1;
      else if (!o.late && o.stage >= 2 && Math.random() < (state.force ? 0.25 : 0.02)) o.late = 1;
    });
    stampUpdate();
    renderAll();
  }

  function advance(o, quiet) {
    if (o.stage >= 4) {
      deliver(o);
      return;
    }
    o.stage += 1;
    if (o.late && Math.random() < 0.4) o.late = Math.max(0, o.late - 3);
    if (!quiet) renderAll();
  }
  function deliver(o) {
    const i = orders.indexOf(o);
    if (i >= 0) orders.splice(i, 1);
    state.rev += o.sum;
    state.total += 1;
    const m = o.src === "Телефон" ? 0 : o.src === "Свой сайт" ? 2 : 1;
    state.pay[m] += o.sum;
    if (m === 0) state.cash += o.sum;
  }

  // карточка заказа
  function renderSheet() {
    const o = orders.find((x) => x.uid === state.open);
    if (!o) {
      closeSheet();
      return;
    }
    const steps = STEP_NAMES.map((name, i) => {
      const cls = i < o.stage ? "is-done" : i === o.stage ? "is-now" : "";
      return `<li class="${cls}">${name}<span></span><small>${i < o.stage ? hhmm(state.clock - (o.stage - i) * 420) : ""}</small></li>`;
    }).join("");
    const nextLabel = o.stage >= 4 ? "Отметить доставленным" : "Передать дальше: " + STAGES[o.stage + 1];
    $("gp-sheet").innerHTML = `
      <div class="gp__sheet-h">
        <div><h3>Заказ ${esc(o.id)}${o.pre ? ", предварительный" : ""}</h3><p>${esc(o.src)}, ${esc(o.phone)}</p></div>
        <button type="button" class="gp__x" id="gp-x" aria-label="Закрыть">×</button>
      </div>
      <div class="gp__facts2">
        <div><span>Сумма</span><b>${money(o.sum)}${NB}₽</b></div>
        <div><span>К времени</span><b>${o.t}</b></div>
        <div><span>Этап</span><b>${STAGES[o.stage]}</b></div>
      </div>
      <ul class="gp__steps">${steps}</ul>
      ${o.late ? `<p class="gp__late-note">Опаздывает на ${o.late}${NB}${plural(o.late, "минуту", "минуты", "минут")}.</p>` : ""}
      <button type="button" class="gp__next" id="gp-next">${nextLabel}</button>`;
    $("gp-x").addEventListener("click", closeSheet);
    $("gp-next").addEventListener("click", () => {
      const was = o.stage;
      if (was >= 4) {
        deliver(o);
        closeSheet();
        toast("Заказ " + o.id + " доставлен. Выручка обновилась.");
      } else {
        advance(o, true);
        toast("Заказ " + o.id + ": " + STAGES[o.stage]);
      }
      stampUpdate();
      renderAll();
    });
  }
  let lastFocus = null;
  function openSheet(uidv, from) {
    state.open = uidv;
    lastFocus = from || null;
    $("gp-drawer").classList.add("is-open");
    renderSheet();
    const x = $("gp-x");
    if (x) x.focus();
  }
  function closeSheet() {
    state.open = null;
    state.dialog = null;
    $("gp-drawer").classList.remove("is-open");
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  // окна действий смены
  const EMP = ["Дима", "Оля", "Ильяс", "Аня"];
  const dlgState = { taxi: new Set(), staff: new Set(), qty: {} };
  function openDialog(kind) {
    state.open = null;
    state.dialog = kind;
    lastFocus = root.querySelector(`[data-act="${kind}"]`);
    $("gp-drawer").classList.add("is-open");
    renderDialog();
    const x = $("gp-x");
    if (x) x.focus();
  }
  function head(title, sub) {
    return `<div class="gp__sheet-h"><div><h3>${title}</h3><p>${sub}</p></div><button type="button" class="gp__x" id="gp-x" aria-label="Закрыть">×</button></div>`;
  }
  function renderDialog() {
    const k = state.dialog;
    if (!k) return;
    let html = "";
    if (k === "taxi") {
      const ready = orders.filter((o) => o.stage === 3).sort(bySort);
      dlgState.taxi.forEach((u) => { if (!ready.find((o) => o.uid === u)) dlgState.taxi.delete(u); });
      html = head("Такси", "Выберите готовые заказы, которые поедут на такси.") +
        `<div class="gp__rows">${ready.length ? ready.map((o) => `<label><input type="checkbox" data-pick="${o.uid}"${dlgState.taxi.has(o.uid) ? " checked" : ""}><span><b>${esc(o.id)}</b>, ${money(o.sum)}${NB}₽</span><em>к ${o.t}</em></label>`).join("") : '<p class="gp__none">Готовых заказов нет.</p>'}</div>` +
        `<button type="button" class="gp__next" id="gp-do"${dlgState.taxi.size ? "" : " disabled"}>Вызвать такси${dlgState.taxi.size ? " (" + dlgState.taxi.size + ")" : ""}</button>`;
    } else if (k === "writeoff") {
      const items = ["Пепперони 30 см", "Филадельфия", "Бургер классик", "Шаурма XL"];
      html = head("Списание с витрины", "Сколько позиций списать.") +
        `<div class="gp__rows">${items.map((d) => `<div class="gp__step"><span>${esc(d)}</span><div><button type="button" data-qty="${esc(d)}" data-d="-1" aria-label="Меньше">−</button><b>${dlgState.qty[d] || 0}</b><button type="button" data-qty="${esc(d)}" data-d="1" aria-label="Больше">+</button></div></div>`).join("")}</div>` +
        `<button type="button" class="gp__next" id="gp-do"${Object.values(dlgState.qty).some((n) => n > 0) ? "" : " disabled"}>Списать</button>`;
    } else if (k === "staff") {
      html = head("Развоз сотрудников", "Кто едет в этом рейсе.") +
        `<div class="gp__rows">${EMP.map((n) => `<label><input type="checkbox" data-emp="${n}"${dlgState.staff.has(n) ? " checked" : ""}><span><b>${n}</b></span><em>на смене</em></label>`).join("")}</div>` +
        `<button type="button" class="gp__next" id="gp-do"${dlgState.staff.size ? "" : " disabled"}>Создать маршрут${dlgState.staff.size ? " (" + dlgState.staff.size + ")" : ""}</button>`;
    } else if (k === "close") {
      const left = orders.filter((o) => o.stage < 4).length;
      const onRoad = orders.filter((o) => o.stage === 4).length;
      html = head("Закрытие смены", left ? "Сначала нужно завершить заказы в работе." : "Всё выдано, смену можно закрывать.") +
        `<div class="gp__facts2"><div><span>Выручка</span><b>${money(state.rev)}${NB}₽</b></div><div><span>Заказов</span><b>${money(state.total)}</b></div><div><span>В работе</span><b>${left + onRoad}</b></div></div>` +
        `<button type="button" class="gp__next" id="gp-do">${left + onRoad ? "Завершить заказы и закрыть смену" : "Закрыть смену"}</button>`;
    }
    $("gp-sheet").innerHTML = html;
    $("gp-x").addEventListener("click", closeSheet);
    const go = $("gp-do");
    if (go) go.addEventListener("click", runDialog);
  }
  function runDialog() {
    const k = state.dialog;
    if (k === "taxi") {
      const n = dlgState.taxi.size;
      orders.filter((o) => dlgState.taxi.has(o.uid)).forEach((o) => { o.stage = 4; });
      dlgState.taxi.clear();
      closeSheet();
      toast("Такси вызвано: " + n + " " + plural(n, "заказ уехал", "заказа уехали", "заказов уехали") + ".");
    } else if (k === "writeoff") {
      const parts = Object.entries(dlgState.qty).filter(([, n]) => n > 0).map(([d, n]) => d + " × " + n);
      dlgState.qty = {};
      closeSheet();
      toast("Списано: " + parts.join(", ") + ".");
    } else if (k === "staff") {
      const names = [...dlgState.staff].join(", ");
      dlgState.staff.clear();
      closeSheet();
      toast("Маршрут создан: " + names + ".");
    } else if (k === "close") {
      const rest = orders.slice();
      rest.forEach((o) => deliver(o));
      closeSheet();
      toast("Смена закрыта. Выручка за смену: " + money(state.rev) + NB + "₽.");
      stampUpdate();
      // новая смена: подкидываем несколько заказов, чтобы окно не пустело
      for (let i = 0; i < 6; i++) simulate();
      return;
    }
    stampUpdate();
    renderAll();
  }
  $("gp-sheet").addEventListener("change", (e) => {
    const c = e.target;
    if (c.dataset.pick) { const u = Number(c.dataset.pick); c.checked ? dlgState.taxi.add(u) : dlgState.taxi.delete(u); renderDialog(); }
    else if (c.dataset.emp) { c.checked ? dlgState.staff.add(c.dataset.emp) : dlgState.staff.delete(c.dataset.emp); renderDialog(); }
  });
  $("gp-sheet").addEventListener("click", (e) => {
    const b = e.target.closest("[data-qty]");
    if (!b) return;
    const d = b.dataset.qty;
    dlgState.qty[d] = Math.max(0, Math.min(9, (dlgState.qty[d] || 0) + Number(b.dataset.d)));
    renderDialog();
  });

  // подсказки
  let toastTimer = 0;
  function toast(text) {
    const t = $("gp-toast");
    t.textContent = text;
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-on"), 3200);
  }

  // события
  $("gp-kanban").addEventListener("click", (e) => {
    const b = e.target.closest(".gp__card");
    if (b) openSheet(Number(b.dataset.uid), b);
  });
  $("gp-drawer").addEventListener("click", (e) => {
    if (e.target === $("gp-drawer")) closeSheet();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (state.open || state.dialog)) closeSheet();
  });

  $("gp-search").addEventListener("input", (e) => { state.q = e.target.value; renderBoard(); });
  const sortMenu = $("gp-sort-menu");
  function closeSort() { sortMenu.classList.remove("is-open"); $("gp-sort").setAttribute("aria-expanded", "false"); }
  $("gp-sort").addEventListener("click", (e) => {
    e.stopPropagation();
    const open = !sortMenu.classList.contains("is-open");
    sortMenu.classList.toggle("is-open", open);
    $("gp-sort").setAttribute("aria-expanded", String(open));
  });
  sortMenu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sort]");
    if (!b) return;
    state.sort = b.dataset.sort;
    sortMenu.querySelectorAll("button").forEach((x) => x.classList.toggle("is-on", x === b));
    $("gp-sort-label").textContent = b.textContent;
    closeSort();
    renderBoard();
  });
  document.addEventListener("click", closeSort);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSort(); });
  $("gp-only-late").addEventListener("change", (e) => { state.onlyLate = e.target.checked; renderBoard(); });
  $("gp-only-pre").addEventListener("change", (e) => { state.onlyPre = e.target.checked; renderBoard(); });
  $("gp-refresh").addEventListener("click", (e) => {
    const b = e.currentTarget;
    b.classList.add("is-spin");
    setTimeout(() => b.classList.remove("is-spin"), 500);
    simulate();
  });

  // экраны меню
  const DISHES = ["Пепперони 30 см", "Филадельфия", "Wok курица", "Бургер классик", "Шаурма XL", "Цезарь ролл", "Калифорния", "Маргарита"];
  const stops = new Set(["Филадельфия"]);
  function dishesOf(o) { return [DISHES[o.uid % DISHES.length], DISHES[(o.uid * 3 + 1) % DISHES.length]]; }
  function setScreen(name) {
    state.screen = name;
    const main = root.querySelector(".gp__main");
    const host = $("gp-screen");
    main.classList.toggle("is-view-orders", name === "Заказы");
    const special = name !== "Главная" && name !== "Заказы";
    main.classList.toggle("is-screen", special);
    host.hidden = !special;
    if (special) renderScreen(name);
    renderChrome();
  }
  function renderScreen(name) {
    const host = $("gp-screen");
    if (name === "Станция кухни") {
      const items = orders.filter((o) => o.stage === 2).sort(bySort);
      host.innerHTML = `<h3>Станция кухни</h3><p>${items.length ? "Заказы в работе. Нажмите «Готово», когда блюда собраны." : "Все блюда приготовлены."}</p>
        <div class="gp__tickets">${items.map((o) => `<div class="gp__ticket${o.late ? " is-late" : ""}"><strong>${esc(o.id)}</strong><span>к ${o.t}${o.late ? ", −" + o.late + NB + "мин" : ""}</span><ul>${dishesOf(o).map((d) => `<li>${esc(d)}${stops.has(d) ? " (стоп)" : ""}</li>`).join("")}</ul><button type="button" data-ready="${o.uid}">Готово</button></div>`).join("")}</div>`;
    } else if (name === "Стоп-лист") {
      host.innerHTML = `<h3>Стоп-лист</h3><p>Блюдо в стопе пропадает из каналов заказа. Нажмите на строку, чтобы поставить или снять.</p>
        <div class="gp__stoplist">${DISHES.map((d) => `<button type="button" class="gp__stoprow${stops.has(d) ? " is-stop" : ""}" data-dish="${esc(d)}"><span>${esc(d)}<em>${stops.has(d) ? "в стопе" : "в меню"}</em></span><span>${stops.has(d) ? "Снять" : "В стоп"}</span></button>`).join("")}</div>`;
    } else if (SCREENS[name]) {
      host.innerHTML = SCREENS[name]();
    } else {
      host.innerHTML = `<div class="gp__soon"><h3>${esc(name)}</h3><p>Этот раздел в демо не открывается. Попробуйте «Станция кухни», «Стоп-лист» или «Заказы».</p><button type="button" data-screen="Главная">На главную</button></div>`;
    }
  }

  // ---- остальные разделы меню ----
  const PRICES = { "Пепперони 30 см": 890, "Филадельфия": 1240, "Wok курица": 670, "Бургер классик": 540, "Шаурма XL": 420, "Цезарь ролл": 510, "Калифорния": 980, "Маргарита": 690 };
  const sc = {
    draft: { src: "Телефон", phone: "", qty: {} },
    tables: Array.from({ length: 12 }, (_, i) => ({ n: i + 1, st: [0, 1, 1, 2, 0, 1, 0, 0, 2, 1, 0, 1][i] })),
    dict: { tab: "dishes", q: "" },
    guard: [["Дима", "кухня", true], ["Оля", "курьер", true], ["Ильяс", "курьер", false], ["Аня", "администратор", true], ["Руслан", "повар", true]],
    exp: [["Продукты", 48200], ["Аренда", 30000], ["Зарплата", 62500], ["Упаковка", 8400], ["Маркетинг", 12000]],
    hours: [18, 24, 31, 42, 55, 68, 74, 61, 48, 39, 27, 20],
    hourPick: null,
    stock: [["Тесто, кг", 24, 20], ["Сыр моцарелла, кг", 6, 10], ["Лосось, кг", 4, 8], ["Рис, кг", 31, 15], ["Курица, кг", 12, 10], ["Коробки 30 см, шт", 140, 100]],
    buy: [["Сыр моцарелла, кг", 640, 640], ["Лосось, кг", 1320, 1320], ["Курица, кг", 310, 310], ["Рис, кг", 120, 120], ["Тесто, кг", 85, 85]],
    sets: [["Автообновление заказов", true], ["Подсвечивать опоздания", true], ["Звук при новом заказе", false], ["Показывать предварительные", true]],
    segs: [["Спят 30 дней", 184, "Ролл в подарок от 1 200 ₽ — на ваш сайт, не в ленту агрегатора."], ["Ходят каждую неделю", 96, "Бонус x2 на самовывоз: им и так дешевле у вас, чем в агрегаторе."], ["Первый заказ с сайта", 41, "Второй заказ со скидкой 10% в приложении, чтобы не ушли на площадку."]],
    cams: ["Кухня", "Зал", "Склад", "Вход"],
    cam: 0,
    lists: [["Открытие смены", ["Проверить температуру холодильников", "Включить пароконвектомат", "Проверить остатки тары"], [true, false, false]], ["Закрытие смены", ["Вымыть линию раздачи", "Сдать кассу", "Выключить оборудование"], [false, false, false]]],
    guestSent: new Set(),
  };
  const card = (inner) => `<div class="gp__card2">${inner}</div>`;
  const SCREENS = {
    "Принять заказ"() {
      const d = sc.draft;
      const total = Object.entries(d.qty).reduce((s, [k, n]) => s + PRICES[k] * n, 0);
      return `<h3>Новый заказ</h3><p>Соберите заказ и нажмите «Принять»: он попадёт в «Принятые» на главной.</p>
        <div class="gp__seg">${SOURCES.slice(0, 3).map((s) => `<button type="button" class="${d.src === s ? "is-on" : ""}" data-sc="src" data-v="${s}">${s}</button>`).join("")}</div>
        <input class="gp__field" data-sc="phone" type="tel" inputmode="tel" placeholder="Телефон гостя" value="${esc(d.phone)}" aria-label="Телефон гостя">
        <div class="gp__rows">${Object.keys(PRICES).map((k) => `<div class="gp__step"><span>${esc(k)} <em>${PRICES[k]}${NB}₽</em></span><div><button type="button" data-sc="qty" data-d="-1" data-k="${esc(k)}" aria-label="Меньше">−</button><b>${d.qty[k] || 0}</b><button type="button" data-sc="qty" data-d="1" data-k="${esc(k)}" aria-label="Больше">+</button></div></div>`).join("")}</div>
        <button type="button" class="gp__next" data-sc="accept">Принять заказ, ${money(total)}${NB}₽</button>`;
    },
    "Зал"() {
      const names = ["Свободен", "Занят", "Просит счёт"];
      const cnt = [0, 1, 2].map((s) => sc.tables.filter((t) => t.st === s).length);
      return `<h3>Зал</h3><p>Нажмите на стол, чтобы сменить статус. Свободно: ${cnt[0]}, занято: ${cnt[1]}, ждут счёт: ${cnt[2]}.</p>
        <div class="gp__tables">${sc.tables.map((t) => `<button type="button" class="gp__tbl s${t.st}" data-sc="tbl" data-n="${t.n}"><b>${t.n}</b><span>${names[t.st]}</span></button>`).join("")}</div>`;
    },
    "Справочники"() {
      const D = { dishes: Object.entries(PRICES).map(([k, v]) => [k, v + NB + "₽"]), zones: [["Центр", "до 30 мин"], ["Юго-запад", "до 40 мин"], ["Ленина", "до 35 мин"], ["Пригород", "до 60 мин"]], staff: sc.guard.map((g) => [g[0], g[1]]) };
      const q = sc.dict.q.trim().toLowerCase();
      const rows = D[sc.dict.tab].filter((r) => !q || r[0].toLowerCase().includes(q));
      return `<h3>Справочники</h3>
        <div class="gp__seg">${[["dishes", "Блюда"], ["zones", "Зоны доставки"], ["staff", "Сотрудники"]].map(([k, n]) => `<button type="button" class="${sc.dict.tab === k ? "is-on" : ""}" data-sc="dtab" data-v="${k}">${n}</button>`).join("")}</div>
        <input class="gp__field" data-sc="dq" type="search" placeholder="Поиск" value="${esc(sc.dict.q)}" aria-label="Поиск по справочнику">
        <div class="gp__rows">${rows.length ? rows.map((r) => `<div class="gp__line"><span>${esc(r[0])}</span><em>${esc(r[1])}</em></div>`).join("") : '<p class="gp__none">Ничего не найдено.</p>'}</div>`;
    },
    "Пост охраны"() {
      return `<h3>Пост охраны</h3><p>Кто сейчас на посту. Нажмите, чтобы отметить приход или уход.</p>
        <div class="gp__rows">${sc.guard.map((g, i) => `<button type="button" class="gp__line gp__btnrow${g[2] ? " is-ok" : ""}" data-sc="guard" data-i="${i}"><span><b>${g[0]}</b>, ${g[1]}</span><em>${g[2] ? "на посту" : "не пришёл"}</em></button>`).join("")}</div>`;
    },
    "Учёт расходов"() {
      const total = sc.exp.reduce((s, e) => s + e[1], 0);
      const max = Math.max(...sc.exp.map((e) => e[1]));
      return `<h3>Учёт расходов</h3><p>Расходов за смену: ${money(total)}${NB}₽.</p>
        <div class="gp__rows">${sc.exp.map((e) => `<div class="gp__bar2"><span>${e[0]}</span><i style="--w:${(e[1] / max) * 100}%"></i><b>${money(e[1])}${NB}₽</b></div>`).join("")}</div>
        <div class="gp__inline"><input class="gp__field" data-sc="expname" placeholder="Статья" aria-label="Статья расходов"><input class="gp__field" data-sc="expsum" type="number" inputmode="numeric" placeholder="Сумма, ₽" aria-label="Сумма"><button type="button" class="gp__next" data-sc="expadd">Добавить</button></div>`;
    },
    "Учёт выручки"() {
      const max = Math.max(...sc.hours);
      const pick = sc.hourPick;
      return `<h3>Учёт выручки</h3><p>${pick === null ? "Выручка по часам. Нажмите на столбик." : `${11 + pick}:00 — ${money(sc.hours[pick] * 1000)}${NB}₽`} Всего за смену: ${money(state.rev)}${NB}₽.</p>
        <div class="gp__chart">${sc.hours.map((h, i) => `<button type="button" class="${pick === i ? "is-on" : ""}" data-sc="hour" data-i="${i}" style="--h:${(h / max) * 100}%" aria-label="${11 + i}:00"><span>${11 + i}</span></button>`).join("")}</div>
        <div class="gp__line"><span>Наличные</span><em>${money(state.pay[0])}${NB}₽</em></div><div class="gp__line"><span>Безнал</span><em>${money(state.pay[1])}${NB}₽</em></div><div class="gp__line"><span>Онлайн</span><em>${money(state.pay[2])}${NB}₽</em></div>`;
    },
    "Учёт товаров"() {
      return `<h3>Учёт товаров</h3><p>Остатки на складе. Низкие остатки подсвечены, нажмите «+», чтобы заказать.</p>
        <div class="gp__rows">${sc.stock.map((s, i) => `<div class="gp__line${s[1] < s[2] ? " is-low" : ""}"><span>${s[0]}</span><em>${s[1]}${s[1] < s[2] ? ", мало" : ""}</em><button type="button" class="gp__mini" data-sc="stock" data-i="${i}">+10</button></div>`).join("")}</div>`;
    },
    "Закупочные цены"() {
      return `<h3>Закупочные цены</h3><p>Измените цену поставщика, чтобы увидеть, как она отразится на себестоимости.</p>
        <div class="gp__rows">${sc.buy.map((b, i) => { const d = b[1] - b[2]; return `<div class="gp__line"><span>${b[0]}</span><input class="gp__num" type="number" inputmode="numeric" value="${b[1]}" data-sc="buy" data-i="${i}" aria-label="Цена, ${esc(b[0])}"><em class="${d > 0 ? "up" : d < 0 ? "down" : ""}">${d === 0 ? "без изменений" : (d > 0 ? "+" : "−") + Math.abs(Math.round((d / b[2]) * 100)) + "%"}</em></div>`; }).join("")}</div>`;
    },
    "Настройки"() {
      return `<h3>Настройки</h3><p>Работают сразу.</p>
        <div class="gp__rows">${sc.sets.map((s, i) => `<label class="gp__line"><span>${s[0]}</span><input type="checkbox" class="gp__sw" data-sc="set" data-i="${i}"${s[1] ? " checked" : ""}></label>`).join("")}</div>`;
    },
    "Гости"() {
      return `<h3>Гости</h3><p>Сегменты. Предложение уходит на ваш сайт и в приложение, а не в ленту агрегатора.</p>
        <div class="gp__rows">${sc.segs.map((g, i) => `<div class="gp__seg2"><div><b>${g[0]}</b><em>${g[1]} гостей</em><p>${g[2]}</p></div><button type="button" class="gp__mini2${sc.guestSent.has(i) ? " is-ok" : ""}" data-sc="seg" data-i="${i}">${sc.guestSent.has(i) ? "Отправлено" : "Отправить"}</button></div>`).join("")}</div>`;
    },
    "Видео"() {
      return `<h3>Видео</h3><p>Камеры точки. Выберите камеру.</p>
        <div class="gp__cam gp__cam--big"><span class="gp__live">● LIVE</span><b>${sc.cams[sc.cam]}</b></div>
        <div class="gp__seg">${sc.cams.map((c, i) => `<button type="button" class="${sc.cam === i ? "is-on" : ""}" data-sc="cam" data-i="${i}">${c}</button>`).join("")}</div>`;
    },
    "Чек-листы"() {
      return `<h3>Чек-листы</h3>${sc.lists.map((l, li) => { const done = l[2].filter(Boolean).length; return `<div class="gp__rows"><div class="gp__line"><b>${l[0]}</b><em>${done} из ${l[1].length}</em></div><div class="gp__meter2"><i style="width:${(done / l[1].length) * 100}%"></i></div>${l[1].map((t, i) => `<label class="gp__line"><span>${t}</span><input type="checkbox" class="gp__chk" data-sc="chk" data-l="${li}" data-i="${i}"${l[2][i] ? " checked" : ""}></label>`).join("")}</div>`; }).join("")}`;
    },
  };
  SCREENS["Принять заказ NEW"] = SCREENS["Принять заказ"];

  function scAct(el, kind) {
    const a = el.dataset.sc, i = Number(el.dataset.i);
    const re = () => renderScreen(state.screen);
    if (a === "src") { sc.draft.src = el.dataset.v; re(); }
    else if (a === "qty") { const k = el.dataset.k; sc.draft.qty[k] = Math.max(0, Math.min(9, (sc.draft.qty[k] || 0) + Number(el.dataset.d))); re(); }
    else if (a === "accept") {
      const total = Object.entries(sc.draft.qty).reduce((s, [k, n]) => s + PRICES[k] * n, 0);
      if (sc.draft.phone.replace(/\D/g, "").length < 10) { toast("Введите телефон гостя полностью."); return; }
      if (!total) { toast("Добавьте хотя бы одно блюдо."); return; }
      state.seq += 1;
      const o = mk(String(state.seq % 10000).padStart(4, "0"), hhmm(state.clock), total, 0, 1, 0, { src: sc.draft.src, phone: sc.draft.phone });
      orders.push(o);
      sc.draft = { src: "Телефон", phone: "", qty: {} };
      toast("Заказ " + o.id + " принят, он в колонке «Принятые».");
      stampUpdate();
      setScreen("Главная");
      renderAll();
    }
    else if (a === "tbl") { const t = sc.tables.find((x) => x.n === Number(el.dataset.n)); t.st = (t.st + 1) % 3; re(); }
    else if (a === "dtab") { sc.dict.tab = el.dataset.v; re(); }
    else if (a === "guard") { sc.guard[i][2] = !sc.guard[i][2]; re(); }
    else if (a === "expadd") {
      const name = root.querySelector('[data-sc="expname"]').value.trim();
      const sum = Number(root.querySelector('[data-sc="expsum"]').value);
      if (!name || !(sum > 0)) { toast("Укажите статью и сумму."); return; }
      sc.exp.push([name, sum]); re(); toast("Расход добавлен: " + name + ".");
    }
    else if (a === "hour") { sc.hourPick = i; re(); }
    else if (a === "stock") { sc.stock[i][1] += 10; re(); toast("Заказано +10: " + sc.stock[i][0] + "."); }
    else if (a === "seg") { sc.guestSent.add(i); re(); toast("Предложение отправлено: " + sc.segs[i][1] + " гостей."); }
    else if (a === "cam") { sc.cam = i; re(); }
  }
  $("gp-screen").addEventListener("click", (e) => {
    const el = e.target.closest("[data-sc]");
    if (!el || el.tagName === "INPUT") return;
    scAct(el);
  });
  $("gp-screen").addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.sc === "phone") sc.draft.phone = el.value;
    else if (el.dataset.sc === "dq") { sc.dict.q = el.value; const pos = el.selectionStart; renderScreen(state.screen); const n = root.querySelector('[data-sc="dq"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
  });
  $("gp-screen").addEventListener("change", (e) => {
    const el = e.target;
    const i = Number(el.dataset.i);
    if (el.dataset.sc === "buy") { sc.buy[i][1] = Math.max(1, Number(el.value) || sc.buy[i][2]); renderScreen(state.screen); }
    else if (el.dataset.sc === "set") {
      sc.sets[i][1] = el.checked;
      if (i === 0) autoSim = el.checked;
      if (i === 1) root.classList.toggle("no-late", !el.checked);
      toast(sc.sets[i][0] + ": " + (el.checked ? "включено" : "выключено") + ".");
    }
    else if (el.dataset.sc === "chk") { sc.lists[Number(el.dataset.l)][2][i] = el.checked; renderScreen(state.screen); }
  });

  const INFO = {
    late: "Опоздания: заказы, которые выходят позже обещанного гостю времени.",
    avg: "Среднее опоздание доставки по заказам, которые уже в работе.",
    promise: "Обещаем гостю: время, которое видит гость при заказе.",
    calc: "Расчётное время: сколько займёт заказ при текущей загрузке кухни и курьеров.",
    nps: "NPS 4,74: средняя оценка гостей по заказам смены.",
    cash: "Наличные в кассе на текущий момент смены.",
    user: "Администратор смены. Смена открыта в 11:17.",
  };

  root.addEventListener("click", (e) => {
    const t = e.target;
    const menu = t.closest("[data-screen]");
    if (menu) { setScreen(menu.dataset.screen); return; }
    const info = t.closest("[data-info]");
    if (info) { toast(INFO[info.dataset.info]); return; }
    const ready = t.closest("[data-ready]");
    if (ready) {
      const o = orders.find((x) => x.uid === Number(ready.dataset.ready));
      if (o) { advance(o, true); toast("Заказ " + o.id + " передан дальше."); stampUpdate(); renderAll(); renderScreen(state.screen); }
      return;
    }
    const dish = t.closest("[data-dish]");
    if (dish) {
      const d = dish.dataset.dish;
      if (stops.has(d)) { stops.delete(d); toast("«" + d + "» снова в меню."); } else { stops.add(d); toast("«" + d + "» в стопе: гости её не увидят."); }
      renderScreen(state.screen);
      return;
    }
    const cell = t.closest(".gp__cells span[data-uid]");
    if (cell) { openSheet(Number(cell.dataset.uid), cell); return; }
    const st = t.closest(".gp__stat");
    if (st && !t.closest(".gp__i")) {
      const n = Number(st.dataset.stage);
      state.stage = state.stage === n ? null : n;
      renderChrome(); renderBoard();
      if (state.stage !== null) toast("Подсвечен этап «" + STAGES[state.stage] + "» на доске заказов.");
      return;
    }
    const col = t.closest("[data-colstage]");
    if (col) {
      const n = Number(col.dataset.colstage);
      state.stage = state.stage === n ? null : n;
      renderChrome(); renderBoard();
      return;
    }
    if (t.closest("[data-group]")) { state.collapsed = !state.collapsed; renderBoard(); return; }
    const pr = t.closest("[data-pay]");
    if (pr) {
      const n = Number(pr.dataset.pay);
      state.payPick = state.payPick === n ? null : n;
      renderChrome();
      if (state.payPick !== null) toast(["Наличные", "Безнал", "Онлайн"][n] + ": " + money(state.pay[n]) + NB + "₽ за смену.");
      return;
    }
    if (t.closest("#gp-late-badge")) {
      const c = $("gp-only-late"); c.checked = !c.checked; state.onlyLate = c.checked; renderBoard();
    }
  });
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const el = e.target.closest('[role="button"][tabindex]');
    if (el && el.tagName !== "BUTTON") { e.preventDefault(); el.click(); }
  });

  // подразделения
  const menu = $("gp-unit-menu");
  menu.innerHTML = UNITS.map((u) => `<button type="button" role="option" data-unit="${u.id}"${u.id === state.unit ? ' class="is-on"' : ""}>${u.name}</button>`).join("");
  $("gp-units").addEventListener("click", (e) => {
    const opt = e.target.closest("[data-unit]");
    if (opt) {
      state.unit = opt.dataset.unit;
      menu.querySelectorAll("button").forEach((b) => b.classList.toggle("is-on", b === opt));
      renderAll();
      toast("Показаны данные: " + UNITS.find((u) => u.id === state.unit).name);
    }
    const open = !menu.classList.contains("is-open") || opt;
    menu.classList.toggle("is-open", open && !opt);
    $("gp-units").setAttribute("aria-expanded", String(open && !opt));
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#gp-units")) menu.classList.remove("is-open");
  });

  // действия смены
  root.querySelector(".gp__actions").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    if (act === "force") {
      state.force = !state.force;
      b.classList.toggle("is-on", state.force);
      b.setAttribute("aria-pressed", String(state.force));
      if (state.force) {
        orders.forEach((o) => { if (o.stage >= 2 && !o.late) { o.late = 3; o.fm = true; } });
        toast("Форс-мажор: гостям теперь обещаем +15 мин, расчётное время пересчитано.");
      } else {
        orders.forEach((o) => { if (o.fm) { o.late = 0; o.fm = false; } });
        toast("Форс-мажор выключен: время вернулось к обычному.");
      }
      renderAll();
    } else {
      openDialog(act);
    }
  });

  // окно как экран ПК: размер фиксирован, на узких экранах масштабируется целиком
  const stage = $("gp-stage");
  function fit() {
    const frame = stage.parentElement;
    const pe = frame.parentElement;
    const cs = getComputedStyle(pe), fs = getComputedStyle(frame);
    const extra = parseFloat(fs.paddingLeft) + parseFloat(fs.paddingRight) + parseFloat(fs.borderLeftWidth) + parseFloat(fs.borderRightWidth);
    const avail = pe.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - extra;
    const k = Math.min(1, avail / 1200);
    root.style.transform = `scale(${k})`;
    stage.style.width = 1200 * k + "px";
    stage.style.height = 760 * k + "px";
  }
  fit();
  window.addEventListener("resize", fit);


  // курсор «Click»: стрелка и капсула следуют за мышью, только над окном демо
  (function initCursor() {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const wrap = document.createElement("div");
    wrap.className = "gp-cur";
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = '<div class="gp-cur__arrow"><svg viewBox="0 0 18 22" fill="none"><path d="M2 1.5v15.2l4.2-3.9 3 6.9 2.6-1.2-3-6.7 5.7-.3z" fill="#173D3B" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/></svg></div><div class="gp-cur__cap"><i>Click</i></div>';
    document.body.appendChild(wrap);
    const arrow = wrap.querySelector(".gp-cur__arrow");
    const cap = wrap.querySelector(".gp-cur__cap");
    root.classList.add("has-cursor");
    const target = { x: 0, y: 0 };
    const a = { x: 0, y: 0 };
    const c = { x: 0, y: 0 };
    let shown = false, raf = 0;
    const kA = reduceMotion ? 1 : 0.45;
    const kC = reduceMotion ? 1 : 0.2;
    function frame() {
      a.x += (target.x - a.x) * kA; a.y += (target.y - a.y) * kA;
      c.x += (target.x - c.x) * kC; c.y += (target.y - c.y) * kC;
      arrow.style.transform = `translate(${a.x}px, ${a.y}px)`;
      cap.style.transform = `translate(${c.x + 14}px, ${c.y + 18}px)`;
      const still = Math.abs(target.x - c.x) < 0.1 && Math.abs(target.y - c.y) < 0.1;
      raf = still ? 0 : requestAnimationFrame(frame);
    }
    function move(e) {
      target.x = e.clientX; target.y = e.clientY;
      const text = e.target.closest && e.target.closest('input[type="search"], input[type="text"], input[type="tel"], input[type="number"], textarea');
      if (!shown) { a.x = c.x = target.x; a.y = c.y = target.y; }
      wrap.classList.toggle("is-on", !text);
      shown = true;
      if (!raf) raf = requestAnimationFrame(frame);
    }
    function hide() { shown = false; wrap.classList.remove("is-on"); }
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerenter", move);
    stage.addEventListener("pointerleave", hide);
    stage.addEventListener("pointerdown", () => {
      if (reduceMotion) return;
      cap.classList.remove("is-press");
      void cap.offsetWidth;
      cap.classList.add("is-press");
      clearTimeout(cap._t);
      cap._t = setTimeout(() => cap.classList.remove("is-press"), 460);
    });
    window.addEventListener("blur", hide);
    // при скролле страницы или списка внутри окна курсор остаётся, пока под ним окно демо
    const TEXT_SEL = 'input[type="search"], input[type="text"], input[type="tel"], input[type="number"], textarea';
    function sync() {
      if (!shown) return;
      const el = document.elementFromPoint(target.x, target.y);
      if (el && stage.contains(el)) wrap.classList.toggle("is-on", !el.closest(TEXT_SEL));
      else hide();
    }
    document.addEventListener("scroll", sync, { passive: true, capture: true });
  })();

  // старт и цикл
  stampUpdate();
  renderAll();
  let visibleNow = true;
  let autoSim = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((en) => { visibleNow = en[0].isIntersecting; }, { threshold: 0.15 }).observe(root);
  }
  setInterval(() => {
    if (!document.hidden) tickClock();
  }, 1000);
  if (!reduceMotion) {
    setInterval(() => {
      if (!autoSim || document.hidden || !visibleNow || state.open || state.dialog) return;
      if (document.activeElement && document.activeElement.id === "gp-search") return;
      simulate();
    }, 3600);
  }
})();
