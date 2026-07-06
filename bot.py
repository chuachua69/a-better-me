import os
import json
import sqlite3
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, MessageHandler,
    filters, ConversationHandler, ContextTypes,
)

load_dotenv("../.env")
TOKEN = os.getenv("ABETTERME_BOT_TOKEN")
DB_PATH = os.getenv("ABETTERME_DB", "data.db")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://chuachua69.github.io/a-better-me/")

# ---------- habit generation (kept in sync with the web app) ----------
HABIT_LIB = [
    {"k": ["runner", "running", "marath", "jog", "sprint"], "h": ["Run or brisk-walk for 25 minutes", "Do a 5-minute mobility warm-up", "Log the distance and how it felt"]},
    {"k": ["athlet", "fitness", "gym", "muscle", "lifter", "lifting", "bodybuild", "strength train"], "h": ["Train for 30 minutes", "Hit today's protein target", "Sleep 7+ hours"]},
    {"k": ["yoga", "flexib", "mobility"], "h": ["Flow through 15 minutes of yoga", "Hold three deep stretches", "Breathe slowly for 5 minutes"]},
    {"k": ["writer", "writing", "author", "novelist", "blogger", "poet"], "h": ["Write 300 words — no editing", "Read for 20 minutes", "Capture one idea in a notebook"]},
    {"k": ["reader", "reading", "bookworm", "well-read"], "h": ["Read 20 pages", "Note one takeaway", "Screens off 30 min before bed"]},
    {"k": ["scholar", "student", "learner", "learning", "study", "curious", "polymath"], "h": ["Study one topic for 40 minutes", "Review yesterday's notes", "Teach one thing you learned"]},
    {"k": ["coder", "coding", "developer", "engineer", "programmer", "software", "hacker"], "h": ["One 60-minute deep-work block", "Ship one small improvement", "Read code better than yours"]},
    {"k": ["craft", "maker", "builder", "artisan", "woodwork"], "h": ["One hour of focused making", "Finish one small piece", "Sharpen or tidy your tools"]},
    {"k": ["artist", "painter", "painting", "drawing", "sketch", "illustrat", "designer", "creative"], "h": ["Create for 45 minutes", "Share one piece of work", "Collect three references"]},
    {"k": ["musician", "music", "guitar", "piano", "singer", "singing", "producer"], "h": ["Practice for 30 minutes", "Learn one new phrase", "Play something purely for joy"]},
    {"k": ["photograph", "filmmak", "videograph"], "h": ["Make one deliberate frame", "Study one artist's work", "Edit one shot to finish"]},
    {"k": ["founder", "entrepreneur", "startup", "hustler", "ceo", "indie"], "h": ["Do one revenue-moving task", "Talk to one customer", "Ship something publicly"]},
    {"k": ["invest", "trader", "wealth", "frugal", "saver", "finance", "budget"], "h": ["Log today's spending", "Skip one impulse purchase", "Move a little to savings"]},
    {"k": ["leader", "manager", "mentor", "coach", "captain"], "h": ["Set the day's top 3", "Recognize someone's effort", "Have one real 1:1 conversation"]},
    {"k": ["speaker", "orator", "persuad", "communicat", "storytell"], "h": ["Rehearse aloud for 10 minutes", "Record and review yourself", "Learn one rhetorical device"]},
    {"k": ["teacher", "educator", "tutor", "professor"], "h": ["Explain one concept simply", "Prepare one clear example", "Ask a better question"]},
    {"k": ["parent", "father", "mother", "dad", "mom", "family man", "family woman"], "h": ["Phone away at dinner", "15 minutes of undistracted play", "Read or talk at bedtime"]},
    {"k": ["partner", "spouse", "husband", "wife", "boyfriend", "girlfriend", "lover", "marriage"], "h": ["Do one small kind gesture", "Ask about their day and listen", "Give 20 undivided minutes"]},
    {"k": ["friend", "connector", "social"], "h": ["Reach out to one person", "Listen without fixing", "Plan time with someone you miss"]},
    {"k": ["mindful", "meditat", "present", "calm", "zen", "peace", "stillness"], "h": ["Meditate for 10 minutes", "Take three deep breaths before reacting", "Single-task for one hour"]},
    {"k": ["grateful", "gratitude", "optimist", "positive", "joyful"], "h": ["Write down three gratitudes", "Thank someone sincerely", "Reframe one worry"]},
    {"k": ["healthy", "wellness", "nutrition", "vitality", "clean eat"], "h": ["Drink 2L of water", "Eat one whole-food meal", "Get 20 minutes of daylight"]},
    {"k": ["cook", "chef", "kitchen", "baker", "baking"], "h": ["Cook one real meal", "Prep tomorrow's food", "Try one new ingredient"]},
    {"k": ["earlyrise", "early riser", "morning person", "disciplin", "consistent"], "h": ["Wake at a set time — no snooze", "Plan the day before it starts", "Do the hard task first"]},
    {"k": ["minimal", "declutter", "simplic", "tidy", "organiz"], "h": ["Clear one surface", "Remove one thing you don't use", "One-in, one-out today"]},
    {"k": ["stoic", "resilient", "grit", "disciplined", "warrior"], "h": ["Do one hard thing on purpose", "Journal: what's in my control?", "Take a cold shower or hard walk"]},
    {"k": ["spiritual", "faith", "prayer", "praying", "soul", "believer"], "h": ["Sit in prayer or reflection 10 min", "Read something wise", "Act from your values once, visibly"]},
    {"k": ["adventur", "explorer", "traveler", "outdoors", "hiker", "nature"], "h": ["Spend 20 minutes outside", "Plan one micro-adventure", "Notice something new on a familiar route"]},
    {"k": ["gardener", "gardening", "plant", "grower", "farmer"], "h": ["Tend the garden for 15 minutes", "Water and observe closely", "Learn one plant or technique"]},
    {"k": ["giver", "generous", "volunteer", "service", "charit", "kind"], "h": ["Do one act of service", "Give without expecting return", "Check on someone quietly struggling"]},
    {"k": ["sober", "recovery", "clean living"], "h": ["Reach out to your support", "Replace the urge with a walk", "Note one reason you're proud"]},
    {"k": ["sleep", "rested", "recover"], "h": ["Set a fixed bedtime", "Screens off 30 min before bed", "Do a short wind-down ritual"]},
    {"k": ["focused", "productiv", "deep work", "maker of things"], "h": ["Protect one 90-minute focus block", "Choose today's single most important task", "Take a real break away from screens"]},
]


