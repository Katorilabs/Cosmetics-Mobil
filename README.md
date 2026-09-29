# Cosmedia

Cosmedia; kozmetik ürünlerini INCI içerikleriyle birlikte sunan, kullanıcının cilt
profiliyle ürünleri eşleştiren ve puanların nedenini açıklayan bir mobil uygulama
projesidir.

Bu repository şu anda projenin üretime uygun backend temelini içerir. Mobil uygulama,
admin paneli ve scraper worker sonraki aşamalarda aynı monorepo içine eklenecektir.

## İçindekiler

- [Projenin hedefi](#projenin-hedefi)
- [Şu anda neler hazır?](#şu-anda-neler-hazır)
- [Teknoloji yığını](#teknoloji-yığını)
- [Repository yapısı](#repository-yapısı)
- [İlk kurulum](#ilk-kurulum)
- [Projeyi çalıştırma](#projeyi-çalıştırma)
- [API endpointleri](#api-endpointleri)
- [Kimlik doğrulama kurulumu](#kimlik-doğrulama-kurulumu)
- [Profil bazlı ürün eşleştirme](#profil-bazlı-ürün-eşleştirme)
- [Açıklanabilir içerik skoru](#açıklanabilir-içerik-skoru)
- [Kaynak ve kanıt yönetimi](#kaynak-ve-kanıt-yönetimi)
- [INCI alias ve normalizasyon](#inci-alias-ve-normalizasyon)
- [CSV katalog importu](#csv-katalog-importu)
- [API hata formatı](#api-hata-formatı)
- [Veri modeli](#veri-modeli)
- [Ortam değişkenleri](#ortam-değişkenleri)
- [Komutlar](#komutlar)
- [Migration çalışma düzeni](#migration-çalışma-düzeni)
- [Test ve CI](#test-ve-ci)
- [Ekip çalışma düzeni](#ekip-çalışma-düzeni)
- [Yol haritası](#yol-haritası)
- [Sorun giderme](#sorun-giderme)

## Projenin hedefi

Uygulamanın ana ürün fikri üç parçadan oluşur:

1. Ürünlerin marka, kategori, varyant, görsel ve versiyonlanmış INCI listelerini
   güvenilir şekilde saklamak.
2. Cilt tipi ve cilt endişelerine göre ürün/İçerik eşleştirmesi yapmak.
3. Kullanıcı deneyimi ile algoritmik içerik analizini birbirinden ayırarak
   açıklanabilir skorlar göstermek.

Planlanan örnek kullanıcı deneyimi:

```text
Karma + akne eğilimli cilt
        |
        +-- Uygun ürün kategorileri
        +-- Aranabilecek içerikler (niasinamid, salisilik asit vb.)
        +-- Kaçınılabilecek içerik sinyalleri
        +-- Benzer profillerin ürün deneyimi
        +-- Açıklanabilir formül uyumluluk skoru
```

Skorlar tıbbi teşhis veya kesin güvenlik hükmü vermeyecek; skor nedeni, kullanılan
kural sürümü ve güven seviyesi kullanıcıya açıklanacaktır.

## Şu anda neler hazır?

- npm workspaces tabanlı monorepo temeli
- TypeScript ve NestJS ile versiyonlu REST API
- PostgreSQL ve Prisma veri katmanı
- İlk veritabanı migration'ı
- Ürün listeleme ve ürün detay okuma modülü
- Tekrar çalıştırılabilir demo seed (2 ürün, 7 INCI, 4 alias, 1 evidence, 5 skor kuralı)
- Admin marka/kategori oluşturma ve listeleme endpointleri
- Transactional ürün + varyant + ilk formül oluşturma
- Ürün güncelleme, arşivleme ve yeni formül versiyonu ekleme
- Environment tabanlı geçici admin API key guard
- UTF-8 CSV ile atomik ve idempotent katalog importu
- Dosya/satır/hücre limitleri ve satır bazlı CSV doğrulama raporu
- Request ID içeren ortak API hata formatı
- OIDC/JWKS tabanlı, sağlayıcıdan bağımsız Bearer token doğrulaması
- İlk doğrulanmış istekte idempotent uygulama kullanıcısı oluşturma/eşleme
- Cilt tipi, endişeler, alerjiler ve kaçınılan INCI profil endpointleri
- Yayınlanmış ürün varyantları için idempotent ve sayfalı favori endpointleri
- Kaçınılan INCI ve moderasyonlu kanıtlara dayalı açıklanabilir profil eşleştirme
- Kanonik INCI adı, normalize anahtar ve moderasyonlu alias çözümleme altyapısı
- Kaynak atıflı kanıt oluşturma, düzenleme, onaylama ve onay geri çekme API’si
- Revizyon denetimiyle eşzamanlı kanıt düzenleme/moderasyon koruması
- Değiştirilemez kural sürümü, profil hash'i ve idempotent snapshot kullanan skor motoru
- API/veritabanı health kontrolü
- Swagger/OpenAPI dokümantasyonu
- DTO doğrulama ve bilinmeyen alanları reddetme
- Helmet güvenlik başlıkları
- Açık CORS yerine environment üzerinden origin listesi
- Global rate limiting
- PostgreSQL ve Redis için Docker Compose
- Jest test altyapısı
- GitHub Actions üzerinde test ve build kontrolü
- Versiyonlanmış formül, skor ve profil snapshot'larını destekleyen veri modeli

Henüz hazır olmayan ana parçalar:

- Managed auth sağlayıcısındaki login/kayıt ekranları ve rol yönetimi
- Sağlayıcı hesabı ile uygulama verisini birlikte silen hesap kapatma akışı
- Mobil Expo uygulaması
- Scraper worker ve moderasyon ekranı
- Yorum endpointleri
- Üretim deployment altyapısı

## Teknoloji yığını

| Alan | Teknoloji | Kullanım amacı |
| --- | --- | --- |
| Runtime | Node.js 24 LTS | Desteklenen ve sabit sunucu çalışma ortamı |
| Dil | TypeScript | Tip güvenliği ve ortak mobil/API tipleri |
| Backend | NestJS 11 | Modüler backend ve dependency injection |
| API | REST + OpenAPI | Mobil istemciyle açık ve versiyonlu sözleşme |
| Veritabanı | PostgreSQL 17 | İlişkisel ürün, INCI, profil ve yorum verileri |
| ORM | Prisma 7 | Şema, migration ve tip güvenli sorgular |
| Auth | OIDC + JWKS + jose | Sağlayıcıdan bağımsız access token doğrulaması |
| Kuyruk | Redis (hazır, henüz bağlı değil) | Gelecekte scraper/BullMQ işleri |
| Test | Jest + Supertest | Unit ve gerçek PostgreSQL üzerinde API e2e testleri |
| Lokal servisler | Docker Compose | Ekipte aynı PostgreSQL/Redis ortamı |
| CI | GitHub Actions | Her push/PR için test ve build |

Detaylı teknik kararlar için [mimari dokümanını](docs/ARCHITECTURE.md) okuyun.

## Repository yapısı

```text
cosmedia/
├── apps/
│   └── api/
│       ├── prisma/
│       │   ├── migrations/       # Commit edilen SQL migration'ları
│       │   └── schema.prisma     # Ana veri modeli
│       ├── src/
│       │   ├── config/           # Environment doğrulama
│       │   ├── database/         # Prisma bağlantısı
│       │   ├── generated/        # Prisma Client; Git'e eklenmez
│       │   └── modules/
│       │       ├── favorites/
│       │       ├── health/
│       │       ├── identity/
│       │       ├── ingredients/
│       │       ├── matching/
│       │       ├── profiles/
│       │       ├── products/
│       │       └── scoring/
│       ├── jest.config.cjs
│       └── package.json
├── docs/
│   └── ARCHITECTURE.md
├── .github/workflows/
│   └── api-ci.yml
├── .env.example
├── compose.yaml
├── package.json
└── package-lock.json
```

Planlanan yeni dizinler:

```text
apps/mobile/          # Expo + React Native
apps/admin/           # Moderasyon ve katalog yönetimi
workers/scraper/      # Playwright/Cheerio + BullMQ
packages/contracts/   # Mobil/API ortak DTO ve şemaları
```

## İlk kurulum

### 1. Gereksinimler

Bilgisayarda şunlar kurulu olmalıdır:

- Git
- [NVM](https://github.com/nvm-sh/nvm) veya Node.js 24 LTS
- Docker Desktop ve Docker Compose

Node 23 kullanmayın. Node 23 destek dışıdır ve güncel Prisma sürümü bu runtime'ı
kabul etmez. Repository içindeki `.nvmrc` ekipte aynı Node majör sürümünü kullanır.

### 2. Repository'yi alın

```bash
git clone https://github.com/Katorilabs/Cosmetics-Mobil.git
cd Cosmetics-Mobil
```

Zaten klonladıysanız:

```bash
git switch main
git pull --ff-only origin main
```

### 3. Node sürümünü açın

```bash
nvm install
nvm use
node --version
```

Çıktının `v24.x.x` olması beklenir.

### 4. Environment dosyasını oluşturun

```bash
cp .env.example .env
```

Lokal geliştirme değerleri hazır gelir. `.env` Git'e eklenmez. Gerçek üretim
parolalarını veya API anahtarlarını hiçbir zaman commit etmeyin.

### 5. Bağımlılıkları kurun

```bash
npm ci
```

`npm ci`, commit edilmiş lock dosyasını birebir kullanır ve ekip üyelerinde aynı
paket sürümlerini kurar. Yeni paket eklerken `npm install <paket>` kullanılır.

### 6. Lokal servisleri başlatın

Docker Desktop açıkken:

```bash
docker compose up -d postgres redis
docker compose ps
```

Servisler:

- PostgreSQL: `localhost:55432`
- Redis: `localhost:6379`

PostgreSQL için özellikle `55432` seçildi; bazı bilgisayarlarda 5432/5433 mevcut
PostgreSQL kurulumları tarafından kullanılıyor olabilir.

### 7. Prisma Client'ı üretin ve migration'ları uygulayın

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
```

`db:deploy`, repository'de bulunan migration'ları uygular. İlk kurulumda yeniden
`init` migration'ı oluşturmayın. `db:seed` iki yayınlanmış demo ürün, bunların normalize
INCI kayıtları, dört moderasyonlu alias, bir evidence örneği ve beş v1 skor kuralı
oluşturur; komut tekrar çalıştırıldığında duplicate üretmez.

## Projeyi çalıştırma

Development/watch modu:

```bash
npm run dev
```

Adresler:

- API kökü: <http://localhost:3000/api/v1>
- Swagger: <http://localhost:3000/docs>
- Health: <http://localhost:3000/api/v1/health>

Swagger yalnızca development/test ortamında açılır; production ortamında otomatik
olarak kapatılır.

Production çıktısını lokal test etmek için:

```bash
npm run build
npm start
```

Servisleri durdurmak için:

```bash
docker compose stop
```

Container'ları kaldırıp veriyi korumak için:

```bash
docker compose down
```

> `docker compose down -v` veritabanı volume'ünü ve lokal verileri siler. Yalnızca
> bilinçli bir sıfırlama gerektiğinde kullanılmalıdır.

## API endpointleri

Mevcut public endpointler:

| Metot | Endpoint | Açıklama |
| --- | --- | --- |
| GET | `/api/v1/health` | API ve PostgreSQL hazır mı? |
| GET | `/api/v1/products` | Yayındaki ürünleri sayfalı listeler |
| GET | `/api/v1/products/:id` | Ürün, varyant, görsel ve aktif INCI formülü |

Kullanıcı endpointleri `Authorization: Bearer <access-token>` header'ı gerektirir:

| Metot | Endpoint | Açıklama |
| --- | --- | --- |
| GET | `/api/v1/me` | Doğrulanmış kullanıcıyı getirir; ilk istekte uygulama kaydını oluşturur |
| PATCH | `/api/v1/me` | Kullanıcının görünen adını günceller veya temizler |
| GET | `/api/v1/me/skin-profile` | Mevcut cilt profilini getirir |
| PUT | `/api/v1/me/skin-profile` | Cilt profilini oluşturur veya tamamen günceller |
| DELETE | `/api/v1/me/skin-profile` | Cilt profilini idempotent olarak siler |
| GET | `/api/v1/me/favorites` | Favorileri `page` ve `limit` ile sayfalı listeler |
| PUT | `/api/v1/me/favorites/:variantId` | Yayınlanmış aktif varyantı idempotent favoriler |
| DELETE | `/api/v1/me/favorites/:variantId` | Favoriyi idempotent kaldırır |
| GET | `/api/v1/me/product-matches` | Cilt profiline göre açıklanabilir varyant eşleşmelerini listeler |
| GET | `/api/v1/me/product-scores/:variantId` | Sürümlü profil/formül eşleşme skorunu getirir |

`PUT /me/skin-profile`; `DRY`, `OILY`, `COMBINATION`, `NORMAL`, `SENSITIVE` cilt
tiplerini ve şemada tanımlı endişeleri kabul eder. Kaçınılan INCI adları normalize
edilir; moderasyonlu bir alias ile eşleşiyorsa kanonik INCI adına çevrilir. Bilinmeyen
adlar normalize edilmiş halleriyle korunur. Bilinmeyen request alanları reddedilir.

Örnek:

```bash
curl -X PUT \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "skinType": "COMBINATION",
    "concerns": ["ACNE", "LARGE_PORES"],
    "allergies": ["Fragrance"],
    "avoidInci": ["PARFUM", "ALCOHOL DENAT."]
  }' \
  "http://localhost:3000/api/v1/me/skin-profile"
```

Admin katalog endpointleri `x-admin-key` header'ı gerektirir:

| Metot | Endpoint | Açıklama |
| --- | --- | --- |
| GET | `/api/v1/admin/catalog/brands` | Markaları listeler |
| POST | `/api/v1/admin/catalog/brands` | Marka oluşturur |
| GET | `/api/v1/admin/catalog/categories` | Kategorileri listeler |
| POST | `/api/v1/admin/catalog/categories` | Kategori oluşturur |
| GET | `/api/v1/admin/catalog/ingredients` | Kanonik içerikleri alias'larıyla sayfalı listeler |
| POST | `/api/v1/admin/catalog/ingredients/:ingredientId/aliases` | Moderasyonlu alias ekler |
| DELETE | `/api/v1/admin/catalog/ingredient-aliases/:aliasId` | Alias kaydını siler |
| POST | `/api/v1/admin/catalog/products` | Ürün, ilk varyant ve ilk formülü transaction içinde oluşturur |
| POST | `/api/v1/admin/catalog/imports/products` | `text/csv` katalog dosyasını atomik olarak import eder |
| PATCH | `/api/v1/admin/catalog/products/:id` | Ürün bilgilerini veya yayın durumunu günceller |
| DELETE | `/api/v1/admin/catalog/products/:id` | Ürünü fiziksel olarak silmeden arşivler |
| POST | `/api/v1/admin/catalog/variants/:variantId/formulas` | Yeni versiyonlanmış INCI formülü ekler |
| GET | `/api/v1/admin/catalog/evidence` | Kanıtları içerik, kaynak araması, seviye, etki ve onay durumuyla sayfalı listeler |
| GET | `/api/v1/admin/catalog/evidence/:id` | Kanıtı güncel revizyonuyla getirir |
| POST | `/api/v1/admin/catalog/ingredients/:ingredientId/evidence` | Kaynak atıflı, onay bekleyen kanıt oluşturur |
| PUT | `/api/v1/admin/catalog/evidence/:id` | Kanıt içeriğini tamamen değiştirir ve onayını kaldırır |
| POST | `/api/v1/admin/catalog/evidence/:id/approve` | Okunan revizyonu onaylar |
| POST | `/api/v1/admin/catalog/evidence/:id/revoke` | Kaydı silmeden onayını geri çeker |
| GET | `/api/v1/admin/scoring/rules` | Skor kurallarını sürüme göre listeler |
| POST | `/api/v1/admin/scoring/rule-sets` | Değiştirilemez yeni kural sürümü oluşturur |
| POST | `/api/v1/admin/scoring/rule-sets/:version/activate` | Bir kural sürümünü atomik olarak aktifleştirir |

Lokal admin örneği:

```bash
curl -H "x-admin-key: local-development-admin-key-change-me" \
  "http://localhost:3000/api/v1/admin/catalog/brands"
```

Bu anahtar yalnızca katalog temeli geliştirilirken kullanılan geçici korumadır.
Production öncesinde managed auth ve rol/yetki kontrolüyle değiştirilecektir.

Ürün listeleme query parametreleri:

| Parametre | Tip | Varsayılan | Açıklama |
| --- | --- | --- | --- |
| `search` | string | — | Ürün veya marka adında arama |
| `categoryId` | UUID | — | Kategori filtresi |
| `brandId` | UUID | — | Marka filtresi |
| `page` | integer | `1` | Sayfa numarası |
| `limit` | integer | `20` | Sayfa boyutu; en fazla 100 |

Örnek:

```bash
curl "http://localhost:3000/api/v1/products?page=1&limit=20"
```

Seed çalıştırıldıysa listede iki demo ürün görünür. Seed çalıştırılmadıysa `data: []`
yanıtı normaldir.

## Kimlik doğrulama kurulumu

API belirli bir auth firmasının SDK'sına bağlı değildir. Seçilen managed auth
sağlayıcısının OIDC ayarlarından şu üç değer alınır ve `.env` dosyasına birlikte
yazılır:

```dotenv
AUTH_ISSUER=https://identity.example.com/
AUTH_AUDIENCE=cosmedia-api
AUTH_JWKS_URL=https://identity.example.com/.well-known/jwks.json
AUTH_ALLOWED_ALGORITHMS=RS256
```

- Mobil istemci API'ye **access token** gönderir; ID token API yetkilendirmesi için
  kullanılmaz.
- `AUTH_ISSUER` ve `AUTH_AUDIENCE`, token claim'leriyle karakter karakter eşleşmelidir.
- JWKS adresi yalnızca environment üzerinden güvenilir kabul edilir; token içindeki
  harici anahtar adresleri kullanılmaz.
- Production ortamında OIDC değerleri zorunludur ve JWKS adresi HTTPS olmalıdır.
- İmza, süre, issuer, audience ve izinli algoritma geçmeden kullanıcı oluşturulmaz.
- Doğrulanmış ilk istekte `sub` claim'iyle uygulama kullanıcısı idempotent olarak
  oluşturulur. Email yalnızca `email_verified=true` claim'i varsa saklanır.

Sağlayıcı seçilip mobil login/kayıt akışı bağlanana kadar development ortamında OIDC
değerleri boş bırakılabilir. Bu durumda public katalog çalışır; Bearer token gerektiren
`/me` endpointleri kapalı kalır. Sağlayıcı hesabı ile yerel uygulama verisini birlikte
silen hesap kapatma akışı, sağlayıcının yönetim API'si seçildikten sonra eklenecektir.

## Profil bazlı ürün eşleştirme

`GET /api/v1/me/product-matches`, kullanıcının cilt profilini yayınlanmış ve aktif
formüllerle varyant seviyesinde kesiştirir.

| Parametre | Varsayılan | Açıklama |
| --- | --- | --- |
| `search` | — | Ürün veya marka adında arama |
| `categoryId` | — | UUID ile kategori filtresi |
| `brandId` | — | UUID ile marka filtresi |
| `excludeAvoided` | `true` | Açık kaçınma/`AVOID` sinyalli formülleri sonuçtan çıkarır |
| `page` | `1` | Sayfa numarası |
| `limit` | `20` | Sayfa boyutu; en fazla 100 |

Eşleştirme kuralları:

- Profildeki `avoidInci` adları aktif formülün normalize INCI listesiyle kesin olarak
  karşılaştırılır.
- Yalnızca `reviewedAt` değeri bulunan ve yönü açıkça `BENEFICIAL`, `CAUTION` veya
  `AVOID` olarak işaretlenmiş kanıtlar sinyal üretir.
- Kanıtın cilt tipi veya endişelerinden en az biri kullanıcı profiliyle eşleşmelidir.
- Sonuç durumu `RELEVANT`, `CAUTION`, `AVOID` veya `NEUTRAL` olur; her sinyal içerik
  adı, kanıt seviyesi, eşleşen profil alanları, özet ve kaynak URL'siyle açıklanır.
- Serbest metin `allergies` alanı otomatik INCI eşleştirmesine sokulmaz. Alerjiler
  için doğrulanmış alias sözlüğü eklenene kadar ilgili adlar `avoidInci` listesine de
  eklenmelidir.

Bu endpoint ürün etkinliği veya tıbbi güvenlik puanı vermez. INCI listesi içerik
konsantrasyonunu göstermediğinden response içindeki `guidance` alanı
`formulaConcentrationKnown=false` ve `medicalAdvice=false` bilgisini taşır.
`excludeAvoided=false` kullanıldığında kaçınılan varyantlar gizlenmez; `AVOID`
gerekçeleriyle birlikte gösterilir.

Demo seed, niasinamid için acne profiline ilişkin moderasyonlu bir örnek kanıt kaydı
oluşturur. Kaynak: [PubMed PMID 7657446](https://pubmed.ncbi.nlm.nih.gov/7657446/).
Seed özeti herhangi bir üründe aynı konsantrasyon veya klinik etki varsaymaz.

## Açıklanabilir içerik skoru

`GET /api/v1/me/product-scores/:variantId`, kullanıcının cilt profilini aktif formülle
karşılaştırır ve `0–100` arasında bir **profil/formül eşleşme indeksi** döndürür. Bu
değer güvenlik, toksisite, tedavi veya ürün etkinliği puanı değildir.

Varsayılan v1 kural seti:

| Kural | Ağırlık | Davranış |
| --- | ---: | --- |
| `BASE_SCORE` | `+50` | Nötr başlangıç değeri |
| `PROFILE_BENEFICIAL_EVIDENCE` | `+10` | Kanıt seviyesine göre `0.5/0.75/1` çarpanı |
| `PROFILE_CAUTION_EVIDENCE` | `-12` | Profil ile eşleşen moderasyonlu caution sinyali |
| `PROFILE_AVOID_EVIDENCE` | `-30` | Profil ile eşleşen moderasyonlu avoid sinyali |
| `EXPLICIT_AVOID_INCI` | `-100` | Kullanıcının açık `avoidInci` tercihi |

Her kuralın katkısı, eşleşen içerikleri ve kaynak kanıtları `explanation.appliedRules`
alanında gösterilir. Aynı içerik ve etki için birden fazla çalışma varsa en güçlü
kanıt seviyesi bir kez sayılır. Sonuç `0–100` aralığına sınırlandırılır ve
`LOW_MATCH`, `LIMITED_MATCH`, `MODERATE_MATCH` veya `STRONG_MATCH` bandı eklenir.

`confidence`, ürün etkinliğinin olasılığı değildir; formül kaynağının güven değeriyle
çözümlenmiş/kesin içerik oranından hesaplanan veri tamlığı göstergesidir. Formül
konsantrasyonları INCI listesinden bilinmediği için response her zaman
`formulaConcentrationKnown=false`, `safetyGuarantee=false` ve
`efficacyGuarantee=false` sınırlarını taşır.

Snapshot anahtarı aktif formül, sıralanmış profil tercihleri hash'i, kural sürümü ve
hesaba katılan kanıt içeriğinin SHA-256 hash'inden (`evidenceKey`) oluşur. Aynı girdi tekrar istendiğinde yeni kayıt üretilmez. Kural sürümleri oluşturma
sonrasında değiştirilmez; yeni metodoloji yeni bir sürüm olarak eklenir ve admin
endpointiyle atomik biçimde aktifleştirilir. Eski snapshot'lar karşılaştırılabilirlik
için korunur. Kanıt onayı geri çekildiğinde veya onaylı içerik/kaynak değiştiğinde
sonraki skor isteği güncel girdilere ait snapshot'ı kullanır; eski sonuç üzerine
yazılmaz. Migration öncesi kayıtlar `evidenceKey=legacy` ile korunur.

## Kaynak ve kanıt yönetimi

Kaynak bilgisi her `IngredientEvidence` üzerinde `sourceName`, `sourceUrl` ve isteğe
bağlı `publishedAt` ile tutulur. Bu aşamada ayrı kaynak kataloğu veya yönetim ekranı
bulunmaz; yönetim admin API ve Swagger üzerinden yapılır. HTTP(S) bağlantıları
atıf olarak saklanır, API bu adreslere istek göndermez. Kaynağın bilimsel geçerliliği
ve kanıt seviyesi moderatör tarafından değerlendirilir; otomatik doğrulama yapılmaz.

Örnek oluşturma gövdesi (test amaçlıdır, gerçek bilimsel kanıt değildir):

```json
{
  "title": "Örnek çalışma başlığı",
  "summary": "Çalışmanın bulguları, kapsamı ve sınırlılıkları burada özetlenir.",
  "sourceName": "Örnek kaynak",
  "sourceUrl": "https://example.com/study",
  "level": "MODERATE",
  "effect": "BENEFICIAL",
  "skinTypes": ["COMBINATION"],
  "concerns": ["ACNE"],
  "publishedAt": "2020-01-01T00:00:00.000Z"
}
```

Oluşturulan kayıt `revision=1`, `reviewedAt=null` ile başlar. Onaylama veya onayı
kaldırma isteği, son okunan revizyonu `{"revision":1}` biçiminde gönderir. Her işlem
revizyonu artırır. `PUT`, tüm içerik alanlarıyla birlikte güncel `revision` ister ve
önceki onayı kaldırır; yayın tarihi gönderilmezse veya `null` ise temizlenir.
Eski revizyonla düzenleme/onaylama `409 EVIDENCE_REVISION_CONFLICT` döndürür;
istemci kaydı tekrar okuyup değişiklikleri değerlendirmelidir. İstemci `reviewedAt`
alanını doğrudan yazamaz. Onay geri çekme kaydı silmez.

Liste filtreleri: `ingredientId`, `search` (başlık, özet, kaynak adı veya URL),
`state=PENDING|APPROVED`, `level`, `effect`, `page`, `limit` (en fazla 100).
Yalnızca onaylı, profil hedefiyle eşleşen ve `INFORMATIONAL` olmayan kanıtlar
kullanıcı eşleştirmelerine ve skorlara katılır. Boş hedef listeleri herkese yönelik
kanıt anlamına gelmez; herhangi bir profile eşleşmez.

Yeni migration için API'yi güncellemeden önce `npm run db:deploy`, ardından
`npm run db:generate` ve `npm run build` çalıştırın.

## INCI alias ve normalizasyon

Her `Ingredient` kaydı bir kanonik `inciName` ve benzersiz `normalizedName` anahtarı
taşır. Normalizasyon Unicode uyumluluk dönüşümü uygular, farklı tire karakterlerini
birleştirir, gereksiz boşlukları kaldırır ve karşılaştırma anahtarını büyük harfe
çevirir. Noktalama işaretleri agresif biçimde silinmez; böylece benzer görünen farklı
kimyasal adların yanlışlıkla birleşme riski azaltılır.

`IngredientAlias`, kullanıcı veya veri kaynağında görülebilen adı tek bir kanonik
içeriğe bağlar. Geçici admin anahtarıyla eklenen alias moderasyonlu kabul edilir ve
`reviewedAt` zamanı kaydedilir. Bir alias:

- başka bir kanonik ad veya alias ile aynı normalize anahtarı kullanamaz,
- formül importu ve admin formül oluşturma sırasında kanonik içeriğe çözülür,
- cilt profilindeki `avoidInci` tercihlerini de kanonik ada dönüştürür,
- silindiğinde daha önce kurulmuş formül–içerik bağlantılarını bozmaz.

Formülde kaynaktan gelen ad `ProductIngredient.rawName` alanında aynen korunur;
eşleştirme ve ilerideki skor motoru kanonik `Ingredient` kaydını kullanır. Alias
sözlüğünde bulunmayan kontrollü admin/CSV girdisi yeni bir kanonik içerik oluşturur.
Bu nedenle scraper çıktısı gelecekte otomatik yayınlanmadan önce moderasyona girecektir.

Örnek alias oluşturma:

```bash
curl -X POST \
  -H "x-admin-key: local-development-admin-key-change-me" \
  -H "content-type: application/json" \
  -d '{"alias":"Vitamin B3","sourceName":"Manual review"}' \
  "http://localhost:3000/api/v1/admin/catalog/ingredients/<ingredient-uuid>/aliases"
```

## CSV katalog importu

Örnek dosya:
[`apps/api/prisma/data/products.example.csv`](apps/api/prisma/data/products.example.csv)

Import isteği:

```bash
curl -X POST \
  -H "content-type: text/csv" \
  -H "x-admin-key: local-development-admin-key-change-me" \
  --data-binary @apps/api/prisma/data/products.example.csv \
  "http://localhost:3000/api/v1/admin/catalog/imports/products"
```

CSV kolonları:

| Kolon | Zorunlu | Açıklama |
| --- | --- | --- |
| `brand` | Evet | Marka adı |
| `brand_website` | Hayır | Protokollü marka URL'si |
| `category` | Evet | Kategori adı |
| `product_name` | Evet | Ürün adı ve idempotency slug kaynağı |
| `description` | Hayır | Ürün açıklaması; en fazla 5.000 karakter |
| `status` | Hayır | `DRAFT`, `PUBLISHED`, `ARCHIVED`; boşsa `DRAFT` |
| `variant_name` | Evet | Ör. `50 ml`; ürün içinde benzersiz |
| `size_value` | Hayır | En fazla iki ondalıklı pozitif değer |
| `size_unit` | Hayır | `ml`, `g` vb. |
| `barcode` | Hayır | 8–14 rakam |
| `image_url` | Hayır | Protokollü görsel URL'si |
| `raw_inci` | Hayır | Etiketteki ham INCI metni; virgül içeriyorsa CSV'de tırnaklanmalı |
| `inci_names` | Evet | `AQUA\|GLYCERIN\|Vitamin B3` biçiminde INCI/alias adları |
| `source_name` | Hayır | Verinin kaynağı |
| `source_url` | Hayır | Protokollü kaynak URL'si |
| `confidence` | Hayır | `0` ile `1` arasında güven seviyesi |

Güvenlik ve tutarlılık kuralları:

- Yalnızca UTF-8 `text/csv` veya `application/csv` gövdesi kabul edilir.
- Maksimum dosya boyutu 1 MB, maksimum veri satırı 1.000'dir.
- Eksik/tekrarlı header, bozuk kolon sayısı ve null byte reddedilir.
- Tüm satırlar veritabanına geçmeden önce doğrulanır.
- Dosya tek transaction içinde uygulanır; bir DB hatasında tamamı geri alınır.
- Aynı ürün/varyant güncellenir; aynı ham INCI tekrar import edilirse yeni formül
  versiyonu oluşturulmaz.
- Ham INCI değişirse eski aktif formül pasifleştirilir ve yeni sürüm açılır.

Başarılı yanıt örneği:

```json
{
  "totalRows": 2,
  "productsCreated": 2,
  "productsUpdated": 0,
  "variantsCreated": 2,
  "variantsUpdated": 0,
  "formulasCreated": 2,
  "formulasUnchanged": 0,
  "ingredientLinksCreated": 7
}
```

## API hata formatı

Tüm API hataları aynı zarfı kullanır:

```json
{
  "error": {
    "code": "CSV_ROWS_INVALID",
    "message": "One or more CSV rows are invalid",
    "status": 400,
    "details": {
      "rows": [{ "row": 2, "fields": [] }]
    },
    "path": "/api/v1/admin/catalog/imports/products",
    "timestamp": "2026-07-19T16:42:50.897Z",
    "requestId": "376a05aa-9a03-4c21-ba7a-2e5a9a2912c1"
  }
}
```

`x-request-id` response header'ı ile gövdedeki `requestId` aynıdır. İstemci geçerli
bir `x-request-id` gönderirse hata yanıtında korunur. Beklenmeyen `500` hatalarında
iç exception mesajı kullanıcıya açılmaz.

## Veri modeli

Ana ilişkiler:

```text
Brand ──< Product >── Category
             |
             v
       ProductVariant
        |     |     |
        |     |     +──< Review
        |     +────────< ProductImage
        v
   FormulaVersion ──< ProductIngredient >── Ingredient ──< IngredientAlias
        |                                      |
        +──< ScoreSnapshot                     +──< IngredientEvidence
                  ^
                  |
          ScoreRule (versioned)

User ── SkinProfile
  |
  +──< Favorite >── ProductVariant
  |
  +──< Review (profileSnapshot ile)
```

Önemli kararlar:

- Ürün ve ürün varyantı ayrıdır; aynı ürünün farklı hacim/barkodları olabilir.
- INCI listesi doğrudan ürün üstüne yazılmaz, `FormulaVersion` ile versiyonlanır.
- Normalize edilemeyen içeriklerde ham isim kaybedilmez.
- Kanonik içerik ve alias anahtarları benzersizdir; alias eşleşmesi formülün ham adını
  değiştirmeden tüm analizleri tek bir `Ingredient` kaydı üzerinde toplar.
- Yorum, kullanıcının o andaki cilt profilini snapshot olarak saklar.
- Favori bir ürüne değil belirli ürün varyantına bağlıdır; kullanıcı/varyant başına
  tek kayıt vardır ve ilişkili kayıt silindiğinde cascade ile temizlenir.
- Ingredient evidence yönü bilinmiyorsa `INFORMATIONAL` kalır ve profil sinyali
  üretmez; yalnızca moderasyonlu/yönlendirilmiş kanıt eşleştirmeye katılır.
- Skor, formül, anonim profil hash'i, kanıt hash'i ve scoring sürümüne bağlı idempotent snapshot
  olarak tutulur; açıklama ve veri güveni gösterilen sayıyla birlikte sabitlenir.
- Scraper verisi otomatik yayınlanmaz; moderasyon akışına girecek şekilde modellenir.

Şemanın tamamı: [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma)

## Ortam değişkenleri

| Değişken | Örnek | Açıklama |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test`, `production` |
| `PORT` | `3000` | API portu |
| `DATABASE_URL` | `postgresql://...:55432/cosmedia` | PostgreSQL bağlantısı |
| `CORS_ORIGINS` | `http://localhost:8081,...` | Virgülle ayrılmış izinli origin listesi |
| `API_RATE_LIMIT_TTL_MS` | `60000` | Rate limit zaman penceresi |
| `API_RATE_LIMIT_LIMIT` | `100` | Pencere başına maksimum istek |
| `ADMIN_API_KEY` | `local-development-...` | Geçici admin katalog anahtarı; en az 32 karakter |
| `AUTH_ISSUER` | `https://identity.example.com/` | Access token içindeki güvenilir OIDC issuer |
| `AUTH_AUDIENCE` | `cosmedia-api` | API için beklenen token audience değeri |
| `AUTH_JWKS_URL` | `https://identity.example.com/.well-known/jwks.json` | İmza anahtarlarının güvenilir JWKS adresi |
| `AUTH_ALLOWED_ALGORITHMS` | `RS256` | Virgülle ayrılmış izinli asimetrik imza algoritmaları |

Eksik veya geçersiz environment değeri olduğunda API sessizce yanlış ayarla açılmaz;
başlangıç sırasında anlaşılır bir hata vererek kapanır.

Development ortamında OIDC değerleri boş bırakılabilir; public ve geçici admin
endpointleri çalışmaya devam eder ancak `/me` endpointleri `AUTH_NOT_CONFIGURED`
yanıtı verir. Üç OIDC değeri birlikte ayarlanmalıdır. Production ortamında bu
değerler zorunludur ve `AUTH_JWKS_URL` HTTPS kullanmalıdır. Token imzası, issuer,
audience, süre ve izinli algoritma doğrulanmadan hiçbir claim güvenilir kabul edilmez.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | API'yi watch modunda çalıştırır |
| `npm run build` | TypeScript production build üretir |
| `npm start` | Önceden üretilmiş build'i çalıştırır |
| `npm test` | Unit testleri çalıştırır |
| `npm run test:coverage` | Coverage raporu üretir |
| `npm run db:generate` | Prisma Client üretir |
| `npm run db:deploy` | Mevcut migration'ları uygular |
| `npm run db:seed` | İdempotent demo katalog, evidence ve skor kurallarını yükler |
| `npm run db:migrate -- --name <ad>` | Yeni migration oluşturur ve uygular |
| `npm run db:studio` | Prisma Studio arayüzünü açar |

## Migration çalışma düzeni

Veri modelinde değişiklik yaparken:

1. `apps/api/prisma/schema.prisma` dosyasını güncelleyin.
2. Açıklayıcı bir migration adı seçin.
3. Migration'ı oluşturun:

```bash
npm run db:migrate -- --name add_product_admin_fields
```

4. Oluşan SQL'i `apps/api/prisma/migrations/` altında inceleyin.
5. `npm run db:generate`, `npm test` ve `npm run build` çalıştırın.
6. Şema ve migration dosyasını aynı commit'e ekleyin.

Var olan migration dosyalarını sonradan elle değiştirerek ekip veritabanları arasında
fark oluşturmayın. Düzeltme gerekiyorsa yeni migration ekleyin.

## Test ve CI

Lokal doğrulama:

```bash
npm test
npm run test:e2e
npm run build
npx prisma validate --config apps/api/prisma.config.ts
git diff --check
```

`npm run test:e2e` için Docker PostgreSQL servisi çalışıyor ve migration'lar uygulanmış
olmalıdır. Test paketi yalnızca `e2e-` önekli kendi katalog, kullanıcı, profil ve
favori/evidence/scoring verisini oluşturur; test sonunda bunları temizler ve
seed/geliştirici verilerine dokunmaz.

GitHub Actions şu durumlarda otomatik çalışır:

- `main` dalına push
- Pull request açılması veya güncellenmesi

CI şu kontrolleri yapar:

1. Node 24 ortamını kurar.
2. `npm ci` ile kilitli bağımlılıkları yükler.
3. İzole bir PostgreSQL 17 servisini hazırlar.
4. Prisma Client üretir ve commit edilmiş migration'ları uygular.
5. Unit testleri çalıştırır.
6. Health, admin yetkilendirme, ortak hata formatı, CSV import/idempotency, kullanıcı
   eşleme, cilt profili, favori, ürün eşleştirme ve idempotent skor snapshot akışlarını
   gerçek HTTP istekleriyle test eder.
7. Production build alır.

## Ekip çalışma düzeni

Doğrudan `main` üzerinde büyük özellik geliştirmek yerine kısa ömürlü feature branch
kullanın:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/admin-product-create
```

İş tamamlanınca:

```bash
npm test
npm run build
git status
git add <ilgili-dosyalar>
git commit -m "feat: add admin product creation"
git push -u origin feature/admin-product-create
```

Commit türleri için öneri:

- `feat:` yeni özellik
- `fix:` hata düzeltmesi
- `refactor:` davranışı değiştirmeyen düzenleme
- `test:` test ekleme/düzeltme
- `docs:` dokümantasyon
- `chore:` bakım ve tooling

Pull request açıklamasında şunlar bulunmalı:

- Ne değişti?
- Neden değişti?
- Nasıl test edildi?
- Migration veya environment değişikliği var mı?
- Mobil uygulamanın API sözleşmesi etkileniyor mu?

## Yol haritası

### Aşama 1 — Katalog temeli (tamamlandı)

- [x] Örnek ve test edilebilir seed veri seti
- [x] CSV ürün/INCI import servisi
- [x] Marka ve kategori oluşturma/listeleme
- [x] Transactional ürün, varyant ve ilk formül oluşturma
- [x] Ürün güncelleme, arşivleme ve formül versiyonu ekleme
- [x] Geçici admin authorization guard
- [x] Ortak hata yanıt formatı
- [x] PostgreSQL integration/e2e testleri ve CI servisi

### Aşama 2 — Kullanıcı ve profil

- [x] Sağlayıcıdan bağımsız OIDC/JWKS token doğrulama altyapısı
- [x] Kullanıcı eşleme ve `/me` API'si
- [x] Cilt tipi, endişeler, alerji ve kaçınılan içerik profili
- [x] Ürün varyantı favorileri
- Managed auth sağlayıcısının login/kayıt akışıyla bağlanması
- Kullanıcı hesabı ve veri silme akışı
- [x] Profil bazlı varyant filtreleme ve açıklanabilir evidence sinyalleri

### Aşama 3 — İçerik ve skor motoru

- [x] INCI alias/normalizasyon sistemi
- [x] Evidence yönü (`INFORMATIONAL/BENEFICIAL/CAUTION/AVOID`) temeli
- [x] Kaynak atıfları ve bilimsel kanıt yönetimi admin API’si
- [x] Versiyonlanmış skor kuralları
- [x] Skor açıklaması ve veri güven seviyesi
- Benzer profil yorum istatistikleri

### Aşama 4 — Mobil MVP

- Expo + React Native + TypeScript
- Expo Router navigasyonu
- Onboarding ve cilt profili
- Ürün arama/filtreleme
- Ürün ve INCI detay ekranı
- Favoriler ve yorumlar

### Aşama 5 — Veri toplama ve operasyon

- Ayrı scraper worker
- Redis + BullMQ
- Playwright/Cheerio adaptörleri
- Retry/dead-letter akışı
- Veri moderasyon paneli
- Sentry, loglama, metrik ve alarm sistemi

### Aşama 6 — Beta ve mağazalar

- TestFlight ve Google Play kapalı test
- KVKK/gizlilik politikası
- Hesap ve veri silme sayfası
- Store metadata ve ekran görüntüleri
- Production database, storage ve backup politikası
- Aşamalı mağaza yayını

## Sorun giderme

### Prisma `DATABASE_URL is required` hatası

Root dizinde `.env` olduğundan emin olun:

```bash
cp .env.example .env
```

### Prisma Node sürümünü kabul etmiyor

```bash
nvm install
nvm use
node --version
```

Node sürümü `24.x` olmalıdır.

### Docker daemon'a bağlanamıyor

Docker Desktop'ı açın ve tamamen başlamasını bekleyin:

```bash
docker info
docker compose up -d postgres redis
```

### PostgreSQL portu kullanılıyor

Proje varsayılan olarak host üzerinde `55432` kullanır. Bu port da doluysa hem
`compose.yaml` port mapping'ini hem `.env` içindeki `DATABASE_URL` değerini aynı
şekilde güncelleyin.

### API açılıyor fakat ürün listesi boş

Demo veriyi yükleyip tekrar deneyin:

```bash
npm run db:seed
```

Health endpoint'i `database: "up"` dönüyor ve seed başarılı tamamlanıyorsa backend
doğru çalışıyor demektir.

### Temiz kurulumdan sonra Prisma tipleri bulunamıyor

```bash
npm run db:generate
npm run build
```

## Mimari ilkeler

- Mobil uygulama veritabanına doğrudan bağlanmaz; yalnızca API sözleşmesini kullanır.
- Scraper API prosesinin içinde çalışmaz; ayrı worker olarak ölçeklenir.
- Scrape edilen veri insan/moderasyon onayı olmadan yayınlanmaz.
- Tıbbi veya mutlak güvenlik iddiaları üretilmez.
- Formül ve skor geçmişi overwrite edilmez, versiyonlanır.
- Secret'lar Git'e eklenmez.
- Her yeni özellik test, migration ve dokümantasyon etkisiyle birlikte değerlendirilir.
