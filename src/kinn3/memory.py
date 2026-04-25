"""Memory adapter. LocalMemory for tests; AnthropicMemory wraps the Memory tool."""
from __future__ import annotations
from pathlib import Path
from typing import Protocol


class MemoryAdapter(Protocol):
    def read(self, key: str) -> str | None: ...
    def write(self, key: str, value: str) -> None: ...
    def append(self, key: str, value: str) -> None: ...


class LocalMemory:
    """File-backed memory. Each key is one file under root/."""

    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        if not key.replace("_", "").replace("-", "").isalnum():
            raise ValueError(f"invalid key: {key}")
        return self.root / f"{key}.txt"

    def read(self, key: str) -> str | None:
        p = self._path(key)
        return p.read_text() if p.exists() else None

    def write(self, key: str, value: str) -> None:
        # Atomic write via .tmp + rename.
        p = self._path(key)
        tmp = p.with_suffix(".tmp")
        tmp.write_text(value)
        tmp.replace(p)

    def append(self, key: str, value: str) -> None:
        existing = self.read(key)
        new = value if existing is None else f"{existing}\n{value}"
        self.write(key, new)
