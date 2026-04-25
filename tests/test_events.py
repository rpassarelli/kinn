import json
from kinn3.events import EventLog


def test_event_log_appends_jsonl(tmp_path):
    log = EventLog(path=tmp_path / "events.jsonl")
    log.emit(actor="agent", event="turn_started", turn=1)
    log.emit(actor="agent", event="probe_selected", turn=1, probe_order=2)
    lines = (tmp_path / "events.jsonl").read_text().strip().split("\n")
    assert len(lines) == 2
    rec = json.loads(lines[0])
    assert rec["actor"] == "agent"
    assert rec["event"] == "turn_started"
    assert "ts" in rec
