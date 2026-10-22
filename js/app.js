const ORDERS = [
  { id: 1042, channel: "yandex", dish: "Пепперони 30 см", status: "Кухня", eta: "12 мин", sum: "890 ₽" },
  { id: 1043, channel: "site", dish: "Филадельфия", status: "Курьер", eta: "24 мин", sum: "1 240 ₽" },
  { id: 1044, channel: "phone", dish: "Wok курица", status: "Новый", eta: "8 мин", sum: "670 ₽" },
  { id: 1045, channel: "yandex", dish: "Бургер классик", status: "Кухня", eta: "15 мин", sum: "540 ₽" },
  { id: 1046, channel: "site", dish: "Шаурма XL", status: "Готов", eta: "31 мин", sum: "420 ₽" },
  { id: 1047, channel: "yandex", dish: "Цезарь ролл", status: "Новый", eta: "6 мин", sum: "510 ₽" },
];

const CHANNEL_LABEL = { yandex: "Яндекс", site: "Сайт", phone: "Телефон" };

const KITCHEN = [
  { dish: "Пепперони 30 см", tickets: 4, minutes: 7 },
  { dish: "Филадельфия", tickets: 3, minutes: 11, stopOnPeak: true },
  { dish: "Wok курица", tickets: 2, minutes: 5 },
  { dish: "Бургер классик", tickets: 5, minutes: 4 },
];

const COURIERS = [
  { name: "Дима", load: "2 заказа", area: "Центр" },
  { name: "Оля", load: "1 заказ", area: "Юго-запад" },
  { name: "Ильяс", load: "свободен", area: "Ленина" },
];

const GUESTS = {
  sleep: {
    title: "Спят 30 дней",
    n: "184 гостя",
    text: "Пуш «Ролл в подарок от 1 200 ₽» — на ваш сайт, не в ленту агрегатора.",
  },
  regular: {
    title: "Ходят каждую неделю",
    n: "96 гостей",
    text: "Бонус x2 на самовывоз. Им и так дешевле у вас, чем в Яндексе.",
  },
  new: {
    title: "Первый заказ с сайта",
    n: "41 гость",
    text: "Второй заказ со скидкой 10% в приложении, чтобы не ушли на площадку.",
  },
};

const state = {
  filter: "all",
  peak: false,
  tab: "orders",
  segment: "sleep",
  channel: "aggregator",
  calcFee: 428400,
  calcKeep: 1611600,
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

function setHeroChannel(channel) {
  state.channel = channel;
  document.querySelectorAll("[data-hero-channel]").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.heroChannel === channel);
  });
  const mode = document.getElementById("hero-mode-label");
  if (mode) mode.textContent = channel === "aggregator" ? "агрегатор" : "свой канал";
  updateCalc();
}

function visibleOrders() {
  return ORDERS.filter((o) => {
    if (state.peak && o.dish === "Филадельфия") return false;
    if (state.filter === "all") return true;
    return o.channel === state.filter;
  });
}

function renderOrders() {
  const list = document.getElementById("order-list");
  const rows = visibleOrders();
  list.innerHTML = rows
    .map(
      (o) => `<li>
        <span class="ch ${o.channel}">${CHANNEL_LABEL[o.channel]}</span>
        <span>${o.dish}</span>
        <span class="status">${o.status}</span>
        <span>${state.peak ? "слот 60 мин" : o.eta}</span>
      </li>`
    )
    .join("");
  document.getElementById("kpi-count").textContent = String(rows.length);
  document.getElementById("kpi-eta").textContent = state.peak ? "60 мин" : "45 мин";
  document.getElementById("kpi-own").textContent = String(
    rows.filter((o) => o.channel === "site" || o.channel === "phone").length
  );
}

function renderKitchen() {
  document.getElementById("kitchen-list").innerHTML = KITCHEN.map((k) => {
    const stopped = state.peak && k.stopOnPeak;
    return `<li class="${stopped ? "stopped" : ""}">
      <span class="ch">${stopped ? "Стоп" : "В работе"}</span>
      <span>${k.dish}</span>
      <span class="status">${k.tickets} тикета</span>
      <span>${stopped ? "снято с меню" : k.minutes + " мин"}</span>
    </li>`;
  }).join("");
}

function renderCouriers() {
  document.getElementById("courier-list").innerHTML = COURIERS.map((c) => {
    const load = state.peak && c.name === "Ильяс" ? "забрали слот +15" : c.load;
    return `<li>
      <span class="ch">Курьер</span>
      <span>${c.name}</span>
      <span class="status">${c.area}</span>
      <span>${load}</span>
    </li>`;
  }).join("");
}

function renderGuests() {
  const g = GUESTS[state.segment];
  document.getElementById("guest-card").innerHTML = `
    <div class="stat-k">${g.title}</div>
    <b>${g.n}</b>
    <p class="screen-lead" style="margin:0">${g.text}</p>
  `;
}

function renderPeak() {
  const alert = document.getElementById("peak-alert");
  alert.hidden = !state.peak;
}

function renderDemo() {
  renderPeak();
  renderOrders();
  renderKitchen();
  renderCouriers();
  renderGuests();
}

function showTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tab").forEach((btn) => {
    const on = btn.dataset.tab === tab;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-selected", String(on));
  });
  document.querySelectorAll(".demo-screen").forEach((screen) => {
    const on = screen.dataset.screen === tab;
    screen.classList.toggle("is-on", on);
    screen.hidden = !on;
  });
  if (tab === "orders") renderOrders();
  if (tab === "kitchen") renderKitchen();
  if (tab === "couriers") renderCouriers();
  if (tab === "guests") renderGuests();
}

function updateCalc() {
  const orders = Number(document.getElementById("calc-orders").value) || 0;
  const check = Number(document.getElementById("calc-check").value) || 0;
  const share = Number(document.getElementById("calc-share").value) || 0;
  document.getElementById("calc-share-val").textContent = `${share}%`;

  const monthTotal = orders * check * 30;
  const monthAgg = monthTotal * (share / 100);
  const fee = state.channel === "aggregator" ? monthAgg * 0.3 : 0;
  const keep = monthTotal - fee;

  const keepLabel = document.getElementById("calc-keep-label");
  if (keepLabel) {
    keepLabel.textContent =
      state.channel === "aggregator" ? "Остаётся точке" : "Остаётся точке (свой канал)";
  }

  const note = document.getElementById("hero-note");
  if (note) {
    note.textContent =
      state.channel === "aggregator"
        ? "Считаем комиссию площадки как 30% от оборота в агрегаторе. Модель для разговора, не обещание экономии."
        : "В своём канале комиссия площадки = 0 ₽. Гость и повторный заказ остаются у точки. Модель для разговора.";
  }

  animateMoney(document.getElementById("calc-fee"), state.calcFee, fee, "calcFee", 380);
  animateMoney(document.getElementById("calc-save"), state.calcKeep, keep, "calcKeep", 380);

  const hiddenFee = document.getElementById("hero-fee");
  const hiddenKeep = document.getElementById("hero-keep");
  if (hiddenFee) hiddenFee.textContent = money(fee);
  if (hiddenKeep) hiddenKeep.textContent = money(keep);
}

function digits(phone) {
  return phone.replace(/\D/g, "");
}

function validateLead(form) {
  const data = Object.fromEntries(new FormData(form));
  const errors = {};
  if (!String(data.name).trim()) errors.name = "Как к вам обращаться";
  const d = digits(data.phone);
  if (d.length < 10) errors.phone = "Нужен номер, на который перезвонить";
  if (!String(data.city).trim()) errors.city = "Город точки";
  if (!data.points || Number(data.points) < 1) errors.points = "Хотя бы одна точка";
  if (!data.orders || Number(data.orders) < 1) errors.orders = "Сколько заказов в обычный день";
  return { data, errors };
}

function paintErrors(form, errors) {
  form.querySelectorAll("[data-err]").forEach((el) => {
    const key = el.dataset.err;
    el.textContent = errors[key] || "";
    const input = form.querySelector(`[name="${key}"]`);
    if (input) input.classList.toggle("is-invalid", Boolean(errors[key]));
  });
}

function showForm(which) {
  ["lead-form", "form-loading", "form-ok", "form-bad"].forEach((id) => {
    const node = document.getElementById(id);
    if (id === "lead-form") node.hidden = which !== "form";
    else node.hidden = which !== id;
  });
}

async function submitLead(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const { data, errors } = validateLead(form);
  paintErrors(form, errors);
  if (Object.keys(errors).length) return;

  showForm("form-loading");
  await new Promise((r) => setTimeout(r, 500));

  const subject = encodeURIComponent("Заявка на подключение Goulash.tech");
  const body = encodeURIComponent(
    [
      `Имя: ${String(data.name).trim()}`,
      `Телефон: ${String(data.phone).trim()}`,
      `Город: ${String(data.city).trim()}`,
      `Точек: ${data.points}`,
      `Заказов в день: ${data.orders}`,
      "",
      "Отправлено с лендинга.",
    ].join("\n")
  );

  try {
    window.location.href = `mailto:info@goulash.tech?subject=${subject}&body=${body}`;
    showForm("form-ok");
  } catch (err) {
    showForm("form-bad");
  }
}

function bind() {
  document.querySelectorAll("[data-hero-channel]").forEach((btn) => {
    btn.addEventListener("click", () => setHeroChannel(btn.dataset.heroChannel));
  });

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });

  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((b) => {
        b.classList.toggle("is-on", b === btn);
      });
      renderOrders();
    });
  });

  document.getElementById("peak-toggle").addEventListener("change", (e) => {
    state.peak = e.target.checked;
    renderDemo();
  });

  document.querySelectorAll("[data-segment]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.segment = btn.dataset.segment;
      document.querySelectorAll("[data-segment]").forEach((b) => {
        b.classList.toggle("is-on", b === btn);
      });
      renderGuests();
    });
  });

  ["calc-orders", "calc-check", "calc-share"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updateCalc);
  });

  document.getElementById("lead-form").addEventListener("submit", submitLead);
  document.getElementById("form-retry").addEventListener("click", () => {
    showForm("form");
  });

  state.calcFee = parseMoney(document.getElementById("calc-fee").textContent);
  state.calcKeep = parseMoney(document.getElementById("calc-save").textContent);

  setHeroChannel("aggregator");
  renderDemo();
  bindFaq();
  bindQuotes();
  bindHeaderStuck();
  bindCountUps();
  bindReveals();
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
