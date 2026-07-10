"""Interview turn logic: produce the next question, and decide when to stop.

The agent is stateless per call — it receives the gap analysis plus the
conversation so far and returns one InterviewTurn. Termination is a hybrid rule
enforced in code (`should_end_interview`), not left entirely to the model.
"""

from app.agent.client import call_structured
from app.schemas import GapAnalysis, InterviewTurn

# Hybrid termination bounds (from PLAN.md): always ask at least MIN, never exceed MAX;
# between the two, honor the agent's own should_end flag.
MIN_QUESTIONS = 5
MAX_QUESTIONS = 12

INTERVIEW_SYSTEM = (
    "You are an adaptive interview agent for a caregiver role. You receive a gap "
    "analysis and the interview so far, and you produce the single next question.\n"
    "Rules:\n"
    "- Ask exactly one question. Never combine multiple questions into one turn.\n"
    '- Every question must target a specific gap-analysis item. Put its id in `targets` '
    'using the format "<list>:<index>", e.g. "weak_or_missing:0" or "claims_to_verify:1".\n'
    "- Work through gaps by priority: cover all high-priority weak_or_missing items "
    "first, then medium, then low, then claims_to_verify.\n"
    "- If the candidate's most recent answer was vague, generic, or evasive, set "
    "is_followup to true and ask one clarifying follow-up on the same gap. Ask at most "
    "one follow-up per gap.\n"
    "- Set should_end to true only once the important gaps have been covered.\n"
    "- `reasoning` is one internal sentence and is never shown to the candidate.\n"
    "- `coverage_notes` is a short running summary of what has been covered so far."
)


def format_history(history: list[dict]) -> str:
    """Render a list of {'question', 'answer'} dicts as a readable transcript."""
    if not history:
        return "(no questions asked yet)"
    return "\n\n".join(
        f"Q{i + 1}: {turn['question']}\nA{i + 1}: {turn['answer']}"
        for i, turn in enumerate(history)
    )


def next_turn(
    gap_analysis: GapAnalysis, history: list[dict], question_count: int
) -> InterviewTurn:
    user_prompt = (
        "Gap analysis:\n"
        + gap_analysis.model_dump_json(indent=2)
        + f"\n\nInterview so far ({question_count} questions asked):\n"
        + format_history(history)
    )
    return call_structured(
        call_type="interview_turn",
        system=INTERVIEW_SYSTEM,
        user_prompt=user_prompt,
        schema=InterviewTurn,
        max_tokens=400,
        # In mock mode this selects the scripted turn for the current position;
        # ignored in real mode.
        mock_name=f"interview_turn_{len(history)}",
    )


def should_end_interview(turn: InterviewTurn, question_count: int) -> bool:
    """Decide whether to stop, given the latest turn and how many have been asked."""
    if question_count < MIN_QUESTIONS:
        return False
    if question_count >= MAX_QUESTIONS:
        return True
    return turn.should_end
