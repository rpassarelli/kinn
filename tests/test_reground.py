from kinn3.reground import detect_fatigue, reground_output


def test_detect_fatigue_via_short_messages_pattern():
    transcript = "\n".join([
        "USER: I don't know.",
        "USER: I don't know.",
        "USER: ...",
    ])
    assert detect_fatigue(transcript) is True


def test_detect_fatigue_normal_messages_no_trigger():
    transcript = "\n".join([
        "USER: We have 8 staff and growing customer base.",
        "USER: The market shifted last quarter when our biggest competitor entered.",
    ])
    assert detect_fatigue(transcript) is False


def test_reground_output_acknowledges_then_open_question():
    out = reground_output()
    assert "?" in out.next_question
    assert any(w in out.heard[0].lower() for w in ("hear", "okay", "tired", "moment"))
