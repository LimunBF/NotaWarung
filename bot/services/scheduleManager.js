import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const scheduledJobs = {
  startTime: null,
  stopTime: null,
  isBotRunning: false
};

// Konfigurasi jadwal berdasarkan env
const OPEN_HOUR = parseInt(process.env.OPEN_HOUR || '09');
const CLOSE_HOUR = parseInt(process.env.CLOSE_HOUR || '23');

export function getScheduledHours() {
  return { open: OPEN_HOUR, close: CLOSE_HOUR };
}

export function isWithinOperatingHours() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}

export function getTimeUntilNextSchedule() {
  const now = new Date();
  const nowHour = now.getHours();
  const nowMinute = now.getMinutes();
  
  let nextAction = null;
  let minutesUntil = 0;

  if (isWithinOperatingHours()) {
    // Di jam kerja — cek apakah sudah waktunya stop (close hour)
    if (nowHour >= CLOSE_HOUR - 1) {
      // Akan stop di jam close
      const stopTime = new Date();
      stopTime.setHours(CLOSE_HOUR, 0, 0, 0);
      const diffMs = stopTime - now;
      minutesUntil = Math.ceil(diffMs / 60000);
      nextAction = 'stop';
    } else {
      // Belum waktunya stop, hitung berapa sampai jam close
      const closeTime = new Date();
      closeTime.setHours(CLOSE_HOUR, 0, 0, 0);
      const diffMs = closeTime - now;
      minutesUntil = Math.ceil(diffMs / 60000);
      nextAction = 'stop';
    }
  } else {
    // Di luar jam kerja — cek berapa sampai jam buka
    if (nowHour < OPEN_HOUR) {
      const openTime = new Date();
      openTime.setHours(OPEN_HOUR, 0, 0, 0);
      const diffMs = openTime - now;
      minutesUntil = Math.ceil(diffMs / 60000);
      nextAction = 'start';
    } else {
      // Sudah lewat jam tutup tapi belum pagi hari — berhenti di menit sebelum jam buka esok
      const nextDay = new Date();
      nextDay.setDate(nextDay.getDate() + 1);
      openTime.setHours(OPEN_HOUR, 0, 0, 0);
      openTime.setDate(nextDay.getDate());
      const diffMs = openTime - now;
      minutesUntil = Math.ceil(diffMs / 60000);
      nextAction = 'start';
    }
  }

  return { nextAction, minutesUntil };
}

export function getOperatingStatus() {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0 = Minggu, 1 = Senin, ...
  
  return {
    isWithinHours: isWithinOperatingHours(),
    currentHour: hour,
    openHour: OPEN_HOUR,
    closeHour: CLOSE_HOUR,
    dayName: getDayName(dayOfWeek)
  };
}

function getDayName(day) {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[day];
}

export async function triggerBotStart(reason = 'manual') {
  if (!supabase) {
    scheduledJobs.isBotRunning = true;
    console.log(`🤖 Bot ${reason}: Starting (DB not configured, simulating)`);
    return { success: true, note: 'DB not configured' };
  }

  // Cek apakah bot udah running
  const { data: existing } = await supabase
    .from('notas')
    .select('id')
    .limit(1);

  scheduledJobs.isBotRunning = true;
  scheduledJobs.startTime = new Date().toISOString();

  console.log(`🤖 Bot started (${reason}): ${scheduledJobs.startTime}`);
  
  return { success: true, isRunning: true, startedAt: scheduledJobs.startTime };
}

export async function triggerBotStop(reason = 'schedule') {
  if (!supabase) {
    scheduledJobs.isBotRunning = false;
    console.log(`🛑 Bot ${reason}: Stopping (DB not configured)`);
    return { success: true, note: 'DB not configured' };
  }

  scheduledJobs.isBotRunning = false;
  scheduledJobs.stopTime = new Date().toISOString();

  console.log(`🛑 Bot stopped (${reason}): ${scheduledJobs.stopTime}`);
  
  return { success: true, isRunning: false, stoppedAt: scheduledJobs.stopTime };
}

export function isBotRunning() {
  return scheduledJobs.isBotRunning;
}

export function getBotScheduleInfo() {
  return {
    openHour: OPEN_HOUR,
    closeHour: CLOSE_HOUR,
    isCurrentlyRunning: scheduledJobs.isBotRunning,
    startTime: scheduledJobs.startTime,
    stopTime: scheduledJobs.stopTime,
    minutesUntilNext: getTimeUntilNextSchedule()
  };
}