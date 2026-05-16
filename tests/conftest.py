import os

# Must be set before backend modules are imported (brain.py reads these at module level)
os.environ.setdefault("VLLM_API_KEY", "test-key")
os.environ.setdefault("VLLM_BASE_URL", "http://localhost:11434/v1")
os.environ.setdefault("VLLM_MODEL", "test-model")

import pytest
from fastapi.testclient import TestClient
from backend.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c
