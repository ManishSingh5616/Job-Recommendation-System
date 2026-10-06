from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.security import verify_internal_key
from app.services import rag

router = APIRouter(dependencies=[Depends(verify_internal_key)])


class ChatRequest(BaseModel):
    user_id: int
    query: str
    history: list[dict] = Field(default_factory=list)
    profile: dict
    recommendations: list[dict] = Field(default_factory=list)
    ats: dict | None = None


@router.post("/chat/stream")
def chat_stream(req: ChatRequest):
    gen = rag.stream_answer(req.user_id, req.query, req.history, req.profile, req.recommendations, req.ats)
    return StreamingResponse(gen, media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
