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
