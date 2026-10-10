import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { parseOrderText } from './services/orderParser.js';
import { NotaManager } from './services/notaManager.js';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const nota = new NotaManager(supabase);

// === COMMANDS ===
bot.start((ctx) => {
  ctx.reply(`👋 Selamat datang di Nota Warung!\n\n` +
    `Catat pesanan warung P. SUMO dengan mudah.\n\n` +
    `📝 Contoh: "satenya 2, makan sini, es teh gulanya dikit"\n` +
    `Atau ketik /menu untuk lihat perintah.`);
});

bot.command('menu', (ctx) => {
  ctx.replyWithMarkdown(
    `*📋 MENU NOTA WARUNG*\n\n` +
    `/nota <id> — Lihat detail nota\n` +
    `/tambah <id> <item> — Tambah item\n` +
    `/bayar <id> — Tandai dibayar\n` +
    `/cancel <id> — Batal\n` +
    `/laporan — Laporan hari ini\n\n` +
    `Atau ketik pesan bebas seperti:\n` +
    `"satenya 2, makan sini"`
  );
});

bot.command('cari', async (ctx) => {
  const query = ctx.message.text.split(' ').slice(1).join(' ');
  if (!query) return ctx.reply('📝 Format: /cari <nama_pelanggan> <tanggal yyyy-mm-dd>');

  const parts = query.trim().split(/\s+/);
  const datePart = parts.find(p => /^\d{4}-\d{2}-\d{2}$/.test(p));
  const namePart = parts.filter(p => !/^\d{4}-\d{2}-\d{2}$/.test(p)).join(' ');

  if (!datePart || !namePart) {
    return ctx.reply('📝 Format: /cari <nama_pelanggan> <tanggal yyyy-mm-dd>\nContoh: /cari budi 2025-01-01');
  }

  try {
    const results = await nota.searchNota(namePart, datePart);
    if (!results || results.length === 0) {
      return ctx.reply('🔍 Tidak ada nota ditemukan.');
    }

    const list = results.map(r =>
      `📄 ${r.nota_number} | 👤 ${r.customer_name || '-'} | 💰 Rp${r.total_amount.toLocaleString('id-ID')} | ${r.status}`
    ).join('\n');

    const msg = `📋 Hasil pencarian:\n${list}`;

    await ctx.replyWithMarkdown(msg, {
      reply_markup: {
        inline_keyboard: results.slice(0, 6).map(r => [
          { text: r.nota_number, callback_data: `viewtoken:${r.public_token}` }
        ])
      }
    });
  } catch (e) {
    console.error('Search error:', e);
    ctx.reply('❌ Gagal mencari nota.');
  }
});

// === FREE TEXT ORDER ===
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;
  const username = ctx.from.username || `${ctx.from.first_name}`;

  if (text.startsWith('/')) return;

  try {
    const parsed = parseOrderText(text);
    if (!parsed.items || parsed.items.length === 0) {
      return ctx.reply('❌ Tidak mengerti. Contoh: "satenya 2, makan sini"');
    }

    const notaId = await nota.createNotul(
      userId,
      username,
      parsed.items,
      parsed.customerName || 'No Name',
      parsed.notes
    );

    const detail = await nota.getDetail(notaId);
    const total = detail.items.reduce((sum, i) => sum + (i.price * i.qty), 0);

    const msg = `✅ *Nota #${notaId} berhasil dibuat*\n` +
      `👤 ${detail.customerName}\n` +
      `📋 Items:\n${detail.items.map(i => `  - ${i.name} x${i.qty} = Rp${i.price * i.qty}`).join('\n')}\n` +
      `💬 ${detail.notes || '-'}\n\n` +
      `💰 *Total: Rp${total}*\n\n` +
      `Pilih aksi:`;

    await ctx.replyWithMarkdown(msg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💳 Bayar', callback_data: `bayar:${notaId}` },
            { text: '➕ Tambah', callback_data: `tambah:${notaId}` },
            { text: '❌ Batal', callback_data: `cancel:${notaId}` },
            { text: '📄 Detail', callback_data: `detail:${notaId}` }
          ],
          [
            { text: '🔗 Link Publik', callback_data: `link:${notaId}` }
          ]
        ]
      }
    });
  } catch (e) {
    console.error('Order error:', e);
    ctx.reply('❌ Gagal membuat nota. Coba lagi.');
  }
});

