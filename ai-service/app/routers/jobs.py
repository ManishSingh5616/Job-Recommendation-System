from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.security import verify_internal_key
from app.services import embeddings, recommender
from app.services.skill_gap import analyze_skill_gap
from app.services.vector_store import job_store

router = APIRouter(dependencies=[Depends(verify_internal_key)])


class JobIn(BaseModel):
    job_id: int
    title: str
    company: str = ""
    description: str = ""
    location: str = ""
    experience_required: str = ""
    education_required: str = ""
    employment_type: str = ""
    salary_range: str = ""
    skills: list[str] = Field(default_factory=list)


class IndexRequest(BaseModel):
    jobs: list[JobIn]


@router.post("/index/jobs")
def index_jobs(req: IndexRequest):
    """Rebuild the FAISS job index from the given jobs (called by the Express seeding script)."""
    if not req.jobs:
        return {"indexed": 0}
    passages = [
        f"{j.title}. {j.company}. {j.description[:1500]}. Required skills: {', '.join(j.skills)}"
        for j in req.jobs
    ]
    vectors = embeddings.embed_passages(passages)
    metas = [{**j.model_dump(), "description": j.description[:1500]} for j in req.jobs]
    job_store.rebuild(vectors, metas)
    return {"indexed": len(req.jobs)}


class RecommendRequest(BaseModel):
    profile: dict
    top_k: int = 20


@router.post("/recommend")
def recommend(req: RecommendRequest):
    results, indexed = recommender.rank_jobs(req.profile, req.top_k)
    return {"recommendations": results, "indexed_jobs": indexed}


class GapRequest(BaseModel):
    recommendations: list[dict]


@router.post("/skill-gap")
def skill_gap(req: GapRequest):
    return analyze_skill_gap(req.recommendations)
