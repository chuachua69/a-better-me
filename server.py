import sqlite3
import json
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

app = FastAPI()

# Restrict browser access to the known frontends (single-user personal tool).
# NOTE: CORS only constrains browsers, not direct curl/API calls.
ALLOWED_ORIGINS = os.getenv(
    "ABETTERME_ORIGINS",
    "https://chuachua69.github.io,http://localhost:8010,http://127.0.0.1:8010",
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

DB_PATH = os.getenv("ABETTERME_DB", "data.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS app_state (
            id INTEGER PRIMARY KEY,
            data TEXT
        )
    ''')
    # insert default if empty
    c.execute('SELECT count(*) FROM app_state WHERE id=1')
    if c.fetchone()[0] == 0:
        c.execute('INSERT INTO app_state (id, data) VALUES (1, ?)', ('{}',))
    conn.commit()
    conn.close()

init_db()

@app.get("/api/state")
def get_state():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT data FROM app_state WHERE id=1')
    row = c.fetchone()
    conn.close()
    if row and row[0]:
        return json.loads(row[0])
    return {}

@app.post("/api/state")
async def save_state(request: Request):
    data = await request.json()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('UPDATE app_state SET data=? WHERE id=1', (json.dumps(data),))
    conn.commit()
    conn.close()
    return {"status": "ok"}

# Mount static files. Serve index.html at root
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    host = os.getenv("ABETTERME_HOST", "127.0.0.1")
    port = int(os.getenv("ABETTERME_PORT", "8787"))
    uvicorn.run(app, host=host, port=port)