// === CALLBACK QUERIES ===
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const [action, ...rest] = data.split(':');
  const id = rest.join(':');

  await ctx.answerCbQuery();

  try {
    switch (action) {
      case 'bayar': {
        await nota.markPaid(id, true);
        await ctx.editMessageText(`✅ Nota #${id} ditandai *dibayar*`, { parse_mode: 'Markdown' });
        break;
      }
      case 'link': {
        const d = await nota.getDetail(id);
        const baseUrl = process.env.BASE_URL || 'https://warung.nota.id';
        const url = `${baseUrl}/nota/${d.id}`;
        await ctx.replyWithMarkdown(`🔗 *Link publik nota #${id}*\n${url}`);
        break;
      }
      case 'viewtoken': {
        try {
          const d = await nota.getNotaByToken(id);
          if (!d) {
            await ctx.reply('❌ Nota tidak ditemukan.');
            return;
          }
          const total = d.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
          const baseUrl = process.env.BASE_URL || 'https://warung.nota.id';
          const url = `${baseUrl}/nota/${d.public_token}`;
          await ctx.replyWithMarkdown(
            `📄 *${d.nota_number}*\n👤 ${d.customer_name || '-'}\n📋 ${d.items.map(i => `- ${i.name} x${i.qty} = Rp${i.price * i.qty}`).join('\\n')}\n💬 ${d.notes || '-'}\n💰 *Total: Rp${total}*\n🔗 ${url}`
          );
        } catch (e) {
          console.error('Viewtoken error:', e);
          ctx.reply('❌ Gagal.');
        }
        break;
      }
      case 'cancel': {
        await nota.cancel(id);
        await ctx.editMessageText(`❌ Nota #${id} dibatalkan.`);
        break;
      }
      case 'detail': {
        const d = await nota.getDetail(id);
        await ctx.editMessageText(`📄 *Nota #${id}*\n👤 ${d.customerName}\n${d.items.map(i => `- ${i.name} x${i.qty} = Rp${i.price * i.qty}`).join('\n')}\n💬 ${d.notes || '-'}`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Kembali', callback_data: `back:${id}` }]
            ]
          }
        });
        break;
      }
      case 'tambah': {
        await ctx.editMessageText(`➕ Kirim item tambahan untuk Nota #${id}\nContoh: "satenya 1, es teh"`);
        ctx.session.addingTo = id;
        break;
      }
      case 'back': {
        const d = await nota.getDetail(id);
        const total = d.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
        await ctx.editMessageText(
          `✅ *Nota #${id}*\n👤 ${d.customerName}\n💰 *Total: Rp${total}*\n\nPilih aksi:`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '💳 Bayar', callback_data: `bayar:${id}` },
                  { text: '❌ Batal', callback_data: `cancel:${id}` }
                ]
              ]
            }
          }
        );
        break;
      }
    }
  } catch (e) {
    console.error('Callback error:', e);
    await ctx.reply('❌ Gagal memproses.');
  }
});

// === COMMANDS WITH PARAMS ===
bot.command('nota', async (ctx) => {
  const id = ctx.message.text.split(' ').slice(1).join(' ');
  if (!id) return ctx.reply('📝 Format: /nota <id_nota>');
  try {
    const d = await nota.getDetail(id);
    const total = d.items.reduce((sum, i) => sum + (i.price * i.qty), 0);
    ctx.replyWithMarkdown(
      `📄 *Nota #${id}*\n👤 ${d.customerName}\n📋 ${d.items.map(i => `- ${i.name} x${i.qty} = Rp${i.price * i.qty}`).join('\n')}\n💬 ${d.notes || '-'}\n💰 *Total: Rp${total}*`
    );
  } catch (e) {
    ctx.reply('❌ Nota tidak ditemukan.');
  }
});

bot.command('tambah', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) return ctx.reply('📝 Format: /tambah <id_nota> <item>');
  const id = args[0];
  const itemText = args.slice(1).join(' ');
  try {
    const parsed = parseOrderText(itemText);
    for (const item of parsed.items) {
      await nota.addItem(id, item.name, item.qty);
    }
    ctx.reply(`✅ Item ditambahkan ke Nota #${id}`);
  } catch (e) {
    ctx.reply('❌ Gagal menambah item.');
  }
});

bot.command('bayar', async (ctx) => {
  const id = ctx.message.text.split(' ').slice(1).join(' ');
  if (!id) return ctx.reply('📝 Format: /bayar <id_nota>');
  try {
    await nota.markPaid(id, true);
    ctx.reply(`✅ Nota #${id} dibayar.`);
  } catch (e) {
    ctx.reply('❌ Gagal.');
  }
});

bot.command('cancel', async (ctx) => {
  const id = ctx.message.text.split(' ').slice(1).join(' ');
  if (!id) return ctx.reply('📝 Format: /cancel <id_nota>');
  try {
    await nota.cancel(id);
    ctx.reply(`❌ Nota #${id} dibatalkan.`);
  } catch (e) {
    ctx.reply('❌ Gagal.');
  }
});

bot.command('laporan', async (ctx) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const r = await nota.getTodayReport(today);
    if (!r || r.length === 0) return ctx.reply('📭 Belum ada nota hari ini.');

    let msg = `📊 *Laporan ${today}*\n\n`;
    let grandTotal = 0;
    r.forEach(n => {
      const total = n.items.reduce((s, i) => s + (i.price * i.qty), 0);
      grandTotal += total;
      msg += `#${n.id} ${n.customerName} — Rp${total}\n`;
    });
    msg += `\n💰 *Grand Total: Rp${grandTotal}*`;
    ctx.replyWithMarkdown(msg);
  } catch (e) {
    ctx.reply('❌ Gagal ambil laporan.');
  }
});

bot.launch();
console.log('✅ Nota Warung Telegram bot started');
