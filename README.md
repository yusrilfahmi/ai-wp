# AI Content Generator Dashboard

## Tentang Aplikasi
Aplikasi ini adalah dashboard cerdas berbasis web yang dirancang untuk mengotomatiskan pembuatan dan penerbitan artikel ramah SEO ke platform WordPress. Memanfaatkan kecerdasan buatan (Gemini & OpenRouter/Custom Models), aplikasi ini mampu menghasilkan judul, meta deskripsi, dan isi artikel yang terstruktur dari input judul, tautan sumber, atau data gambar multimodal (seperti hasil pertandingan, klasemen, statistik).

## Arsitektur & Struktur File
Aplikasi ini dibangun menggunakan framework **Next.js 16 (App Router)**.
- `src/app/`: Menyimpan semua *routes* halaman.
  - `(auth)/`: Rute untuk halaman otentikasi (Supabase Auth).
  - `(main)/`: Rute utama yang berisi dashboard dan alat pembuat artikel (`/dashboard`, `/artikel-mode`, dan `/settings`).
  - `actions/`: Kumpulan Server Actions untuk pemrosesan backend yang aman.
    - `process-content.ts`: Logika pembuatan artikel teks dari prompt dinamis.
    - `process-image-content.ts`: Logika pembuatan artikel dari input multimodal (gambar klasemen, statistik, rating).
    - `draft-post.ts`: Logika integrasi publikasi ke WordPress via WP REST API (termasuk unggah thumbnail).
    - `settings.ts`: Fungsi CRUD pengaturan API Key & prompt yang disimpan ke Supabase.
- `src/components/`: Komponen UI modular client-side (seperti form dashboard, artikel mode, navbar, dan alat crop gambar).
- `src/lib/`: Pengaturan utilitas dasar dan pembuatan instance Supabase client.
- `public/`: Aset statis dan favicon.

## API yang Tersedia
Aplikasi ini mayoritas menggunakan *Server Actions* (tidak diekspos sebagai route API publik langsung, tetapi berupa prosedur internal Next.js yang aman dari pembacaan koneksi network browser):
1. **AI Generation Processing**: Mengirim prompt yang aman ke endpoint `generativelanguage.googleapis.com` (Gemini) atau `openrouter.ai/api/v1/chat/completions` (OpenRouter).
2. **WordPress API Integrations**: Terhubung dengan URL situs secara remote via Basic Auth. Endpoint utama:
   - `/wp-json/wp/v2/tags` (Pencarian tag wp dinamis untuk internal link)
   - `/wp-json/wp/v2/media` (Upload thumbnail)
   - `/wp-json/wp/v2/posts` (Pembuatan ID draft post beserta semantik metadatanya)
   - `/wp-json/wp/v2/categories` (Fetch list kategori realtime dari blog)

## Skema Database
Aplikasi menggunakan **Supabase (PostgreSQL)**.
Pengaturan personal disimpan secara unik bagi tiap penulis di tabel `user_settings`:
- `user_id` (UUID format - didapat dari auth schema) - *Primary Key*
- `gemini_api_key` (String)
- `openrouter_api_key` (String)
- `wp_site_url` (String)
- `wp_username` (String)
- `wp_app_password` (String)
- `active_model` (String)
- `openrouter_model_string` (String)
- `custom_prompt` (Text)

## Cara Setup Project
```bash
# 1. Clone repository
git clone https://github.com/yusrilfahmi/ai-wp.git
cd ai-wp

# 2. Install dependencies
npm install

# 3. Setup Environment Variables
# Buat file .env.local di root directory (sejajar dengan package.json)
NEXT_PUBLIC_SUPABASE_URL=url_project_anda
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon_key_project_anda
```

## Technology Stack Utama
- **Framework**: Next.js 16.2.1 (App Router)
- **Engine**: React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Database Backend**: Supabase (@supabase/supabase-js, @supabase/ssr)

## Library Tambahan yang Digunakan
- **UI Components**: `lucide-react` (Ikon SVG ringan)
- **Toast Notifications**: `sonner` (Menyiapkan pop-up notifikasi cantik)
- **Image Editing**: `react-easy-crop` (Memotong rasio thumbnail gambar di client side)
- **Linting**: `eslint`, `eslint-config-next`

## Cara Run Aplikasi
Setelah mengatur `.env.local`, jalankan server lokal CLI Next.js dengan perintah:
```bash
npm run dev
```
Buka browser dan navigasi ke [http://localhost:3000](http://localhost:3000).
