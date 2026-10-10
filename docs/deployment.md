# 🚀 Nota Warungku - Deployment & Setup Guide

## 📋 Checklist Pre-Deployment

- [ ] Node.js v18+ terinstall
- [ ] npm install di folder `bot/` selesai
- [ ] Supabase project dibuat & schema dijalankan
- [ ] `.env` file dikonfigurasi dengan credentials Supabase
- [ ] `dashboard/app.js` diupdate dengan Supabase URL & key
- [ ] Bot dapat scan QR code & login WhatsApp
- [ ] Test lokal: `npm start` berjalan normal
- [ ] Dashboard dapat diakses & terhubung ke API

---

## 🛠️ Setup Langkah Demi Langkah

### 1. Install Node.js Dependencies

```bash
cd "Z:/Coding/Nota Warung/bot"
npm install
```

Tunggu sampai selesai (±3-5 menit, tergantung koneksi).

### 2. Buat Supabase Project

1. Buka https://supabase.com
2. Sign up / Login
3. Klik **"New Project"**
4. Isi form:
   - **Name**: `nota-warungku` (atau nama apapun)
   - **Database Password**: simpan baik-baik
   - **Region**: `ap-southeast-1` (Singapore, terdekat Madiun)
   - **Pricing**: Free
5. Klik **"Create New Project"** → tunggu 2 menit

### 3. Import Database Schema

1. Buka project Supabase
2. Di sidebar kiri → **SQL Editor** (ikon `>_`)
3. Klik **"New Query"**
4. Buka file: `Z:\Coding\Nota Warung\database\schema.sql`
5. Copy-paste semua isinya ke SQL Editor Supabase
6. Klik **"Run"** (tombol hijau kanan bawah)
7. Sukses: muncul pesan "Success"

### 4. Ambil Supabase Credentials

1. Di sidebar Supabase → **Project Settings** (ikon ⚙️)
2. Tab **API**
3. Catat 2 hal:
   - **Project URL** (contoh: `https://xyzpdq.supabase.co`)
   - **anon / public key** (string panjang diawali `eyJ...`)

### 5. Konfigurasi Environment

Buka file `Z:\Coding\Nota Warung\.env`:

```env
SUPABASE_URL=https://xyzpdq.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
WA_BOT_NUMBER=6281234567890
WARUNG_NAME=Satene Kambing Wong Madiun "P. SUMO"
WARUNG_ADDRESS=Jl. Cokroaminoto No. 4 Madiun
WARUNG_PHONE=082234888689
OPEN_HOUR=09
CLOSE_HOUR=23
PORT=3000
NODE_ENV=production
```

**Ganti:**
- `SUPABASE_URL` & `SUPABASE_KEY` dengan nilai dari step 4
- `WA_BOT_NUMBER` dengan nomor WhatsApp bot nanti (untuk sekarang bisa placeholder)

### 6. Konfigurasi Dashboard

Buka file `Z:\Coding\Nota Warung\dashboard\app.js` (baris 15-16):

Ganti:
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

Dengan:
```javascript
const SUPABASE_URL = 'https://xyzpdq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### 7. Test Bot Lokal

```bash
cd "Z:/Coding/Nota Warung/bot"
npm start
```

Output:
```
🚀 Memulai Nota Warungku Bot...
📋 Warung: Satene Kambing Wong Madiun "P. SUMO"
⏰ Jam operasional: 09:00 - 23:00
🌐 Dashboard API running on port 3000
🔗 Buka: http://localhost:3000
🔗 Scan QR Code ini dengan WhatsApp:
[QR Code muncul]
```

1. Buka WhatsApp di HP
2. Scan QR code yang muncul di terminal
3. Tunggu: "✅ Bot WhatsApp terhubung!"

### 8. Test Bot Commands

Buka https://localhost:3000 di browser untuk lihat dashboard (API akan jalan di background).

Test pesan ke bot:
```
login andi
3 sate kambing
2 nasi putih
5 es teh
```

Bot harus balas dengan nota terstruktur + PDF.

### 9. Deploy ke Railway

```bash
npm i -g @railway/cli
railway login
cd "Z:/Coding/Nota Warung"
railway init
```

Di Railway dashboard:
1. Set environment variables (copy dari `.env`)
2. Deploy:
```bash
railway up
```

Railway akan memberikan URL bot (contoh: `nota-warungku.up.railway.app`).

---

## 🎮 Bot Commands (untuk Kasir)

| Command | Contoh | Hasil |
|---------|--------|-------|
| **Login** | `login andi` | Kasir "andi" aktif |
| **Logout** | `logout` | Logout dari sesi |
| **Buat Nota** | `3 sate kambing\n2 nasi putih` | Auto-parse & hitung total |
| **Menu** | `menu` | Lihat daftar menu + harga |
| **Help** | `help` | Bantuan lengkap |
| **Nota Detail** | `nota 123` | Lihat detail nota |
| **Cancel Nota** | `cancel 123` | Batalkan nota (owner only) |
| **Bayar** | `bayar 123` | Tandai nota lunas |
| **Tambah Item** | `tambah 123 2 sate kambing` | Tambah item ke nota |
| **Laporan Hari Ini** | `laporan` | Summary nota hari ini |
| **Laporan Bulan** | `laporan bulan` | Summary nota bulan ini |

---

## 🌐 Dashboard Features (Web)

**URL**: http://localhost:3000 (lokal) atau Railway URL (prod)

### Sections:

1. **Status & Kontrol**
   - Bot status (online/offline)
   - Tombol START/STOP (manual override)
   - Schedule info (jam buka/tutup, waktu sampai action)

2. **Stats (Real-time)**
   - Nota hari ini (jumlah + total Rp)
   - Nota bulan ini (jumlah + total Rp)

3. **Nota Terbaru**
   - 10 nota terakhir
   - Status (pending/lunas/batal)
   - Tombol "Load More" untuk pagination

4. **Export Laporan**
   - Download Excel hari ini
   - Download Excel bulan ini
   - Auto-generate dengan formula SUM

5. **Kasir Aktif**
   - Daftar kasir yang sedang login
   - Waktu login
   - Mode (owner vs kasir)

---

## 📊 API Endpoints (untuk developer)

```
GET  /api/health              → Status bot & schedule
POST /api/bot/start           → Start bot (manual)
POST /api/bot/stop            → Stop bot (manual)
GET  /api/schedule            → Info jadwal
GET  /api/stats               → Stats hari ini & bulan ini
GET  /api/notas               → List nota (paginated)
GET  /api/notas/:id           → Detail nota + items
GET  /api/kasir/active        → Kasir yang sedang login
GET  /api/menu                → Daftar menu
GET  /api/export/today        → Excel hari ini (download)
GET  /api/export/month        → Excel bulan ini (download)
```

---

## 🔧 Troubleshooting

### Bot tidak connect
**Masalah**: Scanning QR code tidak bekerja
**Solusi**:
1. Pastikan nomor WhatsApp tidak login di device lain
2. Hapus folder `auth_info_baileys`
3. Run `npm start` lagi & scan QR ulang

### Error: Cannot find module 'exceljs'
**Solusi**: `npm install` ulang di folder `bot/`

### Dashboard tidak bisa connect ke API
**Masalah**: API error 500, atau stats tidak muncul
**Solusi**:
1. Cek Supabase credentials di `.env` benar
2. Cek table sudah dibuat: buka Supabase dashboard → Tables
3. Run `npm start` lagi

### PDF tidak tergenerate
**Solusi**:
1. Pastikan folder `temp/pdfs` ada & writable
2. Run: `mkdir -p "temp/pdfs"`

### Export Excel error
**Solusi**:
1. Pastikan folder `temp/exports` ada
2. Run: `mkdir -p "temp/exports"`

---

## 📝 File Structure

```
Z:\Coding\Nota Warung\
├── bot/
│   ├── index.js                    (Main bot + web server)
│   ├── apiServer.js                (Express REST API)
│   ├── package.json                (Dependencies)
│   ├── handlers/
│   │   └── messageHandler.js       (All WA commands)
│   ├── services/
│   │   ├── authManager.js          (Login/logout kasir)
│   │   ├── database.js             (Supabase CRUD)
│   │   ├── excelExporter.js        (Generate Excel)
│   │   ├── kasirManager.js         (Kasir session tracking)
│   │   ├── notaManager.js          (Edit/cancel nota)
│   │   ├── orderParser.js          (Parse "3 sate kambing")
│   │   ├── pdfGenerator.js         (Generate PDF nota)
│   │   └── scheduleManager.js      (Auto-schedule start/stop)
│   └── utils/
│       └── terbilang.js            (Number to Indonesian words)
├── database/
│   ├── schema.sql                  (Supabase schema)
│   └── menu.json                   (Menu + aliases)
├── dashboard/
│   ├── index.html                  (Boomer-friendly UI)
│   ├── style.css                   (CSS)
│   └── app.js                      (API client + logic)
├── docs/
│   ├── setup.md                    (Step-by-step setup)
│   └── deployment.md               (Ini file)
├── .env.example
├── .env                            (Credentials — JANGAN commit!)
├── .gitignore
└── README.md
```

---

## ✅ Verification Checklist

Sebelum production:

- [ ] Bot dapat scan QR & login WhatsApp
- [ ] Kasir bisa buat nota via WA
- [ ] PDF tergenerate & kirim ke WA
- [ ] Dashboard API berjalan (`/api/health` return 200)
- [ ] Stats muncul di dashboard
- [ ] Export Excel bekerja
- [ ] Start/Stop bot dari dashboard bekerja
- [ ] Laporan hari ini / bulan ini akurat
- [ ] Multi-kasir login bekerja
- [ ] Auto-schedule start/stop bekerja

---

## 🎯 Next Steps (Setelah Deploy)

1. **Dapatkan nomor WhatsApp bot** → Update di `.env`
2. **Setup Railway deployment** → Dapatkan URL live
3. **Share dashboard URL ke owner** → Akses dari rumah 24/7
4. **Monitor bot 1-2 hari** → Pastikan stabil
5. **Training kasir** → Ajarkan commands dasar

---

## 📞 Support

Kalau error, cek:
1. Terminal bot output (`npm start` log)
2. Browser console (F12 → Console)
3. Supabase logs (Dashboard → Logs)
4. Railway logs (`railway logs`)

---

**Version**: 1.0.0 | **Last Updated**: 22 Sep 2026
