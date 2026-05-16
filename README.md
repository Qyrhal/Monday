# Monday - AI Voice Assistant (Jarvis from Ironman looking, but with Ultron's Orb thingo )

A full-stack AI voice assistant with real-time chat interface, speech-to-text (STT), text-to-speech (TTS), and wake word detection.
Very lightweight.

Disclaimer: I made this in 20 mins with Claude

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, TailwindCSS 4
- **Backend:** Python, FastAPI (This is a uv project)
- **AI Services:** OpenAI-compatible LLM, faster-whisper (STT), pyttsx3 (TTS) (Supertonic)

This project will work with normal python, but modify the start.sh in the root dir.
## Project Structure

```
/frontend/          # Next.js web application
  src/
    app/           # Next.js app router pages
    components/   # React components (ChatInterface, AudioVisualizer)
    lib/           # API client utilities

/backend/           # FastAPI server
  api/             # REST endpoints and WebSocket handlers
  models/          # Pydantic data models
  services/        # Core services (brain, tts, stt, wake_word)

/tests/            # Python pytest test suite
```

## Getting Started

### Prerequisites

- Python 3.14+
- Node.js 18+
- [bun](https://github.com/oven-sh/bun)
- [uv](https://github.com/astral-sh/uv)

Note: You can use python and npm, but you will need to manually start the backend and frontend

### QuickStart

```bash
# Run the startup script (sets up venv and starts both services)
# requires bun and uv
./start.sh
```

Or manually:

```bash
# Backend
cd backend
uv venv
source .venv/bin/activate  # or venv\Scripts\activate on Windows
uv pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload

# Frontend
cd frontend
bun install
bun run dev
```

### Environment Variables

Create `.env` files in both frontend and backend with the examples provided.


## API Endpoints

- `POST /api/chat/completions` - Chat completion
- `POST /api/audio/transcribe` - Speech to text
- `POST /api/audio/synthesize` - Text to speech
- `GET /api/audio/voices` - List available TTS voices
- `WS /ws` - Real-time voice communication

## License

MIT

