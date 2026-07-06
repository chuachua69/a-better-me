/* ===== A Better Me — Identity Architecture ===== */
const KEY = "aBetterMe.v2";
const DAY = 864e5;

/* Backend sync is optional. Point the public frontend at the droplet backend by
   visiting once with ?api=https://<tunnel-host> — it's remembered in localStorage.
   With no api configured on GitHub Pages, the app runs purely on localStorage. */
const API_BASE = (() => {
  const q = new URLSearchParams(location.search).get("api");
  if (q !== null) localStorage.setItem("aBetterMe.api", q.replace(/\/+$/, ""));
  return (localStorage.getItem("aBetterMe.api") || "").replace(/\/+$/, "");
})();
const SYNC = !!API_BASE || !location.hostname.endsWith("github.io");
const todayStr = () => new Date().toISOString().slice(0, 10);
const dayStr = (offset) => new Date(Date.now() - offset * DAY).toISOString().slice(0, 10);

/* ---------- habit generation from identity ----------
   Order matters: more specific archetypes first. Keywords are matched as
   substrings, so avoid short strings that collide (e.g. "art" hits "smart"). */
const HABIT_LIB = [
  { k: ["runner", "running", "marath", "jog", "sprint"], h: ["Run or brisk-walk for 25 minutes", "Do a 5-minute mobility warm-up", "Log the distance and how it felt"] },
  { k: ["athlet", "fitness", "gym", "muscle", "lifter", "lifting", "bodybuild", "strength train"], h: ["Train for 30 minutes", "Hit today's protein target", "Sleep 7+ hours"] },
  { k: ["yoga", "flexib", "mobility"], h: ["Flow through 15 minutes of yoga", "Hold three deep stretches", "Breathe slowly for 5 minutes"] },
  { k: ["writer", "writing", "author", "novelist", "blogger", "poet"], h: ["Write 300 words — no editing", "Read for 20 minutes", "Capture one idea in a notebook"] },
  { k: ["reader", "reading", "bookworm", "well-read"], h: ["Read 20 pages", "Note one takeaway", "Screens off 30 min before bed"] },
  { k: ["scholar", "student", "learner", "learning", "study", "curious", "polymath"], h: ["Study one topic for 40 minutes", "Review yesterday's notes", "Teach one thing you learned"] },
  { k: ["coder", "coding", "developer", "engineer", "programmer", "software", "hacker"], h: ["One 60-minute deep-work block", "Ship one small improvement", "Read code better than yours"] },
  { k: ["craft", "maker", "builder", "artisan", "woodwork"], h: ["One hour of focused making", "Finish one small piece", "Sharpen or tidy your tools"] },
  { k: ["artist", "painter", "painting", "drawing", "sketch", "illustrat", "designer", "creative"], h: ["Create for 45 minutes", "Share one piece of work", "Collect three references"] },
  { k: ["musician", "music", "guitar", "piano", "singer", "singing", "producer"], h: ["Practice for 30 minutes", "Learn one new phrase", "Play something purely for joy"] },
  { k: ["photograph", "filmmak", "videograph"], h: ["Make one deliberate frame", "Study one artist's work", "Edit one shot to finish"] },
  { k: ["founder", "entrepreneur", "startup", "hustler", "ceo", "indie"], h: ["Do one revenue-moving task", "Talk to one customer", "Ship something publicly"] },
  { k: ["invest", "trader", "wealth", "frugal", "saver", "finance", "budget"], h: ["Log today's spending", "Skip one impulse purchase", "Move a little to savings"] },
  { k: ["leader", "manager", "mentor", "coach", "captain"], h: ["Set the day's top 3", "Recognize someone's effort", "Have one real 1:1 conversation"] },
  { k: ["speaker", "orator", "persuad", "communicat", "storytell"], h: ["Rehearse aloud for 10 minutes", "Record and review yourself", "Learn one rhetorical device"] },
  { k: ["teacher", "educator", "tutor", "professor"], h: ["Explain one concept simply", "Prepare one clear example", "Ask a better question"] },
  { k: ["parent", "father", "mother", "dad", "mom", "family man", "family woman"], h: ["Phone away at dinner", "15 minutes of undistracted play", "Read or talk at bedtime"] },
  { k: ["partner", "spouse", "husband", "wife", "boyfriend", "girlfriend", "lover", "marriage"], h: ["Do one small kind gesture", "Ask about their day and listen", "Give 20 undivided minutes"] },
  { k: ["friend", "connector", "social"], h: ["Reach out to one person", "Listen without fixing", "Plan time with someone you miss"] },
  { k: ["mindful", "meditat", "present", "calm", "zen", "peace", "stillness"], h: ["Meditate for 10 minutes", "Take three deep breaths before reacting", "Single-task for one hour"] },
  { k: ["grateful", "gratitude", "optimist", "positive", "joyful"], h: ["Write down three gratitudes", "Thank someone sincerely", "Reframe one worry"] },
  { k: ["healthy", "wellness", "nutrition", "vitality", "clean eat"], h: ["Drink 2L of water", "Eat one whole-food meal", "Get 20 minutes of daylight"] },
  { k: ["cook", "chef", "kitchen", "baker", "baking"], h: ["Cook one real meal", "Prep tomorrow's food", "Try one new ingredient"] },
  { k: ["earlyrise", "early riser", "morning person", "disciplin", "consistent"], h: ["Wake at a set time — no snooze", "Plan the day before it starts", "Do the hard task first"] },
  { k: ["minimal", "declutter", "simplic", "tidy", "organiz"], h: ["Clear one surface", "Remove one thing you don't use", "One-in, one-out today"] },
  { k: ["stoic", "resilient", "grit", "disciplined", "warrior"], h: ["Do one hard thing on purpose", "Journal: what's in my control?", "Take a cold shower or hard walk"] },
  { k: ["spiritual", "faith", "prayer", "praying", "soul", "believer"], h: ["Sit in prayer or reflection 10 min", "Read something wise", "Act from your values once, visibly"] },
  { k: ["adventur", "explorer", "traveler", "outdoors", "hiker", "nature"], h: ["Spend 20 minutes outside", "Plan one micro-adventure", "Notice something new on a familiar route"] },
  { k: ["gardener", "gardening", "plant", "grower", "farmer"], h: ["Tend the garden for 15 minutes", "Water and observe closely", "Learn one plant or technique"] },
  { k: ["giver", "generous", "volunteer", "service", "charit", "kind"], h: ["Do one act of service", "Give without expecting return", "Check on someone quietly struggling"] },
  { k: ["sober", "recovery", "clean living"], h: ["Reach out to your support", "Replace the urge with a walk", "Note one reason you're proud"] },
  { k: ["sleep", "rested", "recover"], h: ["Set a fixed bedtime", "Screens off 30 min before bed", "Do a short wind-down ritual"] },
  { k: ["focused", "productiv", "deep work", "maker of things"], h: ["Protect one 90-minute focus block", "Choose today's single most important task", "Take a real break away from screens"] },
];

