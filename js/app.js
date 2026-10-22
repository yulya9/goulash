const state = {
  shift: 10,
  method: "phone",
  calc: null,
  calcTouched: false,
  calcFee: 0,
  calcSave: 0,
  calcLic: 0,
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function money(n) {
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

function parseMoney(text) {
  const n = Number(String(text).replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function flash(el) {
  if (!el || reduceMotion) return;
  el.classList.remove("is-flash");
  void el.offsetWidth;
  el.classList.add("is-flash");
}

function animateMoney(el, from, to, key, duration = 520) {
  if (!el) return;
  if (reduceMotion || from === to) {
    el.textContent = money(to);
    if (key) state[key] = to;
    return;
  }
  const start = performance.now();
  flash(el);
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = from + (to - from) * eased;
    el.textContent = money(value);
    if (t < 1) requestAnimationFrame(frame);
    else {
      el.textContent = money(to);
      if (key) state[key] = to;
    }
  }
  requestAnimationFrame(frame);
}

state.shift = 10;
state.method = "phone";
state.calc = null;
state.calcTouched = false;

function rub(n) {
  return money(n).replace(/ /g, " ");
}

const CALC_LIMITS = {
  "calc-orders": { min: 1, max: 1000, msg: "От 1 до 1 000 заказов" },
  "calc-check": { min: 100, max: 10000, msg: "Чек от 100 до 10 000 ₽" },
  "calc-share": { min: 1, max: 100, msg: "От 1 до 100%" },
  "calc-comm": { min: 1, max: 60, msg: "Комиссия от 1 до 60%" },
};

// Возвращает числа или null, если хоть одно поле пустое или вне допустимых границ.
function readCalc() {
  const vals = {};
  let ok = true;
  Object.entries(CALC_LIMITS).forEach(([id, lim]) => {
    const input = document.getElementById(id);
    const raw = input.value.trim();
    const v = Number(raw);
    const bad = raw === "" || !Number.isFinite(v) || v < lim.min || v > lim.max;
    input.classList.toggle("is-invalid", bad);
    const err = document.querySelector(`[data-cerr="${id}"]`);
    if (err) err.textContent = bad ? lim.msg : "";
    if (bad) ok = false;
    vals[id] = v;
  });
  if (!ok) return null;
  return {
    orders: vals["calc-orders"],
    check: vals["calc-check"],
    days: 30,
    comm: vals["calc-comm"] / 100,
    extra: 0,
    share: vals["calc-share"] / 100,
    shift: state.shift / 100,
  };
}

function computeCalc(c) {
  const turnover = c.orders * c.check * c.days;
  const agg = turnover * c.share;
  const fee = agg * c.comm;
  const saved = agg * c.shift * c.comm;
  const net = saved;
  return { turnover, fee, saved, net };
}

function verdictFor(r) {
  return {
    key: "ok",
    title: `За год это около ${rub(r.saved * 12)}: столько сейчас уходит агрегаторам`,
    why: `Возврат ${state.shift}% заказов из агрегаторов экономит комиссию.`,
  };
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function updateCalc() {
  const c = readCalc();
  const res = document.getElementById("calc-res");

  if (!c) {
    res.dataset.verdict = "none";
    setText("calc-net", "—");
    setText("calc-verdict", "Проверьте значения в полях слева");
    state.calc = null;
    refreshAttach();
    return;
  }

  const r = computeCalc(c);
  state.calc = { c, r };

  const v = verdictFor(r);
  res.dataset.verdict = v.key;
  setText("calc-verdict", v.title);

  const netEl = document.getElementById("calc-net");
  netEl.textContent = `+${rub(r.net)}`;
  flash(netEl);

  const lossEl = document.getElementById("hero-loss");
  if (lossEl) {
    lossEl.textContent = "≈ " + rub(r.fee);
    document.getElementById("hero-loss-orders").textContent = String(c.orders);
    document.getElementById("hero-loss-check").textContent = rub(c.check);
  }
  refreshAttach();
}

// Расчёт попадает в заявку, только если человек им пользовался.
function refreshAttach() {
  const el = document.getElementById("lead-attach");
  if (!el) return;
  if (!state.calcTouched || !state.calc) {
    el.hidden = true;
    return;
  }
  const { c, r } = state.calc;
  el.hidden = false;
  el.textContent = `К заявке приложим ваш расчёт: ${c.orders} заказов в день, чек ${rub(c.check)}, переход ${state.shift}%, у вас останется около ${rub(r.net)} в месяц вместо комиссии агрегатору.`;
}

function digits(phone) {
  return phone.replace(/\D/g, "");
}

// ---- Форма заявки: проверка полей, состояния, отправка ----
const NB = " ";
const LEAD_FIELDS = {
  name: {
    check(v) {
      v = v.trim();
      if (v.length < 2) return "Укажите имя";
      if (/\d/.test(v)) return "Имя без цифр, пожалуйста";
      return "";
    },
  },
  phone: {
    check(v) {
      let d = digits(v);
      if (d.length === 11 && d[0] === "8") d = "7" + d.slice(1);
      if (d.length !== 11 || d[0] !== "7") return "Введите номер полностью: +7" + NB + "900" + NB + "000-00-00";
      return "";
    },
  },
  city: { check: (v) => (v.trim().length < 2 ? "Укажите город" : "") },
  company: { check: (v) => (v.trim().length < 2 ? "Укажите название компании" : "") },
  points: {
    check(v) {
      if (!String(v).trim()) return "Укажите количество точек";
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 999) return "Укажите число от 1 до 999";
      return "";
    },
  },
  privacy: { check: (_v, el) => (el.checked ? "" : "Нужно согласие на обработку данных") },
};

function leadValue(form, name) {
  const el = form.querySelector(`[name="${name}"]`);
  return name === "privacy" ? "" : el.value;
}

function setFieldError(form, name, msg) {
  const el = form.querySelector(`[name="${name}"]`);
  const wrap = el.closest(".wpcf7-form-control-wrap");
  wrap.querySelectorAll(".wpcf7-not-valid-tip").forEach((n) => n.remove());
  if (name !== "privacy") {
    el.classList.toggle("wpcf7-not-valid", Boolean(msg));
    el.setAttribute("aria-invalid", msg ? "true" : "false");
  }
  if (!msg) {
    el.removeAttribute("aria-describedby");
    return;
  }
  const tip = document.createElement("span");
  tip.className = "wpcf7-not-valid-tip";
  tip.id = "tip-" + name;
  tip.setAttribute("role", "alert");
  tip.textContent = msg;
  wrap.appendChild(tip);
  el.setAttribute("aria-describedby", tip.id);
}

function validateField(form, name) {
  const el = form.querySelector(`[name="${name}"]`);
  const msg = LEAD_FIELDS[name].check(leadValue(form, name), el);
  setFieldError(form, name, msg);
  return msg;
}

function validateLead(form) {
  const errors = {};
  Object.keys(LEAD_FIELDS).forEach((name) => {
    const msg = validateField(form, name);
    if (msg) errors[name] = msg;
  });
  return { data: Object.fromEntries(new FormData(form)), errors };
}

function setSummary(form, text) {
  const s = document.getElementById("lead-summary");
  s.textContent = text || "";
  s.hidden = !text;
}

function setFormState(form, status) {
  form.classList.remove("init", "invalid", "sending", "sent", "failed");
  form.classList.add(status);
  form.dataset.status = status;
  const busy = status === "sending";
  form.setAttribute("aria-busy", String(busy));
  form.querySelectorAll("input").forEach((i) => {
    if (i.type === "checkbox") i.disabled = busy;
    else i.readOnly = busy;
  });
}

// маска телефона: +7 (900) 000-00-00
function formatPhone(raw) {
  let d = digits(raw);
  if (!d) return "";
  if (d[0] === "8") d = "7" + d.slice(1);
  if (d[0] !== "7") d = "7" + d;
  d = d.slice(0, 11);
  let out = "+7";
  if (d.length > 1) out += NB + "(" + d.slice(1, 4);
  if (d.length >= 4) out += ")";
  if (d.length > 4) out += NB + d.slice(4, 7);
  if (d.length > 7) out += "-" + d.slice(7, 9);
  if (d.length > 9) out += "-" + d.slice(9, 11);
  return out;
}

function bindLeadForm() {
  const form = document.getElementById("lead-form");
  form.addEventListener("submit", submitLead);
  Object.keys(LEAD_FIELDS).forEach((name) => {
    const el = form.querySelector(`[name="${name}"]`);
    // проверка при уходе из поля; пока человек исправляет, ошибка снимается сразу, как только значение верное
    el.addEventListener("blur", () => {
      if (name !== "privacy" && el.value !== "") validateField(form, name);
    });
    const live = () => {
      if (el.classList.contains("wpcf7-not-valid") || document.getElementById("tip-" + name)) validateField(form, name);
      if (!form.querySelector(".wpcf7-not-valid-tip")) setSummary(form, "");
    };
    el.addEventListener(name === "privacy" ? "change" : "input", live);
  });
  const phone = form.querySelector('[name="phone"]');
  phone.addEventListener("input", () => {
    const pos = phone.selectionStart;
    const before = phone.value.length;
    phone.value = formatPhone(phone.value);
    if (pos !== null && pos >= before) phone.setSelectionRange(phone.value.length, phone.value.length);
  });
  phone.addEventListener("focus", () => {
    if (!phone.value) phone.value = "+7" + NB;
  });
  phone.addEventListener("blur", () => {
    if (digits(phone.value).length <= 1) phone.value = "";
  });
}

// Окно с результатом отправки заявки
let leadModalFocus = null;
const FAIL_TEXT = {
  offline: "Нет соединения с интернетом. Проверьте подключение и отправьте заявку ещё раз.",
  timeout: "Сервер слишком долго не отвечает. Попробуйте ещё раз чуть позже.",
  server: "Сервер вернул ошибку. Попробуйте ещё раз или напишите нам в" + NB + '<a class="lead-modal__link" href="https://t.me/GoulashPrivatBot" target="_blank" rel="noopener noreferrer">Telegram</a>.',
  other: "Данные остались в" + NB + 'форме. Попробуйте ещё раз или напишите нам в' + NB + '<a class="lead-modal__link" href="https://t.me/GoulashPrivatBot" target="_blank" rel="noopener noreferrer">Telegram</a>.',
};
function openLeadModal(kind, reason) {
  const m = document.getElementById("lead-modal");
  const ok = kind === "ok";
  m.dataset.kind = kind;
  document.getElementById("lead-modal-title").textContent = ok ? "Заявка отправлена" : "Не" + NB + "удалось отправить заявку";
  document.getElementById("lead-modal-text").innerHTML = ok
    ? "Спасибо за" + NB + "интерес к" + NB + "Goulash. Мы" + NB + "свяжемся с" + NB + "вами, чтобы обсудить подключение."
    : FAIL_TEXT[reason] || FAIL_TEXT.other;
  document.getElementById("lead-modal-ok").textContent = ok ? "Понятно" : "Попробовать ещё раз";
  leadModalFocus = document.activeElement;
  m.hidden = false;
  document.documentElement.classList.add("has-modal");
  document.getElementById("lead-modal-ok").focus();
}
function closeLeadModal() {
  const m = document.getElementById("lead-modal");
  if (m.hidden) return;
  m.hidden = true;
  document.documentElement.classList.remove("has-modal");
  if (leadModalFocus && document.contains(leadModalFocus)) leadModalFocus.focus({ preventScroll: true });
}
function bindLeadModal() {
  const m = document.getElementById("lead-modal");
  m.addEventListener("click", (e) => {
    if (e.target === m || e.target.closest("[data-close-modal]")) closeLeadModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLeadModal();
  });
}

// Адрес приёма заявок. Сейчас открытый тестовый сервис httpbin.org: он принимает запрос и возвращает его обратно,
// никуда дальше данные не уходят. Для боевого сайта заменить на свой адрес (CRM, Telegram-бот, сервис форм).
// Состояния можно посмотреть по адресу: ?form=error (ошибка сервера), ?form=offline (нет сети), ?form=timeout (долгий ответ).
const LEAD_ENDPOINT = "https://httpbin.org/post";

async function sendLead(payload) {
  const demo = new URLSearchParams(location.search).get("form");
  const fail = (reason) => Object.assign(new Error(reason), { reason });
  if (demo === "error") { await new Promise((r) => setTimeout(r, 900)); throw fail("server"); }
  if (demo === "offline" || navigator.onLine === false) { await new Promise((r) => setTimeout(r, 500)); throw fail("offline"); }
  if (demo === "timeout") { await new Promise((r) => setTimeout(r, 1400)); throw fail("timeout"); }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(LEAD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, source: "landing", sentAt: new Date().toISOString() }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw fail("server");
    return await res.json();
  } catch (err) {
    if (err.reason) throw err;
    if (err.name === "AbortError") throw fail("timeout");
    throw fail(navigator.onLine === false ? "offline" : "other");
  } finally {
    clearTimeout(timer);
  }
}

async function submitLead(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.classList.contains("sending")) return;
  const btn = document.getElementById("lead-submit");
  const { data, errors } = validateLead(form);
  const bad = Object.keys(errors);
  if (bad.length) {
    setFormState(form, "invalid");
    setSummary(form, bad.length === 1 ? "Проверьте поле, отмеченное красным" : "Проверьте поля, отмеченные красным");
    const first = form.querySelector(`[name="${bad[0]}"]`);
    first.focus();
    return;
  }
  setSummary(form, "");
  const payload = { ...data, phone: "+" + digits(data.phone).replace(/^8/, "7"), calc: state.calcTouched ? state.calc : null };
  btn.disabled = true;
  btn.classList.add("is-loading");
  btn.textContent = "Отправляем…";
  setFormState(form, "sending");
  try {
    await sendLead(payload);
    form.reset();
    Object.keys(LEAD_FIELDS).forEach((n) => setFieldError(form, n, ""));
    setFormState(form, "sent");
    openLeadModal("ok");
  } catch (err) {
    setFormState(form, "failed");
    openLeadModal("fail", err.reason);
  } finally {
    btn.disabled = false;
    btn.classList.remove("is-loading");
    btn.textContent = "Оставить заявку";
  }
}

function safe(fn) {
  try {
    fn();
  } catch (err) {
    console.error(err);
  }
}

function bind() {
  // форма заявки подключается первой: что бы ни случилось дальше, обычную отправку браузером она перехватит
  safe(() => bindLeadForm());
  safe(() => bindLeadModal());

  safe(() => {
    ["calc-orders", "calc-check", "calc-comm", "calc-share"].forEach((id) => {
      document.getElementById(id).addEventListener("input", () => {
        state.calcTouched = true;
        updateCalc();
      });
    });
    document.querySelectorAll("[data-shift]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.shift = Number(btn.dataset.shift);
        state.calcTouched = true;
        document.querySelectorAll("[data-shift]").forEach((b) => {
          b.classList.toggle("is-on", b === btn);
          b.setAttribute("aria-pressed", String(b === btn));
        });
        updateCalc();
      });
    });
    updateCalc();
  });
  safe(() => bindFaq());
  safe(() => bindQuotes());
  safe(() => bindCasesSlider());
  safe(() => bindStepsGallery());
  safe(() => bindHeaderStuck());
  safe(() => bindCountUps());
  safe(() => bindReveals());
}

