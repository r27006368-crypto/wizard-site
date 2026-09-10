(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_USERS = "wizard.users";
  const LS_SESSION = "wizard.session";
  const LS_HWID = "wizard.hwid";

  const toastEl = $("toast");
  const burst = $("burst");
  const ctx = burst.getContext("2d");

  /* ---------- moving background ---------- */

  const bgCv = $("bg");
  const bctx = bgCv.getContext("2d");
  let bgW = 0, bgH = 0;
  const BG_COLORS = ["rgba(167,139,250,", "rgba(103,232,249,", "rgba(251,191,36,", "rgba(244,114,182,", "rgba(255,255,255,"];

  function sizeBg() {
    bgW = bgCv.width = window.innerWidth;
    bgH = bgCv.height = window.innerHeight;
  }
  sizeBg();

  const dp = () => Math.max(18, Math.round((bgW * bgH) / 16000));
  let dust = [];
  function spawnDust() {
    dust = [];
    const n = dp();
    for (let i = 0; i < n; i++) {
      dust.push({
        x: Math.random() * bgW, y: Math.random() * bgH,
        r: 0.6 + Math.random() * 2.2,
        vy: 0.15 + Math.random() * 0.55,
        vx: (Math.random() - 0.5) * 0.22,
        a: 0.1 + Math.random() * 0.5,
        ph: Math.random() * Math.PI * 2,
        c: BG_COLORS[(Math.random() * BG_COLORS.length) | 0]
      });
    }
  }
  spawnDust();

  function bgTick() {
    bctx.clearRect(0, 0, bgW, bgH);
    const t = performance.now() / 1000;
    for (const p of dust) {
      p.y -= p.vy;
      p.x += p.vx + Math.sin(t + p.ph) * 0.12;
      if (p.y < -8) { p.y = bgH + 8; p.x = Math.random() * bgW; }
      if (p.x < -8) p.x = bgW + 8;
      if (p.x > bgW + 8) p.x = -8;
      const tw = 0.6 + 0.4 * Math.sin(t * 1.6 + p.ph);
      bctx.beginPath();
      bctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      bctx.fillStyle = p.c + (p.a * tw).toFixed(3) + ")";
      bctx.fill();
    }
    requestAnimationFrame(bgTick);
  }
  requestAnimationFrame(bgTick);

  window.addEventListener("resize", () => { sizeBg(); spawnDust(); });

  /* ---------- helpers ---------- */

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const hash = (s) => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return ("00000000" + h.toString(16)).slice(-8).toUpperCase();
  };
  const getUsers = () => {
    try { return JSON.parse(localStorage.getItem(LS_USERS)) || []; } catch { return []; }
  };
  const saveUsers = (u) => localStorage.setItem(LS_USERS, JSON.stringify(u));
  const currentEmail = () => localStorage.getItem(LS_SESSION);
  const currentUser = () => getUsers().find((u) => u.email === currentEmail()) || null;
  const deviceHwid = () => {
    let hw = localStorage.getItem(LS_HWID);
    if (!hw) {
      hw = hash(navigator.userAgent + navigator.language + uid());
      localStorage.setItem(LS_HWID, hw);
    }
    return hw;
  };
  const fmtDate = (ts) => new Date(ts).toLocaleDateString("ru-RU");
  const fmtShort = (s) => (s && s.length > 10 ? s.slice(0, 6) + "…" + s.slice(-4) : s || "—");

  const ROLE_TABLE = {
    "175 навсегда-мес": { group: "Базовый", name: "Базовый · 175 ₽/мес" },
    "250 на год":       { group: "VIP",     name: "VIP · 250 ₽/год" },
    "450 навсегда":     { group: "Ultimate",name: "Ultimate · 450 ₽ навсегда" }
  };
  const GROUP_CLS = {
    "User": "grp-user",
    "Базовый": "grp-basic",
    "VIP": "grp-vip",
    "Ultimate": "grp-ult"
  };

  /* ---------- toast & burst ---------- */

  let toastTimer = null;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.className = "toast " + (kind || "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3200);
  }

  function burstFx(x, y) {
    burst.width = window.innerWidth;
    burst.height = window.innerHeight;
    const N = 120;
    const parts = [];
    const palette = ["#8b5cf6", "#67e8f9", "#fbbf24", "#f472b6", "#ffffff"];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 7;
      parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3,
        g: 0.16 + Math.random() * 0.12, life: 1,
        size: 2 + Math.random() * 4,
        col: palette[(Math.random() * palette.length) | 0]
      });
    }
    let raf;
    const step = () => {
      ctx.clearRect(0, 0, burst.width, burst.height);
      let alive = false;
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life -= 0.014; p.vx *= 0.985;
        if (p.life <= 0) continue;
        alive = true;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (alive) raf = requestAnimationFrame(step);
      else { cancelAnimationFrame(raf); ctx.clearRect(0, 0, burst.width, burst.height); }
    };
    requestAnimationFrame(step);
  }

  /* ---------- auth ui ---------- */

  const authOverlay = $("authOverlay");
  const regForm = $("regForm");
  const loginForm = $("loginForm");
  const profileBox = $("profileBox");
  const nickInput = $("nickInput");
  const emailInput = $("emailInput");
  const passInput = $("passInput");
  const pass2Input = $("pass2Input");
  const loginUser = $("loginUser");
  const loginPass = $("loginPass");
  let activeMode = "reg";

  function setMode(mode) {
    activeMode = mode;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));
    regForm.hidden = mode !== "reg";
    loginForm.hidden = mode !== "login";
  }

  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => setMode(t.dataset.mode)));

  function showAuth() {
    refreshAuthUI();
    authOverlay.hidden = false;
    setTimeout(() => (activeMode === "reg" ? nickInput : loginUser).focus(), 60);
  }

  function refreshAuthUI() {
    const asUser = !!currentUser();
    const at = $("authTabs");
    regForm.hidden = asUser || activeMode !== "reg";
    loginForm.hidden = asUser || activeMode !== "login";
    profileBox.hidden = !asUser;
    at.hidden = asUser;
    $("navLoginBtn").hidden = asUser;
    $("navProfileBtn").hidden = !asUser;
    if (asUser) renderProfile();
  }

  const groupText = (g) => g || "User";

  function renderProfile() {
    const u = currentUser();
    if (!u) return;
    const nick = u.nick;
    $("avatar").textContent = nick.charAt(0).toUpperCase();
    $("profileNick").textContent = nick;
    $("profileEmail").textContent = u.email;
    const grp = groupText(u.group);
    const badge = $("profileRole");
    badge.textContent = grp;
    badge.className = "group-badge " + (GROUP_CLS[grp] || "grp-user");
    $("profileNick2").textContent = nick;
    $("profileGroup").textContent = grp;
    $("profileGuestEmail").textContent = u.email;
    $("profileHwid").textContent = fmtShort(u.hwid || deviceHwid());
  }

  /* ---------- registration ---------- */

  regForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const nick = nickInput.value.trim();
    const email = emailInput.value.trim().toLowerCase();
    const pass = passInput.value;
    const pass2 = pass2Input.value;

    if (!nick) return toast("Впишите ник ниже", "bad");
    if (!/^[\p{L}\p{N}_ .\-]{2,20}$/u.test(nick)) return toast("Ник: от 2 до 20 символов", "bad");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return toast("Почта некорректная", "bad");
    if (pass.length < 6) return toast("Пароль: минимум 6 символов", "bad");
    if (pass !== pass2) return toast("Пароли не совпадают", "bad");

    const users = getUsers();
    if (users.some((u) => u.email === email)) return toast("Такая почта уже зарегистрирована", "bad");
    if (users.some((u) => u.nick.toLowerCase() === nick.toLowerCase())) return toast("Такой ник уже занят", "bad");

    const user = {
      nick, email,
      pass: hash(pass),
      group: "User",
      sub: null,
      hwid: null,
      hwidBoughtAt: null,
      createdAt: Date.now()
    };
    users.push(user);
    saveUsers(users);
    localStorage.setItem(LS_SESSION, email);
    authOverlay.hidden = true;
    refreshAuthUI();
    celebrate("Добро пожаловать, " + nick + "! Группа: User ✨");
  });

  /* ---------- login (ник или почта + пароль) ---------- */

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = loginUser.value.trim().toLowerCase();
    const pass = loginPass.value;
    if (!id) return toast("Введи ник или почту", "bad");
    const byEmail = (u) => u.email === id;
    const byNick = (u) => u.nick.toLowerCase() === id;
    const user = getUsers().find((u) => byEmail(u) || byNick(u));
    if (!user || user.pass !== hash(pass)) {
      return toast("Неверный логин или пароль", "bad");
    }
    localStorage.setItem(LS_SESSION, user.email);
    authOverlay.hidden = true;
    loginUser.value = "";
    loginPass.value = "";
    refreshAuthUI();
    toast("С возвращением, " + user.nick + "!", "good");
  });

  /* ---------- logout ---------- */

  $("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem(LS_SESSION);
    authOverlay.hidden = true;
    refreshAuthUI();
    toast("Ты вышел из аккаунта");
  });

  /* ---------- buy ---------- */

  document.querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const what = ROLE_TABLE[btn.dataset.buy];
      if (!currentUser()) {
        pendingBuy = { key: btn.dataset.buy, price: btn.dataset.price, group: what && what.group };
        toast("Нужен аккаунт — зарегистрируйся или войди", "bad");
        showAuth();
        return;
      }
      $("buyTitle").textContent = (what ? what.group : btn.dataset.buy) + " — " + btn.dataset.price + " ₽";
      $("buyDesc").textContent = btn.dataset.buy;
      pendingBuy = { key: btn.dataset.buy, price: btn.dataset.price, group: what && what.group };
      $("buyOverlay").hidden = false;
    });
  });

  let pendingBuy = null;

  $("payBtn").addEventListener("click", () => {
    if (!pendingBuy) return;
    const u = currentUser();
    if (!u) { $("buyOverlay").hidden = true; showAuth(); return; }
    const forever = pendingBuy.key === "450 навсегда";
    const months = { "175 навсегда-мес": 1, "250 на год": 12 }[pendingBuy.key];
    u.sub = {
      key: pendingBuy.key,
      group: pendingBuy.group || "User",
      endsAt: forever ? null : Date.now() + months * 30 * 24 * 3600 * 1000,
      forever
    };
    u.group = u.sub.group;
    if (!u.hwid) u.hwid = deviceHwid();
    const users = getUsers();
    const idx = users.findIndex((x) => x.email === u.email);
    if (idx >= 0) users[idx] = u;
    saveUsers(users);
    $("buyOverlay").hidden = true;
    pendingBuy = null;
    refreshAuthUI();
    celebrate("Оплата зачислена. Твоя группа: " + u.group + " 🎉");
  });

  /* ---------- hwid reset (199 ₽) ---------- */

  $("hwidBtn").addEventListener("click", () => {
    const u = currentUser();
    if (!u) { toast("Войди в аккаунт для сброса HWID", "bad"); return; }
    if (u.hwidBoughtAt) {
      toast("Сброс HWID уже куплен — повторный недоступен", "bad");
      return;
    }
    $("buyTitle").textContent = "Сброс HWID — 199 ₽";
    $("buyDesc").textContent = "Сбросит привязку устройства. Сможешь зайти с нового ПК.";
    pendingBuy = { hwid: true, price: "199" };
    $("buyOverlay").hidden = false;
  });

  /* ---------- overlays ---------- */

  function closeAuth() {
    authOverlay.hidden = true;
    nickInput.value = ""; emailInput.value = ""; passInput.value = ""; pass2Input.value = "";
  }

  function refreshNav() {
    const asUser = !!currentUser();
    $("navLoginBtn").hidden = asUser;
    $("navProfileBtn").hidden = !asUser;
  }

  $("closeAuth").addEventListener("click", closeAuth);
  $("closeBuy").addEventListener("click", () => { $("buyOverlay").hidden = true; });
  $("navLoginBtn").addEventListener("click", () => { setMode("login"); showAuth(); });
  $("navProfileBtn").addEventListener("click", showAuth);
  $("heroRegBtn").addEventListener("click", () => { setMode("reg"); showAuth(); });

  for (const ov of [authOverlay, $("buyOverlay")]) {
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.hidden = true; });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      authOverlay.hidden = true;
      $("buyOverlay").hidden = true;
    }
  });

  /* ---------- видеообзор (заглушка) ---------- */

  $("playBtn").addEventListener("click", () => {
    toast("Видео скоро появится — как только дашь ссылку, вставлю ролик сюда ✨", "good");
  });

  function celebrate(msg) {
    burstFx(window.innerWidth / 2, window.innerHeight / 2);
    toast(msg, "good");
  }

  /* ---------- init ---------- */

  $("year").textContent = new Date().getFullYear();
  refreshNav();
})();