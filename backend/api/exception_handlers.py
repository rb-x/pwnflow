"""Custom exception handlers for the API."""
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
import logging

logger = logging.getLogger(__name__)

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Custom handler for validation errors that handles binary data properly.
    This prevents UnicodeDecodeError when FastAPI tries to encode binary file data in error messages.
    """
    try:
        # Try to encode errors normally first
        errors = exc.errors()
        for error in errors:
            # If the input is bytes (file upload), replace it with a string representation
            if 'input' in error and isinstance(error['input'], bytes):
                error['input'] = f"<binary data: {len(error['input'])} bytes>"
        
        return JSONResponse(
            status_code=422,
            content={"detail": errors},
        )
    except Exception as e:
        # If encoding still fails, return a generic error
        logger.error(f"Error encoding validation error: {e}")
        return JSONResponse(
            status_code=422,
            content={
                "detail": [{
                    "msg": "Invalid request format. Please check that you're sending multipart/form-data with the correct fields.",
                    "type": "request_validation_error"
                }]
            },
        )