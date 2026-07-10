from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta
from typing import Any, Literal, TypedDict

from langchain_groq import ChatGroq
from langgraph.graph import END, StateGraph
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from . import models, repository
from .schemas import ChatState, InteractionCreate, InteractionUpdate


class ExtractionResult(BaseModel):
    intent: Literal[
        "log_interaction",
        "edit_interaction",
        "search_hcp",
        "generate_followup",
        "interaction_summary",
        "reset_demo_data",
        "unknown",
    ] = "unknown"
    hcpName: str | None = None
    hospital: str | None = None
    speciality: str | None = None
    date: str | None = None
    time: str | None = None
    type: Literal["Meeting", "Call", "Email", "Conference"] | None = None
    summary: str | None = None
    productsDiscussed: list[str] = Field(default_factory=list)
    samplesGiven: str | None = None
    followUpRequired: bool | None = None
    nextMeetingDate: str | None = None
    priority: Literal["Low", "Medium", "High"] | None = None
    notes: str | None = None
    id: str | None = None
    query: str | None = None
    updates: dict[str, Any] = Field(default_factory=dict)


class FollowUpSuggestion(BaseModel):
    actionItem: str
    suggestedDate: str
    justification: str
    clinicalValue: str


class SummaryResult(BaseModel):
    executiveSummary: str
    risks: list[str]
    opportunities: list[str]
    insights: list[str]


class AgentGraphState(TypedDict, total=False):
    user_input: str
    draft_state: dict[str, Any]
    intent: str
    tool_name: str
    extracted_fields: dict[str, Any]
    tool_result: Any
    validation_status: str
    clarification_question: str | None
    response_text: str
    history: list[str]


PRODUCT_HINTS = [
    "CardioProtect (Lisinopril)",
    "GlycaStop (Metformin XR)",
    "OncoShield (Trastuzumab)",
    "LipidDown (Atorvastatin)",
    "PulmoClear (Albuterol)",
]


def _get_llm() -> ChatGroq | None:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    return ChatGroq(model=os.getenv("GROQ_MODEL", "gemma2-9b-it"), api_key=api_key, temperature=0)


def _normalize_time(raw: str) -> str | None:
    value = raw.strip().lower().replace(".", "")
    match_12 = re.search(r"\b(1[0-2]|0?\d)(?::([0-5]\d))?\s*(am|pm)\b", value)
    if match_12:
        hour = int(match_12.group(1))
        minute = int(match_12.group(2) or 0)
        period = match_12.group(3)
        if period == "pm" and hour != 12:
            hour += 12
        if period == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"

    match_24 = re.search(r"\b([01]?\d|2[0-3]):([0-5]\d)\b", value)
    if match_24:
        hour = int(match_24.group(1))
        minute = int(match_24.group(2))
        return f"{hour:02d}:{minute:02d}"
    return None


def _extract_date_and_time(text: str) -> tuple[str | None, str | None]:
    lowered = text.lower()
    extracted_date = _extract_date(lowered)
    # _extract_date already returns None when nothing is found
    extracted_time = _normalize_time(text)
    return extracted_date, extracted_time


def _merge_with_draft(result: ExtractionResult, draft_state: dict[str, Any] | None) -> ExtractionResult:
    # If the user is editing an already saved database record, do NOT merge
    # with the current screen's new interaction log form draft!
    if result.intent == "edit_interaction":
        # Copy top-level fields to updates for safety (e.g. if LLM returned them directly)
        for field in [
            "hcpName", "hospital", "speciality", "date", "time", 
            "type", "summary", "productsDiscussed", "samplesGiven", 
            "followUpRequired", "nextMeetingDate", "priority", "notes"
        ]:
            val = getattr(result, field, None)
            if val not in (None, "", []):
                result.updates[field] = val
        return result

    if not draft_state:
        return result

    for field in [
        "hcpName",
        "hospital",
        "speciality",
        "date",
        "time",
        "type",
        "summary",
        "samplesGiven",
        "nextMeetingDate",
        "priority",
        "notes",
    ]:
        if getattr(result, field, None) in (None, "") and draft_state.get(field):
            setattr(result, field, draft_state.get(field))

    if not result.productsDiscussed and draft_state.get("productsDiscussed"):
        result.productsDiscussed = list(draft_state["productsDiscussed"])

    if result.followUpRequired is None and "followUpRequired" in draft_state:
        result.followUpRequired = bool(draft_state["followUpRequired"])

    return result


