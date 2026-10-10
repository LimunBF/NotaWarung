// API base URL (akan otomatis detect)
const API_BASE = window.location.origin;

// Supabase client
let supabase;

// ──────────────────────────────────────────────
// Initialize
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  loadStats();
  loadRecentNotas();
  loadActiveKasir();
  checkBotStatus();
  
  // Auto-refresh every 30 seconds
  setInterval(() => {
    loadStats();
    loadRecentNotas();
    loadActiveKasir();
    checkBotStatus();
  }, 30000);
});

function initSupabase() {
  // TODO: Ganti dengan URL & key Supabase kamu setelah setup
  // Atau ambil dari API endpoint
  const SUPABASE_URL = 'YOUR_SUPABASE_URL';
  const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
  
  if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } else {
    console.warn('Supabase belum dikonfigurasi di dashboard/app.js');
  }
}

// ──────────────────────────────────────────────
// Bot Status & Control
// ──────────────────────────────────────────────
async function checkBotStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/health`);
    const data = await response.json();
    
    const statusEl = document.getElementById('status');
    const statusText = document.getElementById('bot-status');
    const scheduleInfo = document.getElementById('next-action-info');
    
    if (data.botRunning) {
      statusEl.classList.add('online');
      statusEl.classList.remove('offline');
      statusText.textContent = '✅ Bot Online';
    } else {
      statusEl.classList.add('offline');
      statusEl.classList.remove('online');
      statusText.textContent = '⏸️ Bot Offline';
    }

    if (data.schedule) {
      const { openHour, closeHour, minutesUntilNext } = data.schedule;
      document.getElementById('schedule-hours').textContent = `${String(openHour).padStart(2, '0')}:00 - ${String(closeHour).padStart(2, '0')}:00`;
      
      if (minutesUntilNext) {
        const hours = Math.floor(minutesUntilNext.minutesUntil / 60);
        const mins = minutesUntilNext.minutesUntil % 60;
        scheduleInfo.innerHTML = `⏰ ${minutesUntilNext.nextAction === 'start' ? 'Bot akan START' : 'Bot akan STOP'} dalam <strong>${hours}j ${mins}m</strong>`;
      }
    }
  } catch (error) {
    console.error('Error checking bot status:', error);
    const statusEl = document.getElementById('status');
    const statusText = document.getElementById('bot-status');
    statusEl.classList.add('offline');
    statusEl.classList.remove('online');
    statusText.textContent = '❌ API Offline';
  }
}

async function startBot() {
  const btn = document.getElementById('btn-start');
  btn.disabled = true;
  btn.textContent = '🔄 Starting...';
  
  try {
    const response = await fetch(`${API_BASE}/api/bot/start`, { method: 'POST' });
    const data = await response.json();
    
    if (data.success) {
      alert('✅ Bot berhasil distart!');
      checkBotStatus();
    } else {
      alert('❌ Gagal start bot: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    alert('❌ Error: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '🟢 START BOT';
  }
}

async function stopBot() {
  const btn = document.getElementById('btn-stop');
  btn.disabled = true;
  btn.textContent = '🔄 Stopping...';
  
  try {
    const response = await fetch(`${API_BASE}/api/bot/stop`, { method: 'POST' });
    const data = await response.json();
    
    if (data.success) {
      alert('🛑 Bot berhasil distop!');
      checkBotStatus();
    } else {
      alert('❌ Gagal stop bot: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    alert('❌ Error: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔴 STOP BOT';
  }
}

// ──────────────────────────────────────────────
// Stats
// ──────────────────────────────────────────────
async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/api/stats`);
    const data = await response.json();
    
    if (data.error) {
      console.warn('Stats error:', data.error);
      return;
    }

    document.getElementById('today-count').textContent = data.today.count;
    document.getElementById('today-total').textContent = `Rp ${data.today.total.toLocaleString('id-ID')}`;
    document.getElementById('month-count').textContent = data.month.count;
    document.getElementById('month-total').textContent = `Rp ${data.month.total.toLocaleString('id-ID')}`;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// ──────────────────────────────────────────────
// Recent Notas
// ──────────────────────────────────────────────
let currentOffset = 0;

async function loadRecentNotas() {
  const container = document.getElementById('recent-notas');
  
  try {
    const response = await fetch(`${API_BASE}/api/notas?limit=10&offset=${currentOffset}`);
    const data = await response.json();
    
    if (data.error) {
      container.innerHTML = '<p class="loading">Error memuat data</p>';
      return;
    }

    if (data.notas.length === 0) {
      container.innerHTML = '<p class="loading">Belum ada nota</p>';
      return;
    }

    container.innerHTML = data.notas.map(nota => {
      const time = new Date(nota.created_at).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });

      const statusClass = nota.status === 'paid' ? 'status-paid' : nota.status === 'cancelled' ? 'status-cancelled' : 'status-pending';

      return `
        <div class="nota-item ${statusClass}">
          <div class="info">
            <div class="nota-number">${nota.nota_number}</div>
            <div class="nota-meta">
              <span class="nota-time">${time}</span>
              <span class="nota-kasir">👤 ${nota.kasir_name || '-'}</span>
            </div>
          </div>
          <div class="nota-right">
            <div class="nota-status">${formatStatus(nota.status)}</div>
            <div class="nota-total">Rp ${nota.total_amount.toLocaleString('id-ID')}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading notas:', error);
    container.innerHTML = '<p class="loading">Error memuat data</p>';
  }
}

function formatStatus(status) {
  const map = {
    pending: '⏳ Pending',
    paid: '✅ Lunas',
    cancelled: '🚫 Batal'
  };
  return map[status] || status;
}

async function loadMore() {
  currentOffset += 10;
  await loadRecentNotas();
}

// ──────────────────────────────────────────────
// Active Kasir
// ──────────────────────────────────────────────
async function loadActiveKasir() {
  try {
    const response = await fetch(`${API_BASE}/api/kasir/active`);
    const data = await response.json();
    
    const container = document.getElementById('active-kasir');
    
    if (!data.kasir || data.kasir.length === 0) {
      container.innerHTML = '<p class="loading">Tidak ada kasir yang login</p>';
      return;
    }

    container.innerHTML = data.kasir.map(k => {
      const loginTime = new Date(k.loginTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="kasir-item">
          <span class="kasir-icon">${k.isOwner ? '🔑' : '👤'}</span>
          <span class="kasir-name">${k.kasirName}</span>
          <span class="kasir-time">Login: ${loginTime}</span>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading kasir:', error);
  }
}

// ──────────────────────────────────────────────
// Export
// ──────────────────────────────────────────────
async function exportToday() {
  const btn = document.getElementById('export-today-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';
  
  try {
    const response = await fetch(`${API_BASE}/api/export/today`);
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nota-hari-ini-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } else {
      alert('❌ Gagal generate Excel');
    }
  } catch (error) {
    alert('❌ Error: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '📄 EXCEL HARI INI';
  }
}

async function exportMonth() {
  const btn = document.getElementById('export-month-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Generating...';
  
  try {
    const response = await fetch(`${API_BASE}/api/export/month`);
    
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const monthStr = new Date().toISOString().slice(0, 7);
      a.download = `nota-bulan-${monthStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } else {
      alert('❌ Gagal generate Excel');
    }
  } catch (error) {
    alert('❌ Error: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '📊 EXCEL BULAN INI';
  }
}
