import os
import json
import sqlite3
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ConversationHandler, ContextTypes

load_dotenv("../.env")
TOKEN = os.getenv("ABETTERME_BOT_TOKEN")
DB_PATH = "data.db"
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://chuachua69.github.io/a-better-me/")

# --- Habit Gen ---
HABIT_LIB = [
    {"k": ["athlet", "fit", "strong", "gym", "muscle", "lift"], "h": ["Move for 30 minutes", "Stretch for 10 minutes", "Sleep 7+ hours"]},
    {"k": ["run", "marath", "jog"], "h": ["Run or brisk-walk 3km", "Stretch after training"]},
    {"k": ["writer", "write", "author"], "h": ["Write 300 words", "Read for 20 minutes"]},
    {"k": ["read"], "h": ["Read 20 pages", "Screens off 30 min before bed"]},
    {"k": ["scholar", "student", "learn", "study"], "h": ["Study for 45 minutes", "Review yesterday's notes"]},
    {"k": ["craft", "maker", "build", "engineer", "develop", "coder", "program"], "h": ["One hour of deep work", "Ship one small thing"]},
    {"k": ["creator", "artist", "design", "paint", "music"], "h": ["Create for 45 minutes", "Share one piece of work"]},
    {"k": ["founder", "entrepreneur", "hustl", "ceo"], "h": ["One revenue-moving task", "Talk to one customer"]},
    {"k": ["leader", "manager", "mentor"], "h": ["Plan the day's top 3", "Encourage someone"]},
    {"k": ["parent", "father", "mother", "dad", "mom", "family"], "h": ["Phone away at dinner", "15 min undistracted play"]},
    {"k": ["present", "mindful", "calm", "zen", "peace"], "h": ["Meditate for 10 minutes", "Journal one honest line"]},
    {"k": ["health", "well", "vital"], "h": ["Drink 2L of water", "Eat one whole-food meal"]},
    {"k": ["cook", "chef", "kitchen"], "h": ["Cook one real meal", "Prep tomorrow's food"]},
    {"k": ["save", "invest", "wealth", "money", "frugal"], "h": ["Log today's spending", "No impulse purchases"]},
    {"k": ["early", "morning", "disciplin"], "h": ["Wake at set time — no snooze", "Plan the day before it starts"]},
]

def gen_habits(identity):
    s = (identity or "").lower()
    out = []
    for e in HABIT_LIB:
        if any(k in s for k in e["k"]):
            out.extend(e["h"])
    seen = set()
    uniq = []
    for x in out:
        if x not in seen:
            uniq.append(x)
            seen.add(x)
    uniq = uniq[:3]
    if uniq: return uniq
    
    import re
    noun = re.sub(r'(?i)^the\s+', '', identity).strip() or "this identity"
    return [f"Act like {identity} today", f"One deliberate {noun.lower()} habit"]

