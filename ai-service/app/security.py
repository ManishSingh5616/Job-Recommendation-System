import hmac
import logging

from fastapi import Header, HTTPException

from app import config

log = logging.getLogger("security")
if not config.INTERNAL_API_KEY:
    log.warning("INTERNAL_API_KEY is not set: the AI service accepts requests from anyone who can reach it.")


def verify_internal_key(x_internal_key: str = Header(default="")):
    """Only the Express gateway should call this service."""
    if config.INTERNAL_API_KEY and not hmac.compare_digest(x_internal_key, config.INTERNAL_API_KEY):
        raise HTTPException(status_code=401, detail="Invalid internal key")
