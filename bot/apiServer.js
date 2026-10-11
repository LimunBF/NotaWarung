import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { generateTodayExcel, generateMonthExcel } from './services/excelExporter.js';
import { getBotScheduleInfo, triggerBotStart, triggerBotStop, isBotRunning } from './services/scheduleManager.js';
import { getAllActiveKasir } from './services/authManager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Health check
app.get('/api/health', (req, res) => {
  const schedule = getBotScheduleInfo();
  res.json({
    status: 'ok',
    botRunning: isBotRunning(),
    schedule,
    timestamp: new Date().toISOString()
  });
});

// Bot control: START
app.post('/api/bot/start', async (req, res) => {
  const result = await triggerBotStart('manual-dashboard');
  res.json({
    success: true,
    message: '🟢 Bot started',
    ...result
  });
});

// Bot control: STOP
app.post('/api/bot/stop', async (req, res) => {
  const result = await triggerBotStop('manual-dashboard');
  res.json({
    success: true,
    message: '🔴 Bot stopped',
    ...result
  });
});

// Schedule info
app.get('/api/schedule', (req, res) => {
  const info = getBotScheduleInfo();
  res.json(info);
});

// Active kasir sessions
app.get('/api/kasir/active', (req, res) => {
  const sessions = getAllActiveKasir();
  res.json({ kasir: sessions, count: sessions.length });
});

