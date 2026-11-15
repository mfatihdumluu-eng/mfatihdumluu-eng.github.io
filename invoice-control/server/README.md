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

## Invoice Control OCR — Kendi fatura okuyucumuz

Harici OCR API veya Model ID kullanılmaz. Her belge yalnızca Invoice Control sunucusunda işlenir.

- PDF metin katmanından yazıyı önce doğrudan almak için `pdf-parse` kullanılır.
- PDF metni ve sayfa görüntüleri aynı `pdf-parse` oturumunda çıkarılır; çakışan PDF worker sürümleri kullanılmaz.
- Her sayfa ayrı değerlendirilir: metin katmanı olan sayfadan doğrudan metin, taranmış sayfadan OCR alınır. Varsayılan sınır 10 sayfadır (`OCR_MAX_PAGES`: 1–20). Eksik okuma açıkça bildirilir ve kaydetme engellenir.
- JPG, PNG, WebP ve taranmış PDF'lerde Hollandaca + İngilizce yerel `tesseract.js` OCR çalışır. Görseller `sharp` ile yön bilgisine göre çevrilir, küçültülür ve kontrastı düzenlenir. İlk OCR çağrısında dil paketi indirebilir.
- Metin ayrıştırıcı, güvenle eşleşen ürün satırlarını, tarihi, faturayı, tutarları çıkarır. Alanlar eksikse kullanıcıya uyarı verir; içerik uydurmaz.
- Sistem Admini oturumu gereklidir. Belgeler tarayıcıdan HTTPS sunucusuna gönderilir ve harici OCR servisine aktarılmaz.
- `POST /api/admin/ocr/extract`: 10 MB'ye kadar PDF/JPG/PNG/WebP yükle ve **taslak** çıkar.
- `GET /admin/invoice-reader`: İnceleme/düzeltme ekranı.
- `POST /api/admin/ocr/invoices`: Yalnızca kullanıcı Kaydet düğmesine basınca kontrol edilmiş verileri özel veritabanına kaydet.
- `GET /admin/invoices`: Daha önce kaydedilmiş kayıtlar.
- Önceki Mindee'den kaydedilmiş fatura verileri korunur. Mindee API anahtarı bootstrap sırasında kaldırılır.

**Sınırlar:** Tesseract OCR uzmanlaşmış ticari belge modelleri kadar güvenilir değildir. Özellikle taranmış tablolar, ürün kodları, KDV/BTW, indirimler veya birimler yanlış çıkabilir. Otomatik muhasebeleştirme yoktur; her fatura insan tarafından kontrol edilir. Ücretsiz Render veritabanı kalıcı finansal arşiv için uygun değildir.

## OCR v2 doğrulama ve kayıt

- Ürün kodu, kontrol basamağı geçerli EAN, kg/koli/adet/paket, dört ondalıklı miktar/fiyat ve açık yüzde satır iskontosu ayrıştırılır. Tablo başlıkları miktar/ürün kodu sırasını ayırt etmekte kullanılır. Koli içeriği varsayılarak otomatik birim dönüşümü yapılmaz.
- Hesabı uyuşmayan ürün satırları gizlenmez; kullanıcı düzeltmesi için korunur. Yüzde ve tutar iskontosu aynı satırda birlikte uygulanamaz.
- BTW %9/%21 dökümleri toplanır; açık BTW toplamı varsa ayrıca toplam olarak kullanılır. Ara toplam ile genel toplam farklı alanlardır.
- Satır hesabı dört ondalık hassasiyetle, para tutarı kuruşa yuvarlanarak yapılır. Bilinen satır vergi oranları ve fatura toplamları kontrol edilir. Karışık vergi oranlarında belge iskontosunun dağılımı varsayılmaz.
- Tarayıcı ve API aynı doğrulama modülünü kullanır. Kayıt ile denetim izi tek veritabanı işlemi içinde yazılır; hata halinde ikisi de geri alınır.
- Mevcut `mindee_invoice_reviews` tablo adı geçmiş kayıtları korumak için tutulur. Adı harici API kullanıldığı anlamına gelmez. Bu değişiklik şema veya kullanıcı hesabı silmez.
- Kontrol edilmiş alanlar kaydedilir; orijinal PDF/fotoğraf kalıcı olarak saklanmaz. Dosyayı ayrıca koruyun.
- GitHub Pages ana paneli demo verilerini gösterir; gerçek kayıtların listesi `/admin/invoices` adresindedir.

## Otomatik testler

`npm ci`, `npm test`, `npm run test:ocr`, `npx playwright install --with-deps chromium`, `npm run test:browser`.

Testler bellekte çalışan ayrı PostgreSQL (PGlite) ve yapay fatura belgeleri kullanır. Üretim `DATABASE_URL` değerine bağlanmaz, gerçek faturalara test kaydı eklemez. OCR doğruluğu gerçek tedarikçi belgeleri, düşük kaliteli telefon fotoğrafları ve farklı tablo düzenleri için garanti edilmez. İlk OCR çalışması dil dosyalarını indirebilir.
