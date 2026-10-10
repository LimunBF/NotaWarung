# Nota Warungku - Bot WhatsApp

Bot WhatsApp untuk pencatatan nota warung **Satene Kambing Wong Madiun "P. SUMO"**.

## 🎯 Fitur
- Input pesanan via chat WA natural (contoh: "3 sate kambing, 2 nasi putih")
- Auto-hitung total + terbilang
- Generate PDF nota otomatis
- Dashboard owner (cek laporan dari rumah)
- Multi-kasir support
- Auto-schedule bot (jam kerja warung)

## 📋 Info Warung
- **Nama**: Satene Kambing Wong Madiun "P. SUMO"
- **Alamat**: Jl. Cokroaminoto No. 4 Madiun
- **Telp**: 082 234 888 689
- **Jam Buka**: 09:00 - 23:00

## 🛠️ Stack
- **Bot**: Node.js + Telegraf (ESM, Telegram bot library)
- **Fallback**: WhatsApp via Baileys (lihat `bot/index.js`)
- **Database**: Supabase (PostgreSQL)
- **Dashboard**: HTML/CSS/JS (boomer-friendly UI)
- **Hosting**: Railway (free tier 500 jam/bulan)
- **PDF**: PDFKit

## 📁 Struktur Folder
```
Z:\Coding\Nota Warung\
├── bot/                    # Bot WhatsApp
│   ├── index.js
│   ├── handlers/
│   ├── services/
│   └── package.json
├── database/               # Schema Supabase
│   └── schema.sql
├── dashboard/              # Dashboard owner
│   ├── index.html
│   ├── style.css
│   └── app.js
├── docs/                   # Dokumentasi
│   ├── setup.md
│   └── deployment.md
├── .env.example
└── README.md
```

## 🚀 Setup
Lihat [docs/setup.md](docs/setup.md)

## ⚙️ Konfigurasi Supabase + Railway
Ikuti urutan berikut:

1. Buat project Supabase baru di [supabase.com](https://supabase.com/new)
2. Buka `database/menu.json`, import data menu ke tabel `menu_items` via Supabase SQL editor
3. Jalankan `database/schema.sql` untuk buat semua tabel (notas, nota_items, kasir)
4. Salin `.env.example` → `.env`, isi nilai:
   - `SUPABASE_URL` — dari dashboard → Project Settings → API
   - `SUPABASE_KEY` — `anon/public` key
   - `TELEGRAM_BOT_TOKEN` — dari [@BotFather](https://t.me/BotFather)
5. Deploy ke Railway:
   - Buat project Railway, connect repo GitHub ini
   - Di Railway dashboard, tambahkan semua variables di `.env` sebagai environment variables
   - Railway akan auto-deploy tiap push ke main branch
   - Free tier = 500 jam/bulan cocok untuk jam kerja warung (14 jam/hari = 420 jam/bulan)
6. Test lokal: `npm run dev`
7. Set custom commands di @BotFather untuk bot Telegram
8. Restart Hermes jika ganti command

### 🔄 Switch ke WhatsApp (opsional)
Ubah `BOT_PLATFORM=whatsapp` di `.env`, jalankan `node bot/index.js`.