// Stats (today + month)
app.get('/api/stats', async (req, res) => {
  if (!supabase) {
    return res.json({ error: 'Supabase not configured' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: todayData } = await supabase
      .from('notas')
      .select('total_amount')
      .gte('created_at', today)
      .eq('status', 'paid');

    const { data: monthData } = await supabase
      .from('notas')
      .select('total_amount')
      .gte('created_at', monthStart.toISOString())
      .eq('status', 'paid');

    const todayTotal = (todayData || []).reduce((sum, n) => sum + n.total_amount, 0);
    const monthTotal = (monthData || []).reduce((sum, n) => sum + n.total_amount, 0);

    res.json({
      today: { count: todayData?.length || 0, total: todayTotal },
      month: { count: monthData?.length || 0, total: monthTotal }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Recent notas
app.get('/api/notas', async (req, res) => {
  if (!supabase) {
    return res.json({ error: 'Supabase not configured' });
  }

  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const { data, error } = await supabase
      .from('notas')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ notas: data, count: data.length, offset, limit });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Nota detail with items
app.get('/api/notas/:id', async (req, res) => {
  if (!supabase) {
    return res.json({ error: 'Supabase not configured' });
  }

  try {
    const { data: nota } = await supabase
      .from('notas')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (!nota) return res.status(404).json({ error: 'Nota not found' });

    const { data: items } = await supabase
      .from('nota_items')
      .select('*')
      .eq('nota_id', req.params.id)
      .order('created_at');

    res.json({ ...nota, items: items || [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excel export: today
app.get('/api/export/today', async (req, res) => {
  if (!supabase) {
    return res.json({ error: 'Supabase not configured' });
  }

  try {
    const filePath = await generateTodayExcel(supabase);
    const fileName = path.basename(filePath);
    res.download(filePath, fileName);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Excel export: month
app.get('/api/export/month', async (req, res) => {
  if (!supabase) {
    return res.json({ error: 'Supabase not configured' });
  }

  try {
    const filePath = await generateMonthExcel(supabase);
    const fileName = path.basename(filePath);
    res.download(filePath, fileName);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Menu list
app.get('/api/menu', async (req, res) => {
  if (!supabase) {
    // Fallback ke JSON file
    const menuPath = path.join(__dirname, '../database/menu.json');
    const menuData = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
    return res.json(menuData);
  }

  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('active', true)
      .order('category, name');

    if (error) throw error;
    res.json({ menu: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve dashboard static files
const dashboardPath = path.join(__dirname, '../dashboard');
app.use(express.static(dashboardPath));

// ──────────────────────────────────────────────
// Public nota viewer (web)
// ──────────────────────────────────────────────
app.get('/nota/:token', async (req, res) => {
  try {
    const { data: nota } = await supabase
      .from('notas')
      .select('*')
      .eq('public_token', req.params.token)
      .single();

    if (!nota) return res.status(404).send('<h1>❌ Nota tidak ditemukan</h1>');

    const { data: items } = await supabase
      .from('nota_items')
      .select('*')
      .eq('nota_id', nota.id)
      .order('created_at');

    const total = (items || []).reduce((sum, i) => sum + i.subtotal, 0);

    const itemRows = (items || []).map(i => `
      <tr>
        <td>${i.menu_name}</td>
        <td style="text-align:right">${i.quantity}x</td>
        <td style="text-align:right">Rp ${i.unit_price.toLocaleString('id-ID')}</td>
        <td style="text-align:right">Rp ${(i.quantity * i.unit_price).toLocaleString('id-ID')}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nota ${nota.nota_number} — Nota Warung P. SUMO</title>
  <style>
    body { font-family: 'Courier New', monospace; margin: 20px; color: #000; }
    .receipt { border: 1px dashed #333; padding: 20px; max-width: 600px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .header h2 { margin: 0; font-size: 20px; }
    .header p { margin: 5px 0; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border-bottom: 1px dashed #666; padding: 5px 0; font-size: 12px; }
    .total-row td { border-top: 2px solid #333; font-weight: bold; }
    .footer { text-align: center; margin-top: 20px; font-size: 11px; border-top: 1px dashed #333; padding-top: 10px; }
    button { display: block; margin: 15px auto; padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; }
    button:hover { background: #0056b3; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h2>Nota Warung P. SUMO</h2>
      <p>Satene Kambing Wong Madiun</p>
      <p>JL. Cokroaminoto No.4, Madiun</p>
      <p>WA: 082-234-888-689</p>
    </div>

    <table>
      <tr><td>No</td><td>${nota.nota_number}</td><td>Pelanggan</td><td>${nota.customer_name || '-'}</td></tr>
      <tr><td>Kasir</td><td>${nota.kasir_name || '-'}</td><td>Tgl</td><td>${new Date(nota.created_at).toLocaleDateString('id-ID')}</td></tr>
      ${nota.notes ? `<tr><td colspan="4">Catatan: ${nota.notes}</td></tr>` : ''}
    </table>

    <table>
      <thead>
        <tr><th align="left">Item</th><th align="right">Qty</th><th align="right">Harga</th><th align="right">Subtotal</th></tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="3">TOTAL</td>
          <td align="right">Rp ${total.toLocaleString('id-ID')}</td>
        </tr>
      </tfoot>
    </table>

    <p style="text-align:center">Terbilang: ${nota.terbilang || '-'}</p>
    <p style="text-align:center; font-size:14px;">${nota.status === 'paid' ? '✅ LUNAS' : '⏳ BELUM BAYAR'}</p>

    <div class="footer">
      <p>Terima kasih sudah makan di P. SUMO</p>
    </div>
  </div>

  <button onclick="window.print()">🖨️ Print</button>
  <a href="/api/nota/${req.params.token}/pdf" style="display:block;text-align:center;background:#28a745;color:white;padding:10px;text-decoration:none;">📄 Download PDF</a>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    res.status(500).send('<h1>❌ Error memuat nota</h1>');
  }
});

// ──────────────────────────────────────────────
// Public PDF export (anon key)
// ──────────────────────────────────────────────
app.get('/api/nota/:token/pdf', async (req, res) => {
  try {
    const { NotaManager } = await import('./services/notaManager.js');
    const manager = new NotaManager(supabase);

    const nota = await manager.getNotaByToken(req.params.token);

    if (!nota) return res.status(404).json({ error: 'Nota tidak ditemukan' });

    // Generate PDF using LacSpace receipt
    const { Receipt } = await import('lacspace-pdf');
    const receipt = new Receipt({
      title: 'Nota Warung P. SUMO',
      shopName: 'Satene Kambing Wong Madiun',
      address: 'JL. Cokroaminoto No.4, Madiun',
      phone: '082-234-888-689',
      logo: '',
      documentTitle: `Nota ${nota.nota_number}`
    });

    // Add items
    nota.items.forEach(item => {
      receipt.addLine(item.name, item.qty, item.price, item.qty * item.price);
    });

    // Add total
    receipt.addTotal('Subtotal', nota.total);
    receipt.addTotal('Total', nota.total, true);

    // Footer
    receipt.setFooter([
      'No: ' + nota.nota_number,
      'Pelanggan: ' + (nota.customer_name || '-'),
      'Kasir: ' + (nota.kasir_name || '-'),
      'Status: ' + (nota.status === 'paid' ? 'Lunas' : 'Belum Bayar')
    ]);

    const pdfBuffer = receipt.generate();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="nota-${nota.nota_number}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ error: 'Gagal generate PDF' });
  }
});

export function startServer() {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`🌐 Dashboard API running on port ${port}`);
    console.log(`🔗 Buka: http://localhost:${port}`);
  });
  return app;
}

// Vercel handler export
export default app;