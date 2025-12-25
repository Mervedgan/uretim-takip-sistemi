from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import DATABASE_URL

# Engine oluştur - SQLite ve PostgreSQL desteği
if DATABASE_URL.startswith("sqlite"):
    # SQLite için özel ayarlar
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False},
        echo=False
    )
else:
    # PostgreSQL için connection pooling
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,  # Connection health check
        echo=False
    )

# Session oluştur (veritabanı işlemleri için)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base sınıfı (model tanımları için)
Base = declarative_base()

# Bağlantı test fonksiyonu
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
