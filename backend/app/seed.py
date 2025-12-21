from sqlalchemy.orm import Session
from .db import SessionLocal, engine, Base
from .models import WorkOrder, WorkOrderStage
from datetime import datetime, timedelta

Base.metadata.create_all(bind=engine)

def run():
    db: Session = SessionLocal()
    if db.query(WorkOrder).count() == 0:
        wo = WorkOrder(
            product_code="PRD-1001",
            lot_no="LOT-001",
            qty=1000,
            planned_start=datetime.utcnow(),
            planned_end=datetime.utcnow() + timedelta(hours=2),
        )
        db.add(wo); db.commit(); db.refresh(wo)

        s1 = WorkOrderStage(
            work_order_id=wo.id, stage_name="Enjeksiyon",
            planned_start=wo.planned_start,
            planned_end=wo.planned_start + timedelta(minutes=30)
        )
        s2 = WorkOrderStage(
            work_order_id=wo.id, stage_name="Montaj",
            planned_start=wo.planned_start + timedelta(minutes=30),
            planned_end=wo.planned_start + timedelta(minutes=90)
        )
        db.add_all([s1, s2]); db.commit()
        print(f"Seed ok: WO {wo.id}, stages: {s1.id}, {s2.id}")
    else:
        print("Seed atlandı (veri zaten var).")
    db.close()

if __name__ == "__main__":
    run()
