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

  const toast = (msg) => {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    t.classList.add("on");
    clearTimeout(t._h);
    t._h = setTimeout(() => { t.classList.remove("on"); t.hidden = true; }, 2600);
  };

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

  async function sbGet(table, params) {
    const { data, error } = await SB.from(table).select(params || "*");
    if (error) { console.error(error); return []; }
    return data || [];
  }

  async function sbGetWhere(table, filter, params) {
    let q = SB.from(table).select(params || "*");
    for (const [k, v] of Object.entries(filter)) {
      q = q.eq(k, v);
    }
    const { data, error } = await q;
    if (error) { console.error(error); return []; }
    return data || [];
  }

  async function sbInsert(table, body) {
    const { data, error } = await SB.from(table).insert(body).select();
    if (error) { console.error(error); return null; }
    return data && data[0];
  }

  async function sbUpdate(table, filter, body) {
    let q = SB.from(table).update(body);
    for (const [k, v] of Object.entries(filter)) {
      q = q.eq(k, v);
    }
    const { data, error } = await q.select();
    if (error) { console.error(error); return null; }
    return data;
  }

  async function sbDelete(table, filter) {
    let q = SB.from(table).delete();
    for (const [k, v] of Object.entries(filter)) {
      q = q.eq(k, v);
    }
    const { error } = await q;
    return !error;
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

  function sizeBg() { bgW = bgCv.width = window.innerWidth; bgH = bgCv.height = window.innerHeight; }
  sizeBg();
  const dp = () => Math.max(18, Math.round((bgW * bgH) / 16000));

  function spawnDust() {
    dust = [];
    const pal = themePalette();
    for (let i = 0; i < dp(); i++) {
      dust.push({
        x: Math.random() * bgW, y: Math.random() * bgH,
        r: 0.6 + Math.random() * 2.2, vy: 0.15 + Math.random() * 0.55,
        vx: (Math.random() - 0.5) * 0.22, a: 0.1 + Math.random() * 0.5,
        ph: Math.random() * Math.PI * 2, c: pal[(Math.random() * pal.length) | 0]
      });
    }
  }
  spawnDust();

  function tickBg() {
    ctx.clearRect(0, 0, bgW, bgH);
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
      toast("Вход владельца выполнен. Привет, " + u.nick + "!");
      closeAuth(); refreshNav(); renderProfile(); showProfileView();
      return;
    }

    if (!u) return toast("Такого аккаунта нет. Сначала зарегистрируйся");
    if (u.pass !== hash(p)) return toast("Неверный пароль");

    const now = Date.now();
    await sbUpdate("accounts", { id: u.id }, { last_login: now });
    u.last_login = now;
    cur = u; saveSession(u.nick);
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

  function renderProfile() {
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

  function openBuy(title, desc, price, months, forever) {
    appliedPromo = null;
    $("promoInput").value = "";
    $("buyTitle").textContent = "Оформление";
    $("buyDesc").textContent = desc;
    $("finalPrice").textContent = price + " ₽";
    pending = { title, desc, price, months, forever };
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
    if (p.uses_left <= 0) return toast("У промокода кончились использования");
    appliedPromo = p;
    const disc = Math.round(pending.price * (1 - p.percent / 100));
    $("finalPrice").textContent = pending.price + " ₽ → " + disc + " ₽ (скидка " + p.percent + "%)";
    toast("Промокод применён: −" + p.percent + "%");
  });

  $("payBtn").addEventListener("click", async () => {
    if (!pending) return;
    if (!cur) { $("buyOverlay").hidden = true; pending = null; return toast("Сначала войди в аккаунт"); }
    const base = pending;
    let price = base.price;
    if (appliedPromo) {
      price = Math.round(base.price * (1 - appliedPromo.percent / 100));
      await sbUpdate("app_promos", { id: appliedPromo.id }, { uses_left: appliedPromo.uses_left - 1 });
    }

    const now = Date.now();
    let sub_from = now, sub_to = now, sub_forever = false;

    if (base.forever) {
      if (isActive(cur) && cur.sub_forever) { $("buyOverlay").hidden = true; pending = null; return toast("У тебя уже есть бессрочная подписка"); }
      sub_forever = true;
    } else {
      if (isActive(cur) && cur.sub_forever) { $("buyOverlay").hidden = true; pending = null; return toast("Бессрочная подписка — тариф не нужен"); }
      if (isActive(cur) && cur.sub_to) {
        sub_from = cur.sub_from || now;
        sub_to = addMonths(cur.sub_to, base.months);
      } else {
        sub_from = now;
        sub_to = addMonths(now, base.months);
      }
    }

    await sbUpdate("accounts", { id: cur.id }, { sub_from, sub_to, sub_forever });
    cur.sub_from = sub_from; cur.sub_to = sub_to; cur.sub_forever = sub_forever;

    $("buyOverlay").hidden = true; pending = null; appliedPromo = null;
    renderProfile();
    toast("Оплата принята — подписка оформлена");
  });

  $$("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!cur) { openAuth("login"); return toast("Сначала войди в аккаунт"); }
      const title = btn.dataset.buy;
      const price = +btn.dataset.price;
      const m3 = title.includes("3 мес");
      const m12 = title.includes("год");
      const forever = title.includes("навсегда");
      openBuy("Оформление — " + title, title + " · сумма: " + price + " ₽", price, m3 ? 3 : (m12 ? 12 : 1), forever);
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
    if (k.used_by) return toast("Ключ уже использован: " + k.used_by);

    const now = Date.now();
    const m = k.months || 3;
    await sbUpdate("app_keys", { id: k.id }, { used_by: cur.nick, used_at: now });

    if (cur.sub_forever) { toast("Ключ активирован — бессрочная подписка активна"); }
    else {
      const from = isActive(cur) && cur.sub_from ? cur.sub_from : now;
      const baseTo = isActive(cur) && cur.sub_to ? cur.sub_to : now;
      const to = addMonths(baseTo, m);
      await sbUpdate("accounts", { id: cur.id }, { sub_from: from, sub_to: to, sub_forever: false });
      cur.sub_from = from; cur.sub_to = to; cur.sub_forever = false;
      renderProfile();
      toast("Ключ активирован — подписка +" + m + " мес.");
    }
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
      $("adminKeys").hidden = t.dataset.amt !== "keys";
      $("adminPromos").hidden = t.dataset.amt !== "promos";
    });
  });

  async function renderAdminTables() {
    const users = await sbGet("accounts");
    const box = $("adminUsers");
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
        await sbUpdate("accounts", { id: +s.dataset.uid }, { role: s.value });
        toast("Роль обновлена → " + s.value);
        if (cur && cur.id === +s.dataset.uid) { cur.role = s.value; renderProfile(); }
        await renderAdminTables();
      });
    });
    $$("#adminUsers [data-unsub]").forEach((b) => {
      b.addEventListener("click", async () => {
        await sbUpdate("accounts", { id: +b.dataset.unsub }, { sub_from: null, sub_to: null, sub_forever: false });
        toast("Подписка снята");
        if (cur && cur.id === +b.dataset.unsub) { cur.sub_from = null; cur.sub_to = null; cur.sub_forever = false; renderProfile(); }
        await renderAdminTables();
      });
    });
  }

  async function renderKeys() {
    const keys = await sbGet("app_keys");
    const k = $("keysList");
    if (!keys.length) { k.innerHTML = "<p class='muted'>Ключей пока нет</p>"; return; }
    keys.sort((a, b) => b.id - a.id);
    k.innerHTML = "<table class='admin-table'><thead><tr><th>Ключ</th><th>Срок</th><th>Дата</th><th>Статус</th><th></th></tr></thead><tbody>"
      + keys.map((x) => "<tr><td class='mono'>" + x.code + "</td><td>" + x.months + " мес.</td><td>" + fmtDate(x.created_at) + "</td><td>"
        + (x.used_by ? "использован: " + x.used_by + " · " + fmtDate(x.used_at) : "свободен ✅") + "</td><td><button class='mini' data-delkey='" + x.id + "'>Удалить</button></td></tr>").join("")
      + "</tbody></table>";
  }

  $("genKeyBtn").addEventListener("click", async () => {
    const months = Math.max(1, Math.floor(+$("keyMonths").value || 3));
    const code = "WZ-" + randAlnum(5) + "-" + randAlnum(5) + "-" + randAlnum(5) + "-" + randAlnum(5);
    await sbInsert("app_keys", { code, months, created_at: Date.now() });
    await renderKeys();
    toast("Ключ сгенерирован: " + code + " (" + months + " мес.)");
  });

  $("keysList").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-delkey]");
    if (!b) return;
    await sbDelete("app_keys", { id: +b.dataset.delkey });
    await renderKeys();
    toast("Ключ удалён");
  });

  async function renderPromos() {
    const promos = await sbGet("app_promos");
    const p = $("promosList");
    if (!promos.length) { p.innerHTML = "<p class='muted'>Промокодов пока нет</p>"; return; }
    promos.sort((a, b) => b.id - a.id);
    p.innerHTML = "<table class='admin-table'><thead><tr><th>Код</th><th>Скидка</th><th>Использований</th><th></th></tr></thead><tbody>"
      + promos.map((x) => "<tr><td class='mono'>" + x.code + "</td><td>" + x.percent + "%</td><td>" + x.uses_left + "</td><td><button class='mini' data-delpromo='" + x.id + "'>Удалить</button></td></tr>").join("")
      + "</tbody></table>";
  }

  $("genPromoBtn").addEventListener("click", async () => {
    const per = parseInt($("promoPercent").value, 10);
    if (!per || per < 1 || per > 100) return toast("Процент от 1 до 100");
    const custom = $("promoCode").value.trim();
    let code = custom ? custom.toUpperCase() : ("WZD-" + randAlnum(10));
    if (custom && !/^[A-Za-z0-9-_]{4,64}$/.test(custom)) return toast("Буквы и цифры, 4–64 символов");
    const exist = await sbGetWhere("app_promos", { code });
    if (exist.length) return toast("Такой промокод уже есть");
    await sbInsert("app_promos", { code, percent: per, uses_left: 10 });
    $("promoPercent").value = ""; $("promoCode").value = "";
    await renderPromos();
    toast("Промокод: " + code + " (−" + per + "%)");
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
      if (VIEWS.includes(id)) { if (id === "profile") showProfileView(); else showMainPage(t); return; }
      t.scrollIntoView({ behavior: "smooth" });
    });
  });

  $("videoBox").addEventListener("click", () => toast("Видео появится позже"));

  /* ---------- init ---------- */

  async function init() {
    $("year").textContent = new Date().getFullYear();
    const savedNick = getSession();
    if (savedNick) {
      const rows = await sbGetWhere("accounts", { nick: savedNick });
      if (rows.length) { cur = rows[0]; }
      else { saveSession(null); }
    }
    refreshNav();
    if (cur) { showProfileView(); renderProfile(); }
  }

  init();
})();
