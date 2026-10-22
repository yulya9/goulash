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
      cols.map((c) => `<div class="gp__col-h">${c.name} <em>${c.n}</em></div>`).join("") +
      `<div class="gp__group"><i></i><b>Доставка</b> (${list.length} ${plural(list.length, "заказ", "заказа", "заказов")})</div>` +
      cols.map((c) => `<ul class="gp__list">${c.html}</ul>`).join("");
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

  function renderAll() {
    renderBoard();
    renderPanels();
    renderTop();
    if (state.open) renderSheet();
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
        <div><h3>Заказ ${esc(o.id)}${o.pre ? " · предварительный" : ""}</h3><p>${esc(o.src)} · ${esc(o.phone)}</p></div>
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
    $("gp-drawer").classList.remove("is-open");
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

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
    if (e.key === "Escape" && state.open) closeSheet();
  });

  $("gp-search").addEventListener("input", (e) => { state.q = e.target.value; renderBoard(); });
  $("gp-sort").addEventListener("change", (e) => { state.sort = e.target.value; renderBoard(); });
  $("gp-only-late").addEventListener("change", (e) => { state.onlyLate = e.target.checked; renderBoard(); });
  $("gp-only-pre").addEventListener("change", (e) => { state.onlyPre = e.target.checked; renderBoard(); });
  $("gp-refresh").addEventListener("click", (e) => {
    const b = e.currentTarget;
    b.classList.add("is-spin");
    setTimeout(() => b.classList.remove("is-spin"), 500);
    simulate();
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
    } else if (act === "taxi") {
      toast("Такси вызвано для самого раннего заказа в доставке.");
    } else if (act === "writeoff") {
      toast("Позиция списана с витрины, остаток обновлён.");
    } else if (act === "staff") {
      toast("Развоз сотрудников: заказы добавлены в отдельный маршрут.");
    } else if (act === "close") {
      const n = orders.filter((o) => o.stage < 4).length;
      toast("Смену нельзя закрыть: в работе " + n + " " + plural(n, "заказ", "заказа", "заказов") + ".");
    }
  });

  // старт и цикл
  stampUpdate();
  renderAll();
  let visibleNow = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((en) => { visibleNow = en[0].isIntersecting; }, { threshold: 0.15 }).observe(root);
  }
  setInterval(() => {
    if (!document.hidden) tickClock();
  }, 1000);
  if (!reduceMotion) {
    setInterval(() => {
      if (document.hidden || !visibleNow || state.open) return;
      if (document.activeElement && document.activeElement.id === "gp-search") return;
      simulate();
    }, 3600);
  }
})();
