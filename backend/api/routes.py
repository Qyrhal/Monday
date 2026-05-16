import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
import json

# NOTE: I was playing around with the voices, so this file can be reduced if you only choose only one of the voices to be played for Monday -middy

from backend.models.chat import (
    ChatRequest,
    ChatResponse,
    ChatChoice,
    ChatUsage,
    Message,
)
from backend.services import brain

router = APIRouter()

_tts_service = None
_stt_service = None


def get_tts():
    global _tts_service
    if _tts_service is None:
        from backend.services.tts import TTSService

        _tts_service = TTSService()
    return _tts_service


def get_stt():
    global _stt_service
    if _stt_service is None:
        from backend.services.stt import STTService

        _stt_service = STTService()
    return _stt_service


VOICES = ["F1", "F2", "F3", "F4", "F5", "M1", "M2", "M3", "M4", "M5"]


@router.get("/v1/voices")
async def list_voices():
    return {"voices": VOICES}


@router.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [{"id": "monday", "object": "model", "owned_by": "monday"}],
    }


@router.post("/v1/chat/completions")
async def chat_completions(req: ChatRequest):
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    if req.stream:

        def event_stream():
            stream_id = f"chatcmpl-{uuid.uuid4().hex}"
            for chunk in brain.chat_stream(messages, max_tokens=req.max_tokens or 1024):
                data = {
                    "id": stream_id,
                    "object": "chat.completion.chunk",
                    "model": req.model,
                    "choices": [
                        {"index": 0, "delta": {"content": chunk}, "finish_reason": None}
                    ],
                }
                yield f"data: {json.dumps(data)}\n\n"
            done = {
                "id": stream_id,
                "object": "chat.completion.chunk",
                "model": req.model,
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            }
            yield f"data: {json.dumps(done)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    text = brain.chat(messages, max_tokens=req.max_tokens or 1024)
    return ChatResponse(
        id=f"chatcmpl-{uuid.uuid4().hex}",
        model=req.model,
        choices=[
            ChatChoice(
                index=0,
                message=Message(role="assistant", content=text),
                finish_reason="stop",
            )
        ],
        usage=ChatUsage(prompt_tokens=0, completion_tokens=0, total_tokens=0),
    )


@router.post("/v1/audio/transcriptions")
async def transcribe(file: UploadFile = File(...)):
    audio_bytes = await file.read()
    try:
        ext = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
        stt = get_stt()
        text = stt.transcribe(audio_bytes, ext=ext)
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/v1/audio/speech")
async def synthesize(payload: dict):
    text = payload.get("input", "")
    voice = payload.get("voice", "default")
    if not text:
        raise HTTPException(status_code=400, detail="input required")
    try:
        tts = get_tts()
        audio = tts.synthesize(text, voice=voice)
        return StreamingResponse(iter([audio]), media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
