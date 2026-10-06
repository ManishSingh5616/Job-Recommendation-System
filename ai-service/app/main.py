from fastapi import FastAPI

from app.routers import chat, jobs, resume

app = FastAPI(title="Career Intelligence AI Service", version="2.0.0")
app.include_router(resume.router)
app.include_router(jobs.router)
app.include_router(chat.router)


@app.get("/health")
def health():
    return {"status": "online", "service": "AI microservice (extraction, embeddings, FAISS, scoring, RAG)"}
