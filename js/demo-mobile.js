// Мобильное демо Goulash: экран смены в модалке. Все данные выдуманы.
(function () {
  const openBtn = document.getElementById("dm-open");
  if (!openBtn) return;

  const NB = " ";
  const STAGES = ["Отложенные", "Принятые", "Кухня", "Приготовлено", "В пути"];
  const STEP_NAMES = ["Принят", "Передан на кухню", "Приготовлен", "Передан курьеру", "Доставлен"];
  const SOURCES = ["Яндекс Еда", "Свой сайт", "Телефон", "Delivery Club"];
  const UNITS = [
    { id: "all", name: "Все подразделения", promise: 35, calc: 34 },
    { id: "center", name: "Центр", promise: 32, calc: 31 },
    { id: "south", name: "Юго-запад", promise: 40, calc: 38 },
  ];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let uid = 1;
  function mk(id, t, sum, old, stage, late) {
    uid++;
    return {
      uid, id, t, sum, old: old || null, stage, late: late || 0,
      pre: /^[ПТ]-/.test(id),
      src: SOURCES[uid % SOURCES.length],
      unit: uid % 2 ? "center" : "south",
      phone: "+7 9" + String(10 + ((uid * 7) % 90)) + " " + String(100 + ((uid * 37) % 900)) + "-" + String(10 + ((uid * 13) % 90)) + "-" + String(10 + ((uid * 29) % 90)),
    };
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

  const state = { unit: "all", stage: "all", q: "", sort: "new", onlyLate: false, open: null, unitMenu: false, rev: 1123000, plan: 2000000, delivered: 0 };

  const money = (n) => Math.round(n).toLocaleString("ru-RU").replace(/\s/g, NB);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, d = m % 10; if (m > 10 && m < 20) return c; if (d > 1 && d < 5) return b; if (d === 1) return a; return c; };

  // ---------- разметка ----------
  const modal = document.createElement("div");
  modal.className = "dm-modal";
  modal.id = "dm-modal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Демо интерфейса Goulash на телефоне");
  modal.innerHTML = `
    <div class="dm" id="dm">
      <div class="dm__grabber" aria-label="Потяните вниз, чтобы закрыть демо"></div>
      <header class="dm__top">
        <div class="dm__brand">
          <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M35.8708 0H11.6535C5.21774 0 0 5.24615 0 11.7169V36.0662C0 42.5369 5.21774 47.7831 11.6535 47.7831H35.8708C42.3065 47.7831 47.5243 42.5369 47.5243 36.0662V11.7154C47.5243 5.24462 42.3065 0 35.8708 0Z" fill="#00FFFF"/><path d="M15.8418 15.9297H7.92188V23.8928V31.8558H15.8418V23.8928V15.9297Z" fill="#040406"/><path d="M31.6827 15.9295V7.96484H23.7628H15.8413V15.9295H23.7628H31.6827Z" fill="#040406"/><path d="M15.8413 31.8555V39.8201H23.7628H31.6827V31.8555H23.7628H15.8413Z" fill="#040406"/><path d="M39.6031 23.8945H31.6831V31.8576H39.6031V23.8945Z" fill="#040406"/></svg>
          <span>Goulash.tech</span>
        </div>
        <div class="dm__unitwrap">
          <button type="button" class="dm__unit" id="dm-unit" aria-haspopup="listbox" aria-expanded="false"><span id="dm-unit-name">Все подразделения</span><i aria-hidden="true"></i></button>
          <ul class="dm__unitmenu" id="dm-unitmenu" role="listbox" hidden></ul>
        </div>
        <button type="button" class="dm__close" id="dm-close" aria-label="Закрыть демо">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>
      <div class="dm__scroll" id="dm-scroll">
        <div class="dm__kpis" id="dm-kpis"></div>
        <section class="dm__cash" id="dm-cash"></section>
        <div class="dm__ordhead">
          <h3 id="dm-title">Текущие заказы</h3>
          <span class="dm__badge" id="dm-badge"></span>
        </div>
        <div class="dm__tabs" id="dm-tabs" role="tablist" aria-label="Этапы заказа"></div>
        <div class="dm__tools">
          <label class="dm__search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg><input type="search" id="dm-q" placeholder="Номер заказа или телефон" autocomplete="off" inputmode="search"></label>
          <div class="dm__row">
            <button type="button" class="dm__tog" id="dm-late" role="switch" aria-checked="false"><i></i>Только опаздывающие</button>
            <button type="button" class="dm__sort" id="dm-sort">Сначала новые</button>
          </div>
        </div>
        <ul class="dm__list" id="dm-list"></ul>
      </div>
      <div class="dm__sheetwrap" id="dm-sheetwrap" hidden><div class="dm__sheet" id="dm-sheet" role="dialog" aria-label="Карточка заказа"></div></div>
      <div class="dm__toast" id="dm-toast" role="status" aria-live="polite"></div>
    </div>`;
  document.body.appendChild(modal);
  const $ = (id) => document.getElementById(id);

  // ---------- выборки ----------
  const scope = () => orders.filter((o) => state.unit === "all" || o.unit === state.unit);
  function visible() {
    const q = state.q.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return scope()
      .filter((o) => state.stage === "all" || o.stage === state.stage)
      .filter((o) => !state.onlyLate || o.late)
      .filter((o) => !q || o.id.toLowerCase().includes(q) || (qd.length > 1 && o.phone.replace(/\D/g, "").includes(qd)))
      .sort((a, b) => (state.sort === "new" ? b.t.localeCompare(a.t) : a.t.localeCompare(b.t)));
  }

  // ---------- рендер ----------
  function renderTop() {
    const u = UNITS.find((x) => x.id === state.unit);
    $("dm-unit-name").textContent = u.name;
    $("dm-kpis").innerHTML = `
      <div class="dm__kpi"><small>Обещаем гостю</small><strong>${u.promise}<em>мин</em></strong></div>
      <div class="dm__kpi"><small>Расчётное время</small><strong>${u.calc}<em>мин</em></strong></div>
      <div class="dm__kpi"><small>NPS</small><strong>4,74<em class="up">▲</em></strong></div>`;
    const pc = Math.min(100, Math.round((state.rev / state.plan) * 100));
    $("dm-cash").innerHTML = `
      <div class="dm__cashhead"><small>Выручка в кассе</small><span class="dm__plan">${pc}%</span></div>
      <div class="dm__sum">${money(state.rev)}${NB}₽<em>▲ 2%</em></div>
      <div class="dm__bar"><i style="width:${pc}%"></i></div>
      <div class="dm__small">План: ${money(state.plan)}${NB}₽</div>
      <ul class="dm__pay">
        <li><i class="c1"></i>Наличные<b>22%</b><span>247${NB}060</span></li>
        <li><i class="c2"></i>Безнал<b>44%</b><span>494${NB}120</span></li>
        <li><i class="c3"></i>Онлайн<b>34%</b><span>381${NB}820</span></li>
      </ul>`;
  }
  function renderTabs() {
    const sc = scope();
    const tabs = [{ k: "all", n: "Все", c: sc.length }].concat(STAGES.map((n, i) => ({ k: i, n, c: sc.filter((o) => o.stage === i).length })));
    $("dm-tabs").innerHTML = tabs
      .map((t) => `<button type="button" role="tab" class="dm__tab${state.stage === t.k ? " is-on" : ""}" aria-selected="${state.stage === t.k}" data-stage="${t.k}">${t.n}<b>${t.c}</b></button>`)
      .join("");
  }
  function renderList() {
    const list = visible();
    const sc = scope();
    const late = sc.filter((o) => o.late).length;
    $("dm-title").textContent = `Текущие заказы, ${sc.length}`;
    $("dm-badge").textContent = late ? `Опаздывает ${late}` : "Без опозданий";
    $("dm-badge").classList.toggle("is-ok", !late);
    $("dm-list").innerHTML = list.length
      ? list
          .map((o) => {
            const warn = o.late >= 10 ? "⚠ " : "";
            const lt = o.late ? `<small>−${o.late}${NB}мин</small>` : "";
            const old = o.old ? `<s>${money(o.old)}${NB}₽</s>` : "";
            return `<li><button type="button" class="dm__card${o.late ? " is-late" : ""}" data-uid="${o.uid}">
              <strong>${warn}${esc(o.id)}${lt}</strong><time>${o.t}</time>
              <span class="dm__cs">${money(o.sum)}${NB}₽${old}</span><span class="dm__st">${STAGES[o.stage]}, ${esc(o.src)}</span>
            </button></li>`;
          })
          .join("")
      : `<li class="dm__empty">По этим условиям заказов нет. Сбросьте фильтры или выберите другой этап.</li>`;
  }
  function renderAll() { renderTop(); renderTabs(); renderList(); }

  // ---------- карточка заказа ----------
  function renderSheet() {
    const o = orders.find((x) => x.uid === state.open);
    if (!o) { closeSheet(); return; }
    const steps = STEP_NAMES.map((name, i) => `<li class="${i < o.stage ? "is-done" : i === o.stage ? "is-now" : ""}">${name}</li>`).join("");
    const next = o.stage >= 4 ? "Отметить доставленным" : "Передать дальше: " + STAGES[o.stage + 1];
    $("dm-sheet").innerHTML = `
      <div class="dm__sh"><div><h3>Заказ ${esc(o.id)}</h3><p>${o.pre ? "Предварительный. " : ""}${esc(o.src)}, ${esc(o.phone)}</p></div><button type="button" class="dm__x" id="dm-sx" aria-label="Закрыть карточку">×</button></div>
      <div class="dm__facts"><div><span>Сумма</span><b>${money(o.sum)}${NB}₽</b></div><div><span>К времени</span><b>${o.t}</b></div><div><span>Этап</span><b>${STAGES[o.stage]}</b></div></div>
      <ul class="dm__steps">${steps}</ul>
      ${o.late ? `<p class="dm__latenote">Опаздывает на ${o.late}${NB}${plural(o.late, "минуту", "минуты", "минут")}.</p>` : ""}
      <button type="button" class="dm__next" id="dm-next">${next}</button>`;
    $("dm-sx").addEventListener("click", closeSheet);
    $("dm-next").addEventListener("click", () => {
      if (o.stage >= 4) {
        orders.splice(orders.indexOf(o), 1);
        state.rev += o.sum;
        closeSheet();
        toast(`Заказ ${o.id} доставлен, выручка обновилась`);
      } else {
        o.stage += 1;
        if (o.stage > 2) o.late = Math.max(0, o.late - 5);
        toast(`Заказ ${o.id}: ${STAGES[o.stage]}`);
        renderSheet();
      }
      renderAll();
    });
  }
  function openSheet(id) {
    state.open = id;
    $("dm-sheetwrap").hidden = false;
    renderSheet();
    const x = $("dm-sx"); if (x) x.focus();
  }
  function closeSheet() { state.open = null; $("dm-sheetwrap").hidden = true; }

  let toastT = 0;
  function toast(msg) {
    const t = $("dm-toast");
    t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("is-on"), 2200);
  }

  // ---------- открыть и закрыть ----------
  function openModal() {
    modal.hidden = false;
    document.documentElement.classList.add("dm-lock");
    requestAnimationFrame(() => modal.classList.add("is-open"));
    renderAll();
    $("dm-close").focus();
  }
  function closeModal() {
    closeSheet();
    state.unitMenu = false; $("dm-unitmenu").hidden = true; $("dm-unit").setAttribute("aria-expanded", "false");
    modal.classList.remove("is-open");
    document.documentElement.classList.remove("dm-lock");
    setTimeout(() => { modal.hidden = true; }, reduceMotion ? 0 : 220);
    openBtn.focus();
  }
  openBtn.addEventListener("click", openModal);
  $("dm-close").addEventListener("click", closeModal);
  // Надёжный свайп: увеличенная зона захвата, жест можно начать на ручке или в верхней шапке.
  const grabber = modal.querySelector(".dm__grabber");
  const topbar = modal.querySelector(".dm__top");
  let dragStartY = null;
  const startDrag = (y) => { dragStartY = y; };
  const finishDrag = (y) => {
    if (dragStartY === null) return;
    const distance = y - dragStartY;
    dragStartY = null;
    if (distance > 40 && !modal.hidden) closeModal();
  };
  [grabber, topbar].filter(Boolean).forEach((el) => {
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      startDrag(e.clientY);
    });
    // Touch events are needed on mobile browsers that cancel pointer events during vertical gestures.
    el.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) startDrag(e.touches[0].clientY);
    }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (e.changedTouches.length) finishDrag(e.changedTouches[0].clientY);
    }, { passive: true });
    el.addEventListener("touchcancel", () => { dragStartY = null; }, { passive: true });
  });
  document.addEventListener("pointerup", (e) => finishDrag(e.clientY));
  document.addEventListener("pointercancel", () => { dragStartY = null; });
  // Fallback: listen at document level because mobile browsers may retarget/cancel
  // touch events when the sheet header uses native vertical scrolling.
  let touchStartY = null;
  let touchStartedAtTop = false;
  document.addEventListener("touchstart", (e) => {
    if (modal.hidden || e.touches.length !== 1) return;
    const rect = modal.querySelector(".dm")?.getBoundingClientRect();
    if (!rect) return;
    const y = e.touches[0].clientY;
    touchStartedAtTop = y >= rect.top && y <= rect.top + 90;
    touchStartY = touchStartedAtTop ? y : null;
  }, { passive: true, capture: true });
  document.addEventListener("touchend", (e) => {
    if (touchStartY === null || !touchStartedAtTop || !e.changedTouches.length) return;
    const distance = e.changedTouches[0].clientY - touchStartY;
    touchStartY = null;
    touchStartedAtTop = false;
    if (distance > 40 && !modal.hidden) closeModal();
  }, { passive: true, capture: true });
  document.addEventListener("touchcancel", () => {
    touchStartY = null;
    touchStartedAtTop = false;
  }, { passive: true, capture: true });
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || modal.hidden) return;
    if (state.open) closeSheet(); else closeModal();
  });

  // ---------- управление ----------
  $("dm-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-stage]"); if (!b) return;
    const v = b.dataset.stage; state.stage = v === "all" ? "all" : Number(v);
    renderTabs(); renderList();
  });
  $("dm-list").addEventListener("click", (e) => { const b = e.target.closest("[data-uid]"); if (b) openSheet(Number(b.dataset.uid)); });
  $("dm-q").addEventListener("input", (e) => { state.q = e.target.value; renderList(); });
  $("dm-late").addEventListener("click", (e) => {
    state.onlyLate = !state.onlyLate;
    e.currentTarget.setAttribute("aria-checked", String(state.onlyLate));
    e.currentTarget.classList.toggle("is-on", state.onlyLate);
    renderList();
  });
  $("dm-sort").addEventListener("click", (e) => {
    state.sort = state.sort === "new" ? "old" : "new";
    e.currentTarget.textContent = state.sort === "new" ? "Сначала новые" : "Сначала старые";
    renderList();
  });
  const um = $("dm-unitmenu");
  um.innerHTML = UNITS.map((u) => `<li role="option" data-unit="${u.id}">${u.name}</li>`).join("");
  $("dm-unit").addEventListener("click", () => {
    state.unitMenu = !state.unitMenu; um.hidden = !state.unitMenu;
    $("dm-unit").setAttribute("aria-expanded", String(state.unitMenu));
  });
  um.addEventListener("click", (e) => {
    const li = e.target.closest("[data-unit]"); if (!li) return;
    state.unit = li.dataset.unit; state.unitMenu = false; um.hidden = true;
    $("dm-unit").setAttribute("aria-expanded", "false");
    renderAll();
  });
  document.addEventListener("click", (e) => {
    if (!state.unitMenu || e.target.closest(".dm__unitwrap")) return;
    state.unitMenu = false; um.hidden = true; $("dm-unit").setAttribute("aria-expanded", "false");
  });
})();
