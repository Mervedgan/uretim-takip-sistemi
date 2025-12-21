from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class StartDoneResponse(BaseModel):
    ok: bool
    work_order_stage_id: int
    status: str
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None

class IssueCreate(BaseModel):
    type: str
    description: Optional[str] = None

class WorkOrderCreate(BaseModel):
    product_code: str
    lot_no: str
    qty: int
    planned_start: datetime
    planned_end: datetime