function genHabits(identity) {
  const s = (identity || "").toLowerCase();
  const out = [];
  for (const e of HABIT_LIB) if (e.k.some((k) => s.includes(k))) out.push(...e.h);
  const uniq = [...new Set(out)];
  if (uniq.length) return uniq.slice(0, 3);
  // graceful, still identity-anchored fallback for identities we don't recognise
  return [
    `Spend 20 minutes on what ${identity} cares about`,
    `Do one thing today only ${identity} would do`,
    `Reflect tonight: when did I act like ${identity}?`,
  ];
}

/* ---------- seed ---------- */
const seedBase = {
  intention: "",
  pillars: [
    { id: 1, identity: "The Athlete", creed: "A strong body is a strong mind.", strength: 40 },
    { id: 2, identity: "The Craftsman", creed: "I do fewer things, better.", strength: 55 },
    { id: 3, identity: "The Present One", creed: "Attention is the truest form of love.", strength: 30 },
  ],
  practices: [
    { id: 1, pillarId: 1, name: "Train for 30 minutes", streak: 0, doneOn: "" },
    { id: 2, pillarId: 1, name: "Sleep 7+ hours", streak: 0, doneOn: "" },
    { id: 3, pillarId: 2, name: "One hour of focused making", streak: 0, doneOn: "" },
    { id: 4, pillarId: 2, name: "Finish one small piece", streak: 0, doneOn: "" },
    { id: 5, pillarId: 3, name: "Phone away at dinner", streak: 0, doneOn: "" },
    { id: 6, pillarId: 3, name: "Three deep breaths before reacting", streak: 0, doneOn: "" },
  ],
  reflection: { date: "", text: "" }, // legacy single reflection (migrated to reflections)
  reflections: {},      // { 'YYYY-MM-DD': text }
  dayLog: {},           // { 'YYYY-MM-DD': [practiceId, ...] }  — canonical per-day completions
  history: {},          // { 'YYYY-MM-DD': { done, total } }    — derived, kept for charts
  strengthHistory: {},  // { 'YYYY-MM-DD': avgStrength }
  lastVisit: "",
};

/* demo history so Trends & past days look alive on first run; real data appends from today */
function buildDemo(base) {
  const ids = base.practices.map((p) => p.id);
  const total = ids.length;
  const rnd = (n) => Math.floor(Math.random() * n);
  let strength = 30;
  for (let i = 13; i >= 1; i--) {
    const d = dayStr(i);
    const done = 1 + rnd(total);
    const picks = [...ids].sort(() => Math.random() - 0.5).slice(0, done);
    base.dayLog[d] = picks;
    base.history[d] = { done: picks.length, total };
    strength = Math.max(18, Math.min(72, strength + (rnd(9) - 3)));
    base.strengthHistory[d] = Math.round(strength);
  }
  return base;
}

/* fold legacy / bot-written fields into the canonical model on every load */
function migrate(s) {
  if (!s.dayLog) s.dayLog = {};
  if (!s.reflections) s.reflections = {};
  (s.practices || []).forEach((p) => {
    if (p.doneOn) {
      const arr = s.dayLog[p.doneOn] || (s.dayLog[p.doneOn] = []);
      if (!arr.includes(p.id)) arr.push(p.id);
    }
  });
  if (s.reflection && s.reflection.date && s.reflections[s.reflection.date] == null) {
    s.reflections[s.reflection.date] = s.reflection.text || "";
  }
  return s;
}

let state = loadLocal();

function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return buildDemo(structuredClone(seedBase));
    return migrate({ ...structuredClone(seedBase), ...JSON.parse(raw) });
  } catch {
    return buildDemo(structuredClone(seedBase));
  }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  if (!SYNC) return;
  fetch(API_BASE + "/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  }).catch(() => {});
}

async function syncServer() {
  if (!SYNC) return;
  try {
    const res = await fetch(API_BASE + "/api/state");
    if (res.ok) {
      const data = await res.json();
      if (Object.keys(data).length > 0) {
        state = migrate({ ...structuredClone(seedBase), ...data });
        localStorage.setItem(KEY, JSON.stringify(state));
        renderPractices();
        loadReflection();
        renderPillars();
        if (activeView === "trends") renderTrends();
        el("intentionText").textContent = state.intention || "";
      } else {
        // First run on server, push local state
        save();
      }
    }
  } catch (err) {
    console.error("Fetch state failed:", err);
  }
}
const uid = () => Date.now() + Math.floor(Math.random() * 1000);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pillarName = (id) => (state.pillars.find((p) => p.id === id) || {}).identity || "";

/* ============ SOUND (synth porcelain chimes — no audio files) ============ */
const sfx = (() => {
  let ctx = null;
  let muted = localStorage.getItem("aBetterMe.muted") === "1";
  function ac() {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function note(freq, { t = 0, dur = 0.3, type = "sine", vol = 0.18, glideTo = null } = {}) {
    const c = ac(); if (!c) return;
    const now = c.currentTime + t;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g).connect(c.destination);
    osc.start(now); osc.stop(now + dur + 0.03);
  }
  const api = {
    get muted() { return muted; },
    toggle() { muted = !muted; localStorage.setItem("aBetterMe.muted", muted ? "1" : "0"); if (!muted) api.tap(); return muted; },
    check() { if (muted) return; note(659.3, { dur: 0.18, vol: 0.16 }); note(987.8, { t: 0.05, dur: 0.4, vol: 0.18 }); note(1318.5, { t: 0.05, dur: 0.4, vol: 0.05 }); },
    uncheck() { if (muted) return; note(440, { dur: 0.22, vol: 0.12, glideTo: 311 }); },
    vote() { if (muted) return; note(880, { dur: 0.1, type: "triangle", vol: 0.12 }); note(1174.7, { t: 0.04, dur: 0.16, vol: 0.09 }); },
    tap() { if (muted) return; note(523, { dur: 0.05, type: "triangle", vol: 0.07 }); },
    add() { if (muted) return; [783.99, 987.77, 1318.5].forEach((f, i) => note(f, { t: i * 0.05, dur: 0.26, vol: 0.11 })); },
    seal() { if (muted) return; [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, { t: i * 0.09, dur: 0.5, vol: 0.13 })); },
  };
  return api;
})();

