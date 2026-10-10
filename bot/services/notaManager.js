import { createClient } from '@supabase/supabase-js';

export class NotaManager {
  constructor(supabase) {
    this.supabase = supabase || this._initClient();
  }

  _initClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (url && key) return createClient(url, key);
    return null;
  }

  async createNotul(userId, username, items, customerName, notes) {
    if (!this.supabase) throw new Error('DB not configured');

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { data: existing } = await this.supabase
      .from('notas')
      .select('nota_number')
      .like('nota_number', `NOTA-${today}-%`)
      .order('nota_number', { ascending: false })
      .limit(1);

    let seq = 1;
    if (existing && existing.length > 0) {
      const lastNum = existing[0].nota_number.split('-').pop();
      seq = parseInt(lastNum) + 1;
    }

    const notaNumber = `NOTA-${today}-${seq.toString().padStart(3, '0')}`;
    const total = items.reduce((sum, i) => sum + (i.price * i.qty), 0);

    const { data: nota, error } = await this.supabase
      .from('notas')
      .insert({
        nota_number: notaNumber,
        customer_name: customerName || username,
        total_amount: total,
        terbilang: this._numberToWords(total),
        kasir_name: username,
        notes,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    const itemInserts = items.map(item => ({
      nota_id: nota.id,
      menu_name: item.name,
      quantity: item.qty,
      unit_price: item.price,
      subtotal: item.price * item.qty
    }));

    const { error: itemError } = await this.supabase
      .from('nota_items')
      .insert(itemInserts);

    if (itemError) throw itemError;

    return nota.id;
  }

  async cancel(notaId) {
    if (!this.supabase) return { success: false, error: 'DB not configured' };
    const { error } = await this.supabase.from('notas').update({ status: 'cancelled' }).eq('id', notaId);
    if (error) throw error;
    return { success: true };
  }

  async markPaid(notaId, paid = true) {
    if (!this.supabase) return { success: false, error: 'DB not configured' };
    const { error } = await this.supabase.from('notas').update({ status: paid ? 'paid' : 'pending' }).eq('id', notaId);
    if (error) throw error;
    return { success: true };
  }

  async addItem(notaId, menuName, quantity, price) {
    if (!this.supabase) return { success: false, error: 'DB not configured' };
    const subtotal = quantity * price;
    const { error: itemError } = await this.supabase.from('nota_items').insert({
      nota_id: notaId, menu_name: menuName, quantity, unit_price: price, subtotal
    });
    if (itemError) throw itemError;

    const { data: items } = await this.supabase.from('nota_items').select('subtotal').eq('nota_id', notaId);
    const newTotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    const { error: notaError } = await this.supabase.from('notas').update({
      total_amount: newTotal, terbilang: this._numberToWords(newTotal)
    }).eq('id', notaId);
    if (notaError) throw notaError;
    return { success: true, newTotal };
  }

  async removeItem(notaId, itemId) {
    if (!this.supabase) return { success: false, error: 'DB not configured' };
    const { error } = await this.supabase.from('nota_items').delete().eq('id', itemId);
    if (error) throw error;
    const { data: items } = await this.supabase.from('nota_items').select('subtotal').eq('nota_id', notaId);
    const newTotal = items.reduce((sum, i) => sum + i.subtotal, 0);
    await this.supabase.from('notas').update({ total_amount: newTotal, terbilang: this._numberToWords(newTotal) }).eq('id', notaId);
    return { success: true, newTotal };
  }

  async getDetail(notaId) {
    if (!this.supabase) return null;
    const { data: nota } = await this.supabase.from('notas').select('*').eq('id', notaId).single();
    if (!nota) return null;
    const { data: items } = await this.supabase.from('nota_items').select('*').eq('nota_id', notaId).order('created_at');
    return {
      id: nota.id,
      customerName: nota.customer_name,
      items: (items || []).map(i => ({ name: i.menu_name, qty: i.quantity, price: i.unit_price })),
      notes: nota.notes,
      total: nota.total_amount,
      paymentStatus: nota.status === 'paid' ? 'completed' : 'pending'
    };
  }

  async getTodayReport(date) {
    if (!this.supabase) return [];
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;
    const { data: notas } = await this.supabase.from('notas').select('*, nota_items(*)').gte('created_at', startOfDay).lte('created_at', endOfDay).order('created_at', { ascending: false });
    return (notas || []).map(n => ({ id: n.id, customerName: n.customer_name, status: n.status, items: n.nota_items || [], total: n.total_amount }));
  }

  // Search nota by customer name + date (for kasir)
  async searchNota(customerName, dateStr) {
    if (!this.supabase) throw new Error('DB not configured');

    const startOfDay = `${dateStr}T00:00:00`;
    const endOfDay = `${dateStr}T23:59:59`;

    const { data, error } = await this.supabase
      .from('notas')
      .select('nota_number, customer_name, total_amount, status, public_token, created_at')
      .ilike('customer_name', `%${customerName}%`)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Fetch nota by public_token (for web viewer)
  async getNotaByToken(token) {
    if (!this.supabase) return null;

    const { data: nota } = await this.supabase
      .from('notas')
      .select('*')
      .eq('public_token', token)
      .single();

    if (!nota) return null;

    const { data: items } = await this.supabase
      .from('nota_items')
      .select('*')
      .eq('nota_id', nota.id)
      .order('created_at');

    return {
      ...nota,
      items: (items || []).map(i => ({
        name: i.menu_name,
        qty: i.quantity,
        price: i.unit_price,
        subtotal: i.subtotal
      }))
    };
  }

  _numberToWords(num) {
    const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
    const belasan = ['sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas'];
    function convert(n) {
      if (n === 0) return '';
      if (n < 10) return satuan[n];
      if (n < 20) return belasan[n - 10];
      if (n < 100) { const tens = Math.floor(n / 10); const ones = n % 10; return satuan[tens] + ' puluh' + (ones > 0 ? ' ' + satuan[ones] : ''); }
      if (n < 200) return 'seratus' + (n % 100 > 0 ? ' ' + convert(n % 100) : '');
      if (n < 1000) { const h = Math.floor(n / 100); return satuan[h] + ' ratus' + (n % 100 > 0 ? ' ' + convert(n % 100) : ''); }
      if (n < 2000) return 'seribu' + (n % 1000 > 0 ? ' ' + convert(n % 1000) : '');
      if (n < 1000000) { const k = Math.floor(n / 1000); return convert(k) + ' ribu' + (n % 1000 > 0 ? ' ' + convert(n % 1000) : ''); }
      if (n < 1000000000) { const m = Math.floor(n / 1000000); return convert(m) + ' juta' + (n % 1000000 > 0 ? ' ' + convert(n % 1000000) : ''); }
      return '';
    }
    return convert(num).trim() + ' rupiah';
  }
}

export async function cancelNota(notaId, chatId) { const instance = new NotaManager(); return instance.cancel(notaId); }
export async function editNota(notaId, changes) { const instance = new NotaManager(); if (!instance.supabase) return { success: false, error: 'DB not configured' }; const { error } = await instance.supabase.from('notas').update(changes).eq('id', notaId); if (error) return { success: false, error: error.message }; return { success: true }; }
export async function addItemToNota(notaId, menuName, quantity, price) { const instance = new NotaManager(); return instance.addItem(notaId, menuName, quantity, price); }
export async function removeItemFromNota(notaId, itemId) { const instance = new NotaManager(); return instance.removeItem(notaId, itemId); }
export async function getNotaDetail(notaId) { const instance = new NotaManager(); return instance.getDetail(notaId); }
