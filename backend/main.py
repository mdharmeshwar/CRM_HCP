from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .agent import CRMAgent
from .database import Base, DATABASE_URL, SessionLocal, engine, get_db
from .repository import (
    create_hcp,
    create_interaction,
    get_analytics,
    get_current_user,
    get_db_status,
    list_follow_ups,
    list_hcps,
    list_interactions,
    list_logs,
    list_products,
    toggle_follow_up,
    update_interaction,
)
from .schemas import ChatRequest, HCPCreate, InteractionCreate, InteractionUpdate
from .seed import seed_all, seed_if_empty

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables and seed if empty
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield
    # Shutdown (nothing needed)


app = FastAPI(title="AI-First CRM HCP Module", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/auth/me")
def auth_me(db: Session = Depends(get_db)):
    user = get_current_user(db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.get("/api/hcps")
def get_hcps(q: str | None = None, db: Session = Depends(get_db)):
    return list_hcps(db, q)


@app.post("/api/hcps")
def post_hcp(payload: HCPCreate, db: Session = Depends(get_db)):
    return create_hcp(db, payload)


@app.get("/api/products")
def get_products(db: Session = Depends(get_db)):
    return list_products(db)


@app.get("/api/interactions")
def get_interactions(db: Session = Depends(get_db)):
    return list_interactions(db)


@app.post("/api/interactions")
def post_interaction(payload: InteractionCreate, db: Session = Depends(get_db)):
    return create_interaction(db, payload)


@app.put("/api/interactions/{interaction_id}")
def put_interaction(interaction_id: str, updates: InteractionUpdate, db: Session = Depends(get_db)):
    result = update_interaction(db, interaction_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return result


@app.get("/api/followups")
def get_followups(db: Session = Depends(get_db)):
    return list_follow_ups(db)


@app.post("/api/followups/{follow_up_id}/toggle")
def post_toggle_followup(follow_up_id: str, db: Session = Depends(get_db)):
    result = toggle_follow_up(db, follow_up_id)
    if not result:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    return result


@app.get("/api/logs")
def get_logs(db: Session = Depends(get_db)):
    return list_logs(db)


@app.get("/api/analytics")
def analytics(db: Session = Depends(get_db)):
    return get_analytics(db)


@app.get("/api/db-status")
def db_status(db: Session = Depends(get_db)):
    return get_db_status(db, DATABASE_URL)


@app.post("/api/admin/reset")
def admin_reset(db: Session = Depends(get_db)):
    seed_all(db)
    return {"success": True}


@app.post("/api/chat")
def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    agent = CRMAgent(db)
    state = agent.invoke(payload.message, payload.draftState)
    state.databaseState = {
        "interactionsCount": len(list_interactions(db)),
        "hcpsCount": len(list_hcps(db)),
        "followupsCount": len(list_follow_ups(db)),
    }
    return state


dist_dir = Path(__file__).resolve().parent.parent / "dist"
assets_dir = dist_dir / "assets"
if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    index_file = dist_dir / "index.html"
    if index_file.exists() and not full_path.startswith("api/"):
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Not found")
