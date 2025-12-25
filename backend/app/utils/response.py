from typing import Any, Optional, Dict
from datetime import datetime
from fastapi.responses import JSONResponse
from fastapi import status

def success_response(
    data: Any = None,
    message: str = "Success",
    status_code: int = status.HTTP_200_OK,
    meta: Optional[Dict] = None
) -> JSONResponse:
    """
    Standart başarılı response formatı
    
    Args:
        data: Response data
        message: Success message
        status_code: HTTP status code
        meta: Additional metadata
    
    Returns:
        JSONResponse with standard format
    """
    response_data = {
        "success": True,
        "message": message,
        "data": data,
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    if meta:
        response_data["meta"] = meta
    
    return JSONResponse(content=response_data, status_code=status_code)


def error_response(
    message: str = "An error occurred",
    status_code: int = status.HTTP_400_BAD_REQUEST,
    errors: Optional[Dict] = None,
    error_code: Optional[str] = None
) -> JSONResponse:
    """
    Standart hata response formatı
    
    Args:
        message: Error message
        status_code: HTTP status code
        errors: Validation errors or additional error details
        error_code: Application-specific error code
    
    Returns:
        JSONResponse with standard error format
    """
    response_data = {
        "success": False,
        "message": message,
        "error_code": error_code,
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    if errors:
        response_data["errors"] = errors
    
    return JSONResponse(content=response_data, status_code=status_code)



