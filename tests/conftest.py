"""Shared pytest fixtures."""
from __future__ import annotations
import pytest
from pathlib import Path
from kinn3.memory import LocalMemory
from kinn3.models import VSMBeliefState, Probe, BlockResolution


@pytest.fixture
def memory(tmp_path: Path) -> LocalMemory:
    return LocalMemory(root=tmp_path / "mem")


@pytest.fixture
def empty_belief() -> VSMBeliefState:
    return VSMBeliefState()


@pytest.fixture
def partial_belief() -> VSMBeliefState:
    b = VSMBeliefState(turn=3)
    b.blocks[1] = BlockResolution(resolution="mid", quotes=["family dental clinic", "Matosinhos"], updated_turn=2)
    b.blocks[4] = BlockResolution(resolution="low", quotes=["I'm tired"], updated_turn=1)
    return b


@pytest.fixture
def bootstrap_probes() -> list[Probe]:
    return [
        Probe(order=1, target_block=4, depth="identity",
              draft="What's been hurting most in the last month?"),
        Probe(order=2, target_block=1, depth="identity",
              draft="What does your business do in one line?"),
        Probe(order=3, target_block=3, depth="identity",
              draft="Are you fighting to survive, to grow, or to pivot?"),
    ]
