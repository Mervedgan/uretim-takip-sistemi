from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Veritabanı bağlantısı (SQLite dosyası)
SQLALCHEMY_DATABASE_URL = "sqlite:///./database.db"

# Engine oluştur
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
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
