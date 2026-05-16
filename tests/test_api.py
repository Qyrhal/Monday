import io
import json
import wave
from unittest.mock import MagicMock, patch

# NOTE: As More features are added to this, please add more testing. -middy

# --- health ---

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "name": "Monday"}


# --- models ---

def test_list_models(client):
    r = client.get("/v1/models")
    assert r.status_code == 200
    data = r.json()
    assert data["object"] == "list"
    assert any(m["id"] == "monday" for m in data["data"])


# --- voices ---

def test_list_voices(client):
    r = client.get("/v1/voices")
    assert r.status_code == 200
    voices = r.json()["voices"]
    assert set(voices) == {"F1","F2","F3","F4","F5","M1","M2","M3","M4","M5"}


# --- chat completions (non-streaming) ---

def test_chat_non_streaming(client):
    with patch("backend.services.brain.chat", return_value="Hello, I am Monday."):
        r = client.post("/v1/chat/completions", json={
            "model": "monday",
            "messages": [{"role": "user", "content": "hi"}],
            "stream": False,
        })
    assert r.status_code == 200
    body = r.json()
    assert body["object"] == "chat.completion"
    assert body["choices"][0]["message"]["content"] == "Hello, I am Monday."
    assert body["choices"][0]["finish_reason"] == "stop"


def test_chat_missing_messages(client):
    r = client.post("/v1/chat/completions", json={"model": "monday"})
    assert r.status_code == 422


def test_chat_multi_turn(client):
    with patch("backend.services.brain.chat", return_value="Sure.") as mock_chat:
        r = client.post("/v1/chat/completions", json={
            "model": "monday",
            "messages": [
                {"role": "user", "content": "remember this: 42"},
                {"role": "assistant", "content": "Got it."},
                {"role": "user", "content": "what did I say?"},
            ],
        })
    assert r.status_code == 200
    # brain.chat receives all 3 messages
    called_messages = mock_chat.call_args[0][0]
    assert len(called_messages) == 3


# --- chat completions (streaming) ---

def test_chat_streaming(client):
    chunks = ["Hello", ", I", " am", " Monday", "."]
    with patch("backend.services.brain.chat_stream", return_value=iter(chunks)):
        r = client.post("/v1/chat/completions", json={
            "model": "monday",
            "messages": [{"role": "user", "content": "hi"}],
            "stream": True,
        })
    assert r.status_code == 200
    assert "text/event-stream" in r.headers["content-type"]

    content = ""
    finish_seen = False
    done_seen = False
    for line in r.text.splitlines():
        if not line.startswith("data: "):
            continue
        payload = line[6:]
        if payload == "[DONE]":
            done_seen = True
            continue
        obj = json.loads(payload)
        delta = obj["choices"][0]["delta"]
        if delta.get("content"):
            content += delta["content"]
        if obj["choices"][0].get("finish_reason") == "stop":
            finish_seen = True

    assert content == "Hello, I am Monday."
    assert finish_seen
    assert done_seen


# --- audio/speech ---

def test_speech_synthesis(client):
    fake_audio = b"RIFF\x00\x00\x00\x00WAVEfmt "
    mock_tts = MagicMock()
    mock_tts.synthesize.return_value = fake_audio
    with patch("backend.api.routes.get_tts", return_value=mock_tts):
        r = client.post("/v1/audio/speech", json={"input": "Hello", "voice": "default"})
    assert r.status_code == 200
    assert r.headers["content-type"] == "audio/wav"
    assert r.content == fake_audio
    mock_tts.synthesize.assert_called_once_with("Hello", voice="default")


def test_speech_empty_input(client):
    r = client.post("/v1/audio/speech", json={"input": ""})
    assert r.status_code == 400
    assert "input required" in r.json()["detail"]


def test_speech_missing_input_key(client):
    r = client.post("/v1/audio/speech", json={})
    assert r.status_code == 400


def test_speech_tts_error(client):
    mock_tts = MagicMock()
    mock_tts.synthesize.side_effect = RuntimeError("TTS engine failure")
    with patch("backend.api.routes.get_tts", return_value=mock_tts):
        r = client.post("/v1/audio/speech", json={"input": "Hello"})
    assert r.status_code == 500
    assert "TTS engine failure" in r.json()["detail"]


# --- audio/transcriptions ---

def _make_wav(num_frames: int = 16000, sample_rate: int = 16000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * num_frames)
    return buf.getvalue()


def test_transcribe(client):
    mock_stt = MagicMock()
    mock_stt.transcribe.return_value = "hello world"
    with patch("backend.api.routes.get_stt", return_value=mock_stt):
        r = client.post(
            "/v1/audio/transcriptions",
            files={"file": ("audio.wav", _make_wav(), "audio/wav")},
        )
    assert r.status_code == 200
    assert r.json()["text"] == "hello world"


def test_transcribe_empty_speech(client):
    mock_stt = MagicMock()
    mock_stt.transcribe.return_value = ""
    with patch("backend.api.routes.get_stt", return_value=mock_stt):
        r = client.post(
            "/v1/audio/transcriptions",
            files={"file": ("audio.wav", _make_wav(100), "audio/wav")},
        )
    assert r.status_code == 200
    assert r.json()["text"] == ""


def test_transcribe_stt_error(client):
    mock_stt = MagicMock()
    mock_stt.transcribe.side_effect = RuntimeError("model not found")
    with patch("backend.api.routes.get_stt", return_value=mock_stt):
        r = client.post(
            "/v1/audio/transcriptions",
            files={"file": ("audio.wav", _make_wav(100), "audio/wav")},
        )
    assert r.status_code == 500
    assert "model not found" in r.json()["detail"]
