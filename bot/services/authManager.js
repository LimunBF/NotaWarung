import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// Session: chatId -> { nama kasir, loginTime }
const activeKasirSessions = new Map();

export async function handleLoginKasir(chatId, text) {
  // Format: "login andi" atau "login owner"
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase(); // "login"
  const name = parts.slice(1).join(' '); // "andi", "owner", dsb

  if (!supabase) return { success: false, error: 'DB not configured' };

  // Check if this chatId already has a kasir login
  const existing = activeKasirSessions.get(chatId);
  if (existing) {
    return { success: false, error: 'Kasir sudah login di sesi ini. Ketik "logout" untuk logout dulu.' };
  }

  let kasirData;

  if (name.toLowerCase() === 'owner') {
    // Owner login
    kasirData = { id: 'owner', name: 'Owner', isOwner: true };
  } else {
    // Kasir biasa - cek di database atau buat baru
    let { data } = await supabase
      .from('kasir')
      .select('*')
      .ilike('name', name)
      .single();

    if (!data) {
      // Buat kasir baru
      const { error: insertError } = await supabase
        .from('kasir')
        .insert({ name, wa_number: chatId.split('@')[0] })
        .select()
        .single();

      if (insertError) return { success: false, error: 'Gagal membuat kasir: ' + insertError.message };
      data = { id: `kasir_${Date.now()}`, name, isOwner: false };
    }

    kasirData = data;
  }

  activeKasirSessions.set(chatId, {
    kasirId: kasirData.id,
    kasirName: kasirData.name,
    isOwner: kasirData.isOwner || kasirData.name.toLowerCase() === 'owner',
    loginTime: new Date().toISOString()
  });

  return {
    success: true,
    message: `✅ Login sebagai "${kasirData.name}" sukses`,
    isOwner: kasirData.isOwner,
    kasirName: kasirData.name
  };
}

export function handleLogoutKasir(chatId) {
  const session = activeKasirSessions.get(chatId);
  if (!session) {
    return { success: false, error: 'Kasir belum login' };
  }

  activeKasirSessions.delete(chatId);
  return { success: true, message: '✅ Logout berhasil' };
}

export function getCurrentKasirSession(chatId) {
  return activeKasirSessions.get(chatId) || null;
}

export function isKasirLoggedIn(chatId) {
  return activeKasirSessions.has(chatId);
}

export function getAllActiveKasir() {
  const sessions = [];
  for (const [chatId, session] of activeKasirSessions) {
    sessions.push({
      chatId,
      kasirName: session.kasirName,
      isOwner: session.isOwner,
      loginTime: session.loginTime
    });
  }
  return sessions;
}