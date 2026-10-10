# Setup Guide - Nota Warungku

## 📋 Prasyarat

1. **Node.js** (v18 atau lebih baru)
2. **Akun Supabase** (gratis)
3. **Akun Railway** (gratis)
4. **Nomor WhatsApp** untuk bot

---

## 🚀 Langkah Setup

### 1. Install Dependencies

```bash
cd "Z:/Coding/Nota Warung/bot"
npm install
```

### 2. Setup Supabase

1. Buka https://supabase.com
2. Create new project
3. Tunggu database siap (~2 menit)
4. Buka **SQL Editor** di dashboard
5. Copy-paste isi file `database/schema.sql`
6. Run query
7. Catat **Project URL** dan **anon key** dari Settings → API

### 3. Konfigurasi Environment

Copy `.env.example` jadi `.env`:

```bash
cp .env.example .env
```

Edit `.env`, isi:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJxxxxx...
WA_BOT_NUMBER=6281234567890
```

### 4. Test Bot Lokal

```bash
cd bot
npm start
```

Scan QR code yang muncul dengan WhatsApp.

Test kirim pesan:
```
3 sate kambing
2 nasi putih
5 es teh
```

Bot harus reply dengan nota.

### 5. Setup Dashboard

1. Edit `dashboard/app.js` line 15-16:
   - Ganti `YOUR_SUPABASE_URL` dengan URL Supabase kamu
   - Ganti `YOUR_SUPABASE_ANON_KEY` dengan anon key kamu

2. Buka `dashboard/index.html` di browser

3. Cek apakah stats muncul

### 6. Deploy ke Railway

1. Install Railway CLI:
```bash
npm i -g @railway/cli
```

2. Login:
```bash
railway login
```

3. Init project:
```bash
cd "Z:/Coding/Nota Warung"
railway init
```

4. Set environment variables di Railway dashboard

5. Deploy:
```bash
railway up
```

6. Railway akan kasih URL bot

---

## ✅ Checklist

- [ ] Node.js terinstall
- [ ] Supabase project dibuat
- [ ] Database schema dijalankan
- [ ] `.env` file dikonfigurasi
- [ ] Bot jalan lokal & bisa scan QR
- [ ] Test pesan berhasil
- [ ] Dashboard bisa dibuka
- [ ] Railway CLI terinstall
- [ ] Bot deployed ke Railway

---

## 🆘 Troubleshooting

### Bot tidak connect
- Pastikan nomor WA tidak sedang login di device lain
- Coba hapus folder `auth_info_baileys` dan scan QR ulang

### PDF tidak tergenerate
- Pastikan folder `temp/pdfs` ada permission write
- Install ulang pdfkit: `npm install pdfkit`

### Supabase error
- Cek URL dan API key sudah benar
- Pastikan table sudah di-create via schema.sql

---

## 📞 Kontak

Kalau ada masalah, hubungi developer.