def gen_habits(identity):
    s = (identity or "").lower()
    out = []
    for e in HABIT_LIB:
        if any(k in s for k in e["k"]):
            out.extend(e["h"])
    seen, uniq = set(), []
    for x in out:
        if x not in seen:
            uniq.append(x); seen.add(x)
    if uniq:
        return uniq[:3]
    return [
        f"Spend 20 minutes on what {identity} cares about",
        f"Do one thing today only {identity} would do",
        f"Reflect tonight: when did I act like {identity}?",
    ]


# ---------- dates ----------
def today_str():
    return datetime.now().strftime("%Y-%m-%d")


def prev_day(d):
    return (datetime.strptime(d, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")


# ---------- state (shared canonical model with the web app) ----------
def get_state():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT data FROM app_state WHERE id=1")
        row = c.fetchone()
        conn.close()
        st = json.loads(row[0]) if row and row[0] else {}
    except Exception:
        st = {}
    # fold any doneOn into the canonical dayLog so is_done() is consistent
    st.setdefault("dayLog", {})
    for pr in st.get("practices", []):
        d = pr.get("doneOn")
        if d:
            st["dayLog"].setdefault(d, [])
            if pr["id"] not in st["dayLog"][d]:
                st["dayLog"][d].append(pr["id"])
    return st


def save_state(state):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            "CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY, data TEXT)"
        )
        c.execute("SELECT count(*) FROM app_state WHERE id=1")
        if c.fetchone()[0] == 0:
            c.execute("INSERT INTO app_state (id, data) VALUES (1, ?)", (json.dumps(state),))
        else:
            c.execute("UPDATE app_state SET data=? WHERE id=1", (json.dumps(state),))
        conn.commit()
        conn.close()
    except Exception as e:
        print("save_state error:", e)


def uid():
    return int(time.time() * 1000)


def find_pillar(state, pid):
    return next((p for p in state.get("pillars", []) if p["id"] == pid), None)


def find_practice(state, prid):
    return next((p for p in state.get("practices", []) if p["id"] == prid), None)


def is_done(state, prid, date):
    return prid in state.get("dayLog", {}).get(date, [])


def streak_upto(state, prid, date):
    dl = state.get("dayLog", {})
    n, d = 0, date
    while d in dl and prid in dl[d]:
        n += 1
        d = prev_day(d)
    return n


def sync_meta(state, pr):
    latest = ""
    for d, ids in state.get("dayLog", {}).items():
        if pr["id"] in ids and d > latest:
            latest = d
    pr["doneOn"] = latest
    pr["streak"] = streak_upto(state, pr["id"], latest) if latest else 0


def record_day(state, date):
    total = len(state.get("practices", []))
    if total:
        done = len([1 for pr in state["practices"] if is_done(state, pr["id"], date)])
        state.setdefault("history", {})[date] = {"done": done, "total": total}


def record_strength(state):
    pillars = state.get("pillars", [])
    if pillars:
        avg = round(sum(p.get("strength", 0) for p in pillars) / len(pillars))
        state.setdefault("strengthHistory", {})[today_str()] = avg


def toggle(state, prid):
    t = today_str()
    pr = find_practice(state, prid)
    if not pr:
        return
    arr = state.setdefault("dayLog", {}).setdefault(t, [])
    if prid in arr:
        arr.remove(prid)
        now_done = False
    else:
        arr.append(prid)
        now_done = True
    if not arr:
        state["dayLog"].pop(t, None)
    sync_meta(state, pr)
    if now_done:
        pill = find_pillar(state, pr.get("pillarId"))
        if pill:
            pill["strength"] = min(100, pill.get("strength", 0) + 2)
    record_day(state, t)
    record_strength(state)


# ---------- keyboards / rendering ----------
def rows_of(buttons, n=5):
    return [buttons[i:i + n] for i in range(0, len(buttons), n)]


def render_home(state):
    pillars = state.get("pillars", [])
    practices = state.get("practices", [])
    t = today_str()
    done = sum(1 for pr in practices if is_done(state, pr["id"], t))
    intent = state.get("intention", "")
    lines = ["✦ *A Better Me*"]
    if intent:
        lines.append(f"_{intent}_")
    lines.append(f"\nToday: *{done}/{len(practices)}* practices  ·  {len(pillars)} identities")
    kb = [
        [InlineKeyboardButton("✅ Today's practices", callback_data="today")],
        [InlineKeyboardButton("🏛 My identities", callback_data="idents"),
         InlineKeyboardButton("📊 Trends", callback_data="trends")],
        [InlineKeyboardButton("➕ New identity", callback_data="newp"),
         InlineKeyboardButton("✎ Intention", callback_data="intent")],
        [InlineKeyboardButton("🌐 Open dashboard", url=WEBAPP_URL)],
    ]
    return "\n".join(lines), InlineKeyboardMarkup(kb)


def render_today(state):
    t = today_str()
    pillars = state.get("pillars", [])
    practices = state.get("practices", [])
    intent = state.get("intention", "")
    lines = [f"📅 *Today · {t}*"]
    if intent:
        lines.append(f"_{intent}_")
    lines.append("")
    by_pillar = {}
    for pr in practices:
        by_pillar.setdefault(pr.get("pillarId"), []).append(pr)
    buttons, n = [], 0
    for pill in pillars:
        items = by_pillar.get(pill["id"], [])
        if not items:
            continue
        done = sum(1 for pr in items if is_done(state, pr["id"], t))
        lines.append(f"🏛 *{pill['identity']}*  ({done}/{len(items)})  ·  {pill.get('strength', 0)}%")
        for pr in items:
            n += 1
            mark = "✅" if is_done(state, pr["id"], t) else "⬜"
            sk = streak_upto(state, pr["id"], t)
            streak = f"  🔥{sk}" if sk > 0 else ""
            lines.append(f"   {n}. {mark} {pr['name']}{streak}")
            buttons.append(InlineKeyboardButton(str(n), callback_data=f"t:{pr['id']}"))
        lines.append("")
    if n == 0:
        lines.append("No practices yet. Tap ➕ New identity to begin.")
    else:
        lines.append("_Tap a number to check it off._")
    kb = rows_of(buttons, 5)
    kb.append([InlineKeyboardButton("🏛 Identities", callback_data="idents"),
               InlineKeyboardButton("📊 Trends", callback_data="trends")])
    kb.append([InlineKeyboardButton("⬅ Menu", callback_data="home"),
               InlineKeyboardButton("🌐 Dashboard", url=WEBAPP_URL)])
    return "\n".join(lines), InlineKeyboardMarkup(kb)


def render_identities(state):
    pillars = state.get("pillars", [])
    t = today_str()
    lines = ["🏛 *Your identities*", "", "_The selves you're building. Tap one to manage its practices._", ""]
    kb = []
    for pill in pillars:
        items = [pr for pr in state.get("practices", []) if pr.get("pillarId") == pill["id"]]
        done = sum(1 for pr in items if is_done(state, pr["id"], t))
        lines.append(f"• *{pill['identity']}* — {pill.get('strength', 0)}% · {done}/{len(items)} today")
        kb.append([InlineKeyboardButton(f"🏛 {pill['identity']}", callback_data=f"p:{pill['id']}")])
    if not pillars:
        lines.append("None yet.")
    kb.append([InlineKeyboardButton("➕ New identity", callback_data="newp")])
    kb.append([InlineKeyboardButton("⬅ Menu", callback_data="home")])
    return "\n".join(lines), InlineKeyboardMarkup(kb)


def render_pillar(state, pid):
    pill = find_pillar(state, pid)
    if not pill:
        return "Identity not found.", InlineKeyboardMarkup([[InlineKeyboardButton("⬅ Identities", callback_data="idents")]])
    t = today_str()
    items = [pr for pr in state.get("practices", []) if pr.get("pillarId") == pid]
    done = sum(1 for pr in items if is_done(state, pr["id"], t))
    lines = [f"🏛 *{pill['identity']}*", f"_{pill.get('creed', '')}_",
             f"\nStrength: *{pill.get('strength', 0)}%*  ·  Today: *{done}/{len(items)}*", "", "*Practices*"]
    toggles = []
    for i, pr in enumerate(items, 1):
        mark = "✅" if is_done(state, pr["id"], t) else "⬜"
        lines.append(f"   {i}. {mark} {pr['name']}")
        toggles.append(InlineKeyboardButton(str(i), callback_data=f"tp:{pid}:{pr['id']}"))
    if not items:
        lines.append("   _none yet — auto-generate or add one_")
    else:
        lines.append("\n_Tap a number to check it off._")
    kb = rows_of(toggles, 5)
    kb.append([InlineKeyboardButton("✨ Auto-generate", callback_data=f"pg:{pid}"),
               InlineKeyboardButton("➕ Add practice", callback_data=f"pa:{pid}")])
    kb.append([InlineKeyboardButton("👍 Cast a vote", callback_data=f"pv:{pid}"),
               InlineKeyboardButton("✏️ Edit", callback_data=f"pe:{pid}")])
    kb.append([InlineKeyboardButton("⬅ Identities", callback_data="idents")])
    return "\n".join(lines), InlineKeyboardMarkup(kb)


def render_pillar_edit(state, pid):
    pill = find_pillar(state, pid)
    if not pill:
        return "Identity not found.", InlineKeyboardMarkup([[InlineKeyboardButton("⬅ Identities", callback_data="idents")]])
    items = [pr for pr in state.get("practices", []) if pr.get("pillarId") == pid]
    lines = [f"✏️ *Edit — {pill['identity']}*", ""]
    kb = []
    for i, pr in enumerate(items, 1):
        lines.append(f"{i}. {pr['name']}")
        kb.append([
            InlineKeyboardButton(f"✏️ {i}", callback_data=f"hr:{pid}:{pr['id']}"),
            InlineKeyboardButton(f"🗑 {i}", callback_data=f"hx:{pid}:{pr['id']}"),
        ])
    if not items:
        lines.append("_no practices_")
    kb.append([InlineKeyboardButton("🗑 Delete identity", callback_data=f"pdel:{pid}")])
    kb.append([InlineKeyboardButton("⬅ Back", callback_data=f"p:{pid}")])
    return "\n".join(lines), InlineKeyboardMarkup(kb)


def render_trends(state):
    practices = state.get("practices", [])
    pillars = state.get("pillars", [])
    best = max((streak_upto(state, pr["id"], today_str()) for pr in practices), default=0)
    avg = round(sum(p.get("strength", 0) for p in pillars) / len(pillars)) if pillars else 0
    # 14-day consistency from history
    hist = state.get("history", {})
    sd = st = 0
    d = today_str()
    for _ in range(14):
        if d in hist:
            sd += hist[d]["done"]; st += hist[d]["total"]
        d = prev_day(d)
    consistency = round(sd / st * 100) if st else 0
    lines = ["📊 *Trends*", "",
             f"Consistency (14d): *{consistency}%*",
             f"Best active streak: *{best}* days",
             f"Avg identity strength: *{avg}%*"]
    kb = [[InlineKeyboardButton("🌐 Full charts on dashboard", url=WEBAPP_URL)],
          [InlineKeyboardButton("⬅ Menu", callback_data="home")]]
    return "\n".join(lines), InlineKeyboardMarkup(kb)


# ---------- conversation states ----------
AWAIT_IDENTITY, AWAIT_PRACTICE, AWAIT_RENAME, AWAIT_INTENT = range(4)


async def edit_or_send(update, text, kb):
    """Edit the callback message if possible, else reply."""
    q = update.callback_query
    try:
        await q.edit_message_text(text, reply_markup=kb, parse_mode="Markdown")
    except Exception:
        pass


# ---------- commands ----------
async def start(update, context):
    state = get_state()
    if not state.get("pillars"):
        await update.message.reply_text(
            "Welcome to *A Better Me* ✦\n\n"
            "Who are you becoming? Send me an identity to build your first pillar —\n"
            "e.g. _The Athlete_, _The Writer_, _The Present Parent_.",
            parse_mode="Markdown",
        )
        return AWAIT_IDENTITY
    text, kb = render_home(state)
    await update.message.reply_text(text, reply_markup=kb, parse_mode="Markdown")
    return ConversationHandler.END


async def menu_cmd(update, context):
    text, kb = render_home(get_state())
    await update.message.reply_text(text, reply_markup=kb, parse_mode="Markdown")


async def today_cmd(update, context):
    text, kb = render_today(get_state())
    await update.message.reply_text(text, reply_markup=kb, parse_mode="Markdown")


async def help_cmd(update, context):
    await update.message.reply_text(
        "*A Better Me* — build who you're becoming.\n\n"
        "1. Create an *identity* (a self you're building).\n"
        "2. It auto-generates *daily practices* — small votes for that self.\n"
        "3. Check them off each day; your identity strength grows.\n\n"
        "/menu — open the menu\n/today — today's practices\n/start — restart onboarding",
        parse_mode="Markdown",
    )


# ---------- conversation flows ----------
async def receive_identity(update, context):
    msg = update.message
    if not msg or not msg.text:
        return AWAIT_IDENTITY
    identity = msg.text.strip()
    state = get_state()
    pid = uid()
    state.setdefault("pillars", []).append(
        {"id": pid, "identity": identity, "creed": "I show up for this every day.", "strength": 20}
    )
    habits = gen_habits(identity)
    for i, h in enumerate(habits):
        state.setdefault("practices", []).append(
            {"id": uid() + i, "pillarId": pid, "name": h, "streak": 0, "doneOn": ""}
        )
    record_day(state, today_str())
    record_strength(state)
    save_state(state)
    await msg.reply_text(
        f"Created *{identity}* with {len(habits)} starter practices ✦", parse_mode="Markdown"
    )
    text, kb = render_today(state)
    await msg.reply_text(text, reply_markup=kb, parse_mode="Markdown")
    return ConversationHandler.END


async def cb_newpillar(update, context):
    await update.callback_query.answer()
    await update.callback_query.message.reply_text(
        "Who are you becoming? Send me an identity (e.g. _The Runner_).", parse_mode="Markdown"
    )
    return AWAIT_IDENTITY


async def cb_addpractice(update, context):
    q = update.callback_query
    await q.answer()
    pid = int(q.data.split(":")[1])
    context.user_data["add_pid"] = pid
    pill = find_pillar(get_state(), pid)
    name = pill["identity"] if pill else "this identity"
    await q.message.reply_text(f"What practice should *{name}* do daily?", parse_mode="Markdown")
    return AWAIT_PRACTICE


async def receive_practice(update, context):
    msg = update.message
    if not msg or not msg.text:
        return AWAIT_PRACTICE
    pid = context.user_data.get("add_pid")
    state = get_state()
    if pid and find_pillar(state, pid):
        state.setdefault("practices", []).append(
            {"id": uid(), "pillarId": pid, "name": msg.text.strip(), "streak": 0, "doneOn": ""}
        )
        record_day(state, today_str())
        save_state(state)
        text, kb = render_pillar(state, pid)
        await msg.reply_text("Added ✦", parse_mode="Markdown")
        await msg.reply_text(text, reply_markup=kb, parse_mode="Markdown")
    return ConversationHandler.END


async def cb_rename(update, context):
    q = update.callback_query
    await q.answer()
    _, pid, prid = q.data.split(":")
    context.user_data["ren_pid"] = int(pid)
    context.user_data["ren_prid"] = int(prid)
    await q.message.reply_text("Send the new name for this practice:")
    return AWAIT_RENAME


async def receive_rename(update, context):
    msg = update.message
    if not msg or not msg.text:
        return AWAIT_RENAME
    state = get_state()
    prid = context.user_data.get("ren_prid")
    pid = context.user_data.get("ren_pid")
    pr = find_practice(state, prid)
    if pr:
        pr["name"] = msg.text.strip()
        save_state(state)
    text, kb = render_pillar_edit(state, pid)
    await msg.reply_text("Renamed ✦", parse_mode="Markdown")
    await msg.reply_text(text, reply_markup=kb, parse_mode="Markdown")
    return ConversationHandler.END


async def cb_intent(update, context):
    await update.callback_query.answer()
    await update.callback_query.message.reply_text(
        "What's your core intention? (I am becoming someone who…)"
    )
    return AWAIT_INTENT


async def receive_intent(update, context):
    msg = update.message
    if not msg or not msg.text:
        return AWAIT_INTENT
    state = get_state()
    state["intention"] = msg.text.strip()
    save_state(state)
    text, kb = render_home(state)
    await msg.reply_text("Intention set ✦", parse_mode="Markdown")
    await msg.reply_text(text, reply_markup=kb, parse_mode="Markdown")
    return ConversationHandler.END


async def intent_cmd(update, context):
    if context.args:
        state = get_state()
        state["intention"] = " ".join(context.args)
        save_state(state)
        await update.message.reply_text("Intention set ✦", parse_mode="Markdown")
        return ConversationHandler.END
    await update.message.reply_text("What's your core intention? (I am becoming someone who…)")
    return AWAIT_INTENT


async def cancel(update, context):
    await update.message.reply_text("Cancelled.")
    return ConversationHandler.END


# ---------- callback router (navigation + actions) ----------
async def router(update, context):
    q = update.callback_query
    await q.answer()
    data = q.data
    state = get_state()

    if data == "home":
        text, kb = render_home(state)
    elif data == "today":
        text, kb = render_today(state)
    elif data == "idents":
        text, kb = render_identities(state)
    elif data == "trends":
        text, kb = render_trends(state)
    elif data.startswith("t:"):
        toggle(state, int(data[2:])); save_state(state)
        text, kb = render_today(state)
    elif data.startswith("tp:"):
        _, pid, prid = data.split(":")
        toggle(state, int(prid)); save_state(state)
        text, kb = render_pillar(state, int(pid))
    elif data.startswith("p:"):
        text, kb = render_pillar(state, int(data[2:]))
    elif data.startswith("pe:"):
        text, kb = render_pillar_edit(state, int(data[3:]))
    elif data.startswith("pv:"):
        pid = int(data[3:])
        pill = find_pillar(state, pid)
        if pill:
            pill["strength"] = min(100, pill.get("strength", 0) + 5)
            record_strength(state); save_state(state)
        text, kb = render_pillar(state, pid)
    elif data.startswith("pg:"):
        pid = int(data[3:])
        pill = find_pillar(state, pid)
        if pill:
            existing = {pr["name"].lower() for pr in state["practices"] if pr.get("pillarId") == pid}
            fresh = [h for h in gen_habits(pill["identity"]) if h.lower() not in existing]
            for h in fresh:
                state["practices"].append({"id": uid(), "pillarId": pid, "name": h, "streak": 0, "doneOn": ""})
            record_day(state, today_str()); save_state(state)
        text, kb = render_pillar(state, pid)
    elif data.startswith("hx:"):
        _, pid, prid = data.split(":")
        state["practices"] = [p for p in state.get("practices", []) if p["id"] != int(prid)]
        record_day(state, today_str()); save_state(state)
        text, kb = render_pillar_edit(state, int(pid))
    elif data.startswith("pdel:"):
        pid = int(data[5:])
        pill = find_pillar(state, pid)
        name = pill["identity"] if pill else "this identity"
        text = f"Delete *{name}* and all its practices?"
        kb = InlineKeyboardMarkup([
            [InlineKeyboardButton("🗑 Yes, delete", callback_data=f"pdy:{pid}"),
             InlineKeyboardButton("⬅ No", callback_data=f"p:{pid}")]
        ])
        await edit_or_send(update, text, kb)
        return
    elif data.startswith("pdy:"):
        pid = int(data[4:])
        state["pillars"] = [p for p in state.get("pillars", []) if p["id"] != pid]
        state["practices"] = [p for p in state.get("practices", []) if p.get("pillarId") != pid]
        record_day(state, today_str()); record_strength(state); save_state(state)
        text, kb = render_identities(state)
    else:
        text, kb = render_home(state)

    await edit_or_send(update, text, kb)


async def post_init(application):
    await application.bot.set_my_commands([
        BotCommand("menu", "Open the menu"),
        BotCommand("today", "Today's practices"),
        BotCommand("start", "Start / onboarding"),
        BotCommand("help", "How this works"),
    ])


def main():
    if not TOKEN:
        print("Missing ABETTERME_BOT_TOKEN")
        return
    app = Application.builder().token(TOKEN).post_init(post_init).build()

    conv = ConversationHandler(
        entry_points=[
            CommandHandler("start", start),
            CommandHandler("intent", intent_cmd),
            CallbackQueryHandler(cb_newpillar, pattern=r"^newp$"),
            CallbackQueryHandler(cb_addpractice, pattern=r"^pa:"),
            CallbackQueryHandler(cb_rename, pattern=r"^hr:"),
            CallbackQueryHandler(cb_intent, pattern=r"^intent$"),
        ],
        states={
            AWAIT_IDENTITY: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_identity)],
            AWAIT_PRACTICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_practice)],
            AWAIT_RENAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_rename)],
            AWAIT_INTENT: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_intent)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        allow_reentry=True,
    )
    app.add_handler(conv)
    app.add_handler(CommandHandler("menu", menu_cmd))
    app.add_handler(CommandHandler("today", today_cmd))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CallbackQueryHandler(router))  # everything else

    print("A Better Me bot running...")
    app.run_polling()


if __name__ == "__main__":
    main()