/* ---------- visual press effects ---------- */
function ripple(x, y, color) {
  const r = document.createElement("span");
  r.className = "fx-ripple";
  r.style.left = x + "px"; r.style.top = y + "px";
  if (color) r.style.setProperty("--fx", color);
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 620);
}
function bloomRing(x, y) {
  const r = document.createElement("span");
  r.className = "fx-bloom";
  r.style.left = x + "px"; r.style.top = y + "px";
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 640);
}
/* ripple on every interactive press; richer sounds are fired by their own handlers */
document.addEventListener("pointerdown", (e) => {
  const t = e.target.closest("button, .check, .tab");
  if (!t) return;
  const danger = t.classList.contains("rm") || t.dataset.pact === "del";
  ripple(e.clientX, e.clientY, danger ? "rgba(181,18,27,.5)" : "rgba(29,53,87,.42)");
  const ownSound = t.classList.contains("check") || t.dataset.pact === "cast" || t.dataset.pact === "gen" || t.id === "saveReflection";
  if (!ownSound) sfx.tap();
});

/* ---------- day helpers ---------- */
const prevDayStr = (d) => new Date(new Date(d).getTime() - DAY).toISOString().slice(0, 10);
const nextDayStr = (d) => new Date(new Date(d).getTime() + DAY).toISOString().slice(0, 10);
const isDoneOn = (id, date) => (state.dayLog[date] || []).includes(id);
function streakUpto(id, date) {
  let n = 0, d = date;
  while (isDoneOn(id, d)) { n++; d = prevDayStr(d); }
  return n;
}
function doneCountOn(date) {
  const ids = new Set(state.practices.map((p) => p.id));
  return (state.dayLog[date] || []).filter((id) => ids.has(id)).length;
}
/* keep practice.doneOn + streak fresh so the Telegram bot (shared state) stays correct */
function syncPracticeMeta(p) {
  let latest = "";
  for (const d in state.dayLog) if (state.dayLog[d].includes(p.id) && d > latest) latest = d;
  p.doneOn = latest;
  p.streak = latest ? streakUpto(p.id, latest) : 0;
}

/* ---------- recording ---------- */
function recordDay(date) {
  const total = state.practices.length;
  if (total > 0) state.history[date] = { done: doneCountOn(date), total };
}
function recordToday() { recordDay(todayStr()); }
function recordStrength() {
  if (!state.pillars.length) return;
  const avg = Math.round(state.pillars.reduce((s, p) => s + p.strength, 0) / state.pillars.length);
  state.strengthHistory[todayStr()] = avg;
}

/* ---------- header / date ---------- */
document.getElementById("today").textContent =
  new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

const DEKS = {
  today: "Design the person you are becoming — one deliberate practice at a time.",
  identity: "The selves you are building. Name them; the practices follow.",
  trends: "The quiet arithmetic of becoming — votes cast, day after day.",
};

/* ---------- intention ---------- */
const intentionEl = document.getElementById("intentionText");
intentionEl.textContent = state.intention || "";
intentionEl.addEventListener("blur", () => {
  state.intention = intentionEl.textContent.trim();
  save();
});

/* ============ TAB NAVIGATION ============ */
const views = { today: el("view-today"), identity: el("view-identity"), trends: el("view-trends") };
function el(id) { return document.getElementById(id); }
let activeView = "today";

function switchView(name) {
  activeView = name;
  Object.entries(views).forEach(([k, v]) => (v.hidden = k !== name));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  el("viewDek").textContent = DEKS[name];
  if (name === "identity") renderPillars();
  if (name === "trends") renderTrends();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.getElementById("tabbar").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (tab) switchView(tab.dataset.view);
});