function bindCasesSlider() {
  const track = document.querySelector("[data-g2-slider-track]");
  if (!track) return;
  const prev = document.querySelector("[data-g2-slider-prev]");
  const next = document.querySelector("[data-g2-slider-next]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function step() {
    const card = track.querySelector(".g2-case");
    const gap = parseFloat(getComputedStyle(track).columnGap) || 20;
    return card ? card.getBoundingClientRect().width + gap : 400;
  }
  function sync() {
    const max = track.scrollWidth - track.clientWidth - 2;
    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = track.scrollLeft >= max;
  }
  function go(dir) {
    track.scrollBy({ left: dir * step(), behavior: reduce ? "auto" : "smooth" });
  }
  if (prev) prev.addEventListener("click", () => go(-1));
  if (next) next.addEventListener("click", () => go(1));
  track.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);
  sync();

  // перетаскивание мышью
  let down = false, startX = 0, startLeft = 0, moved = false;
  track.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
  });
  window.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) { moved = true; track.classList.add("is-dragging"); }
    if (moved) track.scrollLeft = startLeft - dx;
  });
  window.addEventListener("pointerup", () => {
    if (!down) return;
    down = false;
    track.classList.remove("is-dragging");
  });
  track.addEventListener("click", (e) => { if (moved) { e.preventDefault(); moved = false; } }, true);
}

