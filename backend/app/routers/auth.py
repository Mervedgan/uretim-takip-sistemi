from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import bcrypt
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Header
from typing import List
from app.db import get_db
from app.models import User
from app.schemas import UserResponse, RoleUpdate, UserCreate

router = APIRouter(prefix="/auth", tags=["Auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__ident="2b")

def hash_password(password: str) -> str:
    """Şifreyi hash'le - bcrypt 72 byte limiti için"""
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    # Direkt bcrypt kullan (passlib sorunlu)
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Şifreyi doğrula"""
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    hashed_bytes = hashed.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)

# 🔑 JWT Ayarları - config'den al
from app.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

# Bearer token'ı manuel olarak alıyoruz (HTTPBearer Swagger'da karışıklık yaratıyor)


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
def verify_token(authorization: str = Header(None), db: Session = Depends(get_db)):
    """
    JWT token'ı doğrular ve kullanıcı bilgilerini döndürür.
    """
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header eksik. Format: Bearer <token>"
        )
    
    try:
        # "Bearer <token>" formatından token'ı çıkar
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication scheme. Expected 'Bearer'"
            )
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")

        if username is None:
            raise HTTPException(
                status_code=401,
                detail="Token geçersiz."
            )

        # Kullanıcıyı veritabanından çek (case-insensitive - güvenlik için)
        user = db.query(User).filter(User.username.ilike(username)).first()
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Kullanıcı bulunamadı."
            )

        return {"username": user.username, "role": role, "user_id": user.id}

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
@router.post("/login", dependencies=[])  # Public endpoint - no auth required
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Kullanıcı adını normalize et (trim + lowercase) - case-insensitive login
    username = form_data.username.strip().lower()
    
    # Veritabanında kullanıcıyı ara (case-insensitive)
    # PostgreSQL için ilike, SQLite için lower() kullanılabilir
    user = db.query(User).filter(User.username.ilike(username)).first()

    if not user:
        raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı veya şifre.")
    
    # Şifreyi doğrula
    if not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı veya şifre.")

    # Token oluştur - token'da orijinal username kullan (veritabanındaki)
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
@router.post("/register", dependencies=[])  # Public endpoint - no auth required
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Yeni kullanıcı kaydı oluşturur.
    
    **Yetki:** Public (herkes kayıt olabilir)
    """
    # Kullanıcı adını normalize et (trim + lowercase) - tutarlılık için
    normalized_username = user_data.username.strip().lower()
    
    # Case-insensitive kontrol - aynı kullanıcı adı var mı?
    existing = db.query(User).filter(User.username.ilike(normalized_username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten kayıtlı.")

    # Email unique kontrolü (eğer email verilmişse)
    if user_data.email:
        existing_email = db.query(User).filter(User.email == user_data.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Bu email adresi zaten kayıtlı.")
    
    # Şifreyi hash'le
    hashed = hash_password(user_data.password)
    new_user = User(
        username=normalized_username,  # Normalize edilmiş kullanıcı adı kaydedilir
        password_hash=hashed,
        email=user_data.email,
        phone=user_data.phone,
        role=user_data.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Kayıt sonrası otomatik login için token oluştur
    # Token'da veritabanındaki username kullanılır (normalize edilmiş)
    access_token = create_access_token(
        data={"sub": new_user.username, "role": new_user.role}
    )

    # UserResponse schema'sına uygun user objesi oluştur
    from app.schemas import UserResponse
    user_response = UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        phone=new_user.phone,
        role=new_user.role
    )

    return {
        "ok": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_response.model_dump()
    }


# ---------------------------------------------------------
# ✅ Get Current User Info
# ---------------------------------------------------------
@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Mevcut kullanıcının bilgilerini döndürür.
    
    **Yetki:** Tüm giriş yapmış kullanıcılar
    """
    user = db.query(User).filter(User.id == current_user["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    return user


# ---------------------------------------------------------
# ✅ Admin: List Users
# ---------------------------------------------------------
@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin"))
):
    """
    Tüm kullanıcıları listeler.
    
    **Yetki:** "admin" rolü
    """
    users = db.query(User).all()
    return users


# ---------------------------------------------------------
# ✅ Admin: Change User Role
# ---------------------------------------------------------
@router.patch("/users/{user_id}/role")
def change_user_role(
    user_id: int,
    role_data: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin"))
):
    """
    Kullanıcı rolünü değiştirir.
    
    **Yetki:** "admin" rolü
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    
    # Admin kendi rolünü değiştiremez
    if user.id == current_user["user_id"]:
        raise HTTPException(
            status_code=400,
            detail="Kendi rolünüzü değiştiremezsiniz."
        )
    
    old_role = user.role
    user.role = role_data.role
    db.commit()
    db.refresh(user)
    
    return {
        "ok": True,
        "user_id": user.id,
        "username": user.username,
        "old_role": old_role,
        "new_role": user.role,
        "changed_by": current_user["username"]
    }


# ---------------------------------------------------------
# ✅ Admin: Delete User
# ---------------------------------------------------------
@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("admin"))
):
    """
    Kullanıcıyı siler (hard delete).
    
    **Yetki:** "admin" rolü
    
    **Not:** Admin kendi hesabını silemez.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    
    # Admin kendi hesabını silemez
    if user.id == current_user["user_id"]:
        raise HTTPException(
            status_code=400,
            detail="Kendi hesabınızı silemezsiniz."
        )
    
    # Silinecek kullanıcı bilgilerini kaydet (response için)
    deleted_username = user.username
    deleted_role = user.role
    
    # Kullanıcıyı sil
    db.delete(user)
    db.commit()
    
    return {
        "ok": True,
        "message": "Kullanıcı başarıyla silindi.",
        "deleted_user_id": user_id,
        "deleted_username": deleted_username,
        "deleted_role": deleted_role,
        "deleted_by": current_user["username"]
    }







