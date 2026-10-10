import { createClient } from '@supabase/supabase-js';
import { numberToWords } from '../utils/terbilang.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('⚠️  Supabase credentials tidak ditemukan. Database tidak akan tersimpan.');
}

export async function saveNota(orderResult, chatId, session = null) {
  if (!supabase) {
    console.warn('⚠️  Skip save nota (Supabase not configured)');
    return `LOCAL-${Date.now()}`;
  }

  const { items, total } = orderResult;
  const kasirName = session?.kasirName || 'Bot';
  
  // Generate nota number
  const notaNumber = `NOTA-${Date.now().toString().slice(-8)}`;
  
  // Insert nota
  const { data: nota, error: notaError } = await supabase
    .from('notas')
    .insert({
      nota_number: notaNumber,
      total_amount: total,
      terbilang: numberToWords(total),
      status: 'pending',
      kasir_name: kasirName,
    })
    .select()
    .single();

  if (notaError) {
    console.error('Error insert nota:', notaError);
    throw notaError;
  }

  // Insert nota items
  const notaItems = items.map(item => ({
    nota_id: nota.id,
    menu_name: item.name,
    quantity: item.quantity,
    unit_price: item.price,
    subtotal: item.quantity * item.price
  }));

  const { error: itemsError } = await supabase
    .from('nota_items')
    .insert(notaItems);

  if (itemsError) {
    console.error('Error insert nota items:', itemsError);
    throw itemsError;
  }

  return nota.id;
}
