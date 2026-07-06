/* ===== A Better Me — Identity Architecture ===== */
const KEY = "aBetterMe.v2";
const DAY = 864e5;
const todayStr = () => new Date().toISOString().slice(0, 10);
const dayStr = (offset) => new Date(Date.now() - offset * DAY).toISOString().slice(0, 10);

/* ---------- habit generation from identity ---------- */
const HABIT_LIB = [
  { k: ["athlet", "fit", "strong", "gym", "muscle", "lift"], h: ["Move for 30 minutes", "Stretch for 10 minutes", "Sleep 7+ hours"] },
  { k: ["run", "marath", "jog"], h: ["Run or brisk-walk 3km", "Stretch after training"] },
  { k: ["writer", "write", "author"], h: ["Write 300 words", "Read for 20 minutes"] },
  { k: ["read"], h: ["Read 20 pages", "Screens off 30 min before bed"] },
  { k: ["scholar", "student", "learn", "study"], h: ["Study for 45 minutes", "Review yesterday's notes"] },
  { k: ["craft", "maker", "build", "engineer", "develop", "coder", "program"], h: ["One hour of deep work", "Ship one small thing"] },
  { k: ["creator", "artist", "design", "paint", "music"], h: ["Create for 45 minutes", "Share one piece of work"] },
  { k: ["founder", "entrepreneur", "hustl", "ceo"], h: ["One revenue-moving task", "Talk to one customer"] },
  { k: ["leader", "manager", "mentor"], h: ["Plan the day's top 3", "Encourage someone"] },
  { k: ["parent", "father", "mother", "dad", "mom", "family"], h: ["Phone away at dinner", "15 min undistracted play"] },
  { k: ["present", "mindful", "calm", "zen", "peace"], h: ["Meditate for 10 minutes", "Journal one honest line"] },
  { k: ["health", "well", "vital"], h: ["Drink 2L of water", "Eat one whole-food meal"] },
  { k: ["cook", "chef", "kitchen"], h: ["Cook one real meal", "Prep tomorrow's food"] },
  { k: ["save", "invest", "wealth", "money", "frugal"], h: ["Log today's spending", "No impulse purchases"] },
  { k: ["early", "morning", "disciplin"], h: ["Wake at set time — no snooze", "Plan the day before it starts"] },
];
function genHabits(identity) {
  const s = (identity || "").toLowerCase();
  const out = [];
  for (const e of HABIT_LIB) if (e.k.some((k) => s.includes(k))) out.push(...e.h);
  const uniq = [...new Set(out)].slice(0, 3);
  if (uniq.length) return uniq;
  const noun = identity.replace(/^the\s+/i, "").trim() || "this identity";
  return [`Act like ${identity} today`, `One deliberate ${noun.toLowerCase()} habit`];
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
    { id: 1, pillarId: 1, name: "Move for 30 minutes", streak: 0, doneOn: "" },
    { id: 2, pillarId: 1, name: "Stretch for 10 minutes", streak: 0, doneOn: "" },
    { id: 3, pillarId: 2, name: "One hour of deep work", streak: 0, doneOn: "" },
    { id: 4, pillarId: 3, name: "Phone away at dinner", streak: 0, doneOn: "" },
  ],
  reflection: { date: "", text: "" },
  history: {},          // { 'YYYY-MM-DD': { done, total } }
  strengthHistory: {},  // { 'YYYY-MM-DD': avgStrength }
  lastVisit: "",
};

/* demo history so Trends looks alive on first run; real data appends from today */
function buildDemo(base) {
  const total = base.practices.length;
  const rnd = (n) => Math.floor(Math.random() * n);
  let strength = 30;
  for (let i = 13; i >= 1; i--) {
    const d = dayStr(i);
    base.history[d] = { done: Math.min(total, 1 + rnd(total)), total };
    strength = Math.max(18, Math.min(72, strength + (rnd(9) - 3)));
    base.strengthHistory[d] = Math.round(strength);
  }
  return base;
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return buildDemo(structuredClone(seedBase));
    return { ...structuredClone(seedBase), ...JSON.parse(raw) };
  } catch {
    return buildDemo(structuredClone(seedBase));
  }
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
const uid = () => Date.now() + Math.floor(Math.random() * 1000);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pillarName = (id) => (state.pillars.find((p) => p.id === id) || {}).identity || "";

/* ---------- recording ---------- */
function recordToday() {
  const t = todayStr();
  const total = state.practices.length;
  const done = state.practices.filter((p) => p.doneOn === t).length;
  if (total > 0) state.history[t] = { done, total };
}
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

/* ============ TODAY: practices ============ */
const practicesEl = el("practices"), summaryEl = el("practiceSummary");

function renderPractices() {
  practicesEl.innerHTML = "";
  if (!state.practices.length) {
    practicesEl.innerHTML = `<li class="practice-empty">No practices yet. Add an identity pillar and its habits will appear here.</li>`;
    summaryEl.textContent = "";
    updateStreakLine();
    return;
  }
  const t = todayStr();
  state.practices.forEach((pr) => {
    const done = pr.doneOn === t;
    const li = document.createElement("li");
    li.className = "practice-item" + (done ? " is-done" : "");
    li.innerHTML = `
      <div class="check ${done ? "done" : ""}" data-id="${pr.id}" role="checkbox" aria-checked="${done}" tabindex="0"></div>
      <div class="practice-body">
        <div class="practice-name">${esc(pr.name)}</div>
        <div class="practice-tag">${esc(pillarName(pr.pillarId))}</div>
      </div>
      <div class="practice-streak">${pr.streak > 0 ? "🔥 " + pr.streak : ""}</div>`;
    practicesEl.appendChild(li);
  });
  const doneCount = state.practices.filter((p) => p.doneOn === t).length;
  summaryEl.textContent = `${doneCount} of ${state.practices.length} practices lived today — each one a vote for who you're becoming.`;
  updateStreakLine();
}

practicesEl.addEventListener("click", (e) => {
  const chk = e.target.closest(".check");
  if (chk) toggle(+chk.dataset.id);
});
practicesEl.addEventListener("keydown", (e) => {
  const chk = e.target.closest(".check");
  if (chk && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(+chk.dataset.id); }
});

function toggle(id) {
  const pr = state.practices.find((p) => p.id === id);
  const t = todayStr(), y = dayStr(1);
  if (pr.doneOn === t) {
    pr.doneOn = "";
    pr.streak = Math.max(0, pr.streak - 1);
  } else {
    pr.streak = pr.doneOn === y ? pr.streak + 1 : 1;
    pr.doneOn = t;
    // completing a practice nudges its pillar's identity strength
    const pill = state.pillars.find((p) => p.id === pr.pillarId);
    if (pill) pill.strength = Math.min(100, pill.strength + 2);
  }
  recordToday(); recordStrength(); save(); renderPractices();
}

/* ---------- reflection ---------- */
const reflectionEl = el("reflection"), savedFlag = el("reflectionSaved");
if (state.reflection.date === todayStr()) reflectionEl.value = state.reflection.text;
el("saveReflection").addEventListener("click", () => {
  state.reflection = { date: todayStr(), text: reflectionEl.value.trim() };
  save();
  savedFlag.textContent = "Sealed ✦";
  savedFlag.classList.add("show");
  setTimeout(() => savedFlag.classList.remove("show"), 2200);
});

/* ---------- streak line ---------- */
function updateStreakLine() {
  const best = state.practices.reduce((m, p) => Math.max(m, p.streak), 0);
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
  const bestStreak = state.practices.reduce((m, p) => Math.max(m, p.streak), 0);
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
    intentionEl.textContent = "";
    reflectionEl.value = "";
    renderPractices(); renderPillars();
    if (activeView === "trends") renderTrends();
  }
});

/* ---------- init ---------- */
state.lastVisit = todayStr();
recordToday();
recordStrength();
save();
renderPractices();
renderPillars();
