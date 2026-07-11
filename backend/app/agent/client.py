"""The single gateway between the agent modules and the Anthropic API.

Every LLM call in the app goes through `call_structured` — no agent module ever
constructs an Anthropic client or calls the API itself. Centralizing here keeps
the cross-cutting rules in exactly one place instead of copied across the four
agent modules, where one stale copy would be a silent bug:

- the AI_MOCK switch, so development stays at zero API spend;
- token cost logging to the ApiUsage table with a running cumulative total;
- reading the key from SIGMA_ANTHROPIC_API_KEY (never ANTHROPIC_API_KEY);
- forced tool use, output validation, and one retry on a schema mismatch.

The output shapes themselves live in `schemas.py`; this module only *enforces*
them. `call_structured` has two paths:

- Mock mode (the default): read a fixture from `mocks/`, validate it against the
  requested schema, and return it. The Anthropic client is never constructed and
  the key is never read, so the pipeline runs with no key and nothing billed.
- Real mode (`AI_MOCK=false`): force the model to call a tool whose input schema
  is the requested Pydantic model, log the token cost, validate, and return an
  instance.
"""

import json
import os
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel, ValidationError
from sqlalchemy import func
from sqlmodel import Session, select

from app.db import engine
from app.models import ApiUsage

MODEL = "claude-haiku-4-5"
# Haiku 4.5 list price, in dollars per million tokens.
INPUT_PRICE_PER_MTOK = 1.00
OUTPUT_PRICE_PER_MTOK = 5.00
MOCKS_DIR = Path(__file__).parent.parent / "mocks"

# Bound to BaseModel so callers get their exact schema type back, not a bare BaseModel.
T = TypeVar("T", bound=BaseModel)

# The Anthropic client is expensive to build and only needed in real mode, so it
# is constructed lazily and cached here on first use.
_client = None


class AgentError(Exception):
    """An LLM call failed in a way the caller can't recover from in-process.

    Every failure mode of call_structured (API error, no tool_use block, schema
    mismatch surviving the retry) raises this one type, so routes never need to
    know which. main.py maps it to a single clean HTTP response instead of a
    raw 500 stack trace.
    """


def _is_mock() -> bool:
    # Mock is the default; only the explicit string "false" turns it off.
    return os.environ.get("AI_MOCK", "true").lower() != "false"


def _get_client():
    global _client
    if _client is None:
        # Imported here so mock mode never needs the anthropic package configured.
        from anthropic import Anthropic

        # Hard rule: read SIGMA_ANTHROPIC_API_KEY explicitly, never ANTHROPIC_API_KEY,
        # so the key can't be picked up silently by other tooling.
        _client = Anthropic(api_key=os.environ["SIGMA_ANTHROPIC_API_KEY"])
    return _client


def _log_cost(call_type: str, input_tokens: int, output_tokens: int) -> None:
    """Record one real API call in ApiUsage and print the running cumulative total."""
    cost = (
        input_tokens / 1_000_000 * INPUT_PRICE_PER_MTOK
        + output_tokens / 1_000_000 * OUTPUT_PRICE_PER_MTOK
    )
    with Session(engine) as session:
        session.add(
            ApiUsage(
                call_type=call_type,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost,
            )
        )
        session.commit()
        total = session.exec(select(func.sum(ApiUsage.cost_usd))).one() or 0.0
    print(
        f"[cost] {call_type}: {input_tokens} in / {output_tokens} out "
        f"= ${cost:.4f} | cumulative: ${total:.4f}"
    )


def _first_tool_use(response):
    for block in response.content:
        if block.type == "tool_use":
            return block
    raise AgentError("Model did not return a tool_use block")


def call_structured(
    call_type: str,
    system: str,
    user_prompt: str,
    schema: type[T],
    max_tokens: int,
    mock_name: str | None = None,
    image: tuple[str, str] | None = None,
) -> T:
    """Return a validated instance of `schema`, from a fixture or a real API call.

    `mock_name` overrides which fixture file is read in mock mode (used by the
    interviewer to return a different scripted turn each call); it is ignored in
    real mode. `image` is an optional (media_type, base64 data) pair sent ahead
    of the text prompt — used by the resume image transcription.
    """
    if _is_mock():
        fixture = MOCKS_DIR / f"{mock_name or call_type}.json"
        data = json.loads(fixture.read_text(encoding="utf-8"))
        # Validate the fixture against the real contract so a drifted mock fails loudly.
        return schema.model_validate(data)

    client = _get_client()
    # Forced tool use: the tool's input_schema IS the target JSON schema, and
    # tool_choice forces the model to call it — this is how we get structured output.
    tool = {
        "name": "record_output",
        "description": "Record the result in the required structure.",
        "input_schema": schema.model_json_schema(),
    }
    if image is None:
        content = user_prompt
    else:
        media_type, image_b64 = image
        content = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": image_b64},
            },
            {"type": "text", "text": user_prompt},
        ]
    messages = [{"role": "user", "content": content}]

    from anthropic import APIError

    last_error: ValidationError | None = None
    for _attempt in range(2):  # one initial call + one retry on validation failure
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=max_tokens,
                system=system,
                messages=messages,
                tools=[tool],
                tool_choice={"type": "tool", "name": "record_output"},
            )
        except APIError as error:
            raise AgentError(f"The AI service call failed: {error}") from error
        _log_cost(call_type, response.usage.input_tokens, response.usage.output_tokens)
        block = _first_tool_use(response)
        try:
            return schema.model_validate(block.input)
        except ValidationError as error:
            last_error = error
            # Feed the error back and let the model correct itself on the retry.
            messages.append({"role": "assistant", "content": response.content})
            messages.append(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": (
                                f"That did not match the schema: {error}. "
                                "Call record_output again with corrected data."
                            ),
                            "is_error": True,
                        }
                    ],
                }
            )

    raise AgentError(
        f"The AI response didn't match the required schema after a retry: {last_error}"
    ) from last_error
