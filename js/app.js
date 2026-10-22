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

// Условия из публичного договора goulash.tech (раздел «Тарифы» и «Внедрение»).
const TARIFF = { rate: 0.01, minMonth: 40000, setupFrom: 31500 };

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
  const license = Math.max(turnover * TARIFF.rate, TARIFF.minMonth);
  const net = saved - license - c.extra;
  const perOrderSaved = c.check * c.days * c.share * c.comm * c.shift;
  const perOrderLicense = c.check * c.days * TARIFF.rate;
  const breakeven =
    perOrderSaved > perOrderLicense ? Math.ceil((TARIFF.minMonth + c.extra) / perOrderSaved) : null;
  return { turnover, fee, saved, license, net, breakeven };
}

function verdictFor(r, c) {
  const cost = r.license + c.extra;
  if (r.net >= cost * 0.25) {
    return {
      key: "ok",
      title: "Экономия покрывает лицензию с запасом",
      why: `Возврат ${state.shift}% заказов из агрегаторов покрывает лицензию с запасом.`,
    };
  }
  if (r.saved >= cost * 0.85) {
    return {
      key: "edge",
      title: "На границе: экономия почти равна затратам",
      why: "Экономия примерно равна затратам, запаса нет. Всё решает, сколько гостей реально придёт в свой канал.",
    };
  }
  return {
    key: "no",
    title: "При выбранном сценарии экономия не покрывает стоимость лицензии",
    why: "Минимальная лицензия 40 000 ₽ в месяц выше возвращаемой комиссии. Для такого объёма Гуляш пока дороже эффекта.",
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

  const v = verdictFor(r, c);
  res.dataset.verdict = v.key;
  setText("calc-verdict", v.title);

  const netEl = document.getElementById("calc-net");
  const sign = r.net < 0 ? "−" : "+";
  netEl.textContent = `${sign}${rub(Math.abs(r.net))}`;
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
  const sign = r.net < 0 ? "−" : "+";
  el.hidden = false;
  el.textContent = `К заявке приложим ваш расчёт: ${c.orders} заказов в день, чек ${rub(c.check)}, переход ${state.shift}%, итог ${sign}${rub(Math.abs(r.net))} в месяц.`;
}

function digits(phone) {
  return phone.replace(/\D/g, "");
}

const LEAD_MSG = {
  name: "Укажите имя",
  phone: "Введите номер полностью, например +7\u00a0900\u00a0000-00-00",
  city: "Укажите город",
  company: "Укажите название компании",
  points: "Укажите количество точек",
  privacy: "Нужно согласие на обработку данных",
};

function validateLead(form) {
  const data = Object.fromEntries(new FormData(form));
  const errors = {};
  if (!String(data.name || "").trim()) errors.name = LEAD_MSG.name;
  if (digits(String(data.phone || "")).length < 10) errors.phone = LEAD_MSG.phone;
  if (!String(data.city || "").trim()) errors.city = LEAD_MSG.city;
  if (!String(data.company || "").trim()) errors.company = LEAD_MSG.company;
  if (!(Number(data.points) >= 1)) errors.points = LEAD_MSG.points;
  if (!form.querySelector('[name="privacy"]').checked) errors.privacy = LEAD_MSG.privacy;
  return { data, errors };
}

function paintErrors(form, errors) {
  form.querySelectorAll(".wpcf7-not-valid-tip").forEach((n) => n.remove());
  form.querySelectorAll(".wpcf7-not-valid").forEach((n) => {
    n.classList.remove("wpcf7-not-valid");
    n.setAttribute("aria-invalid", "false");
  });
  Object.entries(errors).forEach(([name, msg]) => {
    const input = form.querySelector(`[name="${name}"]`);
    const wrap = input.closest(".wpcf7-form-control-wrap");
    if (name !== "privacy") {
      input.classList.add("wpcf7-not-valid");
      input.setAttribute("aria-invalid", "true");
    }
    const tip = document.createElement("span");
    tip.className = "wpcf7-not-valid-tip";
    tip.setAttribute("role", "alert");
    tip.textContent = msg;
    wrap.appendChild(tip);
  });
}

function setFormState(form, status, html) {
  form.classList.remove("init", "invalid", "sending", "sent", "failed");
  form.classList.add(status);
  form.dataset.status = status;
  const out = document.getElementById("form-out");
  out.innerHTML = html || "";
  out.setAttribute("aria-hidden", html ? "false" : "true");
}

// Тестовое задание: настоящей отправки нет. Здесь подставляется сервис приёма заявок;
// пока он имитируется. Состояние ошибки можно посмотреть по адресу ?form=error.
async function sendLead(payload) {
  await new Promise((r) => setTimeout(r, 900));
  if (new URLSearchParams(location.search).get("form") === "error") throw new Error("demo");
  return { ok: true, payload };
}

async function submitLead(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const btn = document.getElementById("lead-submit");
  const { data, errors } = validateLead(form);
  paintErrors(form, errors);
  if (Object.keys(errors).length) {
    setFormState(form, "invalid", "");
    const first = form.querySelector(".wpcf7-not-valid") || form.querySelector('[name="privacy"]');
    if (first) first.focus();
    return;
  }
  const payload = { ...data, calc: state.calcTouched ? state.calc : null };
  btn.disabled = true;
  btn.textContent = "Отправляем…";
  setFormState(form, "sending", "");
  try {
    await sendLead(payload);
    form.reset();
    setFormState(
      form,
      "sent",
      "Заявка отправлена. Менеджер свяжется с\u00a0вами." + (payload.calc ? " Расчёт приложен." : "")
    );
  } catch (err) {
    setFormState(
      form,
      "failed",
      'Не\u00a0удалось отправить заявку. Данные сохранены: попробуйте ещё раз или напишите нам в\u00a0<a class="form__desc--link" href="https://t.me/GoulashPrivatBot" target="_blank" rel="noopener noreferrer">Telegram</a>.'
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "Оставить заявку";
  }
}

function bind() {
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

  document.getElementById("lead-form").addEventListener("submit", submitLead);

  updateCalc();
  bindFaq();
  bindQuotes();
  bindCasesSlider();
  bindHeaderStuck();
  bindCountUps();
  bindReveals();
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