function bindStepsGallery() {
  const g = document.querySelector("[data-sg]");
  if (!g) return;
  const panels = [...g.querySelectorAll(".sg__panel")];
  const hover = window.matchMedia("(hover: hover) and (min-width: 768px)");
  function open(p) {
    panels.forEach((x) => {
      const on = x === p;
      x.classList.toggle("is-open", on);
      x.querySelector(".sg__btn").setAttribute("aria-expanded", String(on));
    });
  }
  panels.forEach((p, i) => {
    const b = p.querySelector(".sg__btn");
    p.addEventListener("pointerenter", () => { if (hover.matches) open(p); });
    b.addEventListener("click", () => open(p));
    b.addEventListener("focus", () => open(p));
    b.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      panels[(i + d + panels.length) % panels.length].querySelector(".sg__btn").focus();
    });
  });
}

function bindReveals() {
  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("is-in"));
  }
}

function formatCount(value, decimals) {
  if (decimals > 0) {
    return value.toLocaleString("ru-RU", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return Math.round(value).toLocaleString("ru-RU");
}

function bindCountUps() {
  const nodes = document.querySelectorAll("[data-count]");
  if (!nodes.length) return;

  function run(el) {
    const target = Number(el.dataset.count);
    const decimals = Number(el.dataset.decimals || 0);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    if (reduceMotion || !Number.isFinite(target)) {
      el.textContent = `${prefix}${formatCount(target, decimals)}${suffix}`;
      return;
    }
    const start = performance.now();
    const duration = 1100;
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = `${prefix}${formatCount(target * eased, decimals)}${suffix}`;
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = `${prefix}${formatCount(target, decimals)}${suffix}`;
    }
    requestAnimationFrame(frame);
  }

  if (!("IntersectionObserver" in window)) {
    nodes.forEach(run);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.4 }
  );
  nodes.forEach((el) => io.observe(el));
}