/* ============ PILLARS + HABITS (Identity tab) ============ */
const pillarsEl = document.getElementById("pillars");

function habitRowsHTML(pillarId) {
  const habits = state.practices.filter((p) => p.pillarId === pillarId);
  if (!habits.length) return `<div class="habit-empty">No practices yet — generate or add one.</div>`;
  return habits.map((h) => `
    <div class="habit-row">
      <span class="habit-name">${esc(h.name)}</span>
      <button class="habit-mini" data-hact="edit" data-id="${h.id}">Edit</button>
      <button class="habit-mini rm" data-hact="del" data-id="${h.id}">✕</button>
    </div>`).join("");
}

function renderPillars() {
  pillarsEl.innerHTML = "";
  if (!state.pillars.length) {
    pillarsEl.innerHTML = `<p class="pillar-empty">No pillars yet. Name the identities you're building toward.</p>`;
    return;
  }
  state.pillars.forEach((p) => {
    const el = document.createElement("article");
    el.className = "pillar";
    el.innerHTML = `
      <div class="pillar-id">${esc(p.identity)}</div>
      <div class="pillar-creed">“${esc(p.creed)}”</div>
      <div class="pillar-meter-label"><span>Identity strength</span><span>${p.strength}%</span></div>
      <div class="pillar-meter"><span style="width:${p.strength}%"></span></div>
      <div class="pillar-habits">
        <div class="pillar-habits-title">Daily practices</div>
        ${habitRowsHTML(p.id)}
        <div class="pillar-add-row">
          <button class="gen" data-pact="gen" data-id="${p.id}">✦ Auto-generate</button>
          <button data-pact="add" data-id="${p.id}">＋ Add practice</button>
        </div>
      </div>
      <div class="pillar-actions">
        <button data-pact="cast" data-id="${p.id}">Cast a vote ＋</button>
        <button data-pact="edit" data-id="${p.id}">Edit</button>
        <button class="rm" data-pact="del" data-id="${p.id}">✕</button>
      </div>`;
    pillarsEl.appendChild(el);
  });
}

pillarsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = +btn.dataset.id;

  if (btn.dataset.hact) {
    const h = state.practices.find((x) => x.id === id);
    if (btn.dataset.hact === "edit") {
      const name = prompt("Edit practice", h.name);
      if (name && name.trim()) { h.name = name.trim(); save(); renderPillars(); }
    } else if (btn.dataset.hact === "del") {
      state.practices = state.practices.filter((x) => x.id !== id);
      recordToday(); save(); renderPillars();
    }
    return;
  }

  const p = state.pillars.find((x) => x.id === id);
  switch (btn.dataset.pact) {
    case "cast":
      p.strength = Math.min(100, p.strength + 5);
      sfx.vote();
      recordStrength(); save(); renderPillars();
      break;
    case "edit":
      openModal(p);
      break;
    case "del":
      if (confirm(`Remove “${p.identity}” and its practices?`)) {
        state.pillars = state.pillars.filter((x) => x.id !== id);
        state.practices = state.practices.filter((x) => x.pillarId !== id);
        recordToday(); recordStrength(); save(); renderPillars();
      }
      break;
    case "add": {
      const name = prompt(`New practice for “${p.identity}”`);
      if (name && name.trim()) {
        state.practices.push({ id: uid(), pillarId: id, name: name.trim(), streak: 0, doneOn: "" });
        recordToday(); save(); renderPillars();
      }
      break;
    }
    case "gen": {
      const existing = new Set(state.practices.filter((x) => x.pillarId === id).map((x) => x.name.toLowerCase()));
      const fresh = genHabits(p.identity).filter((n) => !existing.has(n.toLowerCase()));
      if (!fresh.length) { alert("Those practices are already here. Edit or add your own to go deeper."); break; }
      fresh.forEach((n) => state.practices.push({ id: uid(), pillarId: id, name: n, streak: 0, doneOn: "" }));
      sfx.add();
      recordToday(); save(); renderPillars();
      break;
    }
  }
});

/* ---------- modal ---------- */
const veil = el("modalVeil"), mId = el("mIdentity"), mCreed = el("mCreed"),
      mTitle = el("modalTitle"), mHint = el("modalHint");
let editing = null;

function openModal(pillar) {
  editing = pillar || null;
  mTitle.textContent = pillar ? "Edit Pillar" : "New Identity Pillar";
  mHint.hidden = !!pillar;
  mId.value = pillar ? pillar.identity : "";
  mCreed.value = pillar ? pillar.creed : "";
  veil.hidden = false;
  mId.focus();
}
function closeModal() { veil.hidden = true; editing = null; }
el("addPillar").addEventListener("click", () => openModal(null));
el("mCancel").addEventListener("click", closeModal);
veil.addEventListener("click", (e) => { if (e.target === veil) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !veil.hidden) closeModal(); });
el("mSave").addEventListener("click", () => {
  const identity = mId.value.trim();
  if (!identity) { mId.focus(); return; }
  const creed = mCreed.value.trim() || "I show up for this every day.";
  if (editing) {
    editing.identity = identity; editing.creed = creed;
  } else {
    const pid = uid();
    state.pillars.push({ id: pid, identity, creed, strength: 20 });
    genHabits(identity).forEach((n) =>
      state.practices.push({ id: uid(), pillarId: pid, name: n, streak: 0, doneOn: "" }));
    recordToday(); recordStrength();
  }
  save(); renderPillars(); closeModal();
});

/* ============ TODAY: date navigation + practices ============ */
const practicesEl = el("practices"), summaryEl = el("practiceSummary");
const dateLabel = el("dateLabel"), dailyPrompt = el("dailyPrompt");
let viewDate = todayStr();

const niceDate = (d) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const isToday = (d) => d === todayStr();

function renderDateNav() {
  dateLabel.textContent = isToday(viewDate) ? `Today · ${niceDate(viewDate)}` : niceDate(viewDate);
  el("nextDay").disabled = viewDate >= todayStr();
  el("jumpToday").hidden = isToday(viewDate);
  const untouched = isToday(viewDate) && state.practices.length > 0
    && (state.dayLog[viewDate] || []).length === 0
    && !(state.reflections[viewDate] || "").trim();
  dailyPrompt.hidden = !untouched;
}

function shiftDay(delta) {
  let d = delta < 0 ? prevDayStr(viewDate) : nextDayStr(viewDate);
  if (d > todayStr()) d = todayStr();
  viewDate = d;
  renderPractices(); loadReflection();
}
el("prevDay").addEventListener("click", () => shiftDay(-1));
el("nextDay").addEventListener("click", () => shiftDay(1));
el("jumpToday").addEventListener("click", () => { viewDate = todayStr(); renderPractices(); loadReflection(); });

function renderPractices() {
  practicesEl.innerHTML = "";
  if (!state.practices.length) {
    practicesEl.innerHTML = `<li class="practice-empty">No practices yet. Add an identity pillar and its habits will appear here.</li>`;
    summaryEl.textContent = "";
    renderDateNav(); updateStreakLine();
    return;
  }
  const d = viewDate;
  state.practices.forEach((pr) => {
    const done = isDoneOn(pr.id, d);
    const streak = streakUpto(pr.id, d);
    const li = document.createElement("li");
    li.className = "practice-item" + (done ? " is-done" : "");
    li.innerHTML = `
      <div class="check ${done ? "done" : ""}" data-id="${pr.id}" role="checkbox" aria-checked="${done}" tabindex="0"></div>
      <div class="practice-body">
        <div class="practice-name">${esc(pr.name)}</div>
        <div class="practice-tag">${esc(pillarName(pr.pillarId))}</div>
      </div>
      <div class="practice-streak">${streak > 0 ? "🔥 " + streak : ""}</div>`;
    practicesEl.appendChild(li);
  });
  const doneCount = doneCountOn(d);
  summaryEl.textContent = `${doneCount} of ${state.practices.length} practices lived ${isToday(d) ? "today" : "that day"} — each one a vote for who you're becoming.`;
  renderDateNav(); updateStreakLine();
}

