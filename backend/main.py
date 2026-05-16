from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.routes import router
from backend.api.ws import router as ws_router

app = FastAPI(title="Monday AI", version="1.0.0")

# NOTE: I noticed Claude allowed all host origins, and thats fine for local, but I highly suggest you update these if you are pushing to prod. -middy
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(ws_router)


@app.get("/health")
async def health():
    return {"status": "ok", "name": "Monday"}
