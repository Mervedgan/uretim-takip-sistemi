# 🏭 Üretim Takip Sistemi - Backend API

Production-ready FastAPI backend for Production Planning & Tracking System.

## 📋 Özellikler

- ✅ JWT Authentication & RBAC (admin/planner/worker)
- ✅ Work Order Management
- ✅ Stage Tracking with State Machine
- ✅ Issue Management with Lifecycle
- ✅ Efficiency Metrics
- ✅ Machine Integration (Mock)
- ✅ PostgreSQL Database Support
- ✅ Alembic Migrations
- ✅ Docker Compose Setup
- ✅ Comprehensive Logging
- ✅ Request/Response Validation

## 🚀 Hızlı Başlangıç

### Gereksinimler

- Python 3.9+
- PostgreSQL 15+ (veya SQLite for development)
- Docker & Docker Compose (PostgreSQL için)

### Kurulum

1. **Repository'yi klonlayın ve backend dizinine gidin:**
```powershell
cd backend
```

2. **Virtual environment oluşturun:**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

3. **Dependencies yükleyin:**
```powershell
pip install -r requirements.txt
```

4. **Environment variables ayarlayın:**
```powershell
Copy-Item env.example .env
notepad .env  # .env dosyasını düzenleyin
```

5. **PostgreSQL'i başlatın (Docker ile):**
```powershell
docker-compose up -d postgres
```

6. **Database migrations çalıştırın:**
```powershell
alembic upgrade head
```

7. **Uygulamayı başlatın:**
```powershell
python -m uvicorn app.main:app --reload
```

8. **API dokümantasyonuna erişin:**
- Swagger UI: http://localhost:8000/api-docs
- ReDoc: http://localhost:8000/api-redoc

## 📁 Proje Yapısı

```
backend/
├── app/
│   ├── main.py              # FastAPI uygulaması
│   ├── config.py            # Konfigürasyon (env variables)
│   ├── db.py                # Database connection
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── logging_config.py    # Logging setup
│   ├── routers/             # API endpoints
│   │   ├── auth.py          # Authentication
│   │   ├── work_orders.py   # Work orders
│   │   ├── stages.py         # Stage operations
│   │   ├── issues.py         # Issue management
│   │   ├── metrics.py        # Efficiency metrics
│   │   └── machines.py       # Machine integration
│   └── utils/               # Utilities
│       ├── response.py       # Response formatters
│       └── state_machine.py  # State validation
├── alembic/                 # Database migrations
├── scripts/                 # Utility scripts
├── tests/                   # Test files
├── docker-compose.yml       # PostgreSQL container
├── requirements.txt         # Python dependencies
└── README.md               # Bu dosya
```

## 🔧 Konfigürasyon

### Environment Variables

`.env` dosyasında aşağıdaki değişkenleri ayarlayın:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/production_db

# Security
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Application
ENVIRONMENT=development
DEBUG=True
API_HOST=0.0.0.0
API_PORT=8000

# CORS
CORS_ORIGINS=*

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/app.log
LOG_CONSOLE=True
```

### Database Migration

**İlk migration oluşturma:**
```powershell
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

**Yeni migration oluşturma:**
```powershell
alembic revision --autogenerate -m "Add new feature"
alembic upgrade head
```

**Migration geri alma:**
```powershell
alembic downgrade -1
```

**SQLite'dan PostgreSQL'e veri migrasyonu:**
```powershell
python scripts/migrate_sqlite_to_postgres.py
```

## 📡 API Endpoints

### Authentication
- `POST /auth/register` - Kullanıcı kaydı
- `POST /auth/login` - Giriş (JWT token döner)
- `GET /auth/users` - Kullanıcı listesi (admin)
- `PATCH /auth/users/{user_id}/role` - Rol değiştir (admin)

### Work Orders
- `POST /workorders/` - İş emri oluştur (planner/admin)
- `GET /workorders/` - İş emirlerini listele
- `GET /workorders/{wo_id}` - İş emri detayı
- `GET /workorders/{wo_id}/stages` - İş emri aşamaları

### Stages
- `POST /stages/{wos_id}/start` - Aşama başlat (worker/planner)
- `POST /stages/{wos_id}/done` - Aşama bitir (worker/planner)
- `POST /stages/{wos_id}/issue` - Sorun bildir (worker/planner)

### Metrics
- `GET /metrics/workorders/{wo_id}` - İş emri metrikleri
- `GET /metrics/stages/{wos_id}` - Aşama metrikleri

### Issues
- `GET /issues` - Issue listesi (planner/admin)
- `PATCH /issues/{issue_id}/status` - Issue durumu güncelle

### Machines
- `GET /machines/` - Makine listesi
- `POST /machines/` - Makine oluştur
- `POST /machines/{machine_id}/readings` - Makine okuması gönder
- `GET /machines/{machine_id}/readings` - Makine okumaları

## 🧪 Testing

### Test Çalıştırma

```powershell
# Tüm testler
pytest tests/ -v

# Belirli test dosyası
pytest tests/test_auth.py -v

# Coverage ile
pytest tests/ --cov=app --cov-report=html
```

### Manual Testing (Swagger)

1. http://localhost:8000/api-docs adresine gidin
2. `/auth/register` ile kullanıcı oluşturun
3. `/auth/login` ile giriş yapın, token'ı kopyalayın
4. "Authorize" butonuna tıklayın, token'ı yapıştırın
5. Diğer endpoint'leri test edin

## 🐳 Docker

### PostgreSQL Container

```powershell
# Başlat
docker-compose up -d postgres

# Durdur
docker-compose down

# Logları görüntüle
docker-compose logs postgres

# pgAdmin (optional)
docker-compose --profile tools up -d pgadmin
# http://localhost:5050 - admin@admin.com / admin
```

## 📊 Database Models

- **User**: Kullanıcılar (admin/planner/worker)
- **WorkOrder**: İş emirleri
- **WorkOrderStage**: İş emri aşamaları
- **Issue**: Sorun bildirimleri
- **Machine**: Makineler
- **MachineReading**: Makine okumaları

## 🔐 Security

- JWT token authentication
- Password hashing (bcrypt)
- Role-based access control (RBAC)
- Input validation (Pydantic)
- SQL injection protection (SQLAlchemy ORM)

## 📝 Logging

Loglar `logs/app.log` dosyasına yazılır:
- Request/Response logging
- Error logging with stack traces
- Authentication attempts
- Database operations

## 🚧 Development

### Yeni Endpoint Ekleme

1. `app/routers/` altında yeni router oluşturun
2. `app/main.py`'de router'ı ekleyin
3. Gerekirse yeni model/schema ekleyin
4. Migration oluşturun: `alembic revision --autogenerate -m "Add feature"`
5. Test edin

### Code Style

- PEP 8
- Type hints kullanın
- Docstrings ekleyin
- Error handling yapın

## 📚 Daha Fazla Bilgi

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [Pydantic Documentation](https://docs.pydantic.dev/)

## 🐛 Sorun Giderme

### Database Connection Error
- PostgreSQL'in çalıştığından emin olun: `docker-compose ps`
- `.env` dosyasındaki `DATABASE_URL`'i kontrol edin

### Migration Error
- `alembic current` ile mevcut migration'ı kontrol edin
- `alembic history` ile migration geçmişini görün

### Import Error
- Virtual environment aktif mi kontrol edin
- `pip install -r requirements.txt` çalıştırın

## 📄 License

[Your License Here]

## 👥 Contributors

[Your Name/Team]

---

**Son Güncelleme:** 2024  
**Versiyon:** 1.0.0