practicesEl.addEventListener("click", (e) => {
  const chk = e.target.closest(".check");
  if (!chk) return;
  const id = +chk.dataset.id;
  const willComplete = !isDoneOn(id, viewDate);
  const rect = chk.getBoundingClientRect();
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  toggle(id);
  if (willComplete) { sfx.check(); bloomRing(cx, cy); } else { sfx.uncheck(); }
});
practicesEl.addEventListener("keydown", (e) => {
  const chk = e.target.closest(".check");
  if (chk && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(+chk.dataset.id); }
});

function toggle(id) {
  const d = viewDate;
  const arr = state.dayLog[d] || (state.dayLog[d] = []);
  const i = arr.indexOf(id);
  const nowDone = i < 0;
  if (nowDone) arr.push(id); else arr.splice(i, 1);
  if (arr.length === 0) delete state.dayLog[d];
  const pr = state.practices.find((p) => p.id === id);
  if (pr) {
    syncPracticeMeta(pr); // keep doneOn/streak in sync for the Telegram bot
    if (nowDone) {
      const pill = state.pillars.find((p) => p.id === pr.pillarId);
      if (pill) pill.strength = Math.min(100, pill.strength + 2);
    }
  }
  recordDay(d); recordStrength(); save(); renderPractices();
}

/* ---------- reflection (per day) ---------- */
const reflectionEl = el("reflection"), savedFlag = el("reflectionSaved");
function loadReflection() {
  reflectionEl.value = state.reflections[viewDate] || "";
  el("reflectDate").textContent = isToday(viewDate) ? "" : ` · ${niceDate(viewDate)}`;
}
el("saveReflection").addEventListener("click", () => {
  const txt = reflectionEl.value.trim();
  if (txt) state.reflections[viewDate] = txt; else delete state.reflections[viewDate];
  state.reflection = { date: viewDate, text: txt }; // legacy mirror
  save();
  sfx.seal();
  savedFlag.textContent = "Sealed ✦";
  savedFlag.classList.add("show");
  renderDateNav();
  setTimeout(() => savedFlag.classList.remove("show"), 2200);
});

/* ---------- streak line ---------- */
function updateStreakLine() {
  const best = state.practices.reduce((m, p) => Math.max(m, streakUpto(p.id, todayStr())), 0);
  el("streakLine").textContent = best > 0
    ? `Longest active streak: ${best} day${best > 1 ? "s" : ""}. Keep casting votes.`
    : "Every practice checked is a vote for the person you're becoming.";
}

/* ============ TRENDS ============ */
function lastDays(n) { const a = []; for (let i = n - 1; i >= 0; i--) a.push(dayStr(i)); return a; }

function renderTrends() {
  const days = lastDays(14);
  let sumDone = 0, sumTotal = 0;
  days.forEach((d) => { const h = state.history[d]; if (h) { sumDone += h.done; sumTotal += h.total; } });
  const consistency = sumTotal ? Math.round((sumDone / sumTotal) * 100) : 0;
  const bestStreak = state.practices.reduce((m, p) => Math.max(m, streakUpto(p.id, todayStr())), 0);
  const avgStrength = state.pillars.length
    ? Math.round(state.pillars.reduce((s, p) => s + p.strength, 0) / state.pillars.length) : 0;

  el("statGrid").innerHTML = `
    <div class="stat gold"><div class="stat-num">${consistency}<span class="unit">%</span></div><div class="stat-label">Consistency · 14d</div></div>
    <div class="stat"><div class="stat-num">${bestStreak}</div><div class="stat-label">Best streak · days</div></div>
    <div class="stat"><div class="stat-num">${avgStrength}<span class="unit">%</span></div><div class="stat-label">Avg strength</div></div>`;

  el("chartPractices").innerHTML = barChartSVG(days);
  el("notePractices").textContent = `${sumDone} practices lived across the last 14 days.`;
  el("chartStrength").innerHTML = lineChartSVG(days);
  el("barsByPillar").innerHTML = state.pillars.length
    ? state.pillars.map((p) => `
      <div class="pbar-row">
        <div class="pbar-head"><span class="pbar-name">${esc(p.identity)}</span><span class="pbar-val">${p.strength}%</span></div>
        <div class="pbar-track"><div class="pbar-fill" style="width:${p.strength}%"></div></div>
      </div>`).join("")
    : `<p class="chart-empty">Add an identity pillar to see its strength.</p>`;
}

