from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List
from app.db import get_db
from app.models import User

router = APIRouter(prefix="/auth", tags=["Auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 🔑 JWT Ayarları
SECRET_KEY = "super-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Swagger'daki Authorize butonu için OAuth2 şeması
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ---------------------------------------------------------
#  JWT Token Oluştur
# ---------------------------------------------------------
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return token


# ---------------------------------------------------------
#  TOKEN DOĞRULAMA
# ---------------------------------------------------------
def verify_token(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """
    JWT token'ı doğrular ve kullanıcı bilgilerini döndürür.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")

        if username is None:
            raise HTTPException(
                status_code=401,
                detail="Token geçersiz."
            )

        # Kullanıcıyı veritabanından çek
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Kullanıcı bulunamadı."
            )

        return {"username": username, "role": role, "user_id": user.id}

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Token doğrulanamadı veya süresi doldu."
        )


# ---------------------------------------------------------
#  Mevcut Kullanıcıyı Al
# ---------------------------------------------------------
def get_current_user(token_data: dict = Depends(verify_token)):
    """
    Token'dan kullanıcı bilgilerini döndürür.
    Her endpoint'te kullanılabilir.
    """
    return token_data


# ---------------------------------------------------------
#  🔐 ROL BAZLI YETKİ KONTROLÜ (Yeniden Kullanılabilir)
# ---------------------------------------------------------
def require_roles(*allowed_roles: str):
    """
    Belirtilen rollere sahip kullanıcıların endpoint'e erişmesine izin verir.
    
    Kullanım:
        @router.post("/admin-only")
        def admin_endpoint(current_user: dict = Depends(require_roles("admin"))):
            return {"message": "Admin işlemi başarılı"}
    
    Args:
        *allowed_roles: İzin verilen roller (örn: "admin", "planner", "worker")
    
    Returns:
        current_user: Token'dan gelen kullanıcı bilgileri
    
    Raises:
        HTTPException 403: Kullanıcının rolü izin verilen roller arasında değilse
    """
    def role_checker(current_user: dict = Depends(get_current_user)):
        """
        İç fonksiyon: Kullanıcının rolünü kontrol eder
        """
        user_role = current_user.get("role")
        
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bu işlem için yetkin yok. Gerekli rol(ler): {', '.join(allowed_roles)}"
            )
        
        # Yetki varsa kullanıcı bilgilerini döndür
        return current_user
    
    return role_checker


# ---------------------------------------------------------
#  Login
# ---------------------------------------------------------
@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()

    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı veya şifre.")

    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# ---------------------------------------------------------
#  Register
# ---------------------------------------------------------
@router.post("/register")
def register(username: str, password: str, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten kayıtlı.")

    hashed = pwd_context.hash(password)
    new_user = User(username=username, password_hash=hashed)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"ok": True, "user_id": new_user.id}







