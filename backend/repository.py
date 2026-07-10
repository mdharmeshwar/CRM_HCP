from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy.orm import Session

from . import models
from .schemas import HCPCreate, InteractionCreate, InteractionUpdate


def serialize_hcp(hcp: models.HCP) -> dict:
    return {
        "id": hcp.id,
        "name": hcp.name,
        "hospital": hcp.hospital,
        "speciality": hcp.speciality,
        "email": hcp.email,
        "phone": hcp.phone,
        "address": hcp.address,
    }


def serialize_product(product: models.Product) -> dict:
    return {
        "id": product.id,
        "name": product.name,
        "category": product.category,
        "description": product.description,
    }


def serialize_interaction(interaction: models.Interaction) -> dict:
    return {
        "id": interaction.id,
        "hcpId": interaction.hcp_id,
        "hcpName": interaction.hcp_name,
        "hospital": interaction.hospital,
        "speciality": interaction.speciality,
        "date": interaction.date,
        "type": interaction.type,
        "summary": interaction.summary,
        "productsDiscussed": interaction.products_discussed or [],
        "samplesGiven": interaction.samples_given,
        "followUpRequired": interaction.follow_up_required,
        "nextMeetingDate": interaction.next_meeting_date,
        "priority": interaction.priority,
        "notes": interaction.notes,
    }


def serialize_follow_up(follow_up: models.FollowUp) -> dict:
    return {
        "id": follow_up.id,
        "interactionId": follow_up.interaction_id,
        "hcpId": follow_up.hcp_id,
        "hcpName": follow_up.hcp_name,
        "actionItem": follow_up.action_item,
        "dueDate": follow_up.due_date,
        "status": follow_up.status,
    }


def serialize_log(log: models.ActivityLog) -> dict:
    return {
        "id": log.id,
        "action": log.action,
        "timestamp": log.timestamp,
        "details": log.details,
        "user": log.user,
    }


def log_activity(db: Session, action: str, details: str, user: str = "Alex Mercer") -> None:
    db.add(
        models.ActivityLog(
            id=f"log-{uuid4().hex[:10]}",
            action=action,
            timestamp=datetime.utcnow().isoformat(),
            details=details,
            user=user,
        )
    )
    db.commit()


def get_current_user(db: Session) -> models.User | None:
    return db.query(models.User).first()


def list_hcps(db: Session, query: str | None = None) -> list[dict]:
    q = db.query(models.HCP)
    if query:
        like = f"%{query.lower()}%"
        q = q.filter(
            models.HCP.name.ilike(like)
            | models.HCP.hospital.ilike(like)
            | models.HCP.speciality.ilike(like)
        )
    return [serialize_hcp(item) for item in q.order_by(models.HCP.name.asc()).all()]


def get_hcp_by_name(db: Session, name: str) -> models.HCP | None:
    return (
        db.query(models.HCP)
        .filter(models.HCP.name.ilike(name))
        .order_by(models.HCP.name.asc())
        .first()
    )


def get_hcp_by_id(db: Session, hcp_id: str) -> models.HCP | None:
    return db.query(models.HCP).filter(models.HCP.id == hcp_id).first()


def create_hcp(db: Session, payload: HCPCreate) -> dict:
    hcp = models.HCP(id=f"hcp-{uuid4().hex[:8]}", **payload.model_dump())
    db.add(hcp)
    db.commit()
    db.refresh(hcp)
    log_activity(db, "HCP Registered", f"New HCP {hcp.name} added to the directory.")
    return serialize_hcp(hcp)


def list_products(db: Session) -> list[dict]:
    return [serialize_product(item) for item in db.query(models.Product).order_by(models.Product.name.asc()).all()]


def list_interactions(db: Session) -> list[dict]:
    rows = db.query(models.Interaction).order_by(models.Interaction.date.desc(), models.Interaction.id.desc()).all()
    return [serialize_interaction(item) for item in rows]


def get_interaction(db: Session, interaction_id: str) -> models.Interaction | None:
    return db.query(models.Interaction).filter(models.Interaction.id == interaction_id).first()


def _ensure_hcp(db: Session, payload: InteractionCreate) -> models.HCP:
    if payload.hcpId:
        existing = get_hcp_by_id(db, payload.hcpId)
        if existing:
            return existing

    existing = get_hcp_by_name(db, payload.hcpName)
    if existing:
        return existing

    hcp = models.HCP(
        id=f"hcp-{uuid4().hex[:8]}",
        name=payload.hcpName,
        hospital=payload.hospital or "Community General Hospital",
        speciality=payload.speciality or "General Practice",
        email=f"{payload.hcpName.lower().replace(' ', '.').replace('dr.', 'dr')}@hospital.org",
        phone="+1 (555) 010-0000",
        address=f"Territory address for {payload.hcpName}",
    )
    db.add(hcp)
    db.commit()
    db.refresh(hcp)
    return hcp


def create_interaction(db: Session, payload: InteractionCreate) -> dict:
    hcp = _ensure_hcp(db, payload)
    row = models.Interaction(
        id=f"int-{uuid4().hex[:8]}",
        hcp_id=hcp.id,
        hcp_name=hcp.name,
        hospital=payload.hospital or hcp.hospital,
        speciality=payload.speciality or hcp.speciality,
        date=payload.date,
        type=payload.type,
        summary=payload.summary,
        products_discussed=payload.productsDiscussed,
        samples_given=payload.samplesGiven,
        follow_up_required=payload.followUpRequired,
        next_meeting_date=payload.nextMeetingDate,
        priority=payload.priority,
        notes=payload.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    log_activity(db, "Logged Interaction", f"{row.type} with {row.hcp_name} logged.")

    if row.follow_up_required and row.next_meeting_date:
        create_follow_up(
            db,
            interaction=row,
            action_item=f"Follow up with {row.hcp_name} on agreed next steps.",
            due_date=row.next_meeting_date,
            commit=False,
        )
        db.commit()

    return serialize_interaction(row)


def update_interaction(db: Session, interaction_id: str, updates: InteractionUpdate) -> dict | None:
    row = get_interaction(db, interaction_id)
    if not row:
        return None

    data = updates.model_dump(exclude_none=True)
    mapping = {
        "hcpName": "hcp_name",
        "hospital": "hospital",
        "speciality": "speciality",
        "date": "date",
        "type": "type",
        "summary": "summary",
        "productsDiscussed": "products_discussed",
        "samplesGiven": "samples_given",
        "followUpRequired": "follow_up_required",
        "nextMeetingDate": "next_meeting_date",
        "priority": "priority",
        "notes": "notes",
    }
    for key, value in data.items():
        col = mapping.get(key)
        if col:
            setattr(row, col, value)

    db.commit()
    db.refresh(row)
    log_activity(db, "Edited Interaction", f"Updated interaction {interaction_id} for {row.hcp_name}.")
    return serialize_interaction(row)


def list_follow_ups(db: Session) -> list[dict]:
    rows = db.query(models.FollowUp).order_by(models.FollowUp.due_date.asc()).all()
    return [serialize_follow_up(item) for item in rows]


def create_follow_up(
    db: Session,
    interaction: models.Interaction,
    action_item: str,
    due_date: str,
    commit: bool = True,
) -> dict:
    follow_up = models.FollowUp(
        id=f"fup-{uuid4().hex[:8]}",
        interaction_id=interaction.id,
        hcp_id=interaction.hcp_id,
        hcp_name=interaction.hcp_name,
        action_item=action_item,
        due_date=due_date,
        status="Pending",
    )
    db.add(follow_up)
    if commit:
        db.commit()
        db.refresh(follow_up)
        log_activity(db, "Follow-up Created", f"Created follow-up for {interaction.hcp_name}.")
    return serialize_follow_up(follow_up)


def toggle_follow_up(db: Session, follow_up_id: str) -> dict | None:
    row = db.query(models.FollowUp).filter(models.FollowUp.id == follow_up_id).first()
    if not row:
        return None
    row.status = "Completed" if row.status == "Pending" else "Pending"
    db.commit()
    db.refresh(row)
    log_activity(db, "Follow-up Status Updated", f"Set {follow_up_id} to {row.status}.")
    return serialize_follow_up(row)


def list_logs(db: Session) -> list[dict]:
    rows = db.query(models.ActivityLog).order_by(models.ActivityLog.timestamp.desc()).all()
    return [serialize_log(item) for item in rows]


def get_analytics(db: Session) -> dict:
    interactions = db.query(models.Interaction).all()
    hcps = db.query(models.HCP).count()
    pending = db.query(models.FollowUp).filter(models.FollowUp.status == "Pending").count()
    products_total = db.query(models.Product).count()

    type_counts = Counter(item.type for item in interactions)
    speciality_counts = Counter(item.speciality for item in interactions)
    product_counts = Counter()
    date_counts = Counter(item.date[:10] for item in interactions)

    for item in interactions:
        for product in item.products_discussed or []:
            product_counts[product] += 1

    weekly_trend = []
    for offset in range(6, -1, -1):
        day = (datetime.utcnow() - timedelta(days=offset)).date().isoformat()
        weekly_trend.append(
            {
                "date": day[5:],
                "fullDate": day,
                "Interactions": date_counts.get(day, 0),
            }
        )

    return {
        "totals": {
            "interactions": len(interactions),
            "hcps": hcps,
            "pendingFollowups": pending,
            "products": products_total,
        },
        "typesDistribution": [{"name": key, "value": value} for key, value in type_counts.items()],
        "specialtyDistribution": [{"name": key, "count": value} for key, value in speciality_counts.items()],
        "weeklyTrend": weekly_trend,
        "productsDiscussed": [
            {"name": name.split(" ")[0], "fullName": name, "count": count}
            for name, count in product_counts.items()
        ],
    }


def get_db_status(db: Session, database_url: str) -> dict:
    return {
        "connectionDetails": {
            "configured": True,
            "host": database_url.split("@")[-1] if "@" in database_url else "local",
            "database": database_url.rsplit("/", 1)[-1],
            "port": os_port(database_url),
            "status": "Connected",
        },
        "tableCounts": {
            "hcps": db.query(models.HCP).count(),
            "products": db.query(models.Product).count(),
            "interactions": db.query(models.Interaction).count(),
            "followUps": db.query(models.FollowUp).count(),
            "activityLogs": db.query(models.ActivityLog).count(),
        },
        "mysqlCounts": None,
        "timestamp": datetime.utcnow().isoformat(),
    }


def os_port(database_url: str) -> str:
    if ":" not in database_url or "sqlite" in database_url:
        return "local"
    host_part = database_url.split("@")[-1]
    if "/" in host_part:
        host_part = host_part.split("/")[0]
    if ":" in host_part:
        return host_part.rsplit(":", 1)[-1]
    return "default"
