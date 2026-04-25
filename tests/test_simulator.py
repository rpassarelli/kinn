import pytest
from unittest.mock import AsyncMock
from kinn3.simulator import StakeholderSimulator
from kinn3.personas import load_persona


@pytest.mark.asyncio
async def test_simulator_responds_in_persona_voice():
    mock_client = AsyncMock()
    mock_client.simulate_answer = AsyncMock(
        return_value="We're a family dental clinic in Matosinhos. 8 staff."
    )
    persona = load_persona("dental-clinic")
    sim = StakeholderSimulator(client=mock_client, persona=persona)

    ans = await sim.respond(probe="What does your business do in one line?", turn=1)
    assert "dental" in ans.lower() or "clinic" in ans.lower()
