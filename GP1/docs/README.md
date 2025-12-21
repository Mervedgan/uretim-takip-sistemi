# Kalıp Üretim Takip Sistemi - Dokümantasyon

## UML Diyagramları

Bu proje için PlantUML kullanılarak oluşturulmuş UML diyagramları bulunmaktadır.

### Dosyalar
- `docs/use-case-diagram.puml` - Use Case Diyagramı
- `docs/class-diagram.puml` - Class Diyagramı (Backend + Mobil)

### Görüntüleme

#### Yöntem 1: PlantUML Online Editor (Önerilen)
1. [PlantUML Online Server](http://www.plantuml.com/plantuml/uml/) adresine gidin
2. `.puml` dosyasını açın ve içeriğini kopyalayın
3. Online editöre yapıştırın
4. Otomatik olarak diyagram oluşturulacaktır

#### Yöntem 2: VS Code Extension
1. VS Code'da "PlantUML" extension'ını yükleyin
2. `.puml` dosyasını açın
3. `Alt + D` tuşlarına basarak önizlemeyi görüntüleyin
4. `Ctrl + Shift + P` > "PlantUML: Export Current Diagram" ile PNG/SVG export edebilirsiniz

#### Yöntem 3: PlantUML Jar
```bash
java -jar plantuml.jar docs/*.puml
```

## Use Case Diyagramı

### Aktörler
1. **Misafir (Guest)**: Henüz kayıt olmamış kullanıcılar
2. **Operatör (Operator)**: Üretim işlemlerini yöneten kullanıcılar
3. **Planlayıcı (Planner)**: Makine performansını analiz eden kullanıcılar
4. **Yönetici (Manager)**: Tüm sistem verilerini görüntüleyen kullanıcılar
5. **Sistem (System)**: Otomatik işlemleri gerçekleştiren sistem

### Ana Use Case'ler

#### Kimlik Doğrulama
- Kayıt Ol (Register)
- Giriş Yap (Login)
- Çıkış Yap (Logout)

#### Dashboard
- Dashboard Görüntüle
- Aktif Üretimleri Görüntüle
- Makine Durumunu Görüntüle

#### Operatör İşlemleri
- Üretim Başlat
- Üretimi Tamamla
- Parça Sayısı Güncelle
- Üretim Aşamalarını Yönet
- Sorun Bildir

#### Planlayıcı İşlemleri
- Makine Performansını Görüntüle
- Üretim Metriklerini Görüntüle
- Verimlilik Analizi
- Makine Raporları

#### Yönetici İşlemleri
- Üretim Analizini Görüntüle
- Operatör Performansını Görüntüle
- Günlük Üretim Raporlarını Görüntüle
- Genel İstatistikleri Görüntüle

## Class Diyagramı

### Backend (FastAPI)
- **Models**: SQLAlchemy database modelleri (UserModel, MachineModel, ProductionModel, StageModel)
- **Schemas**: Pydantic validation şemaları (UserSchema, ProductionSchema, etc.)
- **Routers**: API endpoint'leri (AuthRouter, ProductionRouter, MachineRouter, ReportRouter)
- **FastAPIApp**: Ana uygulama sınıfı

### Mobil Uygulama (React Native)
- **Types**: TypeScript interface'leri (User, Machine, ProductionRecord, etc.)
- **Screens**: React Native ekranları (LoginScreen, DashboardScreen, OperatorScreen, etc.)
- **Utils**: Yardımcı sınıflar (ApiClient, AuthAPI, TokenStorage, UserStorage, Validators)
- **Data**: Veri yönetimi (ProductionStore, MockData)

### İletişim
- Mobil uygulama `ApiClient` üzerinden HTTP istekleri gönderir
- Backend `Routers` üzerinden istekleri alır ve `Models` ile veritabanı işlemleri yapar
- Veriler `Schemas` ile validate edilir ve mobil uygulamaya döndürülür

## Proje Yapısı

```
GP1/
├── docs/
│   ├── use-case-diagram.puml
│   ├── class-diagram.puml
│   └── README.md
├── src/
│   ├── screens/        # React Native ekranları
│   ├── utils/         # Yardımcı fonksiyonlar
│   ├── types/         # TypeScript type tanımları
│   └── data/          # Veri yönetimi
└── App.tsx            # Ana uygulama bileşeni
```
