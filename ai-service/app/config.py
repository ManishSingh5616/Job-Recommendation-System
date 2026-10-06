import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT = Path(__file__).resolve().parents[1]

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
MODELS = [m.strip() for m in os.getenv("GEMINI_MODELS", "gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.8-flash").split(",") if m.strip()]
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")

FAISS_DIR = Path(os.getenv("FAISS_DIR", ROOT / "faiss_data"))
VOCAB_PATH = Path(os.getenv("SKILLS_VOCAB_PATH", ROOT.parent / "shared" / "skills_vocab.json"))
EMBED_MODEL = "intfloat/multilingual-e5-large"

# multilingual-e5 cosine similarities for related English text sit in a narrow high band, so raw values are
# rescaled to 0-1 before the 0.25 semantic weight is applied. Tune these two numbers if scores look too
# high or too low once you have inspected real similarity values from your data.
SEM_FLOOR = float(os.getenv("SEM_FLOOR", "0.70"))
SEM_CEIL = float(os.getenv("SEM_CEIL", "0.88"))
