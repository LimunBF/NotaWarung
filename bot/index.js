import 'dotenv/config';
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { handleMessage } from './handlers/messageHandler.js';
import { startServer } from './apiServer.js';
import { isWithinOperatingHours, triggerBotStart, triggerBotStop, getBotScheduleInfo } from './services/scheduleManager.js';

const logger = pino({ level: 'info' });

let sock = null;
let isShuttingDown = false;

// ──────────────────────────────────────────────
// WhatsApp Connection
// ──────────────────────────────────────────────
async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  sock = makeWASocket({
    logger,
    printQRInTerminal: false,
    auth: state,
    markOnlineOnConnect: true,
  });

  // QR code
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n🔗 Scan QR Code ini dengan WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error instanceof Boom)
        && lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;

      console.log('❌ Koneksi terputus. Reconnect?', shouldReconnect);

      if (shouldReconnect && !isShuttingDown) {
        setTimeout(() => connectToWhatsApp(), 3000);
      }
    } else if (connection === 'open') {
      console.log('✅ Bot WhatsApp terhubung!');
      console.log(`📱 Nomor: ${sock.user?.id.split(':')[0]}`);
      await triggerBotStart('whatsapp-connected');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Incoming messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return;

    await handleMessage(sock, msg);
  });

  return sock;
}

// ──────────────────────────────────────────────
// Auto-Schedule Checker
// ──────────────────────────────────────────────
let lastCheckedHour = -1;

function scheduleChecker() {
  const now = new Date();
  const currentHour = now.getHours();
  const schedule = getBotScheduleInfo();

  // Cek setiap jam (bukan setiap menit)
  if (currentHour !== lastCheckedHour) {
    lastCheckedHour = currentHour;

    if (currentHour === schedule.openHour) {
      console.log(`⏰ Jam ${schedule.openHour}:00 - Waktunya buka warung!`);
      triggerBotStart('auto-schedule');
    }

    if (currentHour === schedule.closeHour) {
      console.log(`⏰ Jam ${schedule.closeHour}:00 - Waktunya tutup warung!`);
      triggerBotStop('auto-schedule');
    }
  }
}

// Cek setiap 60 detik
setInterval(scheduleChecker, 60000);

// ──────────────────────────────────────────────
// Graceful Shutdown
// ──────────────────────────────────────────────
async function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  isShuttingDown = true;

  await triggerBotStop('shutdown');

  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      // Ignore logout errors
    }
  }

  console.log('👋 Bot stopped. Goodbye!');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ──────────────────────────────────────────────
// Startup
// ──────────────────────────────────────────────
console.log('🚀 Memulai Nota Warungku Bot...');
console.log('📋 Warung:', process.env.WARUNG_NAME || 'Satene Kambing Wong Madiun "P. SUMO"');

const schedule = getBotScheduleInfo();
console.log(`⏰ Jam operasional: ${schedule.openHour}:00 - ${schedule.closeHour}:00`);

if (!isWithinOperatingHours()) {
  console.log('⚠️  Bot dijalankan di luar jam operasional warung.');
  console.log('💡 Bot tetap jalan. Dashboard tetap bisa diakses 24/7.');
}

// Start web server (dashboard API)
startServer();

// Connect WhatsApp
connectToWhatsApp();

console.log('\n📌 Commands yang tersedia:');
console.log('   login <nama>  → Login sebagai kasir/owner');
console.log('   logout        → Logout dari sesi');
console.log('   menu          → Lihat daftar menu');
console.log('   help          → Bantuan');
console.log('   nota <id>     → Lihat detail nota');
console.log('   cancel <id>   → Batalkan nota');
console.log('   laporan       → Link ke dashboard');