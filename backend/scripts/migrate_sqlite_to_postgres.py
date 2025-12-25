"""
SQLite veritabanından PostgreSQL'e veri migrasyon scripti
"""
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models import Base, User, WorkOrder, WorkOrderStage, Issue
from app.config import DATABASE_URL

load_dotenv()

def migrate_data():
    """SQLite'dan PostgreSQL'e veri migrasyonu"""
    
    # SQLite source
    sqlite_url = "sqlite:///./database.db"
    sqlite_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    SQLiteSession = sessionmaker(bind=sqlite_engine)
    sqlite_db = SQLiteSession()
    
    # PostgreSQL destination
    postgres_url = os.getenv("DATABASE_URL")
    if not postgres_url or not postgres_url.startswith("postgresql"):
        print("ERROR: DATABASE_URL must be set to PostgreSQL connection string")
        print("Example: postgresql://postgres:postgres@localhost:5432/production_db")
        return
    
    postgres_engine = create_engine(postgres_url)
    PostgresSession = sessionmaker(bind=postgres_engine)
    postgres_db = PostgresSession()
    
    try:
        print("Starting migration...")
        
        # Migrate Users
        print("Migrating users...")
        users = sqlite_db.query(User).all()
        for user in users:
            existing = postgres_db.query(User).filter(User.id == user.id).first()
            if not existing:
                postgres_db.add(User(
                    id=user.id,
                    username=user.username,
                    password_hash=user.password_hash,
                    role=user.role
                ))
        postgres_db.commit()
        print(f"  Migrated {len(users)} users")
        
        # Migrate Work Orders
        print("Migrating work orders...")
        work_orders = sqlite_db.query(WorkOrder).all()
        for wo in work_orders:
            existing = postgres_db.query(WorkOrder).filter(WorkOrder.id == wo.id).first()
            if not existing:
                postgres_db.add(WorkOrder(
                    id=wo.id,
                    product_code=wo.product_code,
                    lot_no=wo.lot_no,
                    qty=wo.qty,
                    planned_start=wo.planned_start,
                    planned_end=wo.planned_end
                ))
        postgres_db.commit()
        print(f"  Migrated {len(work_orders)} work orders")
        
        # Migrate Work Order Stages
        print("Migrating work order stages...")
        stages = sqlite_db.query(WorkOrderStage).all()
        for stage in stages:
            existing = postgres_db.query(WorkOrderStage).filter(WorkOrderStage.id == stage.id).first()
            if not existing:
                postgres_db.add(WorkOrderStage(
                    id=stage.id,
                    work_order_id=stage.work_order_id,
                    stage_name=stage.stage_name,
                    planned_start=stage.planned_start,
                    planned_end=stage.planned_end,
                    actual_start=stage.actual_start,
                    actual_end=stage.actual_end,
                    status=stage.status
                ))
        postgres_db.commit()
        print(f"  Migrated {len(stages)} stages")
        
        # Migrate Issues
        print("Migrating issues...")
        issues = sqlite_db.query(Issue).all()
        for issue in issues:
            existing = postgres_db.query(Issue).filter(Issue.id == issue.id).first()
            if not existing:
                postgres_db.add(Issue(
                    id=issue.id,
                    work_order_stage_id=issue.work_order_stage_id,
                    type=issue.type,
                    description=issue.description,
                    status=getattr(issue, 'status', 'open'),  # Backward compatibility
                    created_by=issue.created_by,
                    created_at=issue.created_at
                ))
        postgres_db.commit()
        print(f"  Migrated {len(issues)} issues")
        
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        postgres_db.rollback()
        raise
    finally:
        sqlite_db.close()
        postgres_db.close()

if __name__ == "__main__":
    migrate_data()



