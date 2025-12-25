import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.db import engine, Base
from app.routers import stages, auth, work_orders, metrics, issues, machines, products, molds
from app.config import CORS_ORIGINS
from app.logging_config import logger

app = FastAPI(
    title="Üretim Planlama API",
    description="Swagger UI yüklenmezse /api-docs adresinden erişebilirsin.",
    version="1.0.0",
    docs_url="/api-docs",
    redoc_url="/api-redoc",
)

# ✅ Logging middleware - Request logging
class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Request bilgilerini logla
        logger.info(
            f"Request: {request.method} {request.url.path} - "
            f"Client: {request.client.host if request.client else 'unknown'}"
        )
        
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # Response bilgilerini logla
            logger.info(
                f"Response: {request.method} {request.url.path} - "
                f"Status: {response.status_code} - "
                f"Time: {process_time:.3f}s"
            )
            
            return response
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                f"Error: {request.method} {request.url.path} - "
                f"Exception: {str(e)} - "
                f"Time: {process_time:.3f}s",
                exc_info=True
            )
            raise

app.add_middleware(LoggingMiddleware)

# ✅ CORS ayarları - Config'den al
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        f"Unhandled exception: {str(exc)} - Path: {request.url.path}",
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal server error",
            "error_code": "INTERNAL_ERROR"
        }
    )


# ✅ Swagger için custom OpenAPI şeması (Bearer Auth)
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    
    # Bearer Auth tanımı ekliyoruz
    if "components" not in openapi_schema:
        openapi_schema["components"] = {}
    if "securitySchemes" not in openapi_schema["components"]:
        openapi_schema["components"]["securitySchemes"] = {}
    
    # Tüm OAuth2 ve HTTPBearer şemalarını temizliyoruz
    security_schemes = openapi_schema.get("components", {}).get("securitySchemes", {})
    for key in list(security_schemes.keys()):
        if key in ["OAuth2PasswordBearer", "HTTPBearer"]:
            del security_schemes[key]
    
    # Sadece BearerAuth kullanıyoruz
    openapi_schema["components"]["securitySchemes"]["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Login'den aldığınız access_token değerini buraya yapıştırın (Bearer ön eki olmadan)"
    }
    
    # Tüm endpoint'lere BearerAuth uygula (login ve register hariç)
    for path, methods in openapi_schema.get("paths", {}).items():
        if path not in ["/auth/login", "/auth/register", "/"]:
            for method in methods.values():
                if isinstance(method, dict) and "security" not in method:
                    method["security"] = [{"BearerAuth": []}]
    
    # Public endpoint'ler için security uygulanmaz (login, register, root)
    # Diğer tüm endpoint'ler için security uygulanır
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


# ✅ Basit test endpoint
@app.get("/")
def hello():
    return {"msg": "Merhaba, backend çalışıyor!"}


# ✅ Veritabanı tabloları Alembic migrations ile oluşturulur
# Migration çalıştır: alembic upgrade head
# Base.metadata.create_all(bind=engine)  # Kaldırıldı - Alembic kullanıyoruz


# ✅ Router'lar
app.include_router(stages.router)
app.include_router(auth.router)
app.include_router(work_orders.router)
app.include_router(metrics.router)
app.include_router(issues.router)
app.include_router(machines.router)
app.include_router(products.router)
app.include_router(molds.router)





