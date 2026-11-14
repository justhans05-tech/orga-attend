
  // State Global Aplikasi Client
  const AppState = {
    token: localStorage.getItem('orga_token') || null,
    currentUser: null,
    activeSessions: [],
    selectedSessionId: null,
    cameraStream: null,
    capturedSelfieBase64: null,
    cameraFailed: false,
    geoWatchId: null,
    currentCoords: null,
    gpsAccuracy: null
  };

  // Helper Pemanggi
  // lan google.script.run berbasis Promise
 
// ==========================================
// ORGA-ATTEND API CONNECTION
// GitHub Pages → Google Apps Script
// ==========================================

// GANTI dengan URL Web App Apps Script TERBARU.
// Ambil dari Deploy → Manage deployments → Web app URL.
var GAS_API_URL = var GAS_API_URL = 'https://script.google.com/macros/s/AKfycbwCL7MSD3x8K4iIGygUjtIY4ZbtryCCLJrO-5VALvXU9bi5FiJs2RHdK3KRrk8dMWqf/exec';

async function runServer(functionName, ...args) {
  try {
    if (!GAS_API_URL || !GAS_API_URL.endsWith('/exec')) {
      throw new Error('URL Google Apps Script belum dikonfigurasi.');
    }

    const response = await fetch(GAS_API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        fn: functionName,
        args: args
      })
    });

    const raw = await response.text();

    let result;

    try {
      result = JSON.parse(raw);
    } catch (parseError) {
      console.error('[API INVALID RESPONSE]', {
        functionName,
        status: response.status,
        url: response.url,
        response: raw.substring(0, 500)
      });

      throw new Error(
        'Respons server bukan JSON yang valid.'
      );
    }

    if (!response.ok) {
      throw new Error(
        result.message || 'HTTP Error: ' + response.status
      );
    }

    console.log('[API SUCCESS]', functionName, result);

    if (
      result &&
      typeof result === 'object' &&
      typeof result.success === 'boolean'
    ) {
      return result;
    }

    return {
      success: true,
      data: result
    };

  } catch (error) {
    console.error('[API CONNECTION ERROR]', functionName, error);
    throw error;
  }
}


  // Notifikasi Toast
  function showToast(message, type = 'info') {
    const toast = document.getElementById('toastNotification');
    const toastMsg = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    toastMsg.innerText = message;
    
    toast.className = 'fixed top-5 right-5 z-[99999] flex items-center px-4 py-3 rounded-xl shadow-2xl transition-all duration-300 transform translate-y-0 text-white font-medium ';
    if (type === 'success') {
      toast.classList.add('bg-emerald-600');
      toastIcon.innerHTML = '✓';
    } else if (type === 'error') {
      toast.classList.add('bg-rose-600');
      toastIcon.innerHTML = '✕';
    } else {
      toast.classList.add('bg-blue-600');
      toastIcon.innerHTML = 'ℹ';
    }

    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 5000);
  }

  // Loading Overlay
  function showLoading(show = true, message = 'Memproses...') {
    const overlay = document.getElementById('loadingOverlay');
    const msgText = document.getElementById('loadingText');
    if (msgText) msgText.innerText = message;
    if (show) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  // Navigasi View
  function showView(viewId) {
    ['viewLogin', 'viewMemberDashboard', 'viewAdminDashboard'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
  }

  // Format Tanggal
  function formatDateIndo(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
