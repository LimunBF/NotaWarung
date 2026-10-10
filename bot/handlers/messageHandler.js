import { parseOrder } from '../services/orderParser.js';
import { saveNota } from '../services/database.js';
import { generateNotaPDF } from '../services/pdfGenerator.js';
import { numberToWords } from '../utils/terbilang.js';
import { handleLoginKasir, handleLogoutKasir, getCurrentKasirSession } from '../services/authManager.js';
import { cancelNota, editNota, addItemToNota, getNotaDetail } from '../services/notaManager.js';

export async function handleMessage(sock, msg) {
  const chatId = msg.key.remoteJid;
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

  if (!text) return;

  const textLower = text.toLowerCase().trim();

  // ──────────────────────────────────────────────
  // AUTH COMMANDS
  // ──────────────────────────────────────────────

  if (textLower.startsWith('login ')) {
    const result = await handleLoginKasir(chatId, text);
    await sock.sendMessage(chatId, { 
      text: result.success
        ? `✅ *LOGIN BERHASIL*\n\n👤 Kasir: ${result.kasirName}\n${result.isOwner ? '🔑 Mode: OWNER (akses penuh)' : '👨‍💼 Mode: KASIR'}\n\n_Siap menerima pesanan!_`
        : `❌ ${result.error}`
    });
    return;
  }

  if (textLower === 'logout') {
    const result = handleLogoutKasir(chatId);
    await sock.sendMessage(chatId, { 
      text: result.success
        ? '✅ *LOGOUT BERHASIL*\n\n_Kamu sudah logout dari sesi kasir._'
        : `❌ ${result.error}`
    });
    return;
  }

  // ──────────────────────────────────────────────
  // INFO COMMANDS
  // ──────────────────────────────────────────────

  if (textLower === 'menu' || textLower === '/menu') {
    await sendMenu(sock, chatId);
    return;
  }

  if (textLower === 'help' || textLower === '/help' || textLower === '?') {
    await sendHelp(sock, chatId);
    return;
  }

  // ──────────────────────────────────────────────
  // NOTA MANAGEMENT
  // ──────────────────────────────────────────────

  // Lihat detail nota
  if (textLower.startsWith('nota ') || textLower.startsWith('detail ')) {
    const notaId = text.split(/\s+/)[1];
    await showNotaDetail(sock, chatId, notaId);
    return;
  }

  // Cancel nota
  if (textLower.startsWith('cancel ') || textLower.startsWith('batal ')) {
    const notaId = text.split(/\s+/)[1];
    const session = getCurrentKasirSession(chatId);

    if (!session) {
      await sock.sendMessage(chatId, { text: '❌ Kamu harus login dulu. Ketik "login <nama>"' });
      return;
    }

    const result = await cancelNota(notaId, chatId);
    await sock.sendMessage(chatId, { 
      text: result.success
        ? `🚫 *NOTA DIBATALKAN*\n\nID: #${notaId}\n_Status diubah menjadi DIBATALKAN_`
        : `❌ Gagal membatalkan: ${result.error}`
    });
    return;
  }

  // Edit nota - tambah item
  if (textLower.startsWith('tambah ') || textLower.startsWith('add ')) {
    const parts = text.split(/\s+/);
    const notaId = parts[1];
    const orderText = parts.slice(2).join(' ');

    if (!orderText) {
      await sock.sendMessage(chatId, { text: '❓ Format salah. Contoh:\ntambah NOTA-123 3 sate kambing' });
      return;
    }

    const session = getCurrentKasirSession(chatId);
    if (!session && !isOwner(session)) {
      await sock.sendMessage(chatId, { text: '❌ Hanya owner yang bisa edit nota.' });
      return;
    }

    const orderResult = parseOrder(orderText);
    if (orderResult.items.length === 0) {
      await sock.sendMessage(chatId, { text: '❓ Tidak mengenali pesanan.' });
      return;
    }

    for (const item of orderResult.items) {
      const result = await addItemToNota(notaId, item.name, item.quantity, item.price);
      if (result.success) {
        await sock.sendMessage(chatId, { 
          text: `➕ *ITEM DITAMBAHKAN*\n\n🍽️ ${item.name} x${item.quantity} = Rp ${(item.quantity * item.price).toLocaleString('id-ID')}\n\n💰 Total baru: Rp ${result.newTotal.toLocaleString('id-ID')}` 
        });
      }
    }
    return;
  }

  // Bayar / tandai lunas
  if (textLower.startsWith('bayar ') || textLower.startsWith('lunas ')) {
    const notaId = text.split(/\s+/)[1];
    const session = getCurrentKasirSession(chatId);

    if (!session) {
      await sock.sendMessage(chatId, { text: '❌ Kamu harus login dulu.' });
      return;
    }

    const result = await editNota(notaId, { status: 'paid', kasir_name: session.kasirName });
    await sock.sendMessage(chatId, { 
      text: result.success
        ? `💵 *NOTA LUNAS*\n\nID: #${notaId}\n_Dibayar oleh: ${session.kasirName}_`
        : `❌ Error: ${result.error}`
    });
    return;
  }

  // ──────────────────────────────────────────────
  // LAPORAN & EXPORT
  // ──────────────────────────────────────────────

  if (textLower === 'laporan' || textLower === 'laporan hari ini' || textLower === 'laporan today') {
    await sendLaporanSummary(sock, chatId, 'today');
    return;
  }

  if (textLower === 'laporan bulan ini' || textLower === 'laporan month') {
    await sendLaporanSummary(sock, chatId, 'month');
    return;
  }

  // ──────────────────────────────────────────────
  // ORDER PARSING (default)
  // ──────────────────────────────────────────────

  const orderResult = parseOrder(text);

  if (orderResult.items.length === 0) {
    if (text.length > 5 && /\d/.test(text)) {
      await sock.sendMessage(chatId, { 
        text: '❓ Tidak mengenali pesanan.\n\nContoh format:\n3 sate kambing\n2 nasi putih\n5 es teh\n\nKetik *menu* untuk lihat daftar.\nKetik *help* untuk bantuan.' 
      });
    }
    return;
  }

  const session = getCurrentKasirSession(chatId);
  const notaText = generateNotaText(orderResult, session);

  await sock.sendMessage(chatId, { text: notaText });

  try {
    const notaId = await saveNota(orderResult, chatId, session);
    const pdfPath = await generateNotaPDF(orderResult, notaId);

    await sock.sendMessage(chatId, {
      document: { url: pdfPath },
      fileName: `NOTA-${notaId}.pdf`,
      mimetype: 'application/pdf',
      caption: '📄 Nota PDF siap diprint'
    });

    console.log(`✅ Nota #${notaId} berhasil dibuat oleh ${session?.kasirName || 'anon'} (${chatId})`);
  } catch (error) {
    console.error('Error saving nota:', error);
    await sock.sendMessage(chatId, { 
      text: '⚠️ Nota berhasil dihitung, tapi ada error saat menyimpan ke database. Silakan coba lagi.' 
    });
  }
}

// ──────────────────────────────────────────────
// HELPER FUNCTIONS
// ──────────────────────────────────────────────

function generateNotaText(orderResult, session) {
  const { items, total } = orderResult;

  let text = '✅ *NOTA PESANAN*\n';
  text += '━━━━━━━━━━━━━━━━\n\n';

  items.forEach(item => {
    const itemTotal = item.quantity * item.price;
    text += `🍽️ ${item.name}\n`;
    text += `   ${item.quantity} × Rp ${item.price.toLocaleString('id-ID')} = Rp ${itemTotal.toLocaleString('id-ID')}\n\n`;
  });

  text += '━━━━━━━━━━━━━━━━\n';
  text += `💰 *TOTAL: Rp ${total.toLocaleString('id-ID')}*\n`;
  text += `📝 _${numberToWords(total)}_\n`;

  if (session) {
    text += '\n👤 Kasir: ' + session.kasirName + '\n';
  }

  text += '━━━━━━━━━━━━━━━━\n\n';
  text += '🖨️ PDF nota sedang digenerate...\n';
  text += '\n_Satene Kambing Wong Madiun "P. SUMO"_';

  return text;
}

async function sendMenu(sock, chatId) {
  let text = '📋 *MENU WARUNG*\n';
  text += '━━━━━━━━━━━━━━━━\n\n';
  text += '*MAKANAN* 🍖\n';
  text += '• Sate Kambing ........... Rp 45.000\n';
  text += '• Sate Buntel ............ Rp 45.000\n';
  text += '• Tongseng Daging ......... Rp 45.000\n';
  text += '• Tongseng Jeroan ......... Rp 45.000\n';
  text += '• Tongseng Kaki ........... Rp 45.000\n';
  text += '• Tongseng Iga ............ Rp 45.000\n';
  text += '• Tongseng Sumsum ......... Rp 45.000\n';
  text += '• Tongseng Kepala/Lidah ... Rp 45.000\n';
  text += '• Tengkleng ................ Rp 45.000\n';
  text += '• Nasi Putih .............. Rp 5.000\n';
  text += '• Nasi Gule ................ Rp 18.000\n';
  text += '• Sate Ayam ................ Rp 23.000\n';
  text += '• Tongseng Ayam ............ Rp 23.000\n';
  text += '• Kerupuk .................. Rp 1.000\n\n';
  text += '*MINUMAN* 🥤\n';
  text += '• Es Jeruk .................. Rp 7.000\n';
  text += '• Es Jeruk Tawar ............ Rp 7.000\n';
  text += '• Jeruk Panas ................ Rp 7.000\n';
  text += '• Jeruk Panas Tawar .......... Rp 7.000\n';
  text += '• Es Teh ..................... Rp 5.000\n';
  text += '• Teh Panas .................. Rp 5.000\n';
  text += '• Teh Panas Tawar ............ Rp 5.000\n';
  text += '• Es Teh Tawar ............... Rp 2.000\n';
  text += '• Kopi ....................... Rp 5.000\n';
  text += '• Air Mineral ............... Rp 5.000\n';
  text += '• Cleo ........................ Rp 2.000\n\n';
  text += '💡 _Ketik pesanan langsung:_\n_3 sate kambing_\n_2 nasi putih_\n_5 es teh_';

  await sock.sendMessage(chatId, { text });
}

async function sendHelp(sock, chatId) {
  let text = '💡 *CARA PAKAI BOT*\n';
  text += '━━━━━━━━━━━━━━━━\n\n';
  text += '🔐 *AUTHENTICATION*\n';
  text += '`login <nama>` → Login sebagai kasir/owner\n';
  text += '`logout`        → Logout dari sesi\n\n';
  text += '🍽️ *BUAT NOTA BARU*\n';
  text += 'Ketik pesanan langsung:\n';
  text += '```3 sate kambing\n2 nasi putih\n5 es teh```\n\n';
  text += '📋 *INFO*\n';
  text += '`menu`           → Lihat daftar menu + harga\n';
  text += '`help`           → Bantuan ini\n\n';
  text += '📝 *KELOLA NOTA*\n';
  text += '`nota <id>`      → Lihat detail nota\n';
  text += '`cancel <id>`    → Batalkan nota (owner only)\n';
  text += '`bayar <id>`     → Tandai nota lunas\n';
  text += '`tambah <id> <pesanan>` → Tambah item ke nota\n\n';
  text += '📊 *LAPORAN*\n';
  text += '`laporan`        → Ringkasan hari ini\n';
  text += '`laporan bulan`  → Ringkasan bulan ini\n\n';
  text += '━━━━━━━━━━━━━━━━\n';
  text += '📞 Satene Kambing Wong Madiun\n';
  text += 'Jl. Cokroaminoto No. 4 Madiun\n';
  text += '☎️ 082 234 888 689';

  await sock.sendMessage(chatId, { text });
}

