from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from app.db import engine, Base
from app.routers import stages, auth, work_orders

app = FastAPI(
    title="Üretim Planlama API",
    description="Swagger UI yüklenmezse /api-docs adresinden erişebilirsin.",
    version="1.0.0",
    docs_url="/api-docs",
    redoc_url="/api-redoc",
)

# ✅ CORS ayarları
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT token'ı buraya yapıştırın (Bearer ön eki olmadan)"
        }
    }
    
    # Tüm endpointlere security uygulanır
    openapi_schema["security"] = [{"BearerAuth": []}]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


# ✅ Basit test endpoint
@app.get("/")
def hello():
    return {"msg": "Merhaba, backend çalışıyor!"}


# ✅ Veritabanı tablolarını oluştur
Base.metadata.create_all(bind=engine)


# ✅ Router'lar
app.include_router(stages.router)
app.include_router(auth.router)
app.include_router(work_orders.router)





