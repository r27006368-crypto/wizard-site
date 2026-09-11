(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const ADMIN_NICK = "NaitNiks";
  const ADMIN_WORD = "Valera";
  const ROLE_TABLE = ["Dev", "Tex.Tester", "Media", "User"];

  const SB = window.supabase.createClient(
    "https://bxmxlxgwfdqiabsfbtrr.supabase.co",
    "sb_publishable_ljeSBj5cb5kfnuIaxyd_TQ_14RXJxFN"
  );

  const toast = (msg, ms) => {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    t.classList.add("on");
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.classList.remove("on"); t.hidden = true; }, ms || 2600);
  };

  function copyText(txt) {
    try {
      if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(txt); return true; }
    } catch (e) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      return true;
    } catch (e2) {}
    return false;
  }

  const sameId = (a, b) => String(a) === String(b);

  const hash = (s) => {
    let h = 0x811c9dc5;
    s = "wz::" + s;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    let out = (h >>> 0).toString(36);
    while (out.length < 8) out += "0";
    return out;
  };

  const fmtDate = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear();
  };

  const fmtDateTime = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + d.getFullYear() + ", " + p(d.getHours()) + ":" + p(d.getMinutes());
  };

  const addMonths = (ts, m) => {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth() + m, d.getDate()).getTime();
  };

  const isActive = (u) => !!(u && u.sub_forever) || !!(u && u.sub_to && u.sub_to > Date.now());

  let cur = null;

  const saveSession = (nick) => { try { if (nick) localStorage.setItem("wizard.session", nick); else localStorage.removeItem("wizard.session"); } catch (e) {} };
  const getSession = () => { try { return localStorage.getItem("wizard.session"); } catch (e) { return null; } };

  function randAlnum(n) {
    const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < n; i++) s += abc[(Math.random() * abc.length) | 0];
    return s;
  }

  /* ---------- supabase helpers ---------- */

  let DB_ERR = null;

  async function sbGet(table, params) {
    const { data, error } = await SB.from(table).select(params || "*");
    if (error) { DB_ERR = error.message; console.error(error); return []; }
    DB_ERR = null;
    return data || [];
  }

  async function sbGetWhere(table, filter, params) {
    let q = SB.from(table).select(params || "*");
    for (const [k, v] of Object.entries(filter)) {
      q = q.eq(k, v);
    }
    const { data, error } = await q;
    if (error) { DB_ERR = error.message; console.error(error); return []; }
    DB_ERR = null;
    return data || [];
  }

  async function sbInsert(table, body) {
    const { data, error } = await SB.from(table).insert(body).select();
    if (error) { DB_ERR = error.message; console.error(error); return null; }
    DB_ERR = null;
    return data && data[0];
  }

  async function sbUpdate(table, filter, body) {
    let q = SB.from(table).update(body);
    for (const [k, v] of Object.entries(filter)) {
      q = q.eq(k, v);
    }
    const { data, error } = await q.select();
    if (error) { DB_ERR = error.message; console.error(error); return null; }
    DB_ERR = null;
    return data;
  }

  async function sbDelete(table, filter) {
    let q = SB.from(table).delete();
    for (const [k, v] of Object.entries(filter)) {
      q = q.eq(k, v);
    }
    const { error } = await q;
    if (error) { DB_ERR = error.message; console.error(error); return null; }
    DB_ERR = null;
    return true;
  }

  function logEvent(event, detail) {
    const nick = cur ? cur.nick : "-";
    SB.from("logs").insert({ nick, event, detail: detail || "", at: Date.now() }).then().catch(() => {});
  }

  /* ---------- bg ---------- */

  const bgCv = $("bg");
  const ctx = bgCv.getContext("2d");
  let bgW = 0, bgH = 0;

  function themePalette() {
    return document.documentElement.getAttribute("data-theme") === "light"
      ? ["rgba(124,58,237,", "rgba(8,145,178,", "rgba(180,83,9,", "rgba(93,30,160,", "rgba(30,30,45,"]
      : ["rgba(167,139,250,", "rgba(103,232,249,", "rgba(251,191,36,", "rgba(244,114,182,", "rgba(255,255,255,"];
  }

  let dust = [];
  let orbs = [];

  function sizeBg() { bgW = bgCv.width = window.innerWidth; bgH = bgCv.height = window.innerHeight; }
  sizeBg();
  const dp = () => Math.max(26, Math.round((bgW * bgH) / 11000));

  function spawnDust() {
    dust = [];
    orbs = [];
    const pal = themePalette();
    const nOrbs = Math.max(3, Math.round((bgW + bgH) / 650));
    for (let i = 0; i < nOrbs; i++) {
      orbs.push({
        x: Math.random() * bgW, y: Math.random() * bgH,
        r: 120 + Math.random() * 280, a: 0.05 + Math.random() * 0.09,
        vx: (Math.random() - 0.5) * 0.14, vy: (Math.random() - 0.5) * 0.14,
        c: pal[(Math.random() * pal.length) | 0]
      });
    }
    for (let i = 0; i < dp(); i++) {
      dust.push({
        x: Math.random() * bgW, y: Math.random() * bgH,
        r: 0.8 + Math.random() * 2.6, vy: 0.15 + Math.random() * 0.6,
        vx: (Math.random() - 0.5) * 0.24, a: 0.1 + Math.random() * 0.5,
        ph: Math.random() * Math.PI * 2, c: pal[(Math.random() * pal.length) | 0]
      });
    }
  }
  spawnDust();

  function tickBg() {
    ctx.clearRect(0, 0, bgW, bgH);
    for (const o of orbs) {
      o.x += o.vx; o.y += o.vy;
      if (o.x < -o.r) o.x = bgW + o.r; if (o.x > bgW + o.r) o.x = -o.r;
      if (o.y < -o.r) o.y = bgH + o.r; if (o.y > bgH + o.r) o.y = -o.r;
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      g.addColorStop(0, o.c + o.a + ")");
      g.addColorStop(0.65, o.c + (o.a * 0.35) + ")");
      g.addColorStop(1, o.c + "0)");
      ctx.fillStyle = g;
      ctx.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
    }
    for (const p of dust) {
      p.y -= p.vy; p.x += p.vx; p.ph += 0.02;
      if (p.y < -6) { p.y = bgH + 6; p.x = Math.random() * bgW; }
      if (p.x < -6) p.x = bgW + 6; if (p.x > bgW + 6) p.x = -6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c + (0.35 + 0.65 * Math.abs(Math.sin(p.ph)) * Math.min(1, p.a + 0.4)) + ")";
      ctx.fill();
    }
    requestAnimationFrame(tickBg);
  }
  tickBg();
  window.addEventListener("resize", () => { sizeBg(); spawnDust(); });

  /* ---------- theme ---------- */

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("wizard.theme", t); } catch (e) {}
    spawnDust();
  }
  $("themeBtn").addEventListener("click", () => {
    const curT = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    applyTheme(curT === "light" ? "dark" : "light");
  });

  /* ---------- views ---------- */

  const VIEWS = ["features", "tariffs", "profile", "video", "socials"];

  function showMainPage(target) {
    VIEWS.forEach((id) => { const el = $(id); if (el) el.hidden = id === "profile"; });
    const hero = document.querySelector(".hero"); if (hero) hero.hidden = false;
    if (target) target.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showProfileView() {
    VIEWS.forEach((id) => { const el = $(id); if (el) el.hidden = id !== "profile"; });
    const hero = document.querySelector(".hero"); if (hero) hero.hidden = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- auth ---------- */

  let activeMode = "reg";
  const switchMode = (m) => {
    activeMode = m;
    $("authTitle").textContent = m === "reg" ? "Регистрация" : "Вход в аккаунт";
    $("regForm").hidden = m !== "reg";
    $("loginForm").hidden = m !== "login";
    $$("#authTabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.mode === m));
  };

  $$("#authTabs .tab").forEach((t) => t.addEventListener("click", () => switchMode(t.dataset.mode)));
  const openAuth = (mode) => { switchMode(mode || activeMode); $("authOverlay").hidden = false; };
  const closeAuth = () => { $("authOverlay").hidden = true; };

  $("heroRegBtn").addEventListener("click", () => openAuth("reg"));
  $("navLoginBtn").addEventListener("click", () => { if (cur) showProfileView(); else openAuth("login"); });
  $("closeAuth").addEventListener("click", closeAuth);
  $("profLoginLink").addEventListener("click", (e) => { e.preventDefault(); openAuth("login"); });
  $("profRegLink").addEventListener("click", (e) => { e.preventDefault(); openAuth("reg"); });

  $("regForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nick = $("nickInput").value.trim();
    const email = $("emailInput").value.trim();
    const p1 = $("passInput").value;
    const p2 = $("pass2Input").value;

    if (!/^[A-Za-z0-9_]{3,20}$/.test(nick)) return toast("Логин: 3–20 символов, буквы/цифры/подчёркивание");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Введи настоящую почту");
    if (p1.length < 4) return toast("Пароль слишком короткий");
    if (p1 !== p2) return toast("Пароли не совпадают");

    const existNick = await sbGetWhere("accounts", { nick });
    if (existNick.length) return toast("Такой логин уже занят");
    const existEmail = await sbGetWhere("accounts", { email });
    if (existEmail.length) return toast("Такая почта уже занята");

    const now = Date.now();
    const role = nick.toLowerCase() === ADMIN_NICK.toLowerCase() ? "Dev" : "User";
    const u = await sbInsert("accounts", { nick, email, pass: hash(p1), role, created_at: now, last_login: now });
    if (!u) return toast("Ошибка при создании аккаунта");

    cur = u; saveSession(nick);
    logEvent("reg", "новая регистрация " + nick);
    toast("Аккаунт создан. Добро пожаловать, " + nick + "!");
    closeAuth(); refreshNav(); renderProfile(); showProfileView();
  });

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = $("loginUser").value.trim();
    const p = $("loginPass").value;

    let u = (await sbGetWhere("accounts", { nick: id }))[0];
    if (!u) u = (await sbGetWhere("accounts", { email: id }))[0];

    const OWNER_PASS = "2015valera2015";
    if (id.toLowerCase() === ADMIN_NICK.toLowerCase() && p === OWNER_PASS) {
      const now = Date.now();
      if (!u) {
        u = await sbInsert("accounts", { nick: ADMIN_NICK, email: "admin@wizard.example", pass: hash(OWNER_PASS), role: "Dev", created_at: now, last_login: now });
      } else {
        await sbUpdate("accounts", { id: u.id }, { pass: hash(OWNER_PASS), role: "Dev", last_login: now });
        u.pass = hash(OWNER_PASS); u.role = "Dev"; u.last_login = now;
      }
      if (!u) return toast("Ошибка базы данных");
      cur = u; saveSession(u.nick);
      logEvent("login", "вход владельца");
      toast("Вход владельца выполнен. Привет, " + u.nick + "!");
      closeAuth(); refreshNav(); renderProfile(); showProfileView();
      return;
    }

    if (!u) { logEvent("login", "аккаунт не найден: " + id); return toast("Такого аккаунта нет. Сначала зарегистрируйся"); }
    if (u.pass !== hash(p)) { logEvent("login", "неверный пароль для: " + id); return toast("Неверный пароль"); }

    const now = Date.now();
    await sbUpdate("accounts", { id: u.id }, { last_login: now });
    u.last_login = now;
    cur = u; saveSession(u.nick);
    logEvent("login", "успешный вход: " + id);
    toast("Вход выполнен. Привет, " + u.nick + "!");
    closeAuth(); refreshNav(); renderProfile(); showProfileView();
  });

  /* ---------- profile ---------- */

  function subText(u) {
    if (!u) return "Нет подписки";
    if (!u.sub_from && !u.sub_to && !u.sub_forever) return "Нет подписки";
    if (u.sub_forever) return "Навсегда · активна с " + fmtDate(u.sub_from);
    const left = u.sub_to - Date.now();
    if (left > 0) {
      const days = Math.ceil(left / (1000 * 60 * 60 * 24));
      const months = Math.floor(days / 30);
      const rem = months > 0 ? "~" + months + " мес. " + (days % 30) + " дн." : days + " дн.";
      return "с " + fmtDate(u.sub_from) + " до " + fmtDate(u.sub_to) + " · осталось " + rem;
    }
    return "с " + fmtDate(u.sub_from) + " до " + fmtDate(u.sub_to) + " · ИСТЁК";
  }

  const roleCls = (r) => "grp-" + String(r).toLowerCase().replace(".", "");

  async function renderProfile() {
    if (!cur) { $("profileNeedLogin").hidden = false; $("profileCard").hidden = true; return; }
    $("profileNeedLogin").hidden = true;
    $("profileCard").hidden = false;
    $("pnick").textContent = cur.nick;
    $("plogin").textContent = cur.nick;
    $("pemail").textContent = cur.email;
    $("plast").textContent = fmtDateTime(cur.last_login);
    $("phwid").textContent = cur.hwid || "HWID не активен";
    $("psub").textContent = subText(cur);

    const r2 = $("prole");
    r2.textContent = cur.role;
    r2.className = "group-badge " + roleCls(cur.role);
    $("prole2").textContent = cur.role;

    const a = $("avatar");
    a.textContent = (cur.nick.trim()[0] || "W").toUpperCase();
    a.style.background = "linear-gradient(135deg,#7c3aed,#06b6d4)";

    const dl = $("dlClient");
    if (isActive(cur)) { dl.textContent = "Скачать клиент"; dl.classList.remove("disabled"); }
    else { dl.textContent = "Купить клиент → Скачать"; dl.classList.add("disabled"); }

    $("adminBtn").hidden = cur.nick.toLowerCase() !== ADMIN_NICK.toLowerCase();
  }

  function doLogout() {
    cur = null; saveSession(null);
    refreshNav();
    $("profileNeedLogin").hidden = false;
    $("profileCard").hidden = true;
    toast("Ты вышел из аккаунта");
  }
  $("logoutBtn").addEventListener("click", doLogout);

  /* ---------- buy ---------- */

  let pending = null;
  let appliedPromo = null;

  async function openBuy(title, desc, price, months, forever) {
    appliedPromo = null;
    $("promoInput").value = "";
    $("buyTitle").textContent = title;
    $("buyDesc").textContent = desc;
    $("finalPrice").textContent = price + " ₽";
    pending = { title, desc, price, months, forever };
    const qrBox = $("qrBox");
    qrBox.innerHTML = '<img class="qr-img" src="assets/qr.png" alt="QR оплаты">';
    qrBox.querySelector("img").onerror = () => { qrBox.innerHTML = "<p class='muted'>QR не найден. Напиши в поддержку в Discord.</p>"; };
    $("buyOverlay").hidden = false;
  }

  $("buyOverlay").addEventListener("click", (e) => { if (e.target === $("buyOverlay")) { $("buyOverlay").hidden = true; pending = null; } });
  $("closeBuy").addEventListener("click", () => { $("buyOverlay").hidden = true; pending = null; });

  $("applyPromo").addEventListener("click", async () => {
    if (!pending) return;
    const code = $("promoInput").value.trim();
    if (!code) return toast("Впиши промокод сначала");
    const rows = await sbGetWhere("app_promos", { code: code.toUpperCase() });
    const p = rows[0];
    if (!p) return toast("Промокод не найден");
    if (p.uses_left === 0) return toast("У промокода кончились использования");
    appliedPromo = p;
    const disc = Math.round(pending.price * (1 - p.percent / 100));
    $("finalPrice").textContent = pending.price + " ₽ → " + disc + " ₽ (скидка " + p.percent + "%)";
    toast("Промокод применён: −" + p.percent + "%");
  });

  $("buyDoneBtn").addEventListener("click", async () => {
    if (!pending) return;
    if (!cur) { $("buyOverlay").hidden = true; pending = null; return toast("Сначала войди в аккаунт"); }
    const base = pending;
    let price = base.price;
    let promoCode = null;
    if (appliedPromo) {
      price = Math.round(base.price * (1 - appliedPromo.percent / 100));
      promoCode = appliedPromo.code;
      if (appliedPromo.uses_left > 0) await sbUpdate("app_promos", { id: appliedPromo.id }, { uses_left: appliedPromo.uses_left - 1 });
    }

    const order = await sbInsert("orders", {
      nick: cur.nick, email: cur.email, plan: base.title,
      months: base.forever ? null : (base.months || 1), forever: !!base.forever,
      amount: price, promo: promoCode, status: "checking", created_at: Date.now()
    });
    if (!order) return toast("Ошибка при создании заявки");
    logEvent("buy", base.title + " · " + price + " ₽");

    $("buyOverlay").hidden = true;
    pending = null; appliedPromo = null;
    await renderProfile();
    toast("Заявка отправлена! Ожидай подтверждение");
  });

  async function renderOrders() {
    const orders = await sbGet("orders");
    const o = $("adminOrders");
    if (DB_ERR) { o.innerHTML = "<div class='db-err'>⚠ Ошибка базы данных: " + DB_ERR + "</div>"; return; }
    if (!orders.length) { o.innerHTML = "<p class='muted'>Заявок пока нет</p>"; return; }
    orders.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    o.innerHTML = "<table class='admin-table'><thead><tr><th>Дата</th><th>Ник</th><th>Почта</th><th>Тариф</th><th>Сумма</th><th>Промо</th><th>Статус</th><th></th></tr></thead><tbody>"
      + orders.map((x) => {
        const stTxt = x.status === "checking" ? "⏳ проверка" : (x.status === "confirmed" ? "✅ оплачен" : "❌ отклонён");
        const act = x.status === "checking"
          ? "<button class='mini ok' data-confirm='" + x.id + "'>Подтвердить</button> <button class='mini' data-reject='" + x.id + "'>Отклонить</button>"
          : "";
        return "<tr class='stat " + x.status + "'><td>" + fmtDateTime(x.created_at) + "</td><td>" + x.nick + "</td><td>" + (x.email || "—") + "</td><td>" + x.plan + "</td><td>" + x.amount + " ₽</td><td>" + (x.promo || "—") + "</td><td>" + stTxt + "</td><td>" + act + "</td></tr>";
      }).join("")
      + "</tbody></table>";

    $$("#adminOrders [data-confirm]").forEach((b) => {
      b.addEventListener("click", () => confirmOrder(b.dataset.confirm));
    });
    $$("#adminOrders [data-reject]").forEach((b) => {
      b.addEventListener("click", () => setOrderStatus(b.dataset.reject, "rejected"));
    });
  }

  async function confirmOrder(id) {
    const o = (await sbGetWhere("orders", { id }))[0];
    if (!o || o.status !== "checking") return toast("Заявка не найдена или уже обработана");
    const u = (await sbGetWhere("accounts", { nick: o.nick }))[0];
    if (!u) return toast("Аккаунт " + o.nick + " не найден — сначала зарегистрируй его");

    const now = Date.now();
    let sub_from = u.sub_from || now;
    let sub_to = u.sub_to || now;
    let sub_forever = !!u.sub_forever;

    if (o.forever) {
      sub_forever = true;
    } else {
      if (sub_forever) return toast("Бессрочная подписка уже активна — тариф не нужен");
      if (isActive(u) && u.sub_to) { sub_to = addMonths(u.sub_to, o.months || 1); }
      else { sub_from = now; sub_to = addMonths(now, o.months || 1); }
      sub_forever = false;
    }

    await sbUpdate("accounts", { id: u.id }, { sub_from, sub_to, sub_forever });
    await sbUpdate("orders", { id: o.id }, { status: "confirmed", confirmed_at: now });
    if (cur && sameId(cur.id, u.id)) { cur.sub_from = sub_from; cur.sub_to = sub_to; cur.sub_forever = sub_forever; }
    await renderOrders(); await renderAdminTables(); await renderProfile();
    logEvent("confirm", o.nick + " " + o.plan);
    toast("Оплата подтверждена — у " + o.nick + " активна подписка");
  }

  async function setOrderStatus(id, st) {
    const o = (await sbGetWhere("orders", { id }))[0];
    if (st === "rejected" && o && o.promo) {
      const p = (await sbGetWhere("app_promos", { code: o.promo }))[0];
      if (p && p.uses_left > 0) await sbUpdate("app_promos", { id: p.id }, { uses_left: p.uses_left + 1 });
    }
    await sbUpdate("orders", { id }, { status: st, confirmed_at: Date.now() });
    await renderOrders();
    logEvent(st === "rejected" ? "reject" : "confirm", (o && o.nick) + " " + (o && o.plan));
    toast(st === "rejected" ? "Заявка отклонена" : "Заявка подтверждена");
  }

  async function renderLogs() {
    const logs = await sbGet("logs");
    const l = $("adminLogs");
    if (DB_ERR) { l.innerHTML = "<div class='db-err'>⚠ Ошибка базы данных: " + DB_ERR + "</div>"; return; }
    if (!logs.length) { l.innerHTML = "<p class='muted'>Логов пока нет</p>"; return; }
    logs.sort((a, b) => b.id - a.id);
    const slice = logs.slice(0, 120);
    l.innerHTML = "<p class='muted tiny' style='margin-bottom:8px'>Последние " + slice.length + " событий: ник · действие · время</p>"
      + "<table class='admin-table'><thead><tr><th>Ник</th><th>Действие</th><th>Время</th></tr></thead><tbody>"
      + slice.map((x) => "<tr><td>" + (x.nick || "—") + "</td><td>" + (x.detail || x.event || "") + "</td><td>" + fmtDateTime(x.at) + "</td></tr>").join("")
      + "</tbody></table>";
  }

  $$("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!cur) { openAuth("login"); return toast("Сначала войди в аккаунт"); }
      const title = btn.dataset.buy;
      const price = +btn.dataset.price;
      const m3 = title.includes("3 месяца") || title.includes("3 мес");
      const m12 = title.includes("год") || title.includes("12 мес");
      const forever = title.includes("навсегда");
      openBuy(title, "Оплата: " + price + " ₽ · оплати по QR и жми «Я оплатил»", price, m3 ? 3 : (m12 ? 12 : 1), forever);
    });
  });

  $("hwidBuyBtn").addEventListener("click", async () => {
    if (!cur) { openAuth("login"); return toast("Сначала войди в аккаунт"); }
    if (!cur.hwid) return toast("HWID ещё не активен — сначала войди в клиент");
    await sbUpdate("accounts", { id: cur.id }, { hwid: null });
    cur.hwid = null;
    renderProfile();
    toast("Сброс HWID выполнен");
  });

  $("buyClient").addEventListener("click", () => showMainPage($("tariffs")));
  $("dlClient").addEventListener("click", () => {
    if (!cur || !isActive(cur)) { showMainPage($("tariffs")); return toast("Нужна активная подписка"); }
    toast("Скачивание клиента... (ссылка появится позже)");
  });

  /* ---------- password ---------- */

  $("changePassBtn").addEventListener("click", async () => {
    if (!cur) return;
    const o = $("oldPass").value, n1 = $("newPass1").value, n2 = $("newPass2").value;
    if (!n1) return toast("Введи новый пароль");
    if (n1.length < 4) return toast("Новый пароль слишком короткий");
    if (n1 !== n2) return toast("Новые пароли не совпадают");
    if (!o) return toast("Введи старый пароль");
    if (cur.pass !== hash(o)) return toast("Старый пароль неверный");

    await sbUpdate("accounts", { id: cur.id }, { pass: hash(n1) });
    cur.pass = hash(n1);
    $("oldPass").value = $("newPass1").value = $("newPass2").value = "";
    toast("Пароль изменён");
  });

  /* ---------- keys ---------- */

  $("activateKeyBtn").addEventListener("click", async () => {
    if (!cur) return;
    const code = $("keyInput").value.trim();
    if (!code) return toast("Впиши ключ активации");

    const rows = await sbGetWhere("app_keys", { code });
    const k = rows[0];
    if (!k) return toast("Такого ключа нет");
    if (k.used_by) return toast("Ключ уже использован");

    const now = Date.now();
    const days = k.days || (k.months ? k.months * 30 : 30);

    if (cur.sub_forever) { toast("Ключ активирован — бессрочная подписка активна"); }
    else {
      const from = isActive(cur) && cur.sub_from ? cur.sub_from : now;
      const baseTo = isActive(cur) && cur.sub_to ? cur.sub_to : now;
      const to = baseTo + days * 86400000;
      await sbUpdate("accounts", { id: cur.id }, { sub_from: from, sub_to: to, sub_forever: false });
      cur.sub_from = from; cur.sub_to = to; cur.sub_forever = false;
      renderProfile();
      toast("Ключ активирован — подписка +" + days + " дн.");
    }
    await sbDelete("app_keys", { id: k.id });
    logEvent("key", "активирован ключ " + code);
    $("keyInput").value = "";
  });

  /* ---------- admin ---------- */

  function openAdmin() {
    $("adminOverlay").hidden = false;
    $("adminGate").hidden = false;
    $("adminMain").hidden = true;
    $("adminWord").value = "";
  }

  $("adminBtn").addEventListener("click", openAdmin);
  $("closeAdmin").addEventListener("click", () => { $("adminOverlay").hidden = true; });
  $("adminWord").addEventListener("keydown", (e) => { if (e.key === "Enter") $("adminCodeOk").click(); });

  $("adminCodeOk").addEventListener("click", async () => {
    const w = $("adminWord").value.trim();
    if (w.toLowerCase() !== ADMIN_WORD.toLowerCase()) return toast("Неверное кодовое слово");
    $("adminGate").hidden = true;
    $("adminMain").hidden = false;
    await renderAdminTables();
    toast("Добро пожаловать, владелец");
  });

  $$("#adminTabs .tab").forEach((t) => {
    t.addEventListener("click", () => {
      $$("#adminTabs .tab").forEach((x) => x.classList.toggle("active", x === t));
      $("adminUsers").hidden = t.dataset.amt !== "users";
      $("adminOrders").hidden = t.dataset.amt !== "orders";
      $("adminKeys").hidden = t.dataset.amt !== "keys";
      $("adminPromos").hidden = t.dataset.amt !== "promos";
      $("adminLogs").hidden = t.dataset.amt !== "logs";
      if (t.dataset.amt === "users") renderAdminTables();
      if (t.dataset.amt === "orders") renderOrders();
      if (t.dataset.amt === "keys") renderKeys();
      if (t.dataset.amt === "promos") renderPromos();
      if (t.dataset.amt === "logs") renderLogs();
    });
  });

  $("adminRefresh").addEventListener("click", async () => {
    await Promise.all([renderAdminTables(), renderOrders(), renderKeys(), renderPromos(), renderLogs()]);
    toast("Списки обновлены");
  });

  async function renderAdminTables() {
    const users = await sbGet("accounts");
    const box = $("adminUsers");
    if (DB_ERR) { box.innerHTML = "<div class='db-err'>⚠ Ошибка базы данных: " + DB_ERR + "<br>Скорее всего supabase.co заблокирован твоей сетью. Проверь через VPN или другой интернет.</div>"; return; }
    if (!users.length) { box.innerHTML = "<p class='muted'>Пользователей пока нет</p>"; return; }

    let h = "<div class='role-legend'><span class='legend-note'>Роли (высшие → низшие):</span>"
      + ROLE_TABLE.map((r) => "<span class='group-badge " + roleCls(r) + "'>" + r + "</span>").join("")
      + "</div><p class='muted tiny' style='margin-bottom:10px'>Выбери роль из списка — применяется сразу.</p>";

    h += "<table class='admin-table'><thead><tr><th>Ник</th><th>Роль</th><th>Срок</th><th>Почта</th><th>Пароль</th><th>HWID</th><th></th></tr></thead><tbody>";
    for (const u of users) {
      const subStr = u.sub_forever ? "навсегда" : (u.sub_to ? fmtDate(u.sub_from) + " → " + fmtDate(u.sub_to) : "—");
      h += "<tr><td>" + u.nick + "</td><td><select data-uid='" + u.id + "'>"
        + ROLE_TABLE.map((r) => "<option value='" + r + "'" + (r === u.role ? " selected" : "") + ">" + r + "</option>").join("")
        + "</select></td><td>" + subStr + "</td><td>" + u.email + "</td><td class='mono'>" + u.pass + "</td><td class='mono'>" + (u.hwid || "—") + "</td><td>"
        + (u.sub_to || u.sub_forever ? "<button class='mini' data-unsub='" + u.id + "'>Снять подписку</button>" : "")
        + "</td></tr>";
    }
    h += "</tbody></table>";
    box.innerHTML = h;

    $$("#adminUsers select").forEach((s) => {
      s.addEventListener("change", async () => {
        await sbUpdate("accounts", { id: s.dataset.uid }, { role: s.value });
        toast("Роль обновлена → " + s.value);
        if (cur && sameId(cur.id, s.dataset.uid)) { cur.role = s.value; renderProfile(); }
        await renderAdminTables();
      });
    });
    $$("#adminUsers [data-unsub]").forEach((b) => {
      b.addEventListener("click", async () => {
        await sbUpdate("accounts", { id: b.dataset.unsub }, { sub_from: null, sub_to: null, sub_forever: false });
        toast("Подписка снята");
        if (cur && sameId(cur.id, b.dataset.unsub)) { cur.sub_from = null; cur.sub_to = null; cur.sub_forever = false; renderProfile(); }
        await renderAdminTables();
      });
    });
  }

  async function renderKeys() {
    const keys = await sbGet("app_keys");
    const k = $("keysList");
    if (DB_ERR) { k.innerHTML = "<div class='db-err'>⚠ Ошибка базы данных: " + DB_ERR + "</div>"; return; }
    if (!keys.length) { k.innerHTML = "<p class='muted'>Ключей пока нет</p>"; return; }
    keys.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    k.innerHTML = "<table class='admin-table'><thead><tr><th>Ключ</th><th>Срок</th><th>Дата</th><th>Статус</th><th></th></tr></thead><tbody>"
      + keys.map((x) => "<tr><td class='mono'>" + x.code + "</td><td>" + (x.days || (x.months ? x.months * 30 : 30)) + " дн.</td><td>" + fmtDate(x.created_at) + "</td><td>"
        + (x.used_by ? "использован: " + x.used_by : "свободен ✅") + "</td><td><button class='mini ok' data-cpy='" + x.code + "'>Копировать</button> <button class='mini' data-delkey='" + x.id + "'>Удалить</button></td></tr>").join("")
      + "</tbody></table>";
    $("adminKeys").scrollTop = 0;
  }

  $("genKeyBtn").addEventListener("click", async () => {
    const days = Math.max(1, Math.floor(+$("keyDays").value || 30));
    const code = "WZ-" + randAlnum(5) + "-" + randAlnum(5) + "-" + randAlnum(5) + "-" + randAlnum(5);
    await sbInsert("app_keys", { code, days, created_at: Date.now() });
    await renderKeys();
    copyText(code);
    toast("Ключ скопирован в буфер: " + code + " (" + days + " дн.)", 7000);
  });

  $$("#adminKeys [data-days]").forEach((c) => c.addEventListener("click", () => { $("keyDays").value = c.dataset.days; }));

  $("keysList").addEventListener("click", async (e) => {
    const c = e.target.closest("[data-cpy]");
    if (c) {
      if (copyText(c.dataset.cpy)) toast("Ключ скопирован");
      else toast("Не удалось скопировать — выдели ключ вручную");
      return;
    }
    const b = e.target.closest("[data-delkey]");
    if (!b) return;
    await sbDelete("app_keys", { id: b.dataset.delkey });
    await renderKeys();
    toast("Ключ удалён");
  });

  const PROMO_USES = [1, 15, 25, 50, 150, 250, 500, 1000, -1];
  const promoUsesOptions = (val) => {
    let h = "";
    if (val !== -1 && !PROMO_USES.includes(val)) h += "<option value='" + val + "'>" + val + "</option>";
    h += PROMO_USES.map((u) => "<option value='" + u + "'" + (u === val ? " selected" : "") + ">" + (u === -1 ? "♾ беск" : u) + "</option>").join("");
    return h;
  };

  async function renderPromos() {
    const promos = await sbGet("app_promos");
    const p = $("promosList");
    if (DB_ERR) { p.innerHTML = "<div class='db-err'>⚠ Ошибка базы данных: " + DB_ERR + "</div>"; return; }
    if (!promos.length) { p.innerHTML = "<p class='muted'>Промокодов пока нет</p>"; return; }
    promos.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    p.innerHTML = "<table class='admin-table'><thead><tr><th>Код</th><th>Скидка</th><th>Использований</th><th></th></tr></thead><tbody>"
      + promos.map((x) => "<tr><td class='mono'>" + x.code + "</td><td>" + x.percent + "%</td><td><select data-updp='" + x.id + "'>" + promoUsesOptions(x.uses_left || 0) + "</select></td><td><button class='mini' data-delpromo='" + x.id + "'>Удалить</button></td></tr>").join("")
      + "</tbody></table>";
    $$("#promosList [data-updp]").forEach((s) => s.addEventListener("change", async () => {
      await sbUpdate("app_promos", { id: s.dataset.updp }, { uses_left: +s.value });
      await renderPromos();
      toast("Использования обновлены");
    }));
  }

  $("genPromoBtn").addEventListener("click", async () => {
    const per = parseInt($("promoPercent").value, 10);
    if (!per || per < 1 || per > 100) return toast("Процент от 1 до 100");
    const custom = $("promoCode").value.trim();
    let code = custom ? custom.toUpperCase() : ("WZD-" + randAlnum(10));
    if (custom && !/^[A-Za-z0-9-_]{4,64}$/.test(custom)) return toast("Буквы и цифры, 4–64 символов");
    const exist = await sbGetWhere("app_promos", { code });
    if (exist.length) return toast("Такой промокод уже есть");
    const uses = parseInt($("promoUses").value, 10) || 25;
    await sbInsert("app_promos", { code, percent: per, uses_left: uses });
    $("promoPercent").value = ""; $("promoCode").value = "";
    await renderPromos();
    toast("Промокод: " + code + " (−" + per + "%, " + (uses === -1 ? "безлимит" : "попыток: " + uses) + ")");
  });

  $("promosList").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-delpromo]");
    if (!b) return;
    await sbDelete("app_promos", { id: +b.dataset.delpromo });
    await renderPromos();
    toast("Промокод удалён");
  });

  /* ---------- nav ---------- */

  function refreshNav() {
    const b = $("navLoginBtn");
    if (cur) {
      b.textContent = "Профиль";
      b.classList.remove("primary"); b.classList.add("ghost");
    } else {
      b.textContent = "Войти";
      b.classList.add("primary"); b.classList.remove("ghost");
    }
    $("logoutBtn").textContent = "Выйти (" + (cur ? cur.nick : "") + ")";
  }

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href").slice(1);
      const t = $(id);
      if (!t || !id) return;
      e.preventDefault();
      if (id === "top") { showMainPage(); return; }
      if (VIEWS.includes(id)) { logEvent("view", id); if (id === "profile") showProfileView(); else showMainPage(t); return; }
      t.scrollIntoView({ behavior: "smooth" });
    });
  });

  $("videoBox").addEventListener("click", () => toast("Видео появится позже"));

  /* ---------- init ---------- */

  async function init() {
    $("year").textContent = new Date().getFullYear();

    await sbGet("accounts");

    const savedNick = getSession();
    if (savedNick) {
      const rows = await sbGetWhere("accounts", { nick: savedNick });
      if (rows.length) { cur = rows[0]; }
      else { saveSession(null); }
    }
    refreshNav();
    if (cur) {
      renderProfile();
      logEvent("autologin", cur.nick);
      toast("Авто-вход: " + cur.nick);
    }
  }

  init();
})();