function barChartSVG(days) {
  const W = 320, H = 150, padX = 6, padTop = 12, padBot = 20;
  const maxTotal = Math.max(3, ...days.map((d) => state.history[d]?.total || 0));
  const slot = (W - padX * 2) / days.length;
  const bw = slot * 0.6;
  const baseY = H - padBot;
  const fullY = padTop; // top = all practices done
  let bars = "", labels = "";
  days.forEach((d, i) => {
    const rec = state.history[d] || { done: 0, total: 0 };
    const x = padX + i * slot + (slot - bw) / 2;
    const h = (rec.done / maxTotal) * (baseY - padTop);
    const y = baseY - h;
    const isToday = d === todayStr();
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2" fill="${isToday ? "var(--gold)" : "var(--blue-wash)"}"><title>${d}: ${rec.done}/${rec.total}</title></rect>`;
    if (i === 0 || i === days.length - 1 || i === 7) {
      const lbl = i === days.length - 1 ? "today" : d.slice(5);
      labels += `<text class="bar-label" x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${lbl}</text>`;
    }
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Practices completed per day">
    <line class="grid-line" x1="${padX}" y1="${fullY}" x2="${W - padX}" y2="${fullY}"/>
    <text class="grid-cap" x="${W - padX}" y="${fullY - 3}" text-anchor="end">all done</text>
    <line class="grid-line" x1="${padX}" y1="${baseY}" x2="${W - padX}" y2="${baseY}"/>
    ${bars}${labels}
  </svg>`;
}

function lineChartSVG(days) {
  const W = 320, H = 150, padX = 8, padTop = 12, padBot = 20;
  const baseY = H - padBot;
  let last = state.strengthHistory[days.find((d) => state.strengthHistory[d] != null)] ?? 0;
  const vals = days.map((d) => { if (state.strengthHistory[d] != null) last = state.strengthHistory[d]; return last; });
  const step = (W - padX * 2) / (days.length - 1);
  const pts = vals.map((v, i) => [padX + i * step, baseY - (v / 100) * (baseY - padTop)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${pts[pts.length - 1][0].toFixed(1)} ${baseY} L ${pts[0][0].toFixed(1)} ${baseY} Z`;
  const dots = pts.map((p, i) => i === pts.length - 1
    ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="var(--gold)" stroke="var(--cream)" stroke-width="1.5"/>` : "").join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Identity strength trend">
    <defs><linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--gold)" stop-opacity=".28"/>
      <stop offset="1" stop-color="var(--gold)" stop-opacity="0"/>
    </linearGradient></defs>
    <line class="grid-line" x1="${padX}" y1="${padTop}" x2="${W - padX}" y2="${padTop}"/>
    <text class="grid-cap" x="${padX}" y="${padTop - 3}">100%</text>
    <line class="grid-line" x1="${padX}" y1="${baseY}" x2="${W - padX}" y2="${baseY}"/>
    <path d="${area}" fill="url(#areaG)"/>
    <path d="${line}" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <text class="bar-label" x="${padX}" y="${H - 6}">${days[0].slice(5)}</text>
    <text class="bar-label" x="${W - padX}" y="${H - 6}" text-anchor="end">today</text>
  </svg>`;
}

/* ---------- reset ---------- */
el("resetAll").addEventListener("click", () => {
  if (confirm("Reset all pillars, practices, and history? This cannot be undone.")) {
    localStorage.removeItem(KEY);
    state = buildDemo(structuredClone(seedBase));
    viewDate = todayStr();
    intentionEl.textContent = "";
    renderPractices(); loadReflection(); renderPillars();
    if (activeView === "trends") renderTrends();
  }
});

/* ---------- sound toggle ---------- */
const muteBtn = el("muteBtn");
function paintMute() { muteBtn.textContent = sfx.muted ? "🔕" : "🔔"; muteBtn.classList.toggle("muted", sfx.muted); }
muteBtn.addEventListener("click", () => { sfx.toggle(); paintMute(); });
paintMute();

/* ---------- init ---------- */
state.lastVisit = todayStr();
recordToday();
recordStrength();
save();
renderPractices();
loadReflection();
renderPillars();
syncServer();
