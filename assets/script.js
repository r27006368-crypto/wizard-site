(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const LS_USERS = "wizard.users";
  const LS_SESSION = "wizard.session";
  const LS_HWID = "wizard.hwid";

  const toastEl = $("toast");
  const burst = $("burst");
  const ctx = burst.getContext("2d");

  let pendingGoogle = null;
  let pendingBuy = null;

  /* ---------- helpers ---------- */

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const hash = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
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
    "175 навсегда-мес": { role: "Базовый", name: "Базовый · 175 ₽/мес" },
    "250 на год":       { role: "VIP",     name: "VIP · 250 ₽/год" },
    "450 навсегда":     { role: "Ultimate",name: "Ultimate · 450 ₽ навсегда" }
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

  function burstFx(x, y, colors) {
    const R = Math.min(window.innerWidth, window.innerHeight);
    burst.width = window.innerWidth;
    burst.height = window.innerHeight;
    const N = 120;
    const parts = [];
    const palette = colors || ["#8b5cf6", "#67e8f9", "#fbbf24", "#f472b6", "#ffffff"];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 7;
      parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 3,
        g: 0.16 + Math.random() * 0.12,
        life: 1,
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
    return R * 0.5;
  }

  /* ---------- ui state ---------- */

  const authOverlay = $("authOverlay");
  const authTitle = $("authTitle");
  const googleForm = $("googleForm");
  const profileBox = $("profileBox");
  const backBtn = $("backBtn");
  const regSubmit = $("regSubmit");
  const nickInput = $("nickInput");

  function showAuth() {
    refreshAuthUI();
    authOverlay.hidden = false;
    authTitle.textContent = currentUser() ? "Профиль" : "Вход в аккаунт";
    setTimeout(() => nickInput.focus(), 60);
  }

  function refreshAuthUI() {
    const asUser = !!currentUser();
    googleForm.hidden = asUser;
    profileBox.hidden = !asUser;
    backBtn.hidden = !pendingGoogle;
    $("navLoginBtn").hidden = asUser;
    $("navProfileBtn").hidden = !asUser;
    if (asUser) renderProfile();
  }

  function renderProfile() {
    const u = currentUser();
    if (!u) return;
    $("avatar").textContent = u.nick.charAt(0);
    $("profileNick").textContent = u.nick;
    $("profileEmail").textContent = u.email;
    const what = ROLE_TABLE[u.sub && u.sub.key];
    $("profileRole").textContent = what ? what.role : "Игрок";
    $("profileSub").textContent = u.sub
      ? (what ? what.name : "Подписка") + (u.sub.forever ? " · навсегда" : " · до " + fmtDate(u.sub.endsAt))
      : "Нет подписки";
    $("profileHwid").textContent = fmtShort(u.hwid || deviceHwid());
  }

  /* ---------- google sign-in (демо) ---------- */

  const googleBtn = $("googleBtn");
  googleBtn.addEventListener("click", () => {
    const name = ["Aлекс", "Kira", "Max", "Artem", "Sasha", "Nik", "Dan", "Ilya"][
      (Math.random() * 8) | 0
    ];
    const email = name.toLowerCase() + randNum() + "@gmail.com";
    pendingGoogle = { email, defaultNick: name };
    authTitle.textContent = "Продолжить как " + email;
    nickInput.placeholder = "Ник " + name + " в Minecraft";
    nickInput.value = "";
    backBtn.hidden = false;
    regSubmit.textContent = "Зарегистрироваться";
    toast("Аккаунт Google распознан ✦", "good");
  });

  function randNum() {
    return Math.random().toString(10).slice(2, 7);
  }

  backBtn.addEventListener("click", () => {
    pendingGoogle = null;
    authTitle.textContent = "Вход в аккаунт";
    backBtn.hidden = true;
    regSubmit.textContent = "Зарегистрироваться";
  });

  googleForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!pendingGoogle) {
      toast("Сначала войди через Google", "bad");
      return;
    }
    const nick = nickInput.value.trim();
    if (!/^[A-Za-z0-9_]{2,16}$/.test(nick)) {
      toast("Ник: 2–16 символов (буквы, цифры, _)", "bad");
      return;
    }
    const users = getUsers();
    const existing = users.find((u) => u.email === pendingGoogle.email);
    if (existing) {
      localStorage.setItem(LS_SESSION, existing.email);
      pendingGoogle = null;
      closeAuth();
      refreshNav();
      toast("С возвращением, " + existing.nick + "!", "good");
      return;
    }
    const user = {
      email: pendingGoogle.email,
      nick,
      createdAt: Date.now(),
      sub: null,
      hwid: null,
      hwidBoughtAt: null,
      hwidUses: 0
    };
    users.push(user);
    saveUsers(users);
    localStorage.setItem(LS_SESSION, user.email);
    pendingGoogle = null;
    closeAuth();
    refreshNav();
    celebrate("Добро пожаловать, " + nick + "! Волшебство начинается ✨");
  });

  /* ---------- celebrate (после регистрации) ---------- */

  function celebrate(msg) {
    burstFx(window.innerWidth / 2, window.innerHeight / 2);
    toast(msg, "good");
  }

  /* ---------- logout ---------- */

  $("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem(LS_SESSION);
    pendingGoogle = null;
    closeAuth();
    refreshNav();
    toast("Ты вышел из аккаунта");
  });

  /* ---------- buy ---------- */

  document.querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const what = ROLE_TABLE[btn.dataset.buy];
      if (!currentUser()) {
        pendingBuy = { key: btn.dataset.buy, price: btn.dataset.price, role: what && what.role };
        toast("Нужен аккаунт — войди через Google", "bad");
        showAuth();
        return;
      }
      $("buyTitle").textContent = (what ? what.role : btn.dataset.buy) + " — " + btn.dataset.price + " ₽";
      $("buyDesc").textContent = btn.dataset.buy;
      pendingBuy = { key: btn.dataset.buy, price: btn.dataset.price, role: what && what.role };
      $("buyOverlay").hidden = false;
    });
  });

  $("payBtn").addEventListener("click", () => {
    if (!pendingBuy) return;
    const u = currentUser();
    if (!u) { $("buyOverlay").hidden = true; showAuth(); return; }
    const forever = pendingBuy.key === "450 навсегда";
    const months = { "175 навсегда-мес": 1, "250 на год": 12 }[pendingBuy.key];
    u.sub = {
      key: pendingBuy.key,
      role: pendingBuy.role,
      endsAt: forever ? null : Date.now() + months * 30 * 24 * 3600 * 1000,
      forever
    };
    if (!u.hwid) u.hwid = deviceHwid();
    const users = getUsers();
    const idx = users.findIndex((x) => x.email === u.email);
    if (idx >= 0) users[idx] = u;
    saveUsers(users);
    $("buyOverlay").hidden = true;
    pendingBuy = null;
    refreshAuthUI();
    celebrate("Оплата зачислена: " + (u.sub.role || "Подписка") + " 🎉");
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

  /* ---------- overlay helpers ---------- */

  function closeAuth() {
    authOverlay.hidden = true;
    nickInput.value = "";
    pendingGoogle = null;
  }

  function refreshNav() {
    const asUser = !!currentUser();
    $("navLoginBtn").hidden = asUser;
    $("navProfileBtn").hidden = !asUser;
  }

  $("closeAuth").addEventListener("click", closeAuth);
  $("closeBuy").addEventListener("click", () => { $("buyOverlay").hidden = true; });
  $("navLoginBtn").addEventListener("click", showAuth);
  $("navProfileBtn").addEventListener("click", showAuth);

  for (const ov of [authOverlay, $("buyOverlay")]) {
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.hidden = true; });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      authOverlay.hidden = true;
      $("buyOverlay").hidden = true;
    }
  });

  /* ---------- download (демо) ---------- */

  $("downloadBtn").addEventListener("click", (e) => {
    e.preventDefault();
    if (!currentUser()) { showAuth(); toast("Скачивание доступно после входа", "bad"); return; }
    toast("Начинается скачивание Wizard Launcher…", "good");
  });

  /* ---------- init ---------- */

  $("year").textContent = new Date().getFullYear();
  refreshNav();
})();