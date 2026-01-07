import os
from dotenv import load_dotenv
from typing import Optional

# Load environment variables from `.env` if present, otherwise fall back to `env.local`.
# Note: Creating/editing `.env` may be blocked in some environments; `env.local` keeps local defaults.
_backend_root = os.path.dirname(os.path.dirname(__file__))  # .../backend
_env_path = os.path.join(_backend_root, ".env")
_env_local_path = os.path.join(_backend_root, "env.local")

if os.path.exists(_env_path):
    load_dotenv(_env_path)
elif os.path.exists(_env_local_path):
    load_dotenv(_env_local_path)
else:
    # Fall back to process environment only
    load_dotenv()

# ============================================
# SECURITY CONFIGURATION
# ============================================
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# ============================================
# DATABASE CONFIGURATION
# ============================================
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./database.db"  # Default to SQLite for backward compatibility
)

# PostgreSQL specific settings (if using PostgreSQL)
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_DB = os.getenv("POSTGRES_DB", "production_db")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")

# ============================================
# APPLICATION SETTINGS
# ============================================
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
DEBUG = os.getenv("DEBUG", "True").lower() == "true"
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))

# ============================================
# CORS CONFIGURATION
# ============================================
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

# ============================================
# LOGGING CONFIGURATION
# ============================================
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = os.getenv("LOG_FILE", "logs/app.log")
LOG_CONSOLE = os.getenv("LOG_CONSOLE", "True").lower() == "true"