# ⚽ Aile Dünya Kupası Tahmin Ligi

2026 Dünya Kupası boyunca ailecek skor tahmini yarışı.

- **Google ile giriş** + **yönetici onayı** (sadece onayladığın aile üyeleri girer)
- Maçlar **otomatik** çekilir (grup → son 32 → son 16 → çeyrek → yarı → final, hepsi sırayla gelir)
- Maç **başlama saatinde tahmin kilitlenir** (kilit sunucuda, baypas edilemez)
- Maç bitince **skorlar otomatik çekilir** ve **puanlar otomatik hesaplanır**
- Turnuva boyunca **puan tablosu** tutulur

**Teknoloji:** Next.js (App Router) · Supabase (Auth + Postgres) · football-data.org · Vercel

---

## Puanlama (lib/scoring.ts'den değiştirilebilir)

| Durum | Örnek | Puan |
|------|-------|------|
| Tam skor | 2-1 dedin, 2-1 oldu | **5** |
| Doğru sonuç + doğru gol farkı | 2-0 dedin, 3-1 oldu | **3** |
| Sadece doğru kazanan/beraberlik | 1-0 dedin, 3-2 oldu | **2** |
| Yanlış | — | **0** |

---

## Kurulum — Adım Adım

İhtiyacın olan (hepsi ücretsiz): **Node.js 18+**, bir **Supabase** hesabı, bir **Google Cloud** hesabı, bir **football-data.org** hesabı, bir **Vercel** hesabı (ve istersen GitHub).

### 1) Supabase projesi + veritabanı

1. https://supabase.com → yeni proje oluştur (bölge: Europe/Frankfurt yakın olur). Veritabanı şifreni bir yere not et.
2. Proje açılınca soldan **SQL Editor → New query**.
3. Bu repodaki **`supabase/schema.sql`** dosyasının tamamını yapıştır ve **RUN**. (Tabloları, güvenlik kurallarını, tetikleyicileri ve puan tablosunu kurar.)
4. **Project Settings → API**'den şunları kopyala:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` anahtarı → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` anahtarı → `SUPABASE_SERVICE_ROLE_KEY` (**GİZLİ**, asla paylaşma)

### 2) Google ile giriş (OAuth)

**Google Cloud Console** tarafı (https://console.cloud.google.com):
1. Yeni proje oluştur → **APIs & Services → OAuth consent screen** → **External** → uygulama adını gir (ör. "Aile Tahmin Ligi"), e-postanı ekle, kaydet. Test aşamasında "Test users"a aile e-postalarını eklemen yeterli (yayına almak istemezsen).
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application**.
3. **Authorized redirect URIs** alanına Supabase'in callback adresini ekle:
   ```
   https://<PROJE-REF>.supabase.co/auth/v1/callback
   ```
   (`<PROJE-REF>` = Supabase URL'indeki alt alan adı.)
4. Oluştur → **Client ID** ve **Client Secret**'i kopyala.

**Supabase** tarafı:
1. **Authentication → Providers → Google** → enable → Client ID ve Secret'i yapıştır → kaydet.
2. **Authentication → URL Configuration**:
   - **Site URL**: canlı adresin (ör. `https://aile-tahmin.vercel.app`). Şimdilik `http://localhost:3000` yazabilirsin, deploy sonrası güncellersin.
   - **Redirect URLs** listesine ikisini de ekle:
     ```
     http://localhost:3000/auth/callback
     https://<SENIN-VERCEL-ADRESIN>/auth/callback
     ```

### 3) football-data.org API anahtarı

1. https://www.football-data.org/client/register → ücretsiz kayıt ol.
2. E-postana gelen **API Token**'ı `FOOTBALL_DATA_API_KEY` olarak kullan.
   (Ücretsiz plan Dünya Kupası'nı kapsar. Skorlar birkaç dakika gecikmeli gelir — biz maç bitince hesapladığımız için sorun değil.)

### 4) Lokal çalıştırma

```bash
npm install
cp .env.local.example .env.local   # sonra .env.local'i doldur
npm run dev
```

`.env.local` içine yukarıda topladığın değerleri yaz. `CRON_SECRET` için güçlü bir değer üret:
```bash
openssl rand -hex 32
```
Tarayıcıda http://localhost:3000 → Google ile giriş yap. İlk girişte "Onay bekleniyor" ekranını göreceksin (bu normal).

### 5) Kendini yönetici yap + onayla

Supabase **SQL Editor**'de (kendi e-postanla):
```sql
update public.profiles
set approved = true, is_admin = true
where email = 'senin@gmail.com';
```
Sayfayı yenile → artık maçlar ekranı ve **Yönetim** sekmesi açılır.

### 6) İlk maç senkronu

Maçları DB'ye çekmek için bir kez senkron tetikle (tarayıcıda veya terminalde):
```
http://localhost:3000/api/cron/sync?secret=CRON_SECRET_DEGERIN
```
`{ "ok": true, "matches_synced": 104, ... }` görmelisin. Ana sayfada maçlar belirir.

---

## Yayınlama (Vercel)

1. Projeyi GitHub'a push et (ya da `vercel` CLI ile doğrudan yükle).
2. https://vercel.com → **Add New → Project** → repoyu seç → **Import**.
3. **Environment Variables** bölümüne `.env.local`'deki TÜM değişkenleri ekle:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `FOOTBALL_DATA_API_KEY`, `CRON_SECRET`
   - `NEXT_PUBLIC_SITE_URL` → Vercel'in vereceği adres (ör. `https://aile-tahmin.vercel.app`)
4. **Deploy**. Bittiğinde:
   - Supabase **URL Configuration**'da Site URL ve Redirect URL'leri canlı adresinle güncelle (Adım 2.2).
   - Google Cloud'daki redirect URI zaten Supabase callback olduğu için değişmez.

### Otomatik skor senkronu (cron)

Maç sonuçlarını ve puanları periyodik çekmek için `/api/cron/sync` düzenli çağrılmalı. İki yol:

**A) cron-job.org (önerilen, garantili 15 dk):**
1. https://cron-job.org → ücretsiz hesap → **Create cronjob**.
2. URL:
   ```
   https://<SENIN-VERCEL-ADRESIN>/api/cron/sync?secret=CRON_SECRET_DEGERIN
   ```
3. Aralık: her 15 dakika. Kaydet. (Maç günleri yeterli; istersen 10 dk yap.)

**B) Vercel Cron:** Repodaki `vercel.json` zaten her 15 dk'da `/api/cron/sync` çağırır. `CRON_SECRET` env'i tanımlıysa Vercel otomatik `Authorization: Bearer` başlığı ekler ve endpoint bunu kabul eder. (Not: ücretsiz Hobby planında cron sıklığı sınırlı olabilir; bu yüzden A şıkkını öneriyorum.)

---

## Aile üyelerini ekleme

1. Her aile ferdi siteye girip **Google ile giriş** yapar → "Onay bekleniyor" ekranını görür.
2. Sen **Yönetim** sekmesinden onları **Onayla**'ya basarsın. Onaylananlar anında oyuna girer.
3. Onaylamadığın kimse maçları/tahminleri göremez.

> Birini yönetici yapmak istersen (örn. eşin de onaylasın): Supabase SQL'de `update public.profiles set is_admin = true where email = '...';`

---

## Nasıl çalışıyor (kısa)

- **Tahmin kilidi:** Tahminler doğrudan veritabanına yazılamaz; hepsi `/api/predictions` üzerinden geçer. Bu route maçın başlama saatini sunucuda kontrol eder; saat geçtiyse reddeder. Yani kimse kilidi baypas edemez.
- **Maçların gelmesi:** `cron/sync` her çalıştığında football-data.org'dan TÜM Dünya Kupası maçlarını çeker ve `id`'ye göre upsert eder. Eleme turu eşleşmeleri belli oldukça (örn. çeyrek final takımları) API güncellenir, bizim tablo da otomatik güncellenir.
- **Puanlama:** `cron/sync`, biten ama henüz puanlanmamış maçların tahminlerini bulur, `lib/scoring.ts`'deki kurala göre puan verir. Tekrar çalışması güvenlidir (sadece `points` boş olanları hesaplar).

---

## Sık sorunlar

- **Giriş sonrası login'e geri atıyor:** Supabase Redirect URLs'e `.../auth/callback` adresini eklediğinden ve Google redirect URI'nin `.../auth/v1/callback` olduğundan emin ol.
- **Maçlar gelmiyor:** `cron/sync`'i secret ile bir kez elle çağır, dönen JSON'daki hatayı oku. `FOOTBALL_DATA_API_KEY` doğru mu?
- **Puan güncellenmiyor:** Maç football-data.org'da `FINISHED` olana kadar puan hesaplanmaz (ücretsiz planda birkaç dk gecikme normaldir). Bir skor sonradan düzeltilirse, ilgili tahminlerin `points` değerini SQL'de `null` yapıp cron'u tekrar çalıştır.
- **Eleme turu skoru (uzatma/penaltı):** Puan, football-data.org'un bildirdiği tam zaman (full-time) skoruna göre verilir.