def _heuristic_extract(message: str, db: Session, draft_state: dict[str, Any] | None = None) -> ExtractionResult:
    text = message.strip()
    lowered = text.lower()
    result = ExtractionResult(intent="unknown")
    is_refinement = any(
        term in lowered
        for term in [
            "edit",
            "update",
            "change",
            "modify",
            "make the",
            "set the",
            "schedule the next",
            "next meeting",
            "follow up",
            "follow-up",
        ]
    )

    if "reset" in lowered and "seed" in lowered:
        result.intent = "reset_demo_data"
        return result

    if any(term in lowered for term in ["summary", "report", "insight", "analytics"]):
        result.intent = "interaction_summary"
        return result

    if any(term in lowered for term in ["follow up", "follow-up", "next step"]) and "int-" in lowered:
        result.intent = "generate_followup"
        match = re.search(r"(int-[a-zA-Z0-9]+)", text)
        result.id = match.group(1) if match else None
        return result

    if any(term in lowered for term in ["search", "find", "lookup"]):
        result.intent = "search_hcp"
        result.query = text.split()[-1]
        return result

    if any(term in lowered for term in ["edit", "update", "change", "modify"]):
        has_saved_interaction_ref = "int-" in lowered
        result.intent = "edit_interaction" if has_saved_interaction_ref else "log_interaction"
        match = re.search(r"(int-[a-zA-Z0-9]+)", text)
        result.id = match.group(1) if match else None
        
        # Priority mapping
        if "priority" in lowered:
            val = "High" if "high" in lowered else ("Low" if "low" in lowered else "Medium")
            if result.intent == "edit_interaction":
                result.updates["priority"] = val
            else:
                result.priority = val

        # Summary mapping
        if "summary" in lowered:
            if result.intent == "edit_interaction":
                result.updates["summary"] = text
            else:
                result.summary = text

        # Date mapping
        extracted_date, extracted_time = _extract_date_and_time(text)
        if result.intent == "edit_interaction":
            if extracted_date:
                if any(term in lowered for term in ["next meeting", "follow up", "follow-up"]):
                    result.updates["nextMeetingDate"] = extracted_date
                    result.updates["followUpRequired"] = True
                else:
                    result.updates["date"] = extracted_date
            if extracted_time:
                result.updates["time"] = extracted_time
        else:
            if extracted_date:
                if any(term in lowered for term in ["next meeting", "follow up", "follow-up"]):
                    result.nextMeetingDate = extracted_date
                    result.followUpRequired = True
                else:
                    result.date = extracted_date
            result.time = extracted_time

        # CRITICAL: If intent is edit_interaction, copy any top-level fields extracted directly into updates dict
        if result.intent == "edit_interaction":
            for field in [
                "hcpName", "hospital", "speciality", "date", "time", 
                "type", "summary", "productsDiscussed", "samplesGiven", 
                "followUpRequired", "nextMeetingDate", "priority", "notes"
            ]:
                val = getattr(result, field, None)
                if val not in (None, "", []):
                    result.updates[field] = val

        return _merge_with_draft(result, draft_state)

    result.intent = "log_interaction"
    hcps = repository.list_hcps(db)
    for hcp in hcps:
        if hcp["name"].lower() in lowered or hcp["name"].split()[-1].lower() in lowered:
            result.hcpName = hcp["name"]
            result.hospital = hcp["hospital"]
            result.speciality = hcp["speciality"]
            break

    if not result.hcpName:
        doctor_match = re.search(r"dr\.?\s+[A-Z][a-z]+\s*[A-Z]?[a-z]*", text)
        if doctor_match:
            result.hcpName = doctor_match.group(0).strip()

    if "call" in lowered:
        result.type = "Call"
    elif "email" in lowered:
        result.type = "Email"
    elif "conference" in lowered or "summit" in lowered:
        result.type = "Conference"
    elif not draft_state or not draft_state.get("type"):
        result.type = "Meeting"

    for product in PRODUCT_HINTS:
        if product.split(" ")[0].lower() in lowered:
            result.productsDiscussed.append(product)

    if "high" in lowered or "urgent" in lowered:
        result.priority = "High"
    elif "low" in lowered:
        result.priority = "Low"
    elif "medium" in lowered:
        result.priority = "Medium"
    result.followUpRequired = "follow up" in lowered or "follow-up" in lowered or "next meeting" in lowered
    result.samplesGiven = "None"
    result.summary = draft_state.get("summary") if is_refinement and draft_state else text
    result.notes = draft_state.get("notes") if is_refinement and draft_state else "Heuristic extraction used."
    result.date, result.time = _extract_date_and_time(text)
    if result.followUpRequired and result.date:
        result.nextMeetingDate = result.date
        result.date = draft_state.get("date") if draft_state else None
    if not result.date and draft_state and draft_state.get("date"):
        result.date = draft_state["date"]
    if not result.time and draft_state and draft_state.get("time"):
        result.time = draft_state["time"]
    if not result.date:
        result.date = datetime.utcnow().date().isoformat()
    if result.followUpRequired:
        result.nextMeetingDate = result.nextMeetingDate or (datetime.utcnow() + timedelta(days=14)).date().isoformat()
    return _merge_with_draft(result, draft_state)


def _extract_date(lowered: str) -> str | None:
    iso_match = re.search(r"(20\d{2}-\d{2}-\d{2})", lowered)
    if iso_match:
        return iso_match.group(1)
    if "yesterday" in lowered:
        return (datetime.utcnow() - timedelta(days=1)).date().isoformat()
    if "tomorrow" in lowered:
        return (datetime.utcnow() + timedelta(days=1)).date().isoformat()
    return None


def _extract_with_llm(message: str, db: Session, draft_state: dict[str, Any] | None = None) -> ExtractionResult:
    llm = _get_llm()
    if not llm:
        return _heuristic_extract(message, db, draft_state)

    available_hcps = repository.list_hcps(db)
    prompt = (
        "You are an AI-first life-sciences CRM assistant. "
        "Classify the request and extract CRM fields for a single action.\n"
        "Valid intents: log_interaction, edit_interaction, search_hcp, generate_followup, "
        "interaction_summary, reset_demo_data, unknown.\n"
        "If the user is correcting or refining the current unsaved interaction draft "
        "(for example changing date, time, priority, type, notes, products, or follow-up), "
        "treat it as log_interaction, not edit_interaction.\n"
        "If a current draft is provided, use it as context and preserve existing values unless the user changes them.\n"
        "Use these known HCPs when matching names:\n"
        f"{json.dumps(available_hcps)}\n"
        f"Current draft: {json.dumps(draft_state or {})}\n"
        "Return only the structured schema."
    )

    try:
        structured = llm.with_structured_output(ExtractionResult)
        return _merge_with_draft(structured.invoke(f"{prompt}\nUser request: {message}"), draft_state)
    except Exception:
        return _heuristic_extract(message, db, draft_state)


def _generate_followup_suggestion(interaction: dict, db: Session) -> dict:
    llm = _get_llm()
    fallback = {
        "actionItem": f"Follow up with {interaction['hcpName']} on objections.",
        "suggestedDate": interaction.get("nextMeetingDate") or (datetime.utcnow() + timedelta(days=14)).date().isoformat(),
        "justification": "Maintain two-week scientific engagement cadence.",
        "clinicalValue": "Supports evidence follow-through and formulary adoption.",
    }
    if not llm:
        return fallback

    try:
        structured = llm.with_structured_output(FollowUpSuggestion)
        prompt = (
            "Create a concise HCP follow-up plan for a field representative. "
            "Keep each field short and action-oriented.\n"
            f"Interaction: {json.dumps(interaction)}"
        )
        return structured.invoke(prompt).model_dump()
    except Exception:
        return fallback


def _generate_summary(db: Session) -> dict:
    llm = _get_llm()
    interactions = repository.list_interactions(db)[:10]
    fallback = {
        "executiveSummary": "Recent engagement is concentrated in cardiology and oncology with healthy follow-up volume.",
        "risks": ["Several follow-ups are still pending.", "Product mix is concentrated in a small set of brands.", "Some notes are brief and need richer detail."],
        "opportunities": ["Prioritize high-intent cardiology accounts.", "Convert pending follow-ups into scheduled scientific calls.", "Expand oncology evidence-sharing touchpoints."],
        "insights": ["Meetings drive the deepest notes.", "High-priority interactions correlate with follow-up creation.", "Cardiology appears most engaged in current data."],
    }
    if not llm:
        return fallback

    try:
        structured = llm.with_structured_output(SummaryResult)
        prompt = (
            "You are a commercial excellence lead summarizing CRM activity for life-sciences field reps. "
            "Create a concise executive summary with risks, opportunities, and insights.\n"
            f"Interactions: {json.dumps(interactions)}"
        )
        return structured.invoke(prompt).model_dump()
    except Exception:
        return fallback


