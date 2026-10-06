import base64
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.security import verify_internal_key
from app.services import ats, extractor, parser, rag

log = logging.getLogger("resume")
router = APIRouter(prefix="/resume", dependencies=[Depends(verify_internal_key)])


class AnalyzeRequest(BaseModel):
    user_id: int
    filename: str
    content_b64: str


@router.post("/analyze")
def analyze(req: AnalyzeRequest):
    try:
        data = base64.b64decode(req.content_b64)
        raw_text = parser.extract_text(req.filename, data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"Could not read the file: {e}")

    profile, meta = extractor.extract_profile(raw_text)
    ats_result = ats.score_resume(raw_text, profile)
    try:
        meta["chunks_indexed"] = rag.index_resume(req.user_id, raw_text)
    except Exception as e:  # noqa: BLE001
        log.exception("Resume indexing failed")
        meta["chunks_indexed"] = 0
        meta["index_error"] = str(e)
    return {"raw_text": raw_text, "profile": profile, "ats": ats_result, "extraction": meta}
