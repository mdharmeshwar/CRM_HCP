from __future__ import annotations

from sqlalchemy import JSON, Boolean, Column, String, Text

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    role = Column(String(255), nullable=False)
    territory = Column(String(255), nullable=False)


class HCP(Base):
    __tablename__ = "hcps"

    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    hospital = Column(String(255), nullable=False)
    speciality = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    address = Column(Text, nullable=False)


class Product(Base):
    __tablename__ = "products"

    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    category = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)


class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(String(50), primary_key=True)
    hcp_id = Column(String(50), nullable=False)
    hcp_name = Column(String(255), nullable=False)
    hospital = Column(String(255), nullable=False)
    speciality = Column(String(255), nullable=False)
    date = Column(String(30), nullable=False)
    type = Column(String(50), nullable=False)
    summary = Column(Text, nullable=False)
    products_discussed = Column(JSON, nullable=False, default=list)
    samples_given = Column(Text, nullable=False, default="None")
    follow_up_required = Column(Boolean, nullable=False, default=False)
    next_meeting_date = Column(String(30), nullable=True)
    priority = Column(String(20), nullable=False, default="Medium")
    notes = Column(Text, nullable=False, default="")


class FollowUp(Base):
    __tablename__ = "follow_ups"

    id = Column(String(50), primary_key=True)
    interaction_id = Column(String(50), nullable=False)
    hcp_id = Column(String(50), nullable=False)
    hcp_name = Column(String(255), nullable=False)
    action_item = Column(Text, nullable=False)
    due_date = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False, default="Pending")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String(50), primary_key=True)
    action = Column(String(255), nullable=False)
    timestamp = Column(String(50), nullable=False)
    details = Column(Text, nullable=False)
    user = Column(String(255), nullable=False)
