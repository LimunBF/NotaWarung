import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { numberToWords } from '../utils/terbilang.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateNotaPDF(orderResult, notaId) {
  const { items, total } = orderResult;
  
  // Create PDF directory if not exists
  const pdfDir = path.join(__dirname, '../../temp/pdfs');
  if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
  }

  const pdfPath = path.join(pdfDir, `NOTA-${notaId}.pdf`);
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('SATENE KAMBING WONG MADIUN', { align: 'center' });
  doc.fontSize(16).font('Helvetica-BoldOblique').text('"P. SUMO"', { align: 'center' });
  doc.fontSize(11).font('Helvetica').text('Jl. Cokroaminoto No. 4 Madiun', { align: 'center' });
  doc.text('Telp. 082 234 888 689', { align: 'center' });
  
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  // Nota info
  doc.fontSize(10);
  const today = new Date().toLocaleDateString('id-ID', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  doc.text(`Tanggal: ${today}`, 50, doc.y);
  doc.text(`Nota #: ${notaId}`, 350, doc.y - 12);
  doc.moveDown(2);

  // Table header
  const tableTop = doc.y;
  doc.rect(50, tableTop, 495, 20).fillAndStroke('#f0f0f0', '#000');
  
  doc.fillColor('#000').fontSize(10).font('Helvetica-Bold');
  doc.text('Menu', 60, tableTop + 6, { width: 250 });
  doc.text('Qty', 320, tableTop + 6, { width: 50, align: 'center' });
  doc.text('Harga', 380, tableTop + 6, { width: 80, align: 'right' });
  doc.text('Jumlah', 470, tableTop + 6, { width: 70, align: 'right' });

  doc.font('Helvetica');
  let currentY = tableTop + 25;

  // Items
  items.forEach((item, index) => {
    const subtotal = item.quantity * item.price;
    
    if (currentY > 700) {
      doc.addPage();
      currentY = 50;
    }

    const rowHeight = 20;
    if (index % 2 === 1) {
      doc.rect(50, currentY, 495, rowHeight).fill('#f9f9f9');
    }

    doc.fillColor('#000');
    doc.text(item.name, 60, currentY + 5, { width: 240 });
    doc.text(item.quantity.toString(), 320, currentY + 5, { width: 50, align: 'center' });
    doc.text(`Rp ${item.price.toLocaleString('id-ID')}`, 380, currentY + 5, { width: 80, align: 'right' });
    doc.text(`Rp ${subtotal.toLocaleString('id-ID')}`, 470, currentY + 5, { width: 70, align: 'right' });

    currentY += rowHeight;
  });

  // Total line
  doc.moveTo(50, currentY + 5).lineTo(545, currentY + 5).lineWidth(2).stroke();
  currentY += 15;

  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('TOTAL:', 60, currentY);
  doc.text(`Rp ${total.toLocaleString('id-ID')}`, 470, currentY, { width: 70, align: 'right' });
  
  currentY += 25;
  doc.fontSize(10).font('Helvetica-Oblique');
  doc.text(`Terbilang: ${numberToWords(total)}`, 60, currentY, { width: 480 });

  // Footer
  doc.fontSize(9).font('Helvetica').fillColor('#666');
  doc.text('Terima kasih atas kunjungan Anda 🙏', 50, 750, { align: 'center' });
  doc.text('Satene Kambing Wong Madiun "P. SUMO"', 50, 765, { align: 'center' });

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(pdfPath));
    stream.on('error', reject);
  });
}
