from datetime import datetime, timezone

from sqlmodel import JSON, Column, Field, SQLModel, UniqueConstraint

# Table names default to the lowercased class name with no snake_casing:
# InterviewSession -> "interviewsession", JobDescription -> "jobdescription".
# foreign_key strings below must use those exact names.
#
# Nullability rule: a column is nullable iff its value is produced by a later
# step than row creation (an AI call or a user answer that hasn't happened yet).


class Resume(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    filename: str
    raw_text: str
    profile_json: dict | None = Field(default=None, sa_column=Column(JSON))


class JobDescription(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    raw_text: str
    profile_json: dict | None = Field(default=None, sa_column=Column(JSON))


class InterviewSession(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    resume_id: int = Field(foreign_key="resume.id")
    jd_id: int = Field(foreign_key="jobdescription.id")
    gap_analysis_json: dict | None = Field(default=None, sa_column=Column(JSON))
    status: str = Field(default="pending")  # "pending" | "in_progress" | "completed"
    question_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Turn(SQLModel, table=True):
    # Guards the read-modify-write race in submit_answer: two concurrent
    # requests both reading the same pending turn can no longer both insert
    # the "next" turn_index — the second insert fails cleanly instead of
    # silently creating two current questions.
    __table_args__ = (UniqueConstraint("session_id", "turn_index", name="uq_turn_session_index"),)

    id: int | None = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="interviewsession.id")
    turn_index: int
    question: str
    answer: str | None = Field(default=None)
    targets: list | None = Field(default=None, sa_column=Column(JSON))
    is_followup: bool = Field(default=False)
    # The agent decides "this is the last question" when it asks the question,
    # but the answer that lets us act on it arrives in a later, separate HTTP
    # request. Persisting the flag lets us honor it then without a second model
    # call whose question we'd throw away.
    should_end: bool = Field(default=False)


class Report(SQLModel, table=True):
    # A Report row is only inserted once generation succeeds, so all fields
    # are known at insert time and therefore required.
    id: int | None = Field(default=None, primary_key=True)
    # unique=True: guards the check-then-insert race in get_report — only one
    # of two concurrent "generate the report" requests can win the insert.
    session_id: int = Field(foreign_key="interviewsession.id", unique=True)
    overall_score: int
    summary: str
    strengths_json: list = Field(sa_column=Column(JSON))
    gaps_json: list = Field(sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ApiUsage(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    call_type: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
