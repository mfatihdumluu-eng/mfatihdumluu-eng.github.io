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

**Durum:** Bu bir kendi sunucunuza taşıyabileceğiniz başlangıç API'sidir. Canlı veritabanı/SMTP/PDF OCR için gerçek tedarikçi belgeleriyle kapsamlı kabul testi yapılmadı; üretime alınmış bir hizmet olarak değerlendirmeyin.

## Fatura okuyucu ve ortak PostgreSQL havuzu

Üretim okuyucu `/admin/invoice-reader` adresindedir. Yerel OCR ve Mindee iş akışından kaldırılmıştır. `INVOICE_OCR_PROVIDER` ayarı belirtilmezse mevcut Nutrient entegrasyonu kullanılır; `google-document-ai` değeri EU Invoice Parser yolunu seçer. Google yolu ayrıca açıkça `GOOGLE_DOCUMENT_AI_ENABLED=true` gerektirir. Kodun yüklenmesi hiçbir Google API’sini etkinleştirmez, işlemci oluşturmaz veya ücretli çağrı yapmaz.

- `GET /api/admin/invoice-ocr/status`: oturum gerektirir; yapılandırma durumunu gösterir. `connected: null` canlı Google doğrulaması yapıldığı anlamına gelmez.
- `POST /api/admin/invoice-ocr/extract`: seçili sağlayıcıyla tek belge okur. Google belgeleri yalnızca `eu-documentai.googleapis.com` uç noktasına gönderilir.
- Google çağrısından önce PDF sayısı/dosya biçimi kontrol edilir. 10 MB ve 10 sayfa sınırı vardır. WebP sunucuda PNG’ye çevrilir. Otomatik tekrar veya başka ücretli sağlayıcıya geçiş yapılmaz.
- Google’ın `invoice_id`, `supplier_name`, `line_item/*`, fatura tarihi, toplamları ve `vat/*` alanları kontrol ekranına aktarılır. Ürün kodlarındaki baştaki sıfırlar ve satır sırası korunur. Eksik miktar, fiyat, iskonto veya satır KDV oranı uydurulmaz; kullanıcı tamamlar. Standart Invoice Parser satır KDV oranlarını her belgede döndürmez.
- “Pagina 1 van 2” yazan tek sayfalık fotoğraf tamamlanmış fatura olarak kaydedilemez. Tüm sayfaları birlikte yükleyin. Bu kontrol tüm olası eksik sayfaları tespit etme garantisi değildir.
- Kontrol ve Kaydet adımlarından sonra kayıt, mevcut `mindee_invoice_reviews` tablosuna şube ve sağlayıcı adıyla eklenir. Şube kullanıcıları başka şube adına kaydedemez veya başka şubenin faturasını açamaz. Admin şubeyi seçer.
- Mevcut tablolar, kullanıcılar ve eski faturalar korunur. İdempotent şema eklemesi yalnızca `tax_breakdown` JSONB sütununu ekler. Denetim izi ve kayıt tek transaction içinde yazılır.
- Aynı aydaki Nutrient ve Google faturaları ortak havuzda kıyaslanır. Aynı tedarikçi, EAN/ürün kodu ve birim gerekir; yalnızca ada göre eşleştirme yapılmaz. Şubeler diğer şubelerin kimliklerini göremez.
- Arayüz EUR içindir; farklı para birimleri kaydedilmeden önce engellenir. Orijinal dosya kalıcı saklanmaz; ayrıca koruyun.

Kurulum ve güvenli kimlik doğrulama için [GOOGLE_DOCUMENT_AI_SETUP.md](GOOGLE_DOCUMENT_AI_SETUP.md).

## Doğrulama

`npm ci` ve `npm test`.

Testler ayrı, bellekte çalışan PostgreSQL (PGlite), yapay fatura verisi ve sahte Google yanıtları kullanır. Üretim veritabanına bağlanmaz ve ücretli Google isteği yapmaz. Sağlayıcı alan dönüşümü, EU zorunluluğu, kapalı etkinleştirme durumu, dosya/sayfa sınırları, şube yetkileri, aylık havuz ve insan kontrolü sınanır. Bunlar gerçek bir tedarikçi faturasıyla Google doğruluk testi yerine geçmez.
