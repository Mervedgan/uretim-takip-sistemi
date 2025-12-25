from app.db import SessionLocal
from app.models import User

db = SessionLocal()
admin = db.query(User).filter(User.username == 'admin').first()

if admin:
    print(f"Mevcut rol: {admin.role}")
    admin.role = 'admin'
    db.commit()
    db.refresh(admin)
    print(f"✅ Admin rolü güncellendi: {admin.username} -> {admin.role}")
else:
    print("Admin kullanıcısı bulunamadı")

db.close()