function bindQuotes() {
  const section = document.getElementById("cases");
  const track = document.getElementById("quotes-track");
  if (!track || !section) return;

  const buttons = document.querySelectorAll("[data-quotes-dir]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const intervalMs = 4200;
  let timer = null;
  let paused = false;
  let inView = false;

  function step() {
    const card = track.querySelector("figure");
    return card ? card.getBoundingClientRect().width : 360;
  }

  function maxScroll() {
    return Math.max(0, track.scrollWidth - track.clientWidth - 2);
  }

  function syncNav() {
    const canScroll = maxScroll() > 4;
    buttons.forEach((btn) => {
      btn.disabled = !canScroll;
    });
  }

  function go(dir) {
    const max = maxScroll();
    if (dir > 0 && track.scrollLeft >= max - 4) {
      track.scrollTo({ left: 0, behavior: reduce ? "auto" : "smooth" });
      return;
    }
    if (dir < 0 && track.scrollLeft <= 2) {
      track.scrollTo({ left: max, behavior: reduce ? "auto" : "smooth" });
      return;
    }
    track.scrollBy({ left: dir * step(), behavior: reduce ? "auto" : "smooth" });
  }

  function stopAuto() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function startAuto() {
    stopAuto();
    if (reduce || paused || !inView) return;
    timer = window.setInterval(() => go(1), intervalMs);
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      go(Number(btn.dataset.quotesDir));
      startAuto();
    });
  });

  section.addEventListener("mouseenter", () => {
    paused = true;
    stopAuto();
  });
  section.addEventListener("mouseleave", () => {
    paused = false;
    startAuto();
  });
  track.addEventListener("focusin", () => {
    paused = true;
    stopAuto();
  });
  track.addEventListener("focusout", () => {
    paused = false;
    startAuto();
  });
  track.addEventListener(
    "pointerdown",
    () => {
      paused = true;
      stopAuto();
    },
    { passive: true }
  );
  track.addEventListener("pointerup", () => {
    paused = false;
    startAuto();
  });

  track.addEventListener("scroll", syncNav, { passive: true });
  window.addEventListener("resize", () => {
    syncNav();
    startAuto();
  });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) startAuto();
        else stopAuto();
      },
      { threshold: 0.35 }
    );
    io.observe(section);
  } else {
    inView = true;
    startAuto();
  }

  syncNav();
}

function bindHeaderStuck() {
  const header = document.querySelector("[data-g2-header]");
  if (!header) return;
  const onScroll = () => {
    header.classList.toggle("is-stuck", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function bindFaq() {
  const items = [...document.querySelectorAll(".g2-accordion__item")];
  if (!items.length) return;

  items.forEach((item) => {
    const head = item.querySelector(".g2-accordion__head");
    if (!head) return;
    head.addEventListener("click", () => {
      const willOpen = !item.classList.contains("is-open");
      items.forEach((el) => {
        const open = el === item && willOpen;
        el.classList.toggle("is-open", open);
        const btn = el.querySelector(".g2-accordion__head");
        if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  });
}

bind();
