"""Stakeholder simulator for offline calibration."""
from __future__ import annotations
from typing import Protocol
from .personas import Persona


class SimulatorClient(Protocol):
    async def simulate_answer(
        self, *, persona_markdown: str, probe: str, transcript: str, turn: int
    ) -> str: ...


class StakeholderSimulator:
    def __init__(self, client: SimulatorClient, persona: Persona):
        self.client = client
        self.persona = persona
        self.transcript: list[tuple[str, str]] = []

    async def respond(self, probe: str, turn: int) -> str:
        transcript_str = "\n".join(f"Q: {q}\nA: {a}" for q, a in self.transcript)
        answer = await self.client.simulate_answer(
            persona_markdown=self.persona.raw_markdown,
            probe=probe,
            transcript=transcript_str,
            turn=turn,
        )
        self.transcript.append((probe, answer))
        return answer
