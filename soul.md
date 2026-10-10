# Nota Warung Bot Identity & Behavior

## Project Overview
Bot pemesanan warung untuk **Satene Kambing Wong Madiun "P. SUMO"** (Jl. Cokroaminoto No. 4 Madiun).
Multi-platform: Telegram (aktif) + WhatsApp (legacy, mati by default).

## Runtime
- **Platform active:** `BOT_PLATFORM=telegram` (default)  
  Set `BOT_PLATFORM=whatsapp` untuk switch ke WhatsApp Baileys legacy.
- **Hours:** 09:00–23:00 WIB (14hr/day = 420hr/bulan < limit Railway 500hr free tier)
- **Tech stack:** Node.js (ESM) + Telegraf + Supabase PostgreSQL + dotenv

## Database Schema
- `notas` — receipt header (nota_number, customer_name, total_amount, terbilang, kasir_name, notes, status)
- `nota_items` — line items (nota_id, menu_name, quantity, unit_price, subtotal)
- `menu_items` — master menu (name, category, price)
- `kasir` — cashier/user table

## Parser Behavior (orderParser.js)
Input bebas via free text:
- `"satenya 2, makan sini"` → 2x Sate Kambing + note "makan sini"
- `"3 sate buntel x2"` → 3x Sate Buntel + 2x Sate Buntel
- Support keyword: qty prefix/suffix, `x` multiplier, `nama <X>` for customer name, `catatan <X>` for notes

No AI — pure regex + if-else. Menu matching via aliases in `database/menu.json`.

## Telegram Bot Behavior
- `/start` — welcome + brief instructions
- `/menu` — command help
- `/laporan` — today's sales report
- Free text order → auto-create nota + inline keyboard (Bayar | Tambah | Batal | Detail)
- Callback query handlers for all inline actions
- Nota number format: `NOTA-YYYYMMDD-NNN`

## WhatsApp Bot (legacy)
- Uses `bot/index.js` + Baileys
- Mati default, hidup via env switch
- Same NotaManager class underneath

## Owner Notes
- Owner gaptek → UI harus sederhana, emoji, high contrast
- Prefer in-code solutions over external cron/scheduler
