from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to path to import app
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Import Base and models
from app.db import Base
from app.models import User, WorkOrder, WorkOrderStage, Issue, Machine, MachineReading, Notification

# this is the Alembic Config object
config = context.config

# Override sqlalchemy.url from environment variable
# PostgreSQL Docker connection configuration
# Docker Compose maps container port 5432 to host port 5433
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5433")  # Docker host port
POSTGRES_DB = os.getenv("POSTGRES_DB", "production_db")

# Construct PostgreSQL Docker URL for production_db database
# Format: postgresql://username:password@host:port/database
postgres_docker_url = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

# Get DATABASE_URL from .env file, fallback to PostgreSQL Docker URL if not set
database_url = os.getenv("DATABASE_URL")
if not database_url:
    # If DATABASE_URL is not set in .env, use PostgreSQL Docker URL (production_db)
    database_url = postgres_docker_url
    print(f"Connecting to PostgreSQL database: {POSTGRES_DB}")
    print(f"Connection URL: {postgres_docker_url.replace(POSTGRES_PASSWORD, '***')}")

# Ensure we're connecting to production_db
if POSTGRES_DB not in database_url:
    # If DATABASE_URL doesn't contain production_db, use the constructed URL
    database_url = postgres_docker_url
    print(f"Using production_db database: {postgres_docker_url.replace(POSTGRES_PASSWORD, '***')}")

# Set the database URL for Alembic
config.set_main_option("sqlalchemy.url", database_url)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

