/* ===== A Better Me — Identity Architecture ===== */
const KEY = "aBetterMe.v1";
const todayStr = () => new Date().toISOString().slice(0, 10);

const seed = {
  intention: "",
  pillars: [
    { id: 1, identity: "The Athlete", creed: "A strong body is a strong mind.", strength: 40 },
    { id: 2, identity: "The Craftsman", creed: "I do fewer things, better.", strength: 55 },
    { id: 3, identity: "The Present One", creed: "Attention is the truest form of love.", strength: 30 },
  ],
  practices: [
    { id: 1, name: "Move for 30 minutes", tag: "The Athlete", streak: 0, doneOn: "" },
    { id: 2, name: "One hour of deep work", tag: "The Craftsman", streak: 0, doneOn: "" },
    { id: 3, name: "Phone away at dinner", tag: "The Present One", streak: 0, doneOn: "" },
  ],
  reflection: { date: "", text: "" },
  lastVisit: "",
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(seed);
    return { ...structuredClone(seed), ...JSON.parse(raw) };
  } catch {
    return structuredClone(seed);
  }
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
const uid = () => Date.now() + Math.floor(Math.random() * 1000);

/* ---------- date header ---------- */
document.getElementById("today").textContent =
  new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

/* ---------- intention ---------- */
const intentionEl = document.getElementById("intentionText");
intentionEl.textContent = state.intention || "";
intentionEl.addEventListener("blur", () => {
  state.intention = intentionEl.textContent.trim();
  save();
});

/* ---------- pillars ---------- */
const pillarsEl = document.getElementById("pillars");
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
      <div class="pillar-actions">
        <button data-act="cast" data-id="${p.id}">Cast a vote ＋</button>
        <button data-act="edit" data-id="${p.id}">Edit</button>
        <button class="rm" data-act="del" data-id="${p.id}">✕</button>
      </div>`;
    pillarsEl.appendChild(el);
  });
}
pillarsEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = +btn.dataset.id;
  const p = state.pillars.find((x) => x.id === id);
  if (btn.dataset.act === "cast") {
    p.strength = Math.min(100, p.strength + 5);
    save(); renderPillars();
  } else if (btn.dataset.act === "del") {
    state.pillars = state.pillars.filter((x) => x.id !== id);
    save(); renderPillars();
  } else if (btn.dataset.act === "edit") {
    openModal(p);
  }
});

/* ---------- modal ---------- */
const veil = document.getElementById("modalVeil");
const mId = document.getElementById("mIdentity");
const mCreed = document.getElementById("mCreed");
const mTitle = document.getElementById("modalTitle");
let editing = null;

function openModal(pillar) {
  editing = pillar || null;
  mTitle.textContent = pillar ? "Edit Pillar" : "New Identity Pillar";
  mId.value = pillar ? pillar.identity : "";
  mCreed.value = pillar ? pillar.creed : "";
  veil.hidden = false;
  mId.focus();
}
function closeModal() { veil.hidden = true; editing = null; }
document.getElementById("addPillar").addEventListener("click", () => openModal(null));
document.getElementById("mCancel").addEventListener("click", closeModal);
veil.addEventListener("click", (e) => { if (e.target === veil) closeModal(); });
document.getElementById("mSave").addEventListener("click", () => {
  const identity = mId.value.trim();
  if (!identity) { mId.focus(); return; }
  const creed = mCreed.value.trim() || "I show up for this every day.";
  if (editing) {
    editing.identity = identity; editing.creed = creed;
  } else {
    state.pillars.push({ id: uid(), identity, creed, strength: 20 });
  }
  save(); renderPillars(); closeModal();
});

/* ---------- practices ---------- */
const practicesEl = document.getElementById("practices");
const summaryEl = document.getElementById("practiceSummary");

function renderPractices() {
  practicesEl.innerHTML = "";
  if (!state.practices.length) {
    practicesEl.innerHTML = `<li class="practice-empty">No practices yet. Small votes for your future self.</li>`;
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
        <div class="practice-tag">${esc(pr.tag || "")}</div>
      </div>
      <div class="practice-streak">${pr.streak > 0 ? "🔥 " + pr.streak : ""}</div>
      <button class="practice-del" data-del="${pr.id}" title="Remove">✕</button>`;
    practicesEl.appendChild(li);
  });
  const doneCount = state.practices.filter((p) => p.doneOn === t).length;
  summaryEl.textContent = `${doneCount} of ${state.practices.length} practices lived today — each one a vote for who you're becoming.`;
  updateStreakLine();
}

practicesEl.addEventListener("click", (e) => {
  const chk = e.target.closest(".check");
  const del = e.target.closest(".practice-del");
  if (chk) toggle(+chk.dataset.id);
  else if (del) {
    state.practices = state.practices.filter((p) => p.id !== +del.dataset.del);
    save(); renderPractices();
  }
});
practicesEl.addEventListener("keydown", (e) => {
  const chk = e.target.closest(".check");
  if (chk && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(+chk.dataset.id); }
});

function toggle(id) {
  const pr = state.practices.find((p) => p.id === id);
  const t = todayStr();
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (pr.doneOn === t) {
    pr.doneOn = "";
    pr.streak = Math.max(0, pr.streak - 1);
  } else {
    pr.streak = pr.doneOn === y ? pr.streak + 1 : 1;
    pr.doneOn = t;
  }
  save(); renderPractices();
}

document.getElementById("addPractice").addEventListener("click", () => {
  const name = prompt("New daily practice — what small action votes for your future self?");
  if (!name || !name.trim()) return;
  const tag = prompt("Which identity pillar does it serve? (optional)") || "";
  state.practices.push({ id: uid(), name: name.trim(), tag: tag.trim(), streak: 0, doneOn: "" });
  save(); renderPractices();
});

/* ---------- reflection ---------- */
const reflectionEl = document.getElementById("reflection");
const savedFlag = document.getElementById("reflectionSaved");
if (state.reflection.date === todayStr()) reflectionEl.value = state.reflection.text;
document.getElementById("saveReflection").addEventListener("click", () => {
  state.reflection = { date: todayStr(), text: reflectionEl.value.trim() };
  save();
  savedFlag.textContent = "Sealed ✦";
  savedFlag.classList.add("show");
  setTimeout(() => savedFlag.classList.remove("show"), 2200);
});

/* ---------- streak line ---------- */
function updateStreakLine() {
  const best = state.practices.reduce((m, p) => Math.max(m, p.streak), 0);
  const el = document.getElementById("streakLine");
  el.textContent = best > 0
    ? `Longest active streak: ${best} day${best > 1 ? "s" : ""}. Keep casting votes.`
    : "Every practice checked is a vote for the person you're becoming.";
}

/* ---------- reset ---------- */
document.getElementById("resetAll").addEventListener("click", () => {
  if (confirm("Reset all pillars, practices, and reflections? This cannot be undone.")) {
    localStorage.removeItem(KEY);
    state = structuredClone(seed);
    intentionEl.textContent = "";
    reflectionEl.value = "";
    renderPillars(); renderPractices();
  }
});

/* ---------- util ---------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- init ---------- */
state.lastVisit = todayStr();
save();
renderPillars();
renderPractices();