async function showNotaDetail(sock, chatId, notaId) {
  const detail = await getNotaDetail(notaId);

  if (!detail) {
    await sock.sendMessage(chatId, { text: `❌ Nota #${notaId} tidak ditemukan.` });
    return;
  }

  let text = `📄 *DETAIL NOTA #${notaId}*\n`;
  text += '━━━━━━━━━━━━━━━━\n\n';

  detail.items.forEach((item, i) => {
    text += `${i + 1}. ${item.menu_name}\n`;
    text += `   ${item.quantity} × Rp ${item.unit_price.toLocaleString('id-ID')} = Rp ${item.subtotal.toLocaleString('id-ID')}\n\n`;
  });

  text += '━━━━━━━━━━━━━━━━\n';
  text += `💰 TOTAL: Rp ${detail.total_amount.toLocaleString('id-ID')}\n`;
  text += `📝 Terbilang: ${detail.terbilang}\n`;
  text += `👤 Kasir: ${detail.kasir_name || '-'}\n`;
  text += `📅 Tanggal: ${new Date(detail.created_at).toLocaleString('id-ID')}\n`;
  text += `🏷️ Status: ${formatStatus(detail.status)}\n`;

  await sock.sendMessage(chatId, { text });
}

function formatStatus(status) {
  const map = {
    pending: '⏳ Menunggu Pembayaran',
    paid: '✅ Lunas',
    cancelled: '🚫 Dibatalkan'
  };
  return map[status] || status;
}

async function sendLaporanSummary(sock, chatId, period) {
  let supabase;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    }
  } catch (e) {}

  if (!supabase) {
    await sock.sendMessage(chatId, { text: '⚠️ Database belum dikonfigurasi. Hubungi admin.' });
    return;
  }

  try {
    let dateFilter;

    if (period === 'today') {
      dateFilter = new Date().toISOString().split('T')[0];
    } else {
      const monthStart = new Date();
      monthStart.setDate(1);
      dateFilter = monthStart.toISOString();
    }

    const { data: notas } = await supabase
      .from('notas')
      .select('*')
      .gte('created_at', dateFilter)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!notas || notas.length === 0) {
      await sock.sendMessage(chatId, { text: `📊 *LAPORAN ${period === 'today' ? 'HARI INI' : 'BULAN INI'}*\n\n_Belum ada nota._` });
      return;
    }

    const totalAmount = notas.reduce((sum, n) => sum + n.total_amount, 0);
    const paidCount = notas.filter(n => n.status === 'paid').length;
    const pendingCount = notas.filter(n => n.status === 'pending').length;

    let text = `📊 *LAPORAN ${period === 'today' ? 'HARI INI' : 'BULAN INI'}*\n`;
    text += '━━━━━━━━━━━━━━━━\n\n';
    text += `📋 Total Nota: ${notas.length}\n`;
    text += `✅ Sudah bayar: ${paidCount}\n`;
    text += `⏳ Belum bayar: ${pendingCount}\n`;
    text += `\n💰 *TOTAL: Rp ${totalAmount.toLocaleString('id-ID')}*\n`;
    text += `📝 _${numberToWords(totalAmount)}_\n\n`;
    text += '━━━━━━━━━━━━━━━━\n';
    text += '_Untuk laporan lengkap + Excel, buka dashboard web._';

    await sock.sendMessage(chatId, { text });
  } catch (error) {
    console.error('Laporan error:', error);
    await sock.sendMessage(chatId, { text: '❌ Gagal mengambil data laporan.' });
  }
}

function isOwner(session) {
  return session?.isOwner === true;
}