import json
from pathlib import Path
from kinn3.memory import LocalMemory
from kinn3.models import VSMBeliefState

def test_local_memory_roundtrip_belief(tmp_path: Path):
    mem = LocalMemory(root=tmp_path)
    belief = VSMBeliefState()
    belief.blocks[1].resolution = "low"
    belief.blocks[1].quotes = ["I run a dental clinic"]

    mem.write("belief_state", belief.model_dump_json())
    loaded = VSMBeliefState.model_validate_json(mem.read("belief_state"))

    assert loaded.blocks[1].resolution == "low"
    assert loaded.blocks[1].quotes == ["I run a dental clinic"]

def test_local_memory_append_transcript(tmp_path: Path):
    mem = LocalMemory(root=tmp_path)
    mem.append("transcript", "turn 1: hello")
    mem.append("transcript", "turn 2: world")
    assert mem.read("transcript") == "turn 1: hello\nturn 2: world"

def test_local_memory_missing_key_returns_none(tmp_path: Path):
    mem = LocalMemory(root=tmp_path)
    assert mem.read("nonexistent") is None
