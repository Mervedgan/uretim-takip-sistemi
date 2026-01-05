"""
AI Model Servisi
Scikit-learn Random Forest Regressor ile üretim parametrelerini tahmin eder.

Input: Ürün Adı (OneHotEncoder ile encode)
Output: Enjeksiyon Sıcaklığı, Kalıp Sıcaklığı, Çevrim Süresi
"""

import os
import joblib
import numpy as np
from typing import Dict, List, Optional, Tuple
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sqlalchemy.orm import Session

# Model dosya yolları
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'uretim_model.joblib')
ENCODER_PATH = os.path.join(MODEL_DIR, 'label_encoder.joblib')


class UretimAIModel:
    """
    Üretim parametreleri tahmin modeli.
    Random Forest Regressor kullanarak ürün adından
    enjeksiyon sıcaklığı, kalıp sıcaklığı ve çevrim süresini tahmin eder.
    """
    
    def __init__(self):
        self.model: Optional[RandomForestRegressor] = None
        self.label_encoder: Optional[LabelEncoder] = None
        self.urun_listesi: List[str] = []
        self._model_yuklendi = False
    
    def model_yukle(self) -> bool:
        """Kaydedilmiş modeli yükler."""
        try:
            if os.path.exists(MODEL_PATH) and os.path.exists(ENCODER_PATH):
                self.model = joblib.load(MODEL_PATH)
                self.label_encoder = joblib.load(ENCODER_PATH)
                self.urun_listesi = list(self.label_encoder.classes_)
                self._model_yuklendi = True
                print(f"✅ Model yüklendi. Ürün sayısı: {len(self.urun_listesi)}")
                return True
            else:
                print("⚠️ Model dosyaları bulunamadı. Önce modeli eğitin.")
                return False
        except Exception as e:
            print(f"❌ Model yükleme hatası: {e}")
            return False
    
    def model_egit(self, db: Session) -> Dict:
        """
        Veritabanındaki verilerle modeli eğitir.
        
        Returns:
            Dict: Eğitim sonuçları (başarı durumu, metrikler, vb.)
        """
        from app.models import Product
        
        # Verileri çek
        products = db.query(Product).filter(
            Product.deleted_at.is_(None),
            Product.injection_temp_c.isnot(None),
            Product.mold_temp_c.isnot(None),
            Product.cycle_time_sec.isnot(None)
        ).all()
        
        if len(products) < 5:
            return {
                "success": False,
                "message": f"Yeterli veri yok. En az 5 ürün gerekli, mevcut: {len(products)}",
                "urun_sayisi": len(products)
            }
        
        # Veri hazırlığı
        urun_adlari = [p.name for p in products]
        X_raw = np.array(urun_adlari).reshape(-1, 1)
        
        # Hedef değişkenler (3 çıktı)
        y = np.array([
            [p.injection_temp_c, p.mold_temp_c, p.cycle_time_sec]
            for p in products
        ])
        
        # Label Encoder
        self.label_encoder = LabelEncoder()
        X_encoded = self.label_encoder.fit_transform(urun_adlari).reshape(-1, 1)
        self.urun_listesi = list(self.label_encoder.classes_)
        
        # Train-test split (eğer yeterli veri varsa)
        if len(products) >= 10:
            X_train, X_test, y_train, y_test = train_test_split(
                X_encoded, y, test_size=0.2, random_state=42
            )
        else:
            # Veri az ise tamamını eğitim için kullan
            X_train, y_train = X_encoded, y
            X_test, y_test = X_encoded, y
        
        # Model eğitimi
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X_train, y_train)
        
        # Skor hesapla
        train_score = self.model.score(X_train, y_train)
        test_score = self.model.score(X_test, y_test)
        
        # Model klasörünü oluştur
        os.makedirs(MODEL_DIR, exist_ok=True)
        
        # Modeli kaydet
        joblib.dump(self.model, MODEL_PATH)
        joblib.dump(self.label_encoder, ENCODER_PATH)
        
        self._model_yuklendi = True
        
        return {
            "success": True,
            "message": "Model başarıyla eğitildi ve kaydedildi.",
            "urun_sayisi": len(products),
            "train_score": round(train_score, 4),
            "test_score": round(test_score, 4),
            "model_path": MODEL_PATH,
            "urunler": self.urun_listesi[:10]  # İlk 10 ürün
        }
    
    def tahmin_yap(self, urun_adi: str) -> Dict:
        """
        Ürün adına göre üretim parametrelerini tahmin eder.
        
        Args:
            urun_adi: Tahmin yapılacak ürün adı
            
        Returns:
            Dict: Tahmin sonuçları veya hata mesajı
        """
        if not self._model_yuklendi:
            if not self.model_yukle():
                return {
                    "success": False,
                    "message": "Model yüklü değil. Önce /api/ai/train endpoint'ini çağırın."
                }
        
        # Ürün adı bilinen mi kontrol et
        if urun_adi not in self.urun_listesi:
            # Bilinen ürünlere benzerlik hesapla (basit karakter eşleşmesi)
            benzer = self._benzer_urun_bul(urun_adi)
            if benzer:
                return {
                    "success": False,
                    "message": f"'{urun_adi}' bulunamadı. Benzer ürün: '{benzer}'",
                    "oneri": benzer,
                    "bilinen_urunler": self.urun_listesi
                }
            else:
                return {
                    "success": False,
                    "message": f"'{urun_adi}' bilinmeyen bir ürün.",
                    "bilinen_urunler": self.urun_listesi
                }
        
        try:
            # Encode et
            X = self.label_encoder.transform([urun_adi]).reshape(1, -1)
            
            # Tahmin yap
            tahmin = self.model.predict(X)[0]
            
            return {
                "success": True,
                "urun_adi": urun_adi,
                "tahminler": {
                    "enjeksiyon_sicakligi": round(tahmin[0], 1),
                    "kalip_sicakligi": round(tahmin[1], 1),
                    "cevrim_suresi": round(tahmin[2], 1)
                },
                "birim": {
                    "enjeksiyon_sicakligi": "°C",
                    "kalip_sicakligi": "°C",
                    "cevrim_suresi": "saniye"
                }
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Tahmin hatası: {str(e)}"
            }
    
    def _benzer_urun_bul(self, urun_adi: str) -> Optional[str]:
        """Basit benzerlik kontrolü ile en yakın ürünü bulur."""
        urun_adi_lower = urun_adi.lower()
        
        for urun in self.urun_listesi:
            if urun_adi_lower in urun.lower() or urun.lower() in urun_adi_lower:
                return urun
        
        # Kelime bazlı eşleşme
        kelimeler = urun_adi_lower.split()
        for kelime in kelimeler:
            if len(kelime) >= 3:
                for urun in self.urun_listesi:
                    if kelime in urun.lower():
                        return urun
        
        return None
    
    def urunleri_listele(self) -> List[str]:
        """Modelin bildiği tüm ürünleri listeler."""
        if not self._model_yuklendi:
            self.model_yukle()
        return self.urun_listesi
    
    @property
    def model_hazir(self) -> bool:
        """Model kullanıma hazır mı?"""
        return self._model_yuklendi and self.model is not None


# Global model instance
ai_model = UretimAIModel()


