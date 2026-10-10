import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const activeSessions = new Map(); // chatId -> { kasirName, kasirId }

export async function loginKasir(chatId, name) {
  if (!supabase) return { success: false, error: 'DB not configured' };

  // Find or create kasir
  let { data: kasir } = await supabase
    .from('kasir')
    .select('*')
    .ilike('name', name)
    .single();

  if (!kasir) {
    const { data: newKasir, error } = await supabase
      .from('kasir')
      .insert({ name, wa_number: chatId.split('@')[0] })
      .select()
      .single();
    
    if (error) return { success: false, error: error.message };
    kasir = newKasir;
  }

  activeSessions.set(chatId, { 
    kasirName: kasir.name, 
    kasirId: kasir.id 
  });

  return { success: true, kasir: kasir.name };
}

export function logoutKasir(chatId) {
  activeSessions.delete(chatId);
}

export function getCurrentKasir(chatId) {
  return activeSessions.get(chatId);
}

export function isOwner(chatId) {
  const session = activeSessions.get(chatId);
  return session?.kasirName?.toLowerCase() === 'owner';
}

export async function getAllKasir() {
  if (!supabase) return [];
  const { data } = await supabase
    .from('kasir')
    .select('*')
    .eq('active', true)
    .order('name');
  return data || [];
}