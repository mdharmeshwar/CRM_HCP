from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from . import models


DEFAULT_USER = {
    "id": "u-1",
    "name": "Alex Mercer",
    "role": "Senior Specialty Care Representative",
    "territory": "Pacific Northwest Division",
}

DEFAULT_HCPS = [
    {
        "id": "hcp-1",
        "name": "Dr. Sarah Jenkins",
        "hospital": "Metro Cardiology Center",
        "speciality": "Cardiology",
        "email": "sjenkins@metrocardio.org",
        "phone": "+1 (555) 019-2834",
        "address": "742 Evergreen Terrace, Suite 300, Portland, OR",
    },
    {
        "id": "hcp-2",
        "name": "Dr. Robert Chen",
        "hospital": "City Cancer Institute",
        "speciality": "Oncology",
        "email": "r.chen@citycancer.org",
        "phone": "+1 (555) 014-9821",
        "address": "910 Cancer Care Blvd, Wing B, Seattle, WA",
    },
    {
        "id": "hcp-3",
        "name": "Dr. Michael Patel",
        "hospital": "Summit Endocrinology Clinic",
        "speciality": "Endocrinology",
        "email": "mpatel@summitendo.com",
        "phone": "+1 (555) 023-8833",
        "address": "1200 Summit View Dr, Seattle, WA",
    },
    {
        "id": "hcp-4",
        "name": "Dr. Emily Vance",
        "hospital": "St. Jude Children's Research Annex",
        "speciality": "Pediatrics",
        "email": "evance@stjude-annex.org",
        "phone": "+1 (555) 018-4422",
        "address": "450 Hope Lane, Portland, OR",
    },
]

DEFAULT_PRODUCTS = [
    {
        "id": "p-1",
        "name": "CardioProtect (Lisinopril)",
        "category": "Cardiovascular",
        "description": "ACE inhibitor for hypertension and heart failure.",
    },
    {
        "id": "p-2",
        "name": "GlycaStop (Metformin XR)",
        "category": "Diabetes/Endocrinology",
        "description": "Extended-release oral hypoglycemic therapy.",
    },
    {
        "id": "p-3",
        "name": "OncoShield (Trastuzumab)",
        "category": "Oncology",
        "description": "HER2-positive targeted therapy.",
    },
    {
        "id": "p-4",
        "name": "LipidDown (Atorvastatin)",
        "category": "Cardiovascular",
        "description": "High-intensity statin for lipid management.",
    },
    {
        "id": "p-5",
        "name": "PulmoClear (Albuterol)",
        "category": "Pulmonology",
        "description": "Rapid-acting bronchodilator therapy.",
    },
]

DEFAULT_INTERACTIONS = [
    {
        "id": "int-1",
        "hcp_id": "hcp-1",
        "hcp_name": "Dr. Sarah Jenkins",
        "hospital": "Metro Cardiology Center",
        "speciality": "Cardiology",
        "date": "2026-07-01",
        "type": "Meeting",
        "summary": "Reviewed new CardioProtect data, renal safety, and pediatric opportunity.",
        "products_discussed": ["CardioProtect (Lisinopril)", "LipidDown (Atorvastatin)"],
        "samples_given": "CardioProtect starter kits x10, LipidDown samples x5",
        "follow_up_required": True,
        "next_meeting_date": "2026-07-15",
        "priority": "High",
        "notes": "Requested pediatric study PDF. Strong conversion potential.",
    },
    {
        "id": "int-2",
        "hcp_id": "hcp-2",
        "hcp_name": "Dr. Robert Chen",
        "hospital": "City Cancer Institute",
        "speciality": "Oncology",
        "date": "2026-07-03",
        "type": "Call",
        "summary": "Confirmed OncoShield formulary availability with outpatient pharmacy.",
        "products_discussed": ["OncoShield (Trastuzumab)"],
        "samples_given": "None",
        "follow_up_required": False,
        "next_meeting_date": None,
        "priority": "Medium",
        "notes": "Formulary approval confirmed.",
    },
]

DEFAULT_FOLLOW_UPS = [
    {
        "id": "fup-1",
        "interaction_id": "int-1",
        "hcp_id": "hcp-1",
        "hcp_name": "Dr. Sarah Jenkins",
        "action_item": "Send pediatric clinical trial PDF and replenish kits.",
        "due_date": "2026-07-15",
        "status": "Pending",
    }
]

DEFAULT_ACTIVITY_LOGS = [
    {
        "id": "log-1",
        "action": "Logged Interaction",
        "timestamp": "2026-07-01T14:30:00Z",
        "details": "Representative logged an in-person meeting with Dr. Sarah Jenkins.",
        "user": "Alex Mercer",
    }
]


def seed_if_empty(db: Session) -> None:
    if db.query(models.User).first():
        return
    seed_all(db)


def seed_all(db: Session) -> None:
    for table in [
        models.ActivityLog,
        models.FollowUp,
        models.Interaction,
        models.Product,
        models.HCP,
        models.User,
    ]:
        db.query(table).delete()
    db.add(models.User(**DEFAULT_USER))
    db.add_all(models.HCP(**row) for row in DEFAULT_HCPS)
    db.add_all(models.Product(**row) for row in DEFAULT_PRODUCTS)
    db.add_all(models.Interaction(**row) for row in DEFAULT_INTERACTIONS)
    db.add_all(models.FollowUp(**row) for row in DEFAULT_FOLLOW_UPS)
    db.add_all(models.ActivityLog(**row) for row in DEFAULT_ACTIVITY_LOGS)
    db.add(
        models.ActivityLog(
            id="log-seed",
            action="Seeded Demo Data",
            timestamp=datetime.utcnow().isoformat(),
            details="Reset demo CRM records to baseline seed set.",
            user="System",
        )
    )
    db.commit()
