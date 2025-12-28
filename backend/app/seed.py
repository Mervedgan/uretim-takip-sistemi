from sqlalchemy.orm import Session
from .db import SessionLocal, engine, Base
from .models import WorkOrder, WorkOrderStage, Product, Mold, User, Machine, Issue
from datetime import datetime, timedelta, timezone
import bcrypt

Base.metadata.create_all(bind=engine)

def hash_password(password: str) -> str:
    """Şifreyi hash'le - auth.py'deki aynı fonksiyon"""
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def run():
    db: Session = SessionLocal()
    
    # Admin kullanıcı bul veya oluştur
    admin_user = db.query(User).filter(User.username.ilike("admin")).first()
    if not admin_user:
        admin_user = User(
            username="admin",
            password_hash=hash_password("admin123"),
            role="admin",
            email="admin@example.com"
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        print(f"Admin user created: {admin_user.id}")
    else:
        print(f"Admin user found: {admin_user.id}")
    
    # 2 Product oluştur (eğer yoksa)
    product1 = db.query(Product).filter(Product.code == "PRD-001").first()
    if not product1:
        product1 = Product(
            code="PRD-001",
            name="Priz",
            description="Elektrik prizi ürünü"
        )
        db.add(product1)
        db.commit()
        db.refresh(product1)
        print(f"Product 1 created: {product1.id} - {product1.name}")
    
    product2 = db.query(Product).filter(Product.code == "PRD-002").first()
    if not product2:
        product2 = Product(
            code="PRD-002",
            name="Anahtar",
            description="Elektrik anahtarı ürünü"
        )
        db.add(product2)
        db.commit()
        db.refresh(product2)
        print(f"Product 2 created: {product2.id} - {product2.name}")
    
    # Kalıp 15 için ürün - database'deki mevcut veriyi kullan (oluşturma)
    # Not: Database'de zaten kalıp 15 var, sadece work order oluşturulacak
    product3 = db.query(Product).filter(Product.code == "PRD-015").first()
    if not product3:
        # Eğer yoksa oluştur (ama genelde database'de zaten var)
        product3 = Product(
            code="PRD-015",
            name="Ürün 15",
            description="Kalıp 15 için ürün"
        )
        db.add(product3)
        db.commit()
        db.refresh(product3)
        print(f"Product 3 created: {product3.id} - {product3.name}")
    else:
        print(f"Product 3 found (using existing): {product3.id} - {product3.name}")
    
    # Otomotiv klipsi ürünü oluştur (eğer yoksa)
    product4 = db.query(Product).filter(Product.code == "PRD-KLIP").first()
    if not product4:
        product4 = Product(
            code="PRD-KLIP",
            name="Otomotiv Klipsi",
            description="Otomotiv klipsi ürünü"
        )
        db.add(product4)
        db.commit()
        db.refresh(product4)
        print(f"Product 4 created: {product4.id} - {product4.name}")
    else:
        print(f"Product 4 found (using existing): {product4.id} - {product4.name}")
    
    # Her product için 1 Mold oluştur (eğer yoksa)
    mold1 = db.query(Mold).filter(Mold.code == "MOLD-001").first()
    if not mold1:
        mold1 = Mold(
            code="MOLD-001",
            name="KP-01",
            description="Priz kalıbı",
            product_id=product1.id,
            status="active",
            # Excel kolonları kaldırıldı - artık products tablosunda
        )
        db.add(mold1)
        db.commit()
        db.refresh(mold1)
        print(f"Mold 1 created: {mold1.id} - {mold1.name}")
        
        # Product'a Excel kolonlarını ekle
        product1.cavity_count = 2
        product1.cycle_time_sec = 35
        product1.injection_temp_c = 220
        product1.mold_temp_c = 45
        product1.material = "ABS"
        product1.part_weight_g = 35
        product1.hourly_production = 102
        db.commit()
        print(f"Product 1 Excel columns updated")
    
    mold2 = db.query(Mold).filter(Mold.code == "MOLD-002").first()
    if not mold2:
        mold2 = Mold(
            code="MOLD-002",
            name="KP-02",
            description="Anahtar kalıbı",
            product_id=product2.id,
            status="active",
            # Excel kolonları kaldırıldı - artık products tablosunda
        )
        db.add(mold2)
        db.commit()
        db.refresh(mold2)
        print(f"Mold 2 created: {mold2.id} - {mold2.name}")
        
        # Product'a Excel kolonlarını ekle
        product2.cavity_count = 1
        product2.cycle_time_sec = 40
        product2.injection_temp_c = 230
        product2.mold_temp_c = 50
        product2.material = "ABS"
        product2.part_weight_g = 25
        product2.hourly_production = 90
        db.commit()
        print(f"Product 2 Excel columns updated")
    
    # Kalıp 15 - Database'deki mevcut veriyi kullan (oluşturma, sadece kontrol et)
    # Not: Database'de zaten kalıp 15 var ve gerçek verileri var, yeni oluşturma!
    mold15 = db.query(Mold).filter(Mold.code == "MOLD-015").first()
    if not mold15:
        # Eğer gerçekten yoksa oluştur (ama genelde database'de zaten var)
        mold15 = Mold(
            code="MOLD-015",
            name="KP-15",
            description="Kalıp 15",
            product_id=product3.id if product3 else None,
            status="active",
            # Excel kolonları kaldırıldı - artık products tablosunda
        )
        db.add(mold15)
        db.commit()
        db.refresh(mold15)
        print(f"Mold 15 created: {mold15.id} - {mold15.name}")
        
        # Product'a Excel kolonlarını ekle
        if product3:
            product3.cavity_count = 4
            product3.cycle_time_sec = 16  # Database'deki gerçek değer
            product3.injection_temp_c = 200  # Database'deki gerçek değer
            product3.mold_temp_c = 30  # Database'deki gerçek değer
            product3.material = "PP"
            product3.part_weight_g = 50
            product3.hourly_production = 225  # Hesaplanmış değer (3600/16)
            db.commit()
            print(f"Product 3 Excel columns updated")
    else:
        print(f"Mold 15 found (using existing database data): {mold15.id} - {mold15.name}")
        # Product'tan Excel kolonlarını oku
        if mold15.product_id:
            product15 = db.query(Product).filter(Product.id == mold15.product_id).first()
            if product15:
                print(f"  - Cycle Time: {product15.cycle_time_sec} sec")
                print(f"  - Injection Temp: {product15.injection_temp_c}°C")
                print(f"  - Mold Temp: {product15.mold_temp_c}°C")
                print(f"  - Material: {product15.material}")
                print(f"  - Part Weight: {product15.part_weight_g}g")
    
    # Otomotiv klipsi kalıbı oluştur (eğer yoksa)
    moldKlip = db.query(Mold).filter(Mold.code == "MOLD-KLIP").first()
    if not moldKlip:
        moldKlip = Mold(
            code="MOLD-KLIP",
            name="KP-KLIP",
            description="Otomotiv klipsi kalıbı",
            product_id=product4.id,
            status="active",
            # Excel kolonları kaldırıldı - artık products tablosunda
        )
        db.add(moldKlip)
        db.commit()
        db.refresh(moldKlip)
        print(f"Mold Klip created: {moldKlip.id} - {moldKlip.name}")
        
        # Product'a Excel kolonlarını ekle
        product4.cavity_count = 8
        product4.cycle_time_sec = 25
        product4.injection_temp_c = 250
        product4.mold_temp_c = 60
        product4.material = "PA6"
        product4.part_weight_g = 12
        product4.hourly_production = 288
        db.commit()
        print(f"Product 4 Excel columns updated")
    
    # Makineleri oluştur (eğer yoksa) - 10 makine
    print("\n[Makine Oluşturma]")
    for i in range(1, 11):  # 1'den 10'a kadar (MACHINE 01 - MACHINE 10)
        machine_name = f"MACHINE {i:02d}"  # MACHINE 01, MACHINE 02, vb.
        existing_machine = db.query(Machine).filter(Machine.name == machine_name).first()
        
        if not existing_machine:
            machine = Machine(
                name=machine_name,
                machine_type="injection_molding",
                location=f"Üretim Hattı {i}",
                status="active"
            )
            db.add(machine)
            db.commit()
            db.refresh(machine)
            print(f"  - {machine_name} oluşturuldu (ID: {machine.id})")
        else:
            print(f"  - {machine_name} zaten mevcut (ID: {existing_machine.id})")
    
    # Tüm mevcut aktif work order'ları sil (aktif üretimler bölümünü boşalt)
    print("\n[Aktif Üretimleri Temizleme]")
    
    # Önce issues tablosunu temizle (foreign key hatası olmaması için)
    all_issues = db.query(Issue).all()
    for issue in all_issues:
        db.delete(issue)
    db.commit()
    print(f"  - {len(all_issues)} issue silindi")
    
    # Sonra TÜM stage'leri sil (foreign key hatası olmaması için)
    all_stages = db.query(WorkOrderStage).all()
    for stage in all_stages:
        db.delete(stage)
    db.commit()
    print(f"  - {len(all_stages)} stage silindi")
    
    # Sonra tüm work order'ları sil
    all_work_orders = db.query(WorkOrder).all()
    for wo in all_work_orders:
        db.delete(wo)
        print(f"  - Work Order {wo.id} (product_code: {wo.product_code}) silindi")
    
    db.commit()
    print(f"  Toplam {len(all_work_orders)} work order silindi.\n")
    
    # Sadece kalıp 3 ve kalıp 5 için work order oluştur (database'deki mevcut verileri kullan)
    now = datetime.now(timezone.utc)
    
    # Kalıp 3 için product ve mold bul
    mold3 = db.query(Mold).filter(Mold.code == "MOLD-003").first()
    if not mold3:
        # Eğer MOLD-003 yoksa, ID=3 olan kalıbı bul
        mold3 = db.query(Mold).filter(Mold.id == 3).first()
    
    if mold3:
        # Kalıp 3'e ait product'ı bul
        product3 = db.query(Product).filter(Product.id == mold3.product_id).first() if mold3.product_id else None
        
        if product3:
            # Kalıp 3 için work order oluştur
            wo3 = WorkOrder(
                product_code=product3.code,
                lot_no="LOT-003",
                qty=1500,
                planned_start=now - timedelta(hours=1),
                planned_end=now + timedelta(hours=3),
                created_by=admin_user.id
            )
            db.add(wo3)
            db.commit()
            db.refresh(wo3)
            print(f"Work Order 3 created (Kalıp 3): {wo3.id} - Product: {product3.code}")
            
            # Aktif stage oluştur (in_progress)
            stage3 = WorkOrderStage(
                work_order_id=wo3.id,
                stage_name="Enjeksiyon",
                planned_start=wo3.planned_start,
                planned_end=wo3.planned_start + timedelta(minutes=60),
                actual_start=now - timedelta(minutes=30),
                status="in_progress"
            )
            db.add(stage3)
            db.commit()
            print(f"Stage 3 created (in_progress): {stage3.id}")
        else:
            print("Kalıp 3 için product bulunamadı (product_id: {})".format(mold3.product_id))
    else:
        print("Kalıp 3 (MOLD-003 veya ID=3) bulunamadı")
    
    # Kalıp 5 için product ve mold bul
    mold5 = db.query(Mold).filter(Mold.code == "MOLD-005").first()
    if not mold5:
        # Eğer MOLD-005 yoksa, ID=5 olan kalıbı bul
        mold5 = db.query(Mold).filter(Mold.id == 5).first()
    
    if mold5:
        # Kalıp 5'e ait product'ı bul
        product5 = db.query(Product).filter(Product.id == mold5.product_id).first() if mold5.product_id else None
        
        if product5:
            # Kalıp 5 için work order oluştur
            wo5 = WorkOrder(
                product_code=product5.code,
                lot_no="LOT-005",
                qty=2000,
                planned_start=now - timedelta(hours=2),
                planned_end=now + timedelta(hours=4),
                created_by=admin_user.id
            )
            db.add(wo5)
            db.commit()
            db.refresh(wo5)
            print(f"Work Order 5 created (Kalıp 5): {wo5.id} - Product: {product5.code}")
            
            # Aktif stage oluştur (in_progress)
            stage5 = WorkOrderStage(
                work_order_id=wo5.id,
                stage_name="Enjeksiyon",
                planned_start=wo5.planned_start,
                planned_end=wo5.planned_start + timedelta(minutes=70),
                actual_start=now - timedelta(minutes=25),
                status="in_progress"
            )
            db.add(stage5)
            db.commit()
            print(f"Stage 5 created (in_progress): {stage5.id}")
        else:
            print("Kalıp 5 için product bulunamadı (product_id: {})".format(mold5.product_id))
    else:
        print("Kalıp 5 (MOLD-005 veya ID=5) bulunamadı")
    
    print("\n[OK] Seed tamamlandi!")
    print(f"\n[NOT] Database'deki mevcut veriler kullaniliyor.")
    print(f"      Aktif üretimler bölümü temizlendi.")
    print(f"      Sadece kalıp 3 ve kalıp 5 için work order oluşturuldu.")
    print(f"      Yeni üretim başlatmak için uygulamadan 'Yeni Üretim' butonunu kullanin.")
    
    db.close()

if __name__ == "__main__":
    run()
