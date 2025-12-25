# 🚀 Production-Ready Backend Implementation Roadmap
## Üretim Takip Sistemi - Final Implementation Plan

**Timeline:** 6-8 weeks  
**Target:** Production-ready FastAPI backend with PostgreSQL, Docker, migrations, testing, and complete features

---

## 📊 CURRENT STATE ANALYSIS

### ✅ What EXISTS Now

#### **Core Infrastructure**
- ✅ FastAPI application (`app/main.py`)
- ✅ SQLAlchemy models (User, WorkOrder, WorkOrderStage, Issue)
- ✅ SQLite database (`database.db`)
- ✅ JWT authentication (`app/routers/auth.py`)
- ✅ RBAC helper functions (`require_roles`, `get_current_user`)
- ✅ CORS middleware (configured, but needs refinement)
- ✅ Swagger/OpenAPI docs (`/api-docs`)

#### **Endpoints**
- ✅ `POST /auth/login` - Login with JWT
- ✅ `POST /auth/register` - User registration
- ✅ `POST /workorders/` - Create work order (planner/admin)
- ✅ `GET /workorders/` - List work orders (all roles)
- ✅ `GET /workorders/{wo_id}` - Get work order detail
- ✅ `GET /workorders/{wo_id}/stages` - Get stages for work order
- ✅ `POST /stages/{wos_id}/start` - Start stage (worker/planner)
- ✅ `POST /stages/{wos_id}/done` - Complete stage (worker/planner)
- ✅ `POST /stages/{wos_id}/issue` - Report issue (worker/planner)

#### **Models**
- ✅ User (id, username, password_hash, role)
- ✅ WorkOrder (id, product_code, lot_no, qty, planned_start, planned_end)
- ✅ WorkOrderStage (id, work_order_id, stage_name, planned_start, planned_end, actual_start, actual_end, status)
- ✅ Issue (id, work_order_stage_id, type, description, created_by, created_at)

#### **Utilities**
- ✅ Seed script (`app/seed.py`)
- ✅ Basic schemas (`app/schemas.py`)
- ✅ Requirements.txt

---

### ❌ What is MISSING

#### **Database & Infrastructure**
- ❌ PostgreSQL migration (still using SQLite)
- ❌ Docker Compose setup
- ❌ Environment variables (.env) - SECRET_KEY, DATABASE_URL hardcoded
- ❌ Alembic migrations (using `Base.metadata.create_all()`)
- ❌ Database connection pooling/optimization
- ❌ Migration scripts for existing SQLite data

#### **Backend Hardening**
- ❌ Consistent response format (success/error wrappers)
- ❌ Request/error logging (no logging configured)
- ❌ Pydantic validation (dates, qty > 0, start < end, etc.)
- ❌ Proper error handling middleware
- ❌ CORS configuration for mobile (currently `allow_origins=["*"]`)

#### **RBAC Completion**
- ❌ Admin: List users endpoint
- ❌ Admin: Change user roles endpoint
- ❌ Planner/Admin: Define custom stages when creating work order
- ❌ Worker: Stage assignment model (who can work on which stage)
- ❌ Worker: Only assigned stages visible/accessible

#### **Production Tracking**
- ❌ Auto-create default stages when work order created
- ❌ Stage state machine validation (planned → in_progress → done)
- ❌ Prevent invalid state transitions
- ❌ Efficiency/metrics endpoints (planned vs actual duration, delay, efficiency score)
- ❌ Issue lifecycle (open/ack/resolved status)
- ❌ Manager views and filters for issues

#### **Machine Integration**
- ❌ Machine model
- ❌ MachineReading model
- ❌ POST endpoint for mock readings
- ❌ Documentation for real integration (OPC-UA/Modbus/MQTT)

#### **Testing & Documentation**
- ❌ Automated tests (pytest)
- ❌ Test coverage for auth flow
- ❌ Test coverage for work order flow
- ❌ Test coverage for stage flow
- ❌ README.md
- ❌ .env.example
- ❌ docker-compose.yml
- ❌ Migration guide

---

## 🎯 SAFEST IMPLEMENTATION ORDER

**Principle:** Minimize breaking changes, test incrementally, maintain backward compatibility

### Phase 1: Foundation (Week 1-2)
1. **Environment Variables** (.env) - No breaking changes, just refactor
2. **Logging Setup** - Additive only
3. **Response Format Standardization** - Backward compatible wrapper
4. **Pydantic Validation** - Enhance existing schemas, don't change endpoints

### Phase 2: Database Migration (Week 2-3)
5. **Alembic Setup** - Initialize migrations
6. **Docker Compose** - PostgreSQL container
7. **Database URL Migration** - Support both SQLite (dev) and PostgreSQL (prod)
8. **Data Migration Script** - Export SQLite → Import PostgreSQL
9. **Test Migration** - Verify all endpoints work with PostgreSQL

### Phase 3: RBAC & Features (Week 3-5)
10. **Admin Endpoints** - List users, change roles
11. **Stage Assignment Model** - Add assignment table
12. **Auto-create Stages** - Enhance work order creation
13. **State Machine Validation** - Enhance stage endpoints
14. **Efficiency Metrics** - New endpoints

### Phase 4: Machine Integration (Week 5-6)
15. **Machine Models** - Add Machine, MachineReading
16. **Mock Endpoint** - POST readings
17. **Documentation** - Integration guide

### Phase 5: Testing & Polish (Week 6-8)
18. **Pytest Setup** - Test infrastructure
19. **Auth Tests** - Login, register, JWT
20. **Work Order Tests** - CRUD operations
21. **Stage Tests** - Start, done, state transitions
22. **Documentation** - README, .env.example, migration guide
23. **Final Checklist** - All deliverables

---

## 📅 WEEK-BY-WEEK PLAN

### **WEEK 1: Environment & Logging Foundation**

#### Day 1-2: Environment Variables
- [ ] Create `.env.example` with all required variables
- [ ] Install `python-dotenv`
- [ ] Refactor `app/config.py` to read from `.env`
- [ ] Update `app/db.py` to use `DATABASE_URL` from config
- [ ] Update `app/routers/auth.py` to use `SECRET_KEY` from config
- [ ] Test: Verify app still works with `.env` file
- [ ] **Acceptance:** App runs with `.env`, all endpoints functional

#### Day 3-4: Logging Setup
- [ ] Create `app/logging_config.py`
- [ ] Configure structured logging (JSON format for production)
- [ ] Add request logging middleware
- [ ] Add error logging middleware
- [ ] Log all authentication attempts
- [ ] Log all database operations (errors)
- [ ] Test: Check log files created, errors logged
- [ ] **Acceptance:** All requests logged, errors captured

#### Day 5: Response Format Standardization
- [ ] Create `app/utils/response.py` with `SuccessResponse`, `ErrorResponse`
- [ ] Create response wrapper middleware (optional, or helper functions)
- [ ] Update existing endpoints to use consistent format (gradually)
- [ ] Test: Verify backward compatibility
- [ ] **Acceptance:** Responses follow standard format, mobile app still works

---

### **WEEK 2: Database Migration Preparation**

#### Day 1-2: Alembic Setup
- [ ] Install `alembic`
- [ ] Run `alembic init alembic` in backend/
- [ ] Configure `alembic.ini` to use `DATABASE_URL` from `.env`
- [ ] Update `alembic/env.py` to import Base and models
- [ ] Create initial migration: `alembic revision --autogenerate -m "Initial schema"`
- [ ] Review migration file
- [ ] Test: Run `alembic upgrade head` on fresh database
- [ ] **Acceptance:** Alembic creates all tables correctly

#### Day 3-4: Docker Compose Setup
- [ ] Create `docker-compose.yml` with PostgreSQL service
- [ ] Create `Dockerfile` for FastAPI app (optional, for later)
- [ ] Configure PostgreSQL: database name, user, password
- [ ] Add `pgadmin` service (optional, for DB management)
- [ ] Test: `docker-compose up -d postgres`
- [ ] Test: Connect to PostgreSQL from local machine
- [ ] **Acceptance:** PostgreSQL running, accessible, can create tables

#### Day 5: Database URL Migration
- [ ] Update `app/db.py` to support both SQLite and PostgreSQL
- [ ] Add connection pooling for PostgreSQL
- [ ] Test: App works with SQLite (backward compatibility)
- [ ] Test: App works with PostgreSQL (new setup)
- [ ] **Acceptance:** App can switch between databases via `.env`

---

### **WEEK 3: Database Migration Execution**

#### Day 1-2: Data Migration Script
- [ ] Create `scripts/migrate_sqlite_to_postgres.py`
- [ ] Script exports all data from SQLite
- [ ] Script imports to PostgreSQL (respecting foreign keys)
- [ ] Handle edge cases (duplicates, missing relations)
- [ ] Test: Run migration on copy of production SQLite DB
- [ ] Verify: All tables, all rows migrated
- [ ] **Acceptance:** All data successfully migrated

#### Day 3-4: Alembic Migrations for Existing Schema
- [ ] Create migration that matches current SQLite schema
- [ ] Test: `alembic upgrade head` creates correct schema
- [ ] Update `app/main.py` to remove `Base.metadata.create_all()`
- [ ] Test: App starts, uses Alembic migrations only
- [ ] **Acceptance:** App uses migrations, no direct table creation

#### Day 5: Testing & Validation
- [ ] Run all existing endpoints against PostgreSQL
- [ ] Test: Auth flow (login, register, JWT)
- [ ] Test: Work order CRUD
- [ ] Test: Stage operations (start, done, issue)
- [ ] Performance test: Compare SQLite vs PostgreSQL
- [ ] **Acceptance:** All endpoints work identically with PostgreSQL

---

### **WEEK 4: RBAC Completion & Validation**

#### Day 1-2: Admin Endpoints
- [ ] `GET /auth/users` - List all users (admin only)
- [ ] `PATCH /auth/users/{user_id}/role` - Change user role (admin only)
- [ ] Add validation: role must be one of ["admin", "planner", "worker"]
- [ ] Test: Admin can list users, change roles
- [ ] Test: Non-admin cannot access
- [ ] **Acceptance:** Admin endpoints functional, RBAC enforced

#### Day 3: Pydantic Validation Enhancement
- [ ] Update `WorkOrderCreate` schema:
  - [ ] `qty > 0` validation
  - [ ] `planned_start < planned_end` validation
  - [ ] Date format validation
- [ ] Update `IssueCreate` schema:
  - [ ] `type` enum validation
- [ ] Add custom validators
- [ ] Test: Invalid data rejected with clear errors
- [ ] **Acceptance:** All validation rules enforced

#### Day 4-5: Stage Assignment Model
- [ ] Create `StageAssignment` model (user_id, work_order_stage_id)
- [ ] Create Alembic migration
- [ ] Update `GET /workorders/{wo_id}/stages` to show assignments
- [ ] Update `POST /stages/{wos_id}/start` to check assignment (for workers)
- [ ] Planner/Admin can start any stage
- [ ] Test: Workers can only start assigned stages
- [ ] **Acceptance:** Assignment system functional

---

### **WEEK 5: Production Tracking Features**

#### Day 1-2: Auto-create Default Stages
- [ ] Update `POST /workorders/` endpoint
- [ ] After creating work order, auto-create default stages:
  - [ ] "Enjeksiyon" (planned_start to planned_start + 30min)
  - [ ] "Montaj" (planned_start + 30min to planned_end)
- [ ] Make stages configurable (optional: custom stages parameter)
- [ ] Test: Work order creation creates stages automatically
- [ ] **Acceptance:** Default stages created, custom stages supported

#### Day 3: State Machine Validation
- [ ] Create `app/utils/state_machine.py`
- [ ] Define valid transitions: `planned → in_progress → done`
- [ ] Update `POST /stages/{wos_id}/start` to validate current state
- [ ] Update `POST /stages/{wos_id}/done` to validate current state
- [ ] Prevent invalid transitions (e.g., done → in_progress)
- [ ] Test: Invalid transitions rejected
- [ ] **Acceptance:** State machine enforced, invalid transitions blocked

#### Day 4-5: Efficiency Metrics Endpoints
- [ ] `GET /workorders/{wo_id}/metrics` - Planned vs actual duration
- [ ] `GET /stages/{wos_id}/metrics` - Stage efficiency
- [ ] Calculate: delay, efficiency score, on-time percentage
- [ ] Add to response: planned_duration, actual_duration, delay_minutes, efficiency_percent
- [ ] Test: Metrics calculated correctly
- [ ] **Acceptance:** Metrics endpoints return accurate data

---

### **WEEK 6: Issue Lifecycle & Machine Integration**

#### Day 1-2: Issue Lifecycle
- [ ] Add `status` field to `Issue` model (open/ack/resolved)
- [ ] Create Alembic migration
- [ ] `PATCH /stages/{wos_id}/issues/{issue_id}` - Update issue status
- [ ] `GET /issues` - List all issues (manager/admin)
- [ ] Add filters: by status, by type, by work_order_stage_id
- [ ] Test: Issue lifecycle works end-to-end
- [ ] **Acceptance:** Issues can be tracked through lifecycle

#### Day 3-4: Machine Integration Models
- [ ] Create `Machine` model (id, name, machine_type, location, status)
- [ ] Create `MachineReading` model (id, machine_id, reading_type, value, timestamp)
- [ ] Create Alembic migration
- [ ] `POST /machines/{machine_id}/readings` - Post mock readings
- [ ] Add validation: reading_type enum, value range checks
- [ ] Test: Can create machines, post readings
- [ ] **Acceptance:** Machine models and endpoint functional

#### Day 5: Machine Integration Documentation
- [ ] Create `docs/machine_integration.md`
- [ ] Document: OPC-UA integration approach
- [ ] Document: Modbus integration approach
- [ ] Document: MQTT integration approach
- [ ] Provide example code snippets
- [ ] **Acceptance:** Documentation complete, actionable

---

### **WEEK 7: Testing Infrastructure**

#### Day 1-2: Pytest Setup
- [ ] Install `pytest`, `pytest-asyncio`, `httpx`
- [ ] Create `tests/` directory structure
- [ ] Create `tests/conftest.py` with fixtures:
  - [ ] Test database (SQLite in-memory or PostgreSQL test DB)
  - [ ] Test client
  - [ ] Test users (admin, planner, worker)
- [ ] Create `tests/test_auth.py`:
  - [ ] Test register
  - [ ] Test login
  - [ ] Test JWT validation
  - [ ] Test invalid credentials
- [ ] Run tests: `pytest tests/test_auth.py -v`
- [ ] **Acceptance:** Auth tests pass

#### Day 3-4: Work Order Tests
- [ ] Create `tests/test_work_orders.py`:
  - [ ] Test create work order (planner)
  - [ ] Test create work order (worker - should fail)
  - [ ] Test list work orders
  - [ ] Test get work order detail
  - [ ] Test get work order stages
- [ ] Run tests: `pytest tests/test_work_orders.py -v`
- [ ] **Acceptance:** Work order tests pass

#### Day 5: Stage Tests
- [ ] Create `tests/test_stages.py`:
  - [ ] Test start stage (valid transition)
  - [ ] Test start stage (invalid state)
  - [ ] Test done stage (valid transition)
  - [ ] Test done stage (not started)
  - [ ] Test report issue
- [ ] Run tests: `pytest tests/test_stages.py -v`
- [ ] **Acceptance:** Stage tests pass

---

### **WEEK 8: Documentation & Final Polish**

#### Day 1-2: README.md
- [ ] Project overview
- [ ] Installation instructions
- [ ] Environment variables documentation
- [ ] Running the application (local, Docker)
- [ ] API documentation links
- [ ] Testing instructions
- [ ] Migration guide (SQLite → PostgreSQL)

#### Day 3: .env.example
- [ ] All required variables documented
- [ ] Example values provided
- [ ] Comments explaining each variable

#### Day 4: Final Checklist
- [ ] All endpoints tested manually (Swagger)
- [ ] All automated tests passing
- [ ] Docker Compose works
- [ ] Migrations work
- [ ] Documentation complete
- [ ] Mobile app integration tested
- [ ] Performance acceptable

#### Day 5: Delivery Preparation
- [ ] Create final deliverables checklist
- [ ] Review all code for consistency
- [ ] Update version numbers
- [ ] Create release notes
- [ ] **Acceptance:** All deliverables complete

---

## 📁 FINAL FILE STRUCTURE

```
backend/
├── .env                          # Local environment (gitignored)
├── .env.example                  # Template for environment variables
├── .gitignore                    # Git ignore rules
├── docker-compose.yml            # PostgreSQL + optional services
├── Dockerfile                    # FastAPI app container (optional)
├── requirements.txt              # Python dependencies
├── README.md                     # Complete documentation
│
├── alembic/                      # Alembic migrations
│   ├── versions/
│   │   ├── 001_initial_schema.py
│   │   ├── 002_add_stage_assignment.py
│   │   ├── 003_add_issue_status.py
│   │   └── 004_add_machine_models.py
│   ├── env.py
│   └── script.py.mako
│
├── app/
│   ├── __init__.py
│   ├── main.py                   # FastAPI app
│   ├── config.py                 # Configuration (reads .env)
│   ├── db.py                     # Database connection
│   ├── models.py                 # SQLAlchemy models
│   ├── schemas.py                # Pydantic schemas
│   ├── seed.py                   # Seed data script
│   ├── logging_config.py         # Logging configuration
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py               # Auth endpoints + RBAC
│   │   ├── work_orders.py        # Work order endpoints
│   │   ├── stages.py             # Stage endpoints
│   │   ├── issues.py             # Issue management (new)
│   │   ├── metrics.py            # Efficiency metrics (new)
│   │   ├── machines.py           # Machine integration (new)
│   │   └── export.py             # Export endpoints (if needed)
│   │
│   └── utils/
│       ├── __init__.py
│       ├── response.py           # Response formatters
│       └── state_machine.py      # Stage state validation
│
├── scripts/
│   ├── migrate_sqlite_to_postgres.py
│   └── seed_production.py
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py               # Pytest fixtures
│   ├── test_auth.py
│   ├── test_work_orders.py
│   ├── test_stages.py
│   └── test_metrics.py
│
└── docs/
    ├── machine_integration.md
    └── migration_guide.md
```

---

## ✅ ACCEPTANCE TESTS

### **Database Migration**
- [ ] Alembic creates all tables correctly
- [ ] Existing SQLite data migrates to PostgreSQL without loss
- [ ] All foreign keys preserved
- [ ] App works identically with PostgreSQL
- [ ] Migrations can be rolled back (`alembic downgrade`)

### **Environment Variables**
- [ ] App reads all config from `.env`
- [ ] No hardcoded secrets in code
- [ ] `.env.example` documents all variables
- [ ] App fails gracefully if required vars missing

### **Logging**
- [ ] All requests logged (method, path, user, timestamp)
- [ ] All errors logged with stack traces
- [ ] Logs written to file (production) and console (development)
- [ ] Log rotation configured

### **RBAC**
- [ ] Admin can list users
- [ ] Admin can change user roles
- [ ] Non-admin cannot access admin endpoints (403)
- [ ] Workers can only start assigned stages
- [ ] Planner/Admin can start any stage

### **Validation**
- [ ] `qty > 0` enforced
- [ ] `planned_start < planned_end` enforced
- [ ] Invalid dates rejected
- [ ] Invalid state transitions rejected
- [ ] Error messages clear and actionable

### **Production Tracking**
- [ ] Default stages auto-created
- [ ] State machine enforced (planned → in_progress → done)
- [ ] Metrics calculated correctly
- [ ] Issue lifecycle works (open → ack → resolved)

### **Testing**
- [ ] All pytest tests pass
- [ ] Test coverage > 70% for critical paths
- [ ] Tests run in CI/CD (if applicable)

### **Documentation**
- [ ] README.md complete and accurate
- [ ] API docs (Swagger) up to date
- [ ] Migration guide clear
- [ ] Machine integration docs complete

---

## 🖥️ WINDOWS POWERSHELL COMMANDS

### **Week 1: Environment Setup**

```powershell
# Navigate to backend directory
cd backend

# Install python-dotenv
pip install python-dotenv

# Create .env file (copy from .env.example)
Copy-Item .env.example .env

# Edit .env file (use your preferred editor)
notepad .env

# Test: Run app
python -m uvicorn app.main:app --reload
```

### **Week 2: Alembic Setup**

```powershell
# Install alembic
pip install alembic

# Initialize Alembic
alembic init alembic

# Create initial migration
alembic revision --autogenerate -m "Initial schema"

# Review migration file
notepad alembic/versions/xxxx_initial_schema.py

# Apply migration (to SQLite first, for testing)
alembic upgrade head

# Check migration status
alembic current
alembic history
```

### **Week 2: Docker Compose**

```powershell
# Install Docker Desktop for Windows (if not installed)
# Download from: https://www.docker.com/products/docker-desktop

# Start PostgreSQL container
docker-compose up -d postgres

# Check container status
docker-compose ps

# View logs
docker-compose logs postgres

# Connect to PostgreSQL (if psql installed)
# Or use pgAdmin from docker-compose
docker-compose up -d pgadmin

# Stop containers
docker-compose down
```

### **Week 3: Data Migration**

```powershell
# Run migration script
python scripts/migrate_sqlite_to_postgres.py

# Verify data
# Connect to PostgreSQL and run:
# SELECT COUNT(*) FROM users;
# SELECT COUNT(*) FROM work_orders;
# SELECT COUNT(*) FROM work_order_stages;
```

### **Week 4-5: Feature Development**

```powershell
# Create new migration
alembic revision --autogenerate -m "Add stage assignment"

# Apply migration
alembic upgrade head

# Rollback if needed
alembic downgrade -1

# Test endpoints (using curl or Postman)
# Or use Swagger UI: http://localhost:8000/api-docs
```

### **Week 7: Testing**

```powershell
# Install pytest
pip install pytest pytest-asyncio httpx

# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_auth.py -v

# Run with coverage
pip install pytest-cov
pytest tests/ --cov=app --cov-report=html

# View coverage report
start htmlcov/index.html
```

### **General Commands**

```powershell
# Install all dependencies
pip install -r requirements.txt

# Run app in development
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run seed script
python -m app.seed

# Check database (SQLite)
sqlite3 database.db
.tables
SELECT * FROM users;

# Check PostgreSQL (via docker)
docker-compose exec postgres psql -U postgres -d production_db
\dt
SELECT * FROM users;
```

---

## 📋 FINAL DELIVERABLES CHECKLIST

### **Code**
- [ ] All code follows PEP 8 style guide
- [ ] No hardcoded secrets
- [ ] All endpoints have docstrings
- [ ] Error handling consistent
- [ ] Logging implemented

### **Database**
- [ ] Alembic migrations working
- [ ] Migration from SQLite to PostgreSQL tested
- [ ] Seed script works with PostgreSQL
- [ ] Database connection pooling configured

### **Configuration**
- [ ] `.env.example` complete
- [ ] `docker-compose.yml` functional
- [ ] `requirements.txt` up to date
- [ ] All environment variables documented

### **Testing**
- [ ] Pytest setup complete
- [ ] Auth tests passing
- [ ] Work order tests passing
- [ ] Stage tests passing
- [ ] Test coverage acceptable

### **Documentation**
- [ ] README.md complete
- [ ] API docs (Swagger) up to date
- [ ] Migration guide written
- [ ] Machine integration docs written
- [ ] Code comments adequate

### **Features**
- [ ] All RBAC endpoints implemented
- [ ] Stage assignment working
- [ ] Auto-create stages working
- [ ] State machine enforced
- [ ] Metrics endpoints working
- [ ] Issue lifecycle complete
- [ ] Machine integration placeholder complete

### **Production Readiness**
- [ ] Logging configured
- [ ] Error handling robust
- [ ] CORS configured for mobile
- [ ] Performance acceptable
- [ ] Security best practices followed

---

## 🎓 NOTES & BEST PRACTICES

### **Breaking Changes Prevention**
- Always test with mobile app after changes
- Use feature flags if needed
- Maintain backward compatibility for response formats
- Version API if major changes needed (`/api/v1/...`)

### **Database Migration Safety**
- Always backup before migration
- Test migration on copy of production data
- Use transactions for data migration
- Verify foreign key constraints preserved

### **Testing Strategy**
- Write tests before refactoring
- Test happy paths and error cases
- Mock external dependencies
- Use fixtures for common setup

### **Security**
- Never commit `.env` file
- Use strong SECRET_KEY in production
- Validate all inputs
- Use parameterized queries (SQLAlchemy does this)
- Rate limiting (consider adding in future)

---

## 📞 SUPPORT & QUESTIONS

If you encounter issues:
1. Check logs (`logs/app.log`)
2. Verify `.env` configuration
3. Check database connection
4. Review Alembic migration status
5. Test endpoints via Swagger UI

---

**Last Updated:** [Date]  
**Version:** 1.0.0  
**Status:** Ready for Implementation



