import asyncio
import os
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

WAKE_WORD = os.environ.get("WAKE_WORD", "monday").lower()
_SR = 16000
_SILENCE_RMS = 0.008

# Wake-detection tuning
_WAKE_MIN = int(_SR * 0.4)  # need at least 0.4s before checking
_WAKE_MAX = int(_SR * 2.5)  # keep at most 2.5s rolling window
_WAKE_SILENCE = int(_SR * 0.45)  # 0.45s quiet triggers a Whisper check
_WAKE_KEEP = int(_SR * 0.8)  # after a miss, keep last 0.8s for overlap

# Post-wake listening
_LISTEN_SILENCE = int(_SR * 1.5)
_LISTEN_MAX = _SR * 30


@router.websocket("/ws/voice")
async def voice_ws(ws: WebSocket):
    await ws.accept()

    from backend.api.routes import get_stt
    from backend.services.wake_word import EnergyVAD

    stt = get_stt()
    vad = EnergyVAD()
    loop = asyncio.get_event_loop()

    state = "idle"
    wake_buf: list[np.ndarray] = []
    wake_total = 0
    wake_silence = 0

    listen_buf: list[np.ndarray] = []
    listen_total = 0
    listen_sil = 0

    async def check_wake():
        """Transcribe wake_buf, return True if wake word detected."""
        nonlocal wake_buf, wake_total, wake_silence
        audio = np.concatenate(wake_buf) if wake_buf else np.array([], dtype=np.float32)
        text = await loop.run_in_executor(None, stt.transcribe_array, audio)
        if WAKE_WORD in text.lower():
            return True
        # Keep tail for word-boundary overlap
        tail = audio[-_WAKE_KEEP:] if len(audio) > _WAKE_KEEP else audio
        wake_buf = [tail]
        wake_total = len(tail)
        wake_silence = 0
        return False

    try:
        while True:
            data = await ws.receive_bytes()
            chunk = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
            rms = float(np.sqrt(np.mean(chunk**2)))
            is_sil = rms < _SILENCE_RMS

            # ── Idle: rolling VAD + Whisper keyword check ──────────────────
            if state == "idle":
                wake_buf.append(chunk)
                wake_total += len(chunk)
                wake_silence = wake_silence + len(chunk) if is_sil else 0

                # Trim rolling window to _WAKE_MAX
                while wake_total > _WAKE_MAX and wake_buf:
                    removed = wake_buf.pop(0)
                    wake_total -= len(removed)

                enough = wake_total >= _WAKE_MIN
                trigger = wake_silence >= _WAKE_SILENCE or wake_total >= _WAKE_MAX

                if enough and trigger:
                    if await check_wake():
                        state = "listening"
                        listen_buf = []
                        listen_total = 0
                        listen_sil = 0
                        wake_buf = []
                        wake_total = 0
                        wake_silence = 0
                        await ws.send_json({"type": "wake"})

            # ── Listening: collect utterance until silence ──────────────────
            elif state == "listening":
                listen_buf.append(chunk)
                listen_total += len(chunk)
                listen_sil = listen_sil + len(chunk) if is_sil else 0

                done = listen_sil >= _LISTEN_SILENCE or listen_total >= _LISTEN_MAX
                if done:
                    audio = np.concatenate(listen_buf)
                    trim = max(0, len(audio) - int(listen_sil * 0.8))
                    audio = audio[:trim] if trim > 0 else audio

                    text = await loop.run_in_executor(None, stt.transcribe_array, audio)
                    if text:
                        await ws.send_json({"type": "transcript", "text": text})
                    else:
                        await ws.send_json({"type": "idle"})

                    state = "idle"
                    listen_buf = []
                    listen_total = 0
                    listen_sil = 0
                    wake_buf = []
                    wake_total = 0
                    wake_silence = 0

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await ws.send_json({"type": "error", "detail": str(exc)})
        except Exception:
            pass