class CRMAgent:
    def __init__(self, db: Session):
        self.db = db
        self.graph = self._build_graph()

    def _build_graph(self):
        workflow = StateGraph(AgentGraphState)
        workflow.add_node("analyze", self._analyze)
        workflow.add_node("validate", self._validate)
        workflow.add_node("log_interaction", self._log_interaction)
        workflow.add_node("edit_interaction", self._edit_interaction)
        workflow.add_node("search_hcp", self._search_hcp)
        workflow.add_node("generate_followup", self._generate_followup)
        workflow.add_node("interaction_summary", self._interaction_summary)
        workflow.add_node("reset_demo_data", self._reset_demo_data)
        workflow.add_node("respond", self._respond)
        workflow.set_entry_point("analyze")
        workflow.add_edge("analyze", "validate")
        workflow.add_conditional_edges(
            "validate",
            self._route,
            {
                "log_interaction": "log_interaction",
                "edit_interaction": "edit_interaction",
                "search_hcp": "search_hcp",
                "generate_followup": "generate_followup",
                "interaction_summary": "interaction_summary",
                "reset_demo_data": "reset_demo_data",
                "respond": "respond",
            },
        )
        for node in [
            "log_interaction",
            "edit_interaction",
            "search_hcp",
            "generate_followup",
            "interaction_summary",
            "reset_demo_data",
        ]:
            workflow.add_edge(node, "respond")
        workflow.add_edge("respond", END)
        return workflow.compile()

    def invoke(self, message: str, draft_state: dict[str, Any] | None = None) -> ChatState:
        result = self.graph.invoke(
            {
                "user_input": message,
                "draft_state": draft_state or {},
                "history": [],
                "tool_result": None,
                "response_text": "",
                "validation_status": "valid",
            }
        )
        return ChatState(
            userInput=message,
            intent=result.get("intent", "unknown"),
            toolToExecute=result.get("tool_name", ""),
            extractedFields=result.get("extracted_fields", {}),
            toolResult=result.get("tool_result"),
            validationStatus=result.get("validation_status", "valid"),
            clarificationQuestion=result.get("clarification_question"),
            responseText=result.get("response_text", "Request processed."),
            history=result.get("history", []),
        )

    def _analyze(self, state: AgentGraphState) -> AgentGraphState:
        extraction = _extract_with_llm(state["user_input"], self.db, state.get("draft_state"))
        history = state.get("history", []) + ["intent_and_extraction"]
        return {
            "intent": extraction.intent,
            "tool_name": extraction.intent,
            "extracted_fields": extraction.model_dump(exclude_none=True),
            "history": history,
        }

    def _validate(self, state: AgentGraphState) -> AgentGraphState:
        history = state.get("history", []) + ["validation"]
        fields = state.get("extracted_fields", {})
        if state.get("intent") == "log_interaction" and not fields.get("hcpName"):
            return {
                "validation_status": "missing_info",
                "clarification_question": "Please tell me which HCP you met so I can log the interaction correctly.",
                "history": history,
            }
        return {"validation_status": "valid", "history": history}

    def _route(self, state: AgentGraphState) -> str:
        if state.get("validation_status") != "valid":
            return "respond"
        return state.get("intent", "respond")

    def _log_interaction(self, state: AgentGraphState) -> AgentGraphState:
        history = state.get("history", []) + ["log_interaction_tool"]
        fields = state.get("extracted_fields", {})
        interaction = {
            "id": fields.get("id") or "draft-interaction",
            "hcpId": fields.get("hcpId") or state.get("draft_state", {}).get("hcpId", ""),
            "hcpName": fields["hcpName"],
            "hospital": fields.get("hospital") or "",
            "speciality": fields.get("speciality") or "",
            "date": fields.get("date") or state.get("draft_state", {}).get("date") or datetime.utcnow().date().isoformat(),
            "time": fields.get("time") or state.get("draft_state", {}).get("time") or "",
            "type": fields.get("type") or "Meeting",
            "summary": fields.get("summary") or state["user_input"],
            "productsDiscussed": fields.get("productsDiscussed") or [],
            "samplesGiven": fields.get("samplesGiven") or "None",
            "followUpRequired": fields.get("followUpRequired") if fields.get("followUpRequired") is not None else False,
            "nextMeetingDate": fields.get("nextMeetingDate"),
            "priority": fields.get("priority") or "Medium",
            "notes": fields.get("notes") or "",
        }
        return {"tool_result": {"success": True, "interaction": interaction, "draftOnly": True}, "history": history}

    def _edit_interaction(self, state: AgentGraphState) -> AgentGraphState:
        history = state.get("history", []) + ["edit_interaction_tool"]
        fields = state.get("extracted_fields", {})
        interaction_id = fields.get("id")
        if not interaction_id:
            latest = repository.list_interactions(self.db)
            interaction_id = latest[0]["id"] if latest else None
        if not interaction_id:
            return {"tool_result": {"success": False, "interaction": None}, "history": history}
        updated = repository.update_interaction(self.db, interaction_id, InteractionUpdate(**fields.get("updates", {})))
        return {"tool_result": {"success": bool(updated), "interaction": updated}, "history": history}

    def _search_hcp(self, state: AgentGraphState) -> AgentGraphState:
        history = state.get("history", []) + ["search_hcp_tool"]
        fields = state.get("extracted_fields", {})
        results = repository.list_hcps(self.db, fields.get("query") or state["user_input"])
        return {"tool_result": {"success": True, "results": results}, "history": history}

    def _generate_followup(self, state: AgentGraphState) -> AgentGraphState:
        history = state.get("history", []) + ["generate_followup_tool"]
        fields = state.get("extracted_fields", {})
        interaction_id = fields.get("id")
        if not interaction_id:
            latest = repository.list_interactions(self.db)
            interaction_id = latest[0]["id"] if latest else None
        if not interaction_id:
            return {"tool_result": {"success": False, "followUp": None, "suggestions": None}, "history": history}
        interaction_row = repository.get_interaction(self.db, interaction_id)
        if not interaction_row:
            return {"tool_result": {"success": False, "followUp": None, "suggestions": None}, "history": history}
        interaction = repository.serialize_interaction(interaction_row)
        suggestion = _generate_followup_suggestion(interaction, self.db)
        follow_up = repository.create_follow_up(
            self.db,
            interaction_row,
            action_item=suggestion["actionItem"],
            due_date=suggestion["suggestedDate"],
        )
        return {"tool_result": {"success": True, "followUp": follow_up, "suggestions": suggestion}, "history": history}

    def _interaction_summary(self, state: AgentGraphState) -> AgentGraphState:
        history = state.get("history", []) + ["interaction_summary_tool"]
        summary = _generate_summary(self.db)
        return {"tool_result": {"success": True, **summary}, "history": history}

    def _reset_demo_data(self, state: AgentGraphState) -> AgentGraphState:
        history = state.get("history", []) + ["reset_demo_data_tool"]
        from .seed import seed_all

        seed_all(self.db)
        return {"tool_result": {"success": True, "message": "Demo data reset."}, "history": history}

    def _respond(self, state: AgentGraphState) -> AgentGraphState:
        history = state.get("history", []) + ["response"]
        if state.get("validation_status") != "valid":
            return {
                "response_text": state.get("clarification_question") or "I need a bit more information to continue.",
                "history": history,
            }

        intent = state.get("intent")
        tool_result = state.get("tool_result")
        if intent == "log_interaction":
            text = "I updated the interaction draft and synced the form fields, including date and time changes."
        elif intent == "edit_interaction":
            text = "I updated the saved interaction."
        elif intent == "search_hcp":
            count = len(tool_result.get("results", [])) if tool_result else 0
            text = f"I found {count} matching HCP record(s)."
        elif intent == "generate_followup":
            text = "I generated and saved a follow-up action."
        elif intent == "interaction_summary":
            text = "I prepared the executive CRM summary."
        elif intent == "reset_demo_data":
            text = "I reset the demo data."
        else:
            text = "I processed the request, but I need a clearer CRM action."
        return {"response_text": text, "history": history}
