(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const ADMIN_NICK = "NaitNiks";
  const ADMIN_WORD = "Valera";
  const ROLE_TABLE = ["Dev", "Tex.Tester", "Media", "User"];
  const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

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
    return p(d.getDate()) + "." + p(d.getMonth() + 1) + "." + String(d.getFullYear()).slice(2);
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

  const isActive = (u) => !!(u.sub && (u.sub.forever || u.sub.to > Date.now()));

  const storage = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  let users = storage.get("wizard.users", []);
  let keys = storage.get("wizard.keys", []);
  let promos = storage.get("wizard.promos", []);
  let cur = null;

  const saveUsers = () => storage.set("wizard.users", users);
  const saveKeys = () => storage.set("wizard.keys", keys);
  const savePromos = () => storage.set("wizard.promos", promos);

  const saveSession = (u) => { cur = u; try { if (u) localStorage.setItem("wizard.session", u.nick); else localStorage.removeItem("wizard.session"); } catch (e) {} };
  (() => {
    const saved = (() => { try { return localStorage.getItem("wizard.session"); } catch (e) { return null; } })();
    if (saved) cur = users.find((u) => u.nick === saved) || null;
  })();

  const rand4 = () => Math.random().toString(36).slice(2, 6).toUpperCase();

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

  function sizeBg() {
    bgW = bgCv.width = window.innerWidth;
    bgH = bgCv.height = window.innerHeight;
  }
  sizeBg();

  const dp = () => Math.max(18, Math.round((bgW * bgH) / 16000));

  function spawnDust() {
    dust = [];
    const pal = themePalette();
    const n = dp();
    for (let i = 0; i < n; i++) {
      dust.push({
        x: Math.random() * bgW, y: Math.random() * bgH,
        r: 0.6 + Math.random() * 2.2,
        vy: 0.15 + Math.random() * 0.55,
        vx: (Math.random() - 0.5) * 0.22,
        a: 0.1 + Math.random() * 0.5,
        ph: Math.random() * Math.PI * 2,
        c: pal[(Math.random() * pal.length) | 0]
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
    storage.set("wizard.theme", t);
    spawnDust();
  }

  $("themeBtn").addEventListener("click", () => {
    const curT = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    applyTheme(curT === "light" ? "dark" : "light");
  });

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
  $("navLoginBtn").addEventListener("click", () => { if (cur) doLogout(); else openAuth("login"); });
  $("closeAuth").addEventListener("click", closeAuth);
  $("profLoginLink").addEventListener("click", (e) => { e.preventDefault(); openAuth("login"); });
  $("profRegLink").addEventListener("click", (e) => { e.preventDefault(); openAuth("reg"); });

  $("navProfileBtn").addEventListener("click", () => {
    document.getElementById("profile").scrollIntoView({ behavior: "smooth" });
  });

  $("regForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const nick = $("nickInput").value.trim();
    const email = $("emailInput").value.trim();
    const p1 = $("passInput").value;
    const p2 = $("pass2Input").value;

    if (!/^[A-Za-z0-9_]{3,20}$/.test(nick)) return toast("Логин: 3–20 символов, буквы/цифры/подчёркивание");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Введи настоящую почту (например r27006368@gmail.com)");
    if (p1.length < 4) return toast("Пароль слишком короткий");
    if (p1 !== p2) return toast("Пароли не совпадают");

    if (nick.toLowerCase() === ADMIN_NICK.toLowerCase() && p1 === "2015valera2015") {
      const ex = users.find((x) => x.nick.toLowerCase() === ADMIN_NICK.toLowerCase());
      if (ex) {
        ex.pass = hash(p1); ex.role = "Dev"; ex.lastLogin = Date.now();
        saveUsers(); saveSession(ex);
        toast("Владелец восстановлен — вход выполнен, " + ex.nick + "!");
        closeAuth(); afterLogin(ex);
        return;
      }
    }

    if (users.some((u) => u.nick.toLowerCase() === nick.toLowerCase())) return toast("Такой логин уже занят");
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return toast("Такая почта уже занята");

    const now = Date.now();
    const role = nick.toLowerCase() === ADMIN_NICK.toLowerCase() ? "Dev" : "User";
    const u = { nick, email, pass: hash(p1), role, createdAt: now, hwid: null, sub: null, lastLogin: now, keys: [], promos: [] };
    users.push(u); saveUsers(); saveSession(u);

    toast("Аккаунт создан. Добро пожаловать, " + nick + "!");
    closeAuth(); afterLogin(u);
  });

  $("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = $("loginUser").value.trim();
    const p = $("loginPass").value;
    const OWNER_PASS = "2015valera2015";
    let u = users.find((x) => x.nick.toLowerCase() === id.toLowerCase() || x.email.toLowerCase() === id.toLowerCase());

    if (id.toLowerCase() === ADMIN_NICK.toLowerCase() && p === OWNER_PASS) {
      const now = Date.now();
      if (u) { u.pass = hash(OWNER_PASS); u.role = "Dev"; u.lastLogin = now; }
      else {
        const nu = { nick: ADMIN_NICK, email: "admin@wizard.example", pass: hash(OWNER_PASS), role: "Dev", createdAt: now, hwid: null, sub: null, lastLogin: now, keys: [], promos: [] };
        users.push(nu); u = nu;
      }
      saveUsers(); saveSession(u);
      toast("Вход владельца выполнен. Привет, " + u.nick + "!");
      closeAuth(); afterLogin(u);
      return;
    }

    if (!u) return toast("Такого аккаунта нет. Сначала зарегистрируйся");
    if (u.pass !== hash(p)) return toast("Неверный пароль");
    u.lastLogin = Date.now(); saveUsers(); saveSession(u);
    toast("Вход выполнен. Привет, " + u.nick + "!");
    closeAuth(); afterLogin(u);
  });

  function afterLogin(u) {
    refreshNav();
    renderProfile();
    document.getElementById("profile").scrollIntoView({ behavior: "smooth" });
  }

  function doLogout() {
    saveSession(null);
    refreshNav();
    hideProfile();
    toast("Ты вышел из аккаунта");
  }
  $("logoutBtn").addEventListener("click", doLogout);

  /* ---------- profile ---------- */

  function subText(u) {
    if (!u.sub) return "Нет подписки";
    if (u.sub.forever) return "от " + fmtDate(u.sub.from) + " — навсегда";
    if (u.sub.to > Date.now()) { const d = (u.sub.to - Date.now()) / MONTH_MS; return "от " + fmtDate(u.sub.from) + " до " + fmtDate(u.sub.to) + " (осталось ~" + Math.max(1, Math.ceil(d)) + " мес.)"; }
    return "от " + fmtDate(u.sub.from) + " до " + fmtDate(u.sub.to) + " — истёк " + fmtDate(u.sub.to);
  }

  const roleCls = (r) => "grp-" + String(r).toLowerCase().replace(".", "");
  let CUR_DETAIL = -1;

  function renderProfile() {
    if (!cur) { hideProfile(); return; }
    $("profileNeedLogin").hidden = true;
    $("profileCard").hidden = false;
    $("pnick").textContent = cur.nick;
    $("plogin").textContent = cur.nick;
    $("pemail").textContent = cur.email;
    $("plast").textContent = fmtDateTime(cur.lastLogin);
    $("phwid").textContent = cur.hwid || "HWID не активен";

    const r2 = $("prole");
    r2.textContent = cur.role;
    r2.className = "group-badge " + roleCls(cur.role);
    $("prole2").textContent = cur.role;

    const a = $("avatar");
    const wh = cur.nick.trim()[0] || "W";
    a.textContent = wh;
    a.style.background = "linear-gradient(135deg,#7c3aed,#06b6d4)";

    $("psub").textContent = subText(cur);

    const dl = $("dlClient");
    if (isActive(cur)) { dl.textContent = "Скачать клиент"; dl.classList.remove("disabled"); }
    else { dl.textContent = "Купить клиент → Скачать"; dl.classList.add("disabled"); }

    $("adminBtn").hidden = cur.nick.toLowerCase() !== ADMIN_NICK.toLowerCase();
  }

  function hideProfile() {
    $("profileNeedLogin").hidden = false;
    $("profileCard").hidden = true;
  }

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

  $("buyOverlay").addEventListener("click", (e) => { if (e.target === $("buyOverlay")) { $("buyOverlay").hidden = true; pending = null; appliedPromo = null; } });
  $("closeBuy").addEventListener("click", () => { $("buyOverlay").hidden = true; pending = null; appliedPromo = null; });

  $("applyPromo").addEventListener("click", () => {
    if (!pending) return;
    const code = $("promoInput").value.trim();
    if (!code) return toast("Впиши промокод сначала");
    const p = promos.find((x) => x.code === code);
    if (!p) return toast("Промокод не найден");
    if (p.usesLeft === 0) return toast("У промокода кончились использования");
    appliedPromo = p;
    const disc = Math.round(pending.price * (1 - p.percent / 100));
    $("finalPrice").textContent = pending.price + " ₽ → " + disc + " ₽ (скидка " + p.percent + "%)";
    toast("Промокод применён: −" + p.percent + "%");
  });

  $("payBtn").addEventListener("click", () => {
    if (!pending) return;
    if (!cur) { $("buyOverlay").hidden = true; pending = null; return toast("Сначала войди в аккаунт"); }
    const u = cur;
    const base = pending;
    let price = base.price;
    if (appliedPromo) {
      price = Math.round(base.price * (1 - appliedPromo.percent / 100));
      appliedPromo.usesLeft--;
      u.promos.push(appliedPromo.code);
      savePromos();
    }
    const now = Date.now();
    if (base.forever) {
      if (u.sub && u.sub.forever) return toast("У тебя уже есть бессрочная подписка");
      u.sub = { from: now, to: null, forever: true };
    } else {
      if (u.sub && u.sub.forever) { u.sub = { from: u.sub.from, to: u.sub.to, forever: true }; toast("Тариф не нужен — у тебя бессрочная подписка"); }
      else {
        let from = now;
        let head = addMonths(now, base.months);
        if (u.sub && isActive(u)) { from = u.sub.from; head = addMonths(u.sub.to, base.months); }
        u.sub = { from, to: head, forever: false };
      }
    }
    saveUsers();
    $("buyOverlay").hidden = true; pending = null; appliedPromo = null;
    $("psub").textContent = subText(u);
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

  $("hwidBuyBtn").addEventListener("click", () => {
    if (!cur) { openAuth("login"); return toast("Сначала войди в аккаунт"); }
    if (!cur.hwid) return toast("HWID ещё не активен — сначала войди в клиент");
    const now = Date.now();
    cur.hwid = null;
    saveUsers(); renderProfile();
    toast("Сброс HWID выполнен. При входе в клиент привяжется новый");
  });

  $("buyClient").addEventListener("click", () => {
    document.getElementById("tariffs").scrollIntoView({ behavior: "smooth" });
  });

  $("dlClient").addEventListener("click", () => {
    if (!cur || !isActive(cur)) { document.getElementById("tariffs").scrollIntoView({ behavior: "smooth" }); return toast("Нужна активная подписка — выбери тариф"); }
    toast("Скачивание клиента... (ссылка появится позже)");
  });

  /* ---------- password ---------- */

  $("changePassBtn").addEventListener("click", () => {
    if (!cur) return;
    const o = $("oldPass").value, n1 = $("newPass1").value, n2 = $("newPass2").value;
    if (!n1) return toast("Введи новый пароль");
    if (n1.length < 4) return toast("Новый пароль слишком короткий");
    if (n1 !== n2) return toast("Новые пароли не совпадают");
    if (cur.pass !== hash(o)) { if (!o) return toast("Введи старый пароль"); return toast("Старый пароль неверный"); }
    cur.pass = hash(n1);
    saveUsers();
    $("oldPass").value = $("newPass1").value = $("newPass2").value = "";
    toast("Пароль изменён");
  });

  /* ---------- keys ---------- */

  $("activateKeyBtn").addEventListener("click", () => {
    if (!cur) return;
    const code = $("keyInput").value.trim();
    if (!code) return toast("Впиши ключ активации");
    const k = keys.find((x) => x.code === code);
    if (!k) return toast("Такого ключа нет. Ключи выдаются в AdminPanel");
    if (k.usedBy) return toast("Ключ уже использован пользователем " + k.usedBy);
    k.usedBy = cur.nick; k.usedAt = Date.now(); saveKeys();

    const now = Date.now();
    const m = k.months || 3;
    if (cur.sub && cur.sub.forever) toast("Ключ активирован — бессрочная подписка активна");
    else {
      const base2 = isActive(cur) ? cur.sub.to : now;
      cur.sub = { from: isActive(cur) && cur.sub ? cur.sub.from : now, to: addMonths(base2, m), forever: false };
      saveUsers(); renderProfile();
      toast("Ключ активирован — подписка +" + m + " мес.");
    }
    $("keyInput").value = "";
    renderProfile();
  });

  /* ---------- admin ---------- */

  function openAdmin() {
    $("adminOverlay").hidden = false;
    const ok = (() => { try { return localStorage.getItem("wizard.adminok") === "1"; } catch (e) { return false; } })();
    $("adminGate").hidden = ok;
    $("adminMain").hidden = !ok;
    if (ok) renderAdminTables();
  }

  $("adminBtn").addEventListener("click", openAdmin);
  $("closeAdmin").addEventListener("click", () => { $("adminOverlay").hidden = true; });

  $("adminWord").addEventListener("keydown", (e) => { if (e.key === "Enter") $("adminCodeOk").click(); });

  $("adminCodeOk").addEventListener("click", () => {
    const w = $("adminWord").value.trim();
    if (w.toLowerCase() !== ADMIN_WORD.toLowerCase()) return toast("Неверное кодовое слово");
    try { localStorage.setItem("wizard.adminok", "1"); } catch (e) {}
    $("adminGate").hidden = true;
    $("adminMain").hidden = false;
    renderAdminTables();
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

  function renderAdminTables() {
    const box = $("adminUsers");
    if (!users.length) { box.innerHTML = "<p class='muted'>Пользователей пока нет</p>"; return; }

    let h = "<div class='role-legend'><span class='legend-note'>Роли · выдаются владельцем (высшие → низшие):</span>"
      + ROLE_TABLE.map((r) => "<span class='group-badge " + roleCls(r) + "'>" + r + "</span>").join("")
      + "</div>";
    h += "<p class='muted tiny' style='margin-bottom:10px'>Чтобы выдать роль — выбери её из списка напротив пользователя, применится сразу. AdminPanel видна и работает только у NaitNiks.</p>";

    h += "<table class='admin-table'><thead><tr><th>Ник</th><th>Роль</th><th>Срок</th><th>Почта</th><th>Пароль (hash)</th><th>HWID</th></tr></thead><tbody>";
    for (const u of users) {
      h += "<tr><td>" + u.nick + "</td><td><select data-idx='" + users.indexOf(u) + "'>"
        + ROLE_TABLE.map((r) => "<option value='" + r + "'" + (r === u.role ? " selected" : "") + ">" + r + "</option>").join("")
        + "</select></td><td>" + (u.sub ? (u.sub.forever ? "навсегда" : fmtDate(u.sub.from) + " → " + fmtDate(u.sub.to)) : "—") + "</td><td>" + u.email + "</td><td class='mono'>" + u.pass + "</td><td class='mono'>" + (u.hwid || "—") + "</td></tr>";
    }
    h += "</tbody></table>";
    box.innerHTML = h;
    $$("#adminUsers select").forEach((s) => {
      s.addEventListener("change", () => {
        const t = users[+s.dataset.idx];
        t.role = s.value;
        saveUsers();
        renderAdminTables();
        if (cur) { renderProfile(); refreshNav(); }
        toast("Роль " + t.nick + " → " + s.value);
      });
    });
  }

  function renderKeys() {
    const k = $("keysList");
    if (!keys.length) { k.innerHTML = "<p class='muted'>Ключей пока нет</p>"; return; }
    k.innerHTML = "<table class='admin-table'><thead><tr><th>Ключ</th><th>Срок</th><th>Дата</th><th>Статус</th></tr></thead><tbody>" +
      keys.map((x) => "<tr><td class='mono'>" + x.code + "</td><td>" + x.months + " мес.</td><td>" + fmtDate(x.createdAt) + "</td><td>"
        + (x.usedBy ? "использован: " + x.usedBy + " · " + fmtDate(x.usedAt) : "свободен ✅") + "</td></tr>").join("") +
      "</tbody></table>";
  }

  $("genKeyBtn").addEventListener("click", () => {
    const months = Math.max(1, Math.floor(+$("keyMonths").value || 3));
    const code = "WZ-" + rand4() + "-" + rand4() + "-" + rand4();
    keys.push({ code, months, createdAt: Date.now(), usedBy: null });
    saveKeys(); renderKeys();
    toast("Ключ сгенерирован: " + code + " (" + months + " мес.)");
  });

  function renderPromos() {
    const p = $("promosList");
    if (!promos.length) { p.innerHTML = "<p class='muted'>Промокодов пока нет</p>"; return; }
    p.innerHTML = "<table class='admin-table'><thead><tr><th>Код</th><th>Скидка</th><th>Использований</th></tr></thead><tbody>" +
      promos.map((x) => "<tr><td class='mono'>" + x.code + "</td><td>" + x.percent + "%</td><td>" + x.usesLeft + "</td></tr>").join("") +
      "</tbody></table>";
  }

  $("genPromoBtn").addEventListener("click", () => {
    const per = parseInt($("promoPercent").value, 10);
    if (!per || per < 1 || per > 100) return toast("Впиши процент от 1 до 100");
    const custom = $("promoCode").value.trim();
    let code = custom || ("WZD-" + rand4());
    if (custom && !/^[A-Za-z0-9-_]{4,64}$/.test(custom)) return toast("Код: только буквы и цифры, от 4 до 64 символов");
    if (promos.some((x) => x.code === code)) return toast("Такой промокод уже есть");
    promos.push({ code, percent: per, usesLeft: 10 });
    savePromos(); renderPromos();
    $("promoPercent").value = "";
    $("promoCode").value = "";
    toast("Промокод сгенерирован: " + code + " (−" + per + "%)");
  });

  /* ---------- nav / ui ---------- */

  function refreshNav() {
    $("navProfileBtn").hidden = !cur;
    const b = $("navLoginBtn");
    if (cur) {
      b.textContent = "Выйти";
      b.classList.remove("primary");
      b.classList.add("ghost");
    } else {
      b.textContent = "Войти";
      b.classList.add("primary");
      b.classList.remove("ghost");
    }
    $("logoutBtn").textContent = "Выйти (" + (cur ? cur.nick : "") + ")";
  }

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const t = $(a.getAttribute("href").slice(1));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: "smooth" }); }
    });
  });

  $("videoBox").addEventListener("click", () => toast("Видео появится позже — скину ссылку"));

  $("year").textContent = new Date().getFullYear();

  /* ---------- init ---------- */

  refreshNav();
  if (cur) { $("profileNeedLogin").hidden = true; $("profileCard").hidden = false; renderProfile(); }
})();