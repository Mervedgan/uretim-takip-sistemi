import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler
from app.config import LOG_LEVEL, LOG_FILE, LOG_CONSOLE, ENVIRONMENT

# Logs dizinini oluştur
log_path = Path(LOG_FILE)
log_path.parent.mkdir(parents=True, exist_ok=True)

# Logger yapılandırması
def setup_logging():
    """Logging yapılandırmasını ayarlar"""
    
    # Root logger
    logger = logging.getLogger()
    logger.setLevel(getattr(logging, LOG_LEVEL.upper()))
    
    # Format
    if ENVIRONMENT == "production":
        # Production: JSON format (structured logging)
        formatter = logging.Formatter(
            '{"time": "%(asctime)s", "level": "%(levelname)s", "module": "%(name)s", "message": "%(message)s"}',
            datefmt="%Y-%m-%d %H:%M:%S"
        )
    else:
        # Development: Human-readable format
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt="%Y-%m-%d %H:%M:%S"
        )
    
    # File handler (rotating)
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    # Console handler
    if LOG_CONSOLE:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.DEBUG if ENVIRONMENT == "development" else logging.INFO)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
    
    return logger

# Logger'ı başlat
logger = setup_logging()



