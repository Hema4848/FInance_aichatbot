import json
from pathlib import Path
from typing import List, Optional, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi import UploadFile, File

from .file_utils import extract_text_from_upload



app = FastAPI(title="Finance Chatbot API")

# Allow local frontend opened via file:// (browser) and local dev servers.
# If you host the frontend separately, you can tighten this later.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "data" / "finance_knowledge.json"


def load_topics() -> List[dict]:
    if not DATA_FILE.exists():
        return []
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    return data.get("topics", [])


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


@app.get("/api/topics")
def get_topics():
    return {"topics": load_topics()}


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    msg = (req.message or "").lower().strip()
    topics = load_topics()
    if not topics:
        return ChatResponse(reply="Knowledge base missing. Please check backend/data/finance_knowledge.json")

    # Topic matching: pick the best knowledge-card based on token overlap.
    # This keeps replies more directly related to the user question.
    best = None
    best_score = -1

    # basic tokenizer: keep a-z/0-9, split on whitespace
    import re

    msg_tokens = set(re.findall(r"[a-z0-9]+", msg))

    for t in topics:
        topic = str(t.get("topic", ""))
        explanation = str(t.get("explanation", ""))
        tips = t.get("tips", []) or []
        mistakes = t.get("mistakes", []) or []

        hay = " ".join([topic, explanation, *tips, *mistakes]).lower()
        hay_tokens = set(re.findall(r"[a-z0-9]+", hay))


        # score = overlap size with slight boost for title match
        score = len(msg_tokens & hay_tokens)
        if topic.lower() and topic.lower() in msg:
            score += 3

        if score > best_score:
            best_score = score
            best = t

    if not best:
        best = topics[0]

    # Compose a more explanatory answer from the selected card
    topic = str(best.get('topic', '')).strip()
    explanation = str(best.get('explanation', '')).strip()
    tips = best.get('tips', []) or []
    mistakes = best.get('mistakes', []) or []
    examples = best.get('examples', []) or []

    def take(items, n):
        try:
            return (items or [])[:n]
        except TypeError:
            return []

    top_tips = take(tips, 3)
    top_mistakes = take(mistakes, 3)
    top_examples = take(examples, 2)

    # Light heuristics for “why it matters” (keeps dataset-only approach)
    if explanation:
        why = "Why it matters: " + (
            "Understanding this helps you make better financial decisions and stay consistent over time."
        )
    else:
        why = "Why it matters: This concept helps you plan and improve your personal finances."

    sections = []
    # (Why this is more helpful)
    # Users asked “what should I do / how does this work”. We therefore include:
    # definition -> why it matters -> examples (if present) -> actionable tips -> common mistakes -> next-step checklist.
    if topic:
        sections.append(f"{topic}")


    if explanation:
        sections.append(explanation)

    sections.append(why)

    if top_examples:
        ex_text = "Examples: " + "; ".join([str(x).strip() for x in top_examples if str(x).strip()])
        if ex_text != "Examples: ":
            sections.append(ex_text)

    if top_tips:
        tips_text = "Actionable tips: " + "; ".join([str(x).strip() for x in top_tips if str(x).strip()])
        if tips_text != "Actionable tips: ":
            sections.append(tips_text)

    if top_mistakes:
        mistakes_text = "Common mistakes: " + "; ".join([str(x).strip() for x in top_mistakes if str(x).strip()])
        if mistakes_text != "Common mistakes: ":
            sections.append(mistakes_text)

    # Next-step checklist (always present)
    sections.append(
        "Next step (quick checklist): "
        "1) Review your current situation; "
        "2) Apply 1 tip immediately; "
        "3) Track results for 2–4 weeks."
    )

    reply = "\n\n".join([s for s in sections if s])
    return ChatResponse(reply=reply)



class UploadChatResponse(BaseModel):
    reply: str
    extracted_type: str | None = None


@app.post("/api/upload-chat", response_model=UploadChatResponse)
async def upload_chat(file: UploadFile = File(...), message: str = ""):
    """Extract text from an uploaded file (PDF/DOCX/TXT) and answer via the same dataset-matching logic as /api/chat."""
    raw = await file.read()
    extracted_text, detected_type = extract_text_from_upload(file.filename or "upload", raw)

    user_message = (message or "").strip()
    if not user_message:
        user_message = f"Uploaded file content:\n{extracted_text[:4000]}"
    else:
        user_message = f"{user_message}\n\nUploaded file content:\n{extracted_text[:4000]}"

    # Reuse the topic-matching logic by duplicating the minimal parts here.
    topics = load_topics()
    if not topics:
        return UploadChatResponse(reply="Knowledge base missing. Please check backend/data/finance_knowledge.json", extracted_type=detected_type)

    msg = user_message.lower().strip()
    import re
    msg_tokens = set(re.findall(r"[a-z0-9]+", msg))

    best = None
    best_score = -1
    for t in topics:
        topic = str(t.get("topic", ""))
        explanation = str(t.get("explanation", ""))
        tips = t.get("tips", []) or []
        mistakes = t.get("mistakes", []) or []
        hay = " ".join([topic, explanation, *tips, *mistakes]).lower()
        hay_tokens = set(re.findall(r"[a-z0-9]+", hay))
        score = len(msg_tokens & hay_tokens)
        if topic.lower() and topic.lower() in msg:
            score += 3
        if score > best_score:
            best_score = score
            best = t

    if not best:
        best = topics[0]

    topic = str(best.get('topic', '')).strip()
    explanation = str(best.get('explanation', '')).strip()
    tips = best.get('tips', []) or []
    mistakes = best.get('mistakes', []) or []
    examples = best.get('examples', []) or []

    def take(items, n):
        try:
            return (items or [])[:n]
        except TypeError:
            return []

    top_tips = take(tips, 3)
    top_mistakes = take(mistakes, 3)
    top_examples = take(examples, 2)

    if explanation:
        why = "Why it matters: " + (
            "Understanding this helps you make better financial decisions and stay consistent over time."
        )
    else:
        why = "Why it matters: This concept helps you plan and improve your personal finances."

    sections = []
    if topic:
        sections.append(f"{topic}")
    if explanation:
        sections.append(explanation)
    sections.append(why)

    if top_examples:
        ex_text = "Examples: " + "; ".join([str(x).strip() for x in top_examples if str(x).strip()])
        if ex_text != "Examples: ":
            sections.append(ex_text)

    if top_tips:
        tips_text = "Actionable tips: " + "; ".join([str(x).strip() for x in top_tips if str(x).strip()])
        if tips_text != "Actionable tips: ":
            sections.append(tips_text)

    if top_mistakes:
        mistakes_text = "Common mistakes: " + "; ".join([str(x).strip() for x in top_mistakes if str(x).strip()])
        if mistakes_text != "Common mistakes: ":
            sections.append(mistakes_text)

    sections.append(
        "Next step (quick checklist): "
        "1) Review your current situation; "
        "2) Apply 1 tip immediately; "
        "3) Track results for 2–4 weeks."
    )

    reply = "\n\n".join([s for s in sections if s])
    return UploadChatResponse(reply=reply, extracted_type=detected_type)


class BudgetCalcRequest(BaseModel):
    monthly_income: float

    rent: Optional[float] = 0
    food: Optional[float] = 0
    transport: Optional[float] = 0
    emi: Optional[float] = 0

    subscriptions: Optional[float] = 0
    other_expenses: Optional[float] = 0






class BudgetCalcResponse(BaseModel):
    needs_target: float
    wants_target: float
    savings_target: float

    needs_actual: float
    wants_actual: float
    savings_actual: float

    total_expenses: float
    remaining_amount: float

    needs_ratio: float
    wants_ratio: float
    savings_ratio: float

    budget_health_score: int
    suggestion: str



@app.post("/api/budget-calc", response_model=BudgetCalcResponse)
def budget_calc(req: BudgetCalcRequest):
    """50/30/20 budget calculator."""

    income = max(req.monthly_income, 0.0)

    # Needs = rent + food + transport + emi
    rent = max(req.rent or 0.0, 0.0)
    food = max(req.food or 0.0, 0.0)
    transport = max(req.transport or 0.0, 0.0)
    emi = max(req.emi or 0.0, 0.0)

    # Wants = subscriptions + other_expenses
    subscriptions = max(req.subscriptions or 0.0, 0.0)
    other_expenses = max(req.other_expenses or 0.0, 0.0)

    needs_actual = round(float(rent + food + transport + emi), 2)
    wants_actual = round(float(subscriptions + other_expenses), 2)

    total_expenses = round(float(needs_actual + wants_actual), 2)
    remaining_amount = round(float(income - total_expenses), 2)
    savings_actual = round(remaining_amount, 2)


    # Compute targets using the same 50/30/20 rule.
    needs_target = income * 0.50
    wants_target = income * 0.30
    savings_target = income * 0.20

    def ratio(x: float) -> float:
        return (x / income) if income > 0 else 0.0

    needs_ratio = ratio(rent)
    wants_ratio = ratio(wants_actual)
    # (bugfix) keep variable names consistent

    savings_ratio = ratio(savings_actual)




    # Health scoring (mirrors BudgetCalculator.calculate)
    score = 100.0
    budget_health_score = score

    if income > 0 and total_expenses > income:
        overspend_ratio = min((total_expenses - income) / income, 1.0)
        score -= 35.0 + (25.0 * overspend_ratio)

    needs_target_cmp = round(float(income * 0.50), 2)
    wants_target_cmp = round(float(income * 0.30), 2)
    savings_target_cmp = round(float(income * 0.20), 2)

    if income > 0 and needs_actual > needs_target_cmp:
        needs_over_ratio = min(
            (needs_actual - needs_target_cmp) / needs_target_cmp if needs_target_cmp else 1.0, 1.0
        )
        score -= 20.0 * needs_over_ratio

    if income > 0 and wants_actual > wants_target_cmp:
        wants_over_ratio = min(
            (wants_actual - wants_target_cmp) / wants_target_cmp if wants_target_cmp else 1.0, 1.0
        )
        score -= 15.0 * wants_over_ratio

    if income > 0 and savings_actual < savings_target_cmp:
        savings_shortfall_ratio = min(
            (savings_target_cmp - savings_actual) / savings_target_cmp
            if savings_target_cmp
            else 1.0,
            1.0,
        )
        score -= 20.0 * savings_shortfall_ratio

    score = int(max(0.0, min(100.0, round(score))))

    recommendations: List[str] = []
    if needs_actual > needs_target_cmp:
        recommendations.append(
            "Reduce essential costs where possible, such as renegotiating rent or lowering fixed commitments."
        )
    if wants_actual > wants_target_cmp:
        recommendations.append(
            "Cut discretionary spending such as subscriptions and optional purchases."
        )
    if savings_actual < savings_target_cmp:
        recommendations.append(
            "Increase savings by setting aside a fixed amount before spending on wants."
        )
    if total_expenses > income:
        recommendations.append("Your expenses exceed income, so create a strict expense cap immediately.")

    if score >= 85:
        suggestion = "Your allocation looks on track with the 50/30/20 rule. Keep monitoring monthly."
    elif recommendations:
        suggestion = "Budget health: " + str(score) + ".\n\nTop recommendations:\n- " + "\n- ".join(
            recommendations
        )
    else:
        suggestion = "Your allocation looks close to plan. Review your categories and adjust next month."

    return BudgetCalcResponse(
        needs_target=needs_target,
        wants_target=wants_target,
        savings_target=savings_target,
        needs_actual=needs_actual,
        wants_actual=wants_actual,
        savings_actual=savings_actual,
        total_expenses=total_expenses,
        remaining_amount=remaining_amount,
        needs_ratio=needs_ratio,
        wants_ratio=wants_ratio,
        savings_ratio=savings_ratio,
        budget_health_score=budget_health_score,
        suggestion=suggestion,
    )
