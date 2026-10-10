import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function exportNotasToExcel(notas, filename) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Nota');

  // Header
  worksheet.columns = [
    { header: 'No Nota', key: 'nota_number', width: 18 },
    { header: 'Tanggal', key: 'created_at', width: 22 },
    { header: 'Kasir', key: 'kasir_name', width: 15 },
    { header: 'Customer', key: 'customer_name', width: 20 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Total', key: 'total_amount', width: 18 },
    { header: 'Terbilang', key: 'terbilang', width: 40 },
  ];

  // Style header
  worksheet.getRow(1).font = { bold: true, size: 12 };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF667EEA' }
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };

  // Data
  for (const nota of notas) {
    const row = worksheet.addRow({
      nota_number: nota.nota_number,
      created_at: new Date(nota.created_at).toLocaleString('id-ID'),
      kasir_name: nota.kasir_name || '-',
      customer_name: nota.customer_name || '-',
      status: nota.status,
      total_amount: nota.total_amount,
      terbilang: nota.terbilang,
    });
    row.getCell('total_amount').numFmt = '#,##0';
    row.getCell('total_amount').alignment = { horizontal: 'right' };
  }

  // Total row
  const totalRow = worksheet.addRow({
    nota_number: 'TOTAL',
    total_amount: { formula: `SUM(F2:F${notas.length + 1})` }
  });
  totalRow.font = { bold: true, size: 12 };
  totalRow.getCell('total_amount').numFmt = '#,##0';
  totalRow.getCell('total_amount').alignment = { horizontal: 'right' };

  // Save
  const exportDir = path.join(__dirname, '../../temp/exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const filePath = path.join(exportDir, filename);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

export async function generateTodayExcel(supabase) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('notas')
    .select('*')
    .gte('created_at', today)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return exportNotasToExcel(data, `nota-hari-ini-${today}.xlsx`);
}

export async function generateMonthExcel(supabase) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  
  const { data, error } = await supabase
    .from('notas')
    .select('*')
    .gte('created_at', monthStart.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  const monthStr = monthStart.toISOString().slice(0, 7);
  return exportNotasToExcel(data, `nota-bulan-${monthStr}.xlsx`);
}