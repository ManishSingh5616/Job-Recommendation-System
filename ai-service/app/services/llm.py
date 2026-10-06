"""Thin Gemini wrapper with model fallback. Imports are lazy so unit tests run without the SDK."""
import json

from app import config

_client = None


def _get_client():
    global _client
    if _client is None:
        if not config.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set")
        from google import genai

        _client = genai.Client(api_key=config.GEMINI_API_KEY)
    return _client


def generate_json(prompt: str, temperature: float = 0.1) -> dict:
    from google.genai import types

    if not config.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")
    last_error = None
    for model in config.MODELS:
        try:
            response = _get_client().models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=temperature),
            )
            return json.loads(response.text)
        except Exception as exc:  # model unavailable, quota, bad JSON ...
            last_error = exc
            print(f"[llm] {model} failed: {exc}")
    raise RuntimeError(f"All Gemini models failed: {last_error}")


def stream_text(prompt: str, system: str, temperature: float = 0.3):
    """Yield text chunks. Falls back to the next model only if nothing was streamed yet."""
    from google.genai import types

    if not config.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set")
    last_error = None
    for model in config.MODELS:
        started = False
        try:
            stream = _get_client().models.generate_content_stream(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(system_instruction=system, temperature=temperature),
            )
            for chunk in stream:
                if chunk.text:
                    started = True
                    yield chunk.text
            return
        except Exception as exc:
            last_error = exc
            print(f"[llm] stream {model} failed: {exc}")
            if started:
                yield "\n\n_(The response was interrupted. Please ask again.)_"
                return
    raise RuntimeError(f"All Gemini models failed: {last_error}")
