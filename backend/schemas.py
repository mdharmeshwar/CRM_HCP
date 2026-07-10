from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


IntentLiteral = Literal[
    "log_interaction",
    "edit_interaction",
    "search_hcp",
    "generate_followup",
    "interaction_summary",
    "reset_demo_data",
    "unknown",
]


class UserOut(BaseModel):
    id: str
    name: str
    role: str
    territory: str

    model_config = {"from_attributes": True}


class HCPBase(BaseModel):
    name: str
    hospital: str
    speciality: str
    email: str
    phone: str
    address: str


class HCPCreate(HCPBase):
    pass


class HCPOut(HCPBase):
    id: str

    model_config = {"from_attributes": True}


class ProductOut(BaseModel):
    id: str
    name: str
    category: str
    description: str

    model_config = {"from_attributes": True}


class InteractionBase(BaseModel):
    hcpName: str
    hospital: str = ""
    speciality: str = ""
    date: str
    type: Literal["Meeting", "Call", "Email", "Conference"] = "Meeting"
    summary: str
    productsDiscussed: list[str] = Field(default_factory=list)
    samplesGiven: str = "None"
    followUpRequired: bool = False
    nextMeetingDate: str | None = None
    priority: Literal["Low", "Medium", "High"] = "Medium"
    notes: str = ""


class InteractionCreate(InteractionBase):
    hcpId: str | None = None


class InteractionUpdate(BaseModel):
    hcpName: str | None = None
    hospital: str | None = None
    speciality: str | None = None
    date: str | None = None
    type: Literal["Meeting", "Call", "Email", "Conference"] | None = None
    summary: str | None = None
    productsDiscussed: list[str] | None = None
    samplesGiven: str | None = None
    followUpRequired: bool | None = None
    nextMeetingDate: str | None = None
    priority: Literal["Low", "Medium", "High"] | None = None
    notes: str | None = None


class InteractionOut(InteractionBase):
    id: str
    hcpId: str


class FollowUpOut(BaseModel):
    id: str
    interactionId: str
    hcpId: str
    hcpName: str
    actionItem: str
    dueDate: str
    status: Literal["Pending", "Completed"]


class ActivityLogOut(BaseModel):
    id: str
    action: str
    timestamp: str
    details: str
    user: str


class AnalyticsData(BaseModel):
    totals: dict[str, int]
    typesDistribution: list[dict[str, Any]]
    specialtyDistribution: list[dict[str, Any]]
    weeklyTrend: list[dict[str, Any]]
    productsDiscussed: list[dict[str, Any]]


class ChatRequest(BaseModel):
    message: str
    draftState: dict[str, Any] | None = None


class ChatState(BaseModel):
    userInput: str
    intent: IntentLiteral
    toolToExecute: str
    extractedFields: dict[str, Any] = Field(default_factory=dict)
    toolResult: Any = None
    validationStatus: Literal["valid", "missing_info", "invalid_context"] = "valid"
    clarificationQuestion: str | None = None
    responseText: str
    history: list[str] = Field(default_factory=list)
    databaseState: dict[str, int] | None = None