# --- State ---
def today_str(): return datetime.now().strftime("%Y-%m-%d")
def yesterday_str(): return (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

def get_state():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT data FROM app_state WHERE id=1')
        row = c.fetchone()
        conn.close()
        if row and row[0]: return json.loads(row[0])
    except: pass
    return {}

def save_state(state):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('UPDATE app_state SET data=? WHERE id=1', (json.dumps(state),))
        conn.commit()
        conn.close()
    except Exception as e: print("Error saving state:", e)

def record_today(state):
    t = today_str()
    total = len(state.get("practices", []))
    done = len([p for p in state.get("practices", []) if p.get("doneOn") == t])
    if total > 0:
        if "history" not in state: state["history"] = {}
        state["history"][t] = {"done": done, "total": total}

def record_strength(state):
    pillars = state.get("pillars", [])
    if not pillars: return
    avg = round(sum(p.get("strength", 0) for p in pillars) / len(pillars))
    if "strengthHistory" not in state: state["strengthHistory"] = {}
    state["strengthHistory"][today_str()] = avg

def uid(): return int(time.time() * 1000)

# --- Conversations ---
AWAIT_IDENTITY = 1
AWAIT_NEW_PRACTICE = 2
AWAIT_RENAME = 3

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    state = get_state()
    if not state.get("pillars"):
        await update.message.reply_text(
            "Welcome to A Better Me ✦\n\n"
            "To begin, who are you trying to become? (e.g., 'The Athlete', 'The Founder', 'The Writer')\n\n"
            "Send me an identity to create your first pillar."
        )
        return AWAIT_IDENTITY
    else:
        await update.message.reply_text(
            "Welcome back.\n"
            "Commands:\n"
            "/today - Your daily practices\n"
            "/add - Add a new practice\n"
            "/edit - Edit or delete practices\n"
            "/intent <text> - Set daily intention\n"
            "/trends - Your stats"
        )
        return ConversationHandler.END

async def receive_identity(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = update.message or update.edited_message
    if not msg or not msg.text: return
    identity = msg.text.strip()
    state = get_state()
    
    if "pillars" not in state: state["pillars"] = []
    if "practices" not in state: state["practices"] = []
    
    pid = uid()
    state["pillars"].append({
        "id": pid,
        "identity": identity,
        "creed": "I show up for this every day.",
        "strength": 20
    })
    
    habits = gen_habits(identity)
    for h in habits:
        state["practices"].append({
            "id": uid() + len(state["practices"]),
            "pillarId": pid,
            "name": h,
            "streak": 0,
            "doneOn": ""
        })
        
    record_today(state)
    record_strength(state)
    save_state(state)
    
    await msg.reply_text(f"Created pillar: *{identity}*.\nGenerated {len(habits)} starting practices for you.", parse_mode="Markdown")
    
    text, reply_markup = build_today_ui(state)
    await msg.reply_text(text, reply_markup=reply_markup, parse_mode="Markdown")
    return ConversationHandler.END

async def add_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    state = get_state()
    if not state.get("pillars"):
        await update.message.reply_text("Please set up an identity with /start first.")
        return ConversationHandler.END
    await update.message.reply_text("What's the name of the new practice?")
    return AWAIT_NEW_PRACTICE

async def receive_new_practice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = update.message or update.edited_message
    if not msg or not msg.text: return
    name = msg.text.strip()
    state = get_state()
    pid = state["pillars"][0]["id"]
    if "practices" not in state: state["practices"] = []
    state["practices"].append({
        "id": uid(),
        "pillarId": pid,
        "name": name,
        "streak": 0,
        "doneOn": ""
    })
    save_state(state)
    await msg.reply_text(f"Practice added: {name}\nUse /today to see it.")
    return ConversationHandler.END

async def rename_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    pid = int(query.data.split("_")[1])
    context.user_data["renaming_id"] = pid
    await query.edit_message_text("Send the new name for this practice:")
    return AWAIT_RENAME

async def receive_rename(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = update.message or update.edited_message
    if not msg or not msg.text: return
    new_name = msg.text.strip()
    pid = context.user_data.get("renaming_id")
    state = get_state()
    for p in state.get("practices", []):
        if p["id"] == pid:
            p["name"] = new_name
            break
    save_state(state)
    await msg.reply_text(f"Practice renamed to: {new_name}\nUse /edit to continue managing practices.")
    return ConversationHandler.END

async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Canceled.")
    return ConversationHandler.END

# --- UI Builders ---
def build_today_ui(state):
    t = today_str()
    practices = state.get("practices", [])
    intent_txt = state.get('intention', '')
    intent_display = f"\nIntention: {intent_txt}\n" if intent_txt else ""
    
    lines = [f"📅 *Today: {t}*{intent_display}"]
    buttons = []
    for i, p in enumerate(practices, start=1):
        done = "✅" if p.get("doneOn") == t else "⬜"
        streak = f" 🔥{p.get('streak', 0)}" if p.get("streak", 0) > 0 else ""
        lines.append(f"{i}. {done} {p['name']}{streak}")
        buttons.append(InlineKeyboardButton(str(i), callback_data=f"toggle_{p['id']}"))
        
    lines.append("\nTap a number to toggle:")
    text = "\n".join(lines)
    
    keyboard = []
    row = []
    for btn in buttons:
        row.append(btn)
        if len(row) == 5:
            keyboard.append(row)
            row = []
    if row: keyboard.append(row)
        
    keyboard.append([InlineKeyboardButton("🌐 View Dashboard", url=WEBAPP_URL)])
    return text, InlineKeyboardMarkup(keyboard)

def build_edit_ui(state):
    practices = state.get("practices", [])
    if not practices:
        return "No practices to edit. Type /add to create one.", None
        
    lines = ["*Select a practice to edit:*"]
    buttons = []
    for i, p in enumerate(practices, start=1):
        lines.append(f"{i}. {p['name']}")
        buttons.append(InlineKeyboardButton(str(i), callback_data=f"editlist_{p['id']}"))
        
    text = "\n".join(lines)
    
    keyboard = []
    row = []
    for btn in buttons:
        row.append(btn)
        if len(row) == 5:
            keyboard.append(row)
            row = []
    if row: keyboard.append(row)
        
    return text, InlineKeyboardMarkup(keyboard)

# --- Normal Commands ---
async def today_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    state = get_state()
    if not state.get("practices"):
        await update.message.reply_text("No practices found. Type /add to create one.")
        return
    text, reply_markup = build_today_ui(state)
    await update.message.reply_text(text, reply_markup=reply_markup, parse_mode="Markdown")

async def toggle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    pid = int(query.data.split("_")[1])
    state = get_state()
    practices = state.get("practices", [])
    pr = next((p for p in practices if p["id"] == pid), None)
    
    if not pr:
        await query.edit_message_text("Practice not found.")
        return
        
    t = today_str()
    y = yesterday_str()

    if pr.get("doneOn") == t:
        pr["doneOn"] = ""
        pr["streak"] = max(0, pr.get("streak", 0) - 1)
    else:
        pr["streak"] = pr.get("streak", 0) + 1 if pr.get("doneOn") == y else 1
        pr["doneOn"] = t
        pillars = state.get("pillars", [])
        pill = next((p for p in pillars if p["id"] == pr.get("pillarId")), None)
        if pill: pill["strength"] = min(100, pill.get("strength", 0) + 2)

    record_today(state)
    record_strength(state)
    save_state(state)
    
    text, reply_markup = build_today_ui(state)
    try:
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode="Markdown")
    except:
        pass

async def edit_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    state = get_state()
    text, reply_markup = build_edit_ui(state)
    await update.message.reply_text(text, reply_markup=reply_markup, parse_mode="Markdown")

async def edit_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    state = get_state()

    if data == "editback":
        text, reply_markup = build_edit_ui(state)
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode="Markdown")
        return

    if data.startswith("editlist_"):
        pid = int(data.split("_")[1])
        pr = next((p for p in state.get("practices", []) if p["id"] == pid), None)
        if not pr:
            await query.edit_message_text("Practice not found.")
            return
        
        keyboard = [
            [
                InlineKeyboardButton("✏️ Rename", callback_data=f"rename_{pid}"),
                InlineKeyboardButton("🗑️ Delete", callback_data=f"delete_{pid}")
            ],
            [InlineKeyboardButton("🔙 Back", callback_data="editback")]
        ]
        await query.edit_message_text(f"Manage: *{pr['name']}*", reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown")
        return

    if data.startswith("delete_"):
        pid = int(data.split("_")[1])
        state["practices"] = [p for p in state.get("practices", []) if p["id"] != pid]
        record_today(state)
        save_state(state)
        
        text, reply_markup = build_edit_ui(state)
        await query.edit_message_text("Practice deleted.\n\n" + text, reply_markup=reply_markup, parse_mode="Markdown")
        return

async def intent(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("Usage: /intent <your intention>")
        return
    text = " ".join(context.args)
    state = get_state()
    state["intention"] = text
    save_state(state)
    await update.message.reply_text(f"Intention set: {text}")
    
async def trends(update: Update, context: ContextTypes.DEFAULT_TYPE):
    state = get_state()
    best_streak = max([p.get("streak", 0) for p in state.get("practices", [])], default=0)
    pillars = state.get("pillars", [])
    avg_strength = round(sum(p.get("strength", 0) for p in pillars) / len(pillars)) if pillars else 0
    
    keyboard = [[InlineKeyboardButton("🌐 View Dashboard", url=WEBAPP_URL)]]
    await update.message.reply_text(
        f"📈 *Trends*\n"
        f"Best Streak: {best_streak} days\n"
        f"Avg Identity Strength: {avg_strength}%\n",
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

async def post_init(application: Application):
    commands = [
        BotCommand("start", "Start or reset setup"),
        BotCommand("today", "View today's practices"),
        BotCommand("add", "Add a new practice"),
        BotCommand("edit", "Manage your practices"),
        BotCommand("intent", "Set a daily intention"),
        BotCommand("trends", "View your stats"),
    ]
    await application.bot.set_my_commands(commands)

# --- Main Dispatcher ---
def main():
    if not TOKEN:
        print("Missing ABETTERME_BOT_TOKEN")
        return
        
    application = Application.builder().token(TOKEN).post_init(post_init).build()
    
    conv_handler = ConversationHandler(
        entry_points=[
            CommandHandler("start", start),
            CommandHandler("add", add_cmd),
            CallbackQueryHandler(rename_callback, pattern=r"^rename_")
        ],
        states={
            AWAIT_IDENTITY: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_identity)],
            AWAIT_NEW_PRACTICE: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_new_practice)],
            AWAIT_RENAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, receive_rename)]
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        allow_reentry=True
    )
    application.add_handler(conv_handler)
    
    application.add_handler(CommandHandler("today", today_cmd))
    application.add_handler(CommandHandler("edit", edit_cmd))
    application.add_handler(CommandHandler("intent", intent))
    application.add_handler(CommandHandler("trends", trends))
    
    # Standalone callbacks
    application.add_handler(CallbackQueryHandler(toggle_callback, pattern=r"^toggle_"))
    application.add_handler(CallbackQueryHandler(edit_callback, pattern=r"^(editlist_|delete_|editback)"))

    print("ABetterMe Bot is running...")
    application.run_polling()

if __name__ == "__main__":
    main()
