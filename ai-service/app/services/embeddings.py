import threading

import numpy as np

from app import config

_model = None
_lock = threading.Lock()


def _get_model():
    global _model
    with _lock:
        if _model is None:
            from sentence_transformers import SentenceTransformer

            _model = SentenceTransformer(config.EMBED_MODEL)
        return _model


def embed_passages(texts: list[str], batch_size: int = 16) -> np.ndarray:
    prefixed = [f"passage: {t.strip()}" for t in texts]
    vecs = _get_model().encode(prefixed, batch_size=batch_size, normalize_embeddings=True)
    return np.array(vecs, dtype="float32")


def embed_query(text: str) -> np.ndarray:
    vec = _get_model().encode(f"query: {text.strip()}", normalize_embeddings=True)
    return np.array(vec, dtype="float32")
