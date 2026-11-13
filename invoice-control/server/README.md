# Invoice Control — taşınabilir API

## Kurulum
1. Docker ve Docker Compose yükleyin. `invoice-control/` klasöründe `.env` oluşturup `POSTGRES_PASSWORD` belirleyin.
2. `docker compose up -d` ile PostgreSQL ve API'yi başlatın.
3. `docker compose exec -e DATABASE_URL=postgres://invoice:<password>@db:5432/invoice_control api npm run init` ile tablo ve 11 demo hesabı oluşturun. Parolalar terminalde yalnızca ilk oluşturma sırasında yazdırılır; güvenli biçimde saklayın. Bu hesaplarla **gerçek veri** kullanmayın.
4. Ters proxy üzerinden HTTPS kullanıp `/api/*` yolunu 127.0.0.1:3000 adresine yönlendirin. Dosyaları `/var/private-invoices` altında saklayın; bu dizini web'e açmayın.
5. Gerçek kullanım için mali erişim incelemesi, MFA, yedekleme, gizlilik/AVG prosedürleri, virüs tarama, SMTP teslim doğrulaması ve UBL/PDF doğruluk testleri gereklidir.

## API taslağı
- `GET /health` — sağlık durumu
- `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `GET /api/branches`, `GET /api/suppliers`, `POST /api/suppliers` (admin)
- `GET /api/invoices?month=YYYY-MM&branch_id=...&supplier_id=...`
- `POST /api/invoices` — JSON fatura ve satırlar, stok fiyatı ile değil sözleşme ve şubelerle karşılaştır
- `GET /api/compare?month=YYYY-MM&supplier_id=...` — yetkilendirilmiş karşılaştırma
- `GET /api/search?q=...&brand_id=...` — ürün/marka arama
- `POST /api/disputes`, `POST /api/disputes/:id/approve` — admin onayı
- `POST /api/disputes/:id/send` — yalnızca admin, SMTP yapılandırıldığında
- `POST /api/credit-notes` — iade kaydı
- `GET /api/reports?month=...` — yönetici raporu
- `GET /api/audit` — sistem yöneticisi

Fiyat karşılaştırmaları aynı `supplier + product + unit + calendar month` üzerinden yapılır. Eşleşmeyen ürün satırları **inceleme gerektirir**; başka şubenin düşük fiyatı, tek başına fatura hatası kanıtı değildir.

**Güvenlik:** GitHub Pages sadece demo statik arayüzünü barındırır. Gerçek fatura PDF, banka/tedarikçi bilgisi, kullanıcı oturumu ve mail şifresi GitHub deposuna, statik varlıklara veya tarayıcı localStorage'ına konmamalıdır.

**Durum:** Bu bir kendi sunucunuza taşıyabileceğiniz başlangıç API'sidir. Canlı veritabanı/SMTP/PDF OCR henüz kurulup işletim testinden geçmedi; üretime alınmış bir hizmet olarak değerlendirmeyin.

## Mindee V2 API — Sistem Admini

Bu entegrasyon **app.mindee.com (V2)** içindir. Eski platform.mindee.com V1 anahtarları çalışmaz.

1. `app.mindee.com` → Settings → API Keys üzerinden `md_...` formatında yeni API anahtarı oluşturun.
2. Sunucuda `MINDEE_ENCRYPTION_KEY` ortam değişkenini 32 rastgele baytın **64 karakter hex** gösterimiyle tanımlayın:
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
   Bu değişkeni GitHub'a, tarayıcıya veya herkese açık bir .env dosyasına koymayın. Değişirse eski API anahtarı çözülemez.
3. `schema.sql` dosyasındaki `service_integrations` tablosu için şema güncellemesini veritabanına uygulayın (yeni kurulumda oluşturulur).
4. HTTPS API sunucusunda **Sistem Admini hesabıyla oturum açın**. GitHub Pages statik demo panelinden Sistem Admini → Mindee API yoluyla API sunucusunun HTTPS adresini kaydedip `/admin/mindee` sayfasına geçin. Bu adres sadece sunucu adresidir; anahtar oraya değil, kimlik doğrulamalı admin sayfasına girilir.
5. `/admin/mindee` sayfasında API anahtarını ve isteğe bağlı **Model ID** girin. "Anahtarı Kaydet ve Bağlantıyı Test Et" düğmesine basın.
6. Bağlantı kontrolü Mindee'nin `GET https://api-v2.mindee.net/v2/search/models` ucundan **canlı yanıt** alır; 2xx yanıt yeşil, ağ / 401 / 403 / 429 / diğer hatalar kırmızıdır. Durum, sayfa açıldığında ve "Bağlantıyı Yeniden Kontrol Et" tıklandığında yeniden doğrulanır. Başarılı durum 5 dakikadan eskiyse sunucu yenileme isteği olmadan kırmızı kabul edilir.

Endpointler (tamamı geçerli sistem admini oturumu ister):
- `GET /admin/mindee` — güvenli yapılandırma ekranı
- `GET /api/admin/mindee/status?check=1` — Mindee API'yi gerçekten kontrol et, anahtarı asla geri döndürme
- `POST /api/admin/mindee/settings` — `{ "apiKey": "md_...", "modelId": "" }`, anahtarı AES-256-GCM ile şifrele ve doğrula
- `DELETE /api/admin/mindee/settings` — bağlantı ve anahtar kaydını sil

**Önemli:** Bu sürüm yalnızca bağlantıyı yönetir ve test eder; gerçek PDF OCR akışının Mindee modeline gönderilmesi henüz entegre edilmedi. Canlı backend henüz bu statik GitHub Pages sayfası tarafından barındırılmıyor. Sunucu kurulmadan hiçbir API anahtarı girmeyin.
