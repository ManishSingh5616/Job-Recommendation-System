import json
import threading

import faiss
import numpy as np

from app import config


class JobStore:
    """Local FAISS-CPU index (inner product on normalised vectors = cosine) plus JSON metadata."""

    def __init__(self):
        config.FAISS_DIR.mkdir(parents=True, exist_ok=True)
        self.index_path = config.FAISS_DIR / "jobs.index"
        self.meta_path = config.FAISS_DIR / "jobs_meta.json"
        self._lock = threading.Lock()
        self.index = faiss.read_index(str(self.index_path)) if self.index_path.exists() else None
        self.metadata: list[dict] = json.loads(self.meta_path.read_text(encoding="utf-8")) if self.meta_path.exists() else []

    @property
    def count(self) -> int:
        return self.index.ntotal if self.index is not None else 0

    def rebuild(self, vectors: np.ndarray, metas: list[dict]):
        vectors = np.ascontiguousarray(vectors, dtype="float32")
        with self._lock:
            index = faiss.IndexFlatIP(vectors.shape[1])
            index.add(vectors)
            self.index, self.metadata = index, metas
            faiss.write_index(index, str(self.index_path))
            self.meta_path.write_text(json.dumps(metas, ensure_ascii=False), encoding="utf-8")

    def search(self, query_vector: np.ndarray, k: int) -> list[dict]:
        with self._lock:
            if self.index is None or self.index.ntotal == 0:
                return []
            scores, ids = self.index.search(np.asarray([query_vector], dtype="float32"), min(k, self.index.ntotal))
            return [{**self.metadata[i], "raw_similarity": float(s)} for s, i in zip(scores[0], ids[0]) if 0 <= i < len(self.metadata)]


job_store = JobStore()
