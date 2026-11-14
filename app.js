
  // Inisialisasi saat halaman dimuat
  window.addEventListener('DOMContentLoaded', () => {
    checkActiveSession();
    bindCameraEvents();
    initGeolocation();
  });

  // Switch Tab Login
  function switchLoginTab(tab) {
    const tabGoogle = document.getElementById('tabGoogleBtn');
    const tabPass = document.getElementById('tabPassBtn');
    const formGoogle = document.getElementById('formLoginGoogle');
    const formPass = document.getElementById('formLoginPassword');

    if (tab === 'google') {
      tabGoogle.className = 'flex-1 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-800 transition-all';
      tabPass.className = 'flex-1 py-2 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-800 transition-all';
      formGoogle.classList.remove('hidden');
      formPass.classList.add('hidden');
    } else {
      tabPass.className = 'flex-1 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-800 transition-all';
      tabGoogle.className = 'flex-1 py-2 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-800 transition-all';
      formPass.classList.remove('hidden');
      formGoogle.classList.add('hidden');
    }
  }

  // Cek apakah token tersimpan masih valid
  async function checkActiveSession() {
    if (!AppState.token) {
      showView('viewLogin');
      return;
    }

    showLoading(true, 'Memeriksa sesi login...');
    try {
      const res = await runServer('apiGetProfile', AppState.token);
      if (res.success && res.data) {
        setLoggedInUser(res.data);
      } else {
        localStorage.removeItem('orga_token');
        AppState.token = null;
        showView('viewLogin');
      }
    } catch (e) {
      showView('viewLogin');
    } finally {
      showLoading(false);
    }
  }

  // Handle Login Google
  async function handleGoogleLogin() {
    showLoading(true, 'Menghubungkan akun Google...');
    try {
      const res = await runServer('apiLoginWithGoogle', '');
      if (res.success) {
        handleLoginSuccess(res.data);
      } else {
        showToast(res.message || 'Login Google gagal', 'error');
      }
    } catch (e) {
      showToast('Gagal memproses autentikasi Google', 'error');
    } finally {
      showLoading(false);
    }
  }

  // Handle Login Username & Password
  async function handlePasswordLogin(e) {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value;
    const p = document.getElementById('loginPassword').value;

    showLoading(true, 'Memverifikasi kredensial...');
    try {
      const res = await runServer('apiLoginWithPassword', u, p);
      if (res.success) {
        handleLoginSuccess(res.data);
      } else {
        showToast(res.message || 'Username atau password salah', 'error');
      }
    } catch (err) {
      showToast('Gagal terhubung ke server', 'error');
    } finally {
      showLoading(false);
    }
  }

  // Set Sesi Login Sukses
  function handleLoginSuccess(data) {
    AppState.token = data.token;
    localStorage.setItem('orga_token', data.token);
    setLoggedInUser(data.user);
    showToast('Selamat datang, ' + data.user.full_name, 'success');
  }

  function setLoggedInUser(user) {
    AppState.currentUser = user;
    document.getElementById('mainNavbar').classList.remove('hidden');
    document.getElementById('navUserName').innerText = user.full_name;
    document.getElementById('navUserEmail').innerText = user.email || user.username;
    document.getElementById('userRoleBadge').innerText = user.role;

    if (user.role === 'SUPER_ADMIN' || user.role === 'OPERATOR' || user.role === 'VIEWER') {
      showView('viewAdminDashboard');
      loadAdminDashboard();

      // Jika role adalah VIEWER, sembunyikan tombol edit/tambah
      if (user.role === 'VIEWER') {
        const btnSesi = document.getElementById('btnCreateSessionTop');
        const btnUser = document.getElementById('btnCreateUserTop');
        const btnToggle = document.getElementById('btnToggleSession');
        if (btnSesi) btnSesi.classList.add('hidden');
        if (btnUser) btnUser.classList.add('hidden');
        if (btnToggle) btnToggle.classList.add('hidden');
      }
    } else {
      showView('viewMemberDashboard');
      loadMemberDashboard();

      // Isi otomatis data nama & nomor anggota jika sudah ada di profil
      const nameInput = document.getElementById('memberFormFullName');
      const numInput = document.getElementById('memberFormMemberNumber');
      if (nameInput) nameInput.value = user.full_name || '';
      if (numInput) numInput.value = user.member_number || '';
    }
  }

  // Logout
  async function handleLogout() {
    if (AppState.token) {
      await runServer('apiLogout', AppState.token);
    }
    stopCamera();
    localStorage.removeItem('orga_token');
    AppState.token = null;
    AppState.currentUser = null;
    document.getElementById('mainNavbar').classList.add('hidden');
    showView('viewLogin');
    showToast('Anda telah keluar.', 'info');
  }

  // ==========================================
  // LOGIKA DASHBOARD MEMBER (ABSENSI)
  // ==========================================
  async function loadMemberDashboard() {
    initGeolocation();
    const sel = document.getElementById('memberSessionSelect');
    if (sel) {
      sel.innerHTML = '<option value="">Memuat daftar sesi kegiatan...</option>';
    }

    try {
      // Ambil seluruh sesi yang tersedia untuk dipilih anggota
      let sessions = [];
      try {
        const resAll = await runServer('apiGetAllSessionsForMember', AppState.token);
        if (resAll && resAll.data) {
          sessions = Array.isArray(resAll.data) ? resAll.data : (resAll.data.data || []);
        }
      } catch (e1) {
        try {
          const resActive = await runServer('apiGetActiveSessions', AppState.token);
          if (resActive && resActive.data) {
            sessions = Array.isArray(resActive.data) ? resActive.data : (resActive.data.data || []);
          }
        } catch (e2) { }
      }

      AppState.memberSessionList = sessions || [];

      if (sessions.length > 0) {
        sessions.sort((a, b) => String(b.created_at || b.session_date || '').localeCompare(String(a.created_at || a.session_date || '')));

        let optionsHtml = '<option value="">-- Pilih Sesi Kegiatan --</option>';
        sessions.forEach(s => {
          const isOpen = String(s.status || '').toLowerCase() === 'open';
          const statusIcon = isOpen ? '🟢 BUKA' : '🔴 TUTUP';
          const sName = s.session_name || 'Sesi Kegiatan';
          const sDate = s.session_date || '-';
          const sTime = (s.start_time && s.end_time) ? ` | ${s.start_time}-${s.end_time}` : '';
          optionsHtml += `<option value="${s.session_id}">[${statusIcon}] ${sName} (${sDate}${sTime})</option>`;
        });
        if (sel) sel.innerHTML = optionsHtml;

        // Pilih otomatis: utamakan sesi yang sedang OPEN, atau sesi pertama
        const openSession = sessions.find(s => String(s.status || '').toLowerCase() === 'open');
        const defaultSession = openSession || sessions[0];

        if (defaultSession) {
          if (sel) sel.value = defaultSession.session_id;
          applySelectedMemberSession(defaultSession);
        }

        // Mulai lacak GPS
        initGeolocation();
        checkReadyToAttend();
      } else {
        if (sel) sel.innerHTML = '<option value="">Belum ada sesi dibuat</option>';
        AppState.selectedSessionId = null;
        document.getElementById('currentSessionTitle').innerText = 'Tidak Ada Sesi Terbuka';
        document.getElementById('currentSessionSubtitle').innerText = 'Belum ada jadwal absensi yang sedang dibuka pengurus.';
        document.getElementById('geofenceInfo').innerText = '-';
        const badge = document.getElementById('memberSessionBadge');
        if (badge) {
          badge.className = 'text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider';
          badge.innerText = '● Tidak Ada Sesi';
        }
        const btnCheckin = document.getElementById('btnCheckinMain');
        if (btnCheckin) {
          btnCheckin.disabled = true;
          btnCheckin.className = 'w-full py-4 rounded-2xl bg-slate-200 text-slate-400 font-black text-base shadow-none transition-all flex items-center justify-center space-x-2 cursor-not-allowed';
        }
      }
    } catch (e) {
      console.error('loadMemberDashboard error:', e);
      if (sel) sel.innerHTML = '<option value="">Gagal memuat sesi</option>';
    }

    // 2. Ambil Riwayat Kehadiran Pribadi
    loadMyHistory();
  }

  // Handler pergantian sesi di dropdown anggota
  function onMemberSessionSelectChange(sessionId) {
    if (!sessionId) {
      AppState.selectedSessionId = null;
      document.getElementById('currentSessionTitle').innerText = 'Pilih Sesi Kegiatan';
      document.getElementById('currentSessionSubtitle').innerText = 'Silakan pilih salah satu jadwal sesi di dropdown atas.';
      document.getElementById('geofenceInfo').innerText = '-';
      const badge = document.getElementById('memberSessionBadge');
      if (badge) {
        badge.className = 'text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider';
        badge.innerText = '● Belum Dipilih';
      }
      checkReadyToAttend();
      return;
    }

    const sessions = AppState.memberSessionList || [];
    const session = sessions.find(s => s.session_id === sessionId);
    if (session) {
      applySelectedMemberSession(session);
    }
  }

  // Terapkan data sesi yang dipilih ke UI Member
  function applySelectedMemberSession(session) {
    if (!session) return;
    AppState.selectedSessionId = session.session_id;

    const titleEl = document.getElementById('currentSessionTitle');
    const subEl = document.getElementById('currentSessionSubtitle');
    const geoEl = document.getElementById('geofenceInfo');
    const badge = document.getElementById('memberSessionBadge');

    if (titleEl) titleEl.innerText = session.session_name || 'Sesi Utama';
    if (subEl) subEl.innerText = `Tanggal: ${session.session_date || '-'} | Jam: ${session.start_time || '-'}${session.end_time ? ' s/d ' + session.end_time : ''}`;
    if (geoEl) geoEl.innerText = `Max ${session.geofence_radius_m || 100} meter`;

    const isOpen = String(session.status || '').toLowerCase() === 'open';
    if (badge) {
      if (isOpen) {
        badge.className = 'text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider';
        badge.innerText = '● Sedang Dibuka';
      } else {
        badge.className = 'text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full uppercase tracking-wider';
        badge.innerText = '● Sesi Ditutup';
      }
    }

    checkReadyToAttend();
  }

  // Geolocation Browser API (Dijalankan hanya sekali dengan menyimpan watchId)
  function initGeolocation() {
    if (AppState.geoWatchId !== null && AppState.geoWatchId !== undefined) {
      return;
    }

    const badgeText = document.getElementById('gpsStatusText');
    if (!navigator.geolocation) {
      if (badgeText) badgeText.innerText = 'GPS Tidak Didukung Browser';
      return;
    }

    try {
      AppState.geoWatchId = navigator.geolocation.watchPosition(
        pos => {
          AppState.currentCoords = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude
          };
          AppState.gpsAccuracy = pos.coords.accuracy;
          if (badgeText) {
            badgeText.innerText = `GPS Terkunci (±${Math.round(pos.coords.accuracy)}m)`;
          }
          checkReadyToAttend();
        },
        err => {
          if (badgeText) {
            badgeText.innerText = 'Izin Lokasi Ditolak/Mati';
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    } catch (e) {
      console.warn('Geolocation error:', e);
      if (badgeText) badgeText.innerText = 'GPS Error';
    }
  }

  // Helper deteksi perangkat mobile (HP Android/iPhone) vs Desktop/Laptop
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // Event listener binding untuk komponen kamera (Dipanggil di DOMContentLoaded)
  function bindCameraEvents() {
    const placeholder = document.getElementById('cameraPlaceholder');
    const lblTrigger = document.getElementById('lblTriggerCamera');
    const btnGallery = document.getElementById('btnPickGallery');
    const fallbackInput = document.getElementById('fallbackCameraInput');
    const galleryInput = document.getElementById('galleryInput');

    if (placeholder) {
      placeholder.addEventListener('click', () => {
        startCamera();
      });
    }

    if (lblTrigger) {
      lblTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        startCamera();
      });
    }

    if (btnGallery && galleryInput) {
      btnGallery.addEventListener('click', (e) => {
        e.preventDefault();
        galleryInput.value = '';
        galleryInput.click();
      });
    }

    if (fallbackInput) {
      fallbackInput.addEventListener('change', handleFallbackSelfie);
    }

    if (galleryInput) {
      galleryInput.addEventListener('change', handleFallbackSelfie);
    }
  }

  // Trigger fallback kamera bawaan perangkat (HP / Laptop) SECARA SINKRON dari user gesture
  function triggerFallbackCamera(promptMessage) {
    const fallback = document.getElementById('fallbackCameraInput');
    if (!fallback) return;

    // Reset value agar event onchange selalu terpicu meski mengambil foto baru
    fallback.value = '';

    const isMobile = isMobileDevice();
    if (isMobile) {
      fallback.setAttribute('capture', 'user');
    } else {
      fallback.removeAttribute('capture');
    }

    if (promptMessage) {
      showToast(promptMessage, 'info');
    }

    // Buka dialog native kamera secara sinkron
    try {
      fallback.click();
    } catch (e) {
      console.warn('Programmatic click fallback error:', e);
    }
  }

  // Buka kamera (Sinkron: mengecek live webcam vs native camera fallback)
  function startCamera() {
    stopCamera();

    AppState.capturedSelfieBase64 = null;

    const preview = document.getElementById('selfiePreview');
    const placeholder = document.getElementById('cameraPlaceholder');
    const webcamRow = document.getElementById('liveWebcamControlRow');

    if (preview) {
      preview.classList.add('hidden');
      preview.removeAttribute('src');
    }

    if (placeholder) {
      placeholder.classList.remove('hidden');
    }

    if (webcamRow) {
      webcamRow.classList.add('hidden');
      webcamRow.classList.remove('grid');
    }

    // Bagian sinkron sebelum await langsung dari event click pengguna
    const hasGetUserMedia = Boolean(
      window.isSecureContext !== false &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );

    if (AppState.cameraFailed || !hasGetUserMedia) {
      triggerFallbackCamera(isMobileDevice() ? 'Membuka kamera bawaan HP...' : 'Membuka kamera / galeri foto...');
      return;
    }

    startLiveWebcamStream();
  }

  // Mengaktifkan stream live camera
  async function startLiveWebcamStream() {
    const video = document.getElementById('cameraVideo');
    const placeholder = document.getElementById('cameraPlaceholder');
    const titleEl = document.getElementById('cameraPlaceholderTitle');
    const hintEl = document.getElementById('cameraPlaceholderHint');
    const preview = document.getElementById('selfiePreview');
    const webcamRow = document.getElementById('liveWebcamControlRow');

    if (!video || !placeholder) {
      showToast('Komponen kamera tidak ditemukan.', 'error');
      return;
    }

    try {
      showLoading(true, 'Mengaktifkan kamera live...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      AppState.cameraStream = stream;

      video.muted = true;
      video.autoplay = true;
      video.setAttribute('playsinline', '');
      video.srcObject = stream;

      // Sesuai aturan: Tampilkan <video> SEBELUM menunggu onloadedmetadata
      video.classList.remove('hidden');
      if (placeholder) placeholder.classList.add('hidden');
      if (preview) preview.classList.add('hidden');

      // Tunggu metadata / status video siap
      await new Promise((resolve) => {
        if (video.readyState >= 1 && video.videoWidth > 0) {
          resolve();
          return;
        }
        const timeout = setTimeout(resolve, 3000);
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };
      });

      await video.play();

      if (webcamRow) {
        webcamRow.classList.remove('hidden');
        webcamRow.classList.add('grid');
      }

      showToast('Kamera aktif! Posisikan wajah Anda lalu tekan Jepret Foto.', 'success');
    } catch (err) {
      console.error('Camera Error:', err);

      AppState.cameraFailed = true;
      stopCamera();

      let errorMsg = 'Akses live webcam dibatasi/diblokir oleh browser atau iframe Google Apps Script.';
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        errorMsg = 'Akses live webcam diblokir sandbox iframe Apps Script.';
      } else if (err.name === 'NotFoundError') {
        errorMsg = 'Perangkat kamera tidak ditemukan.';
      } else if (err.name === 'NotReadableError') {
        errorMsg = 'Kamera sedang digunakan aplikasi lain.';
      } else if (err.message) {
        errorMsg = err.message;
      }

      if (titleEl) {
        titleEl.innerText = 'Sentuh lagi untuk pakai kamera bawaan HP';
      }
      if (hintEl) {
        hintEl.innerText = errorMsg;
      }

      showToast(errorMsg + ' Sentuh lagi untuk membuka kamera HP.', 'error');
      // PENTING: JANGAN memanggil fallback.click() di sini karena bukan direct user gesture
    } finally {
      showLoading(false);
    }
  }

  // Helper universal untuk menampilkan hasil foto preview
  function showCapturedPreview(base64Image) {
    AppState.capturedSelfieBase64 = base64Image;

    const preview = document.getElementById('selfiePreview');
    const video = document.getElementById('cameraVideo');
    const placeholder = document.getElementById('cameraPlaceholder');
    const webcamRow = document.getElementById('liveWebcamControlRow');
    const lblTrigger = document.getElementById('lblTriggerCamera');

    if (preview) {
      preview.src = base64Image;
      preview.classList.remove('hidden');
    }
    if (video) video.classList.add('hidden');
    if (placeholder) placeholder.classList.add('hidden');
    if (webcamRow) {
      webcamRow.classList.add('hidden');
      webcamRow.classList.remove('grid');
    }

    if (lblTrigger) {
      lblTrigger.innerHTML = '<span>📷 Ambil Ulang Foto</span>';
      lblTrigger.className = 'cursor-pointer py-3 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1.5 shadow text-center select-none';
    }

    checkReadyToAttend();
  }

  // Tombol Jepret Foto dari control row
  function snapPhoto() {
    snapLiveWebcam();
  }

  // Mengambil foto dari frame video webcam live dengan mirror transform
  function snapLiveWebcam() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');

    if (!AppState.cameraStream || !video || !canvas || video.videoWidth === 0) {
      showToast('Kamera belum siap. Pastikan live kamera sudah menyala.', 'error');
      return;
    }

    try {
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      // Mirror effect
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, width, height);

      const base64 = canvas.toDataURL('image/jpeg', 0.85);

      stopCamera();
      showCapturedPreview(base64);
      showToast('Foto selfie berhasil diambil!', 'success');
    } catch (err) {
      console.error('Capture Error:', err);
      showToast('Gagal mengambil foto: ' + err.message, 'error');
    }
  }

  // Handler hasil foto dari input fallback kamera atau galeri
  function handleFallbackSelfie(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith('image/')) {
      showToast('File yang dipilih bukan gambar yang valid. Silakan ambil foto selfie.', 'error');
      return;
    }

    showLoading(true, 'Memproses foto...');

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        try {
          const canvas = document.getElementById('cameraCanvas');
          const maxDim = 1280;
          let w = img.width;
          let h = img.height;

          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          showCapturedPreview(base64);
          showToast('Foto selfie berhasil diambil!', 'success');
        } catch (errCanvas) {
          console.error('Error proses canvas:', errCanvas);
          showToast('Gagal memproses gambar: ' + errCanvas.message, 'error');
        } finally {
          showLoading(false);
        }
      };

      img.onerror = function () {
        showLoading(false);
        showToast('Gagal memuat gambar foto.', 'error');
      };

      img.src = e.target.result;
    };

    reader.onerror = function () {
      showLoading(false);
      showToast('Gagal membaca file foto dari perangkat Anda.', 'error');
    };

    reader.readAsDataURL(file);
  }

  // Menghentikan seluruh stream akses kamera
  function stopCamera() {
    if (AppState.cameraStream) {
      try {
        AppState.cameraStream.getTracks().forEach(track => {
          if (typeof track.stop === 'function') {
            track.stop();
          }
        });
      } catch (e) {
        console.warn('Track stop error:', e);
      }
      AppState.cameraStream = null;
    }

    const video = document.getElementById('cameraVideo');
    const webcamRow = document.getElementById('liveWebcamControlRow');
    const placeholder = document.getElementById('cameraPlaceholder');

    if (video) {
      video.pause();
      video.srcObject = null;
      video.classList.add('hidden');
    }

    if (webcamRow) {
      webcamRow.classList.add('hidden');
      webcamRow.classList.remove('grid');
    }

    if (!AppState.capturedSelfieBase64 && placeholder) {
      placeholder.classList.remove('hidden');
    }
  }

  // Bersihkan kamera jika halaman ditinggalkan
  window.addEventListener('beforeunload', () => {
    stopCamera();
  });

  function checkReadyToAttend() {
    const btn = document.getElementById('btnCheckinMain');
    if (!btn) return;

    const sessions = AppState.memberSessionList || [];
    const currentSession = sessions.find(s => s.session_id === AppState.selectedSessionId);
    const isOpen = currentSession ? (String(currentSession.status || '').toLowerCase() === 'open') : Boolean(AppState.selectedSessionId);

    if (AppState.selectedSessionId && !isOpen) {
      btn.disabled = true;
      btn.innerText = '✕ SESI INI DITUTUP';
      btn.className = 'w-full py-4 rounded-2xl bg-rose-100 text-rose-500 font-black text-base shadow-none transition-all flex items-center justify-center space-x-2 cursor-not-allowed';
      return;
    }

    if (AppState.selectedSessionId && AppState.capturedSelfieBase64) {
      btn.disabled = false;
      btn.innerText = '✓ HADIR SEKARANG';
      btn.className = 'w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 font-black text-white text-base shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer';
    } else {
      btn.disabled = true;
      btn.innerText = '✓ KLIK TOMBOL HADIR';
      btn.className = 'w-full py-4 rounded-2xl bg-slate-200 text-slate-400 font-black text-base shadow-none transition-all flex items-center justify-center space-x-2 cursor-not-allowed';
    }
  }

  // Eksekusi Absensi HADIR 1-KLIK
  async function handlePerformAttendance() {
    if (!AppState.selectedSessionId) {
      showToast('Tidak ada sesi yang dipilih', 'error');
      return;
    }
    if (!AppState.capturedSelfieBase64) {
      showToast('Silakan ambil foto selfie terlebih dahulu', 'error');
      return;
    }

    const customName = document.getElementById('memberFormFullName').value.trim();
    if (!customName) {
      showToast('Nama lengkap wajib diisi!', 'error');
      return;
    }

    const memberNumber = document.getElementById('memberFormMemberNumber').value.trim();
    const notes = document.getElementById('memberFormNotes').value.trim();

    showLoading(true, 'Memvalidasi lokasi & mencatat kehadiran...');
    try {
      const payload = {
        session_id: AppState.selectedSessionId,
        latitude: AppState.currentCoords ? AppState.currentCoords.lat : null,
        longitude: AppState.currentCoords ? AppState.currentCoords.lon : null,
        gps_accuracy_m: AppState.gpsAccuracy,
        selfie_base64: AppState.capturedSelfieBase64,
        member_full_name: customName,
        member_number: memberNumber,
        attendance_notes: notes,
        device_info: navigator.userAgent
      };

      const res = await runServer('apiCheckinAttendance', AppState.token, payload);
      if (res.success) {
        showToast(res.message, 'success');
        document.getElementById('btnCheckinMain').disabled = true;
        document.getElementById('btnCheckinMain').innerText = '✓ ANDA SUDAH HADIR';
        loadMyHistory();
      } else {
        showToast(res.message, 'error');
      }
    } catch (e) {
      showToast('Gagal memproses absensi: ' + e.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // Load Riwayat Kehadiran Pribadi
  async function loadMyHistory() {
    const container = document.getElementById('myHistoryList');
    try {
      const res = await runServer('apiGetMyAttendanceHistory', AppState.token);
      if (res.success && res.data && res.data.length > 0) {
        container.innerHTML = res.data.map(item => `
          <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <p class="text-xs font-bold text-slate-800">${item.event_name || 'Kegiatan Organisasi'}</p>
              <p class="text-[10px] text-slate-400 mt-0.5">${item.attendance_date} &bull; ${item.checkin_at ? item.checkin_at.substring(11, 16) : '-'}</p>
            </div>
            <span class="text-[11px] font-bold px-2.5 py-1 rounded-full ${item.attendance_status === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
              ${item.attendance_status.toUpperCase()}
            </span>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">Belum ada riwayat kehadiran.</p>';
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Form Modal Izin / Sakit
  function toggleLeaveModal(show) {
    const m = document.getElementById('modalLeaveRequest');
    if (show) m.classList.remove('hidden');
    else m.classList.add('hidden');
  }

  async function handleLeaveSubmit(e) {
    e.preventDefault();
    if (!AppState.selectedSessionId) {
      showToast('Tidak ada sesi yang sedang aktif', 'error');
      return;
    }

    const type = document.getElementById('leaveType').value;
    const reason = document.getElementById('leaveReason').value;
    const fileInput = document.getElementById('leaveFile');

    let fileBase64 = null;
    if (fileInput.files && fileInput.files[0]) {
      fileBase64 = await toBase64(fileInput.files[0]);
    }

    showLoading(true, 'Mengirim permohonan...');
    try {
      const res = await runServer('apiSubmitLeave', AppState.token, {
        session_id: AppState.selectedSessionId,
        leave_type: type,
        reason: reason,
        attachment_base64: fileBase64
      });

      if (res.success) {
        showToast(res.message, 'success');
        toggleLeaveModal(false);
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      showToast('Gagal mengajukan izin: ' + err.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }

  // ==========================================
  // LOGIKA DASHBOARD OPERATOR & ADMIN
  // ==========================================
  async function loadAdminDashboard(targetSessionId, newlyCreatedSession) {
    showLoading(true, 'Memuat data organisasi...');
    try {
      const res = await runServer('apiGetAllSessionsForAdmin', AppState.token);
      const sel = document.getElementById('adminSessionSelect');

      let sessionList = (res && res.data) ? (Array.isArray(res.data) ? res.data : (res.data.data || [])) : [];

      // Optimistic UI: jika ada sesi yang baru saja dibuat, pastikan masuk daftar
      if (newlyCreatedSession && newlyCreatedSession.session_id) {
        const found = sessionList.some(s => s.session_id === newlyCreatedSession.session_id);
        if (!found) {
          sessionList.unshift(newlyCreatedSession);
        }
      }

      if (sessionList.length > 0) {
        let optionsHtml = '<option value="">Pilih Sesi Kegiatan...</option>';
        sessionList.forEach(s => {
          const isOpen = String(s.status || '').toLowerCase() === 'open';
          const statusLabel = isOpen ? '🟢 BUKA' : '🔴 TUTUP';
          const sName = s.session_name || 'Sesi Kegiatan';
          const sDate = s.session_date || '-';
          optionsHtml += `<option value="${s.session_id}">[${statusLabel}] ${sName} (${sDate})</option>`;
        });
        sel.innerHTML = optionsHtml;

        let toSelect = targetSessionId;
        if (!toSelect || !sessionList.some(s => s.session_id === toSelect)) {
          const openSession = sessionList.find(s => String(s.status || '').toLowerCase() === 'open');
          toSelect = openSession ? openSession.session_id : sessionList[0].session_id;
        }

        if (toSelect) {
          sel.value = toSelect;
          AppState.selectedSessionId = toSelect;
          const chosen = sessionList.find(s => s.session_id === toSelect);
          const btnToggle = document.getElementById('btnToggleSession');
          if (chosen && btnToggle) {
            const isChosenOpen = String(chosen.status || '').toLowerCase() === 'open';
            btnToggle.innerText = isChosenOpen ? 'Tutup Sesi' : 'Buka Sesi';
            btnToggle.className = isChosenOpen
              ? 'px-4 py-2 text-xs font-bold rounded-xl text-white bg-rose-600 hover:bg-rose-700 shadow transition-all'
              : 'px-4 py-2 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow transition-all';
          }
          await loadAdminSessionReport(toSelect);
        }
      } else {
        sel.innerHTML = '<option value="">Belum ada sesi dibuat</option>';
        const btnToggle = document.getElementById('btnToggleSession');
        if (btnToggle) btnToggle.innerText = 'Buka Sesi';
      }

      // Ambil metadata spreadsheet aktif untuk ditampilkan di banner dashboard admin
      try {
        const ssRes = await runServer('apiGetSpreadsheetUrl', AppState.token);
        if (ssRes && ssRes.success && ssRes.data) {
          const nameEl = document.getElementById('activeSpreadsheetName');
          const linkEl = document.getElementById('linkDirectSpreadsheet');
          if (nameEl && ssRes.data.name) nameEl.innerText = ssRes.data.name;
          if (linkEl && ssRes.data.url) linkEl.href = ssRes.data.url;
        }
      } catch (ssErr) { }
    } catch (e) {
      console.error('Error loadAdminDashboard:', e);
      showToast('Gagal memuat sesi: ' + (e.message || e), 'error');
    } finally {
      showLoading(false);
    }
  }

  // Trigger sinkronisasi ulang seluruh data ke Google Spreadsheet
  async function handleTriggerResync() {
    showLoading(true, 'Menyinkronkan data ke Spreadsheet...');
    try {
      const res = await runServer('apiResyncSpreadsheet', AppState.token);
      if (res && res.success) {
        showToast(res.message || 'Sinkronisasi berhasil! Semua data tersimpan di Spreadsheet.', 'success');
        await loadAdminDashboard(AppState.selectedSessionId);
      } else {
        showToast((res && res.message) ? res.message : 'Gagal sinkronisasi data', 'error');
      }
    } catch (e) {
      showToast('Error sinkronisasi: ' + e.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  async function onAdminSessionSelectChange(sessionId) {
    if (!sessionId) return;
    const btnToggle = document.getElementById('btnToggleSession');
    const sel = document.getElementById('adminSessionSelect');
    const selectedOption = sel.options[sel.selectedIndex];
    if (selectedOption && btnToggle) {
      const isOptionOpen = selectedOption.text.includes('🟢 BUKA');
      btnToggle.innerText = isOptionOpen ? 'Tutup Sesi' : 'Buka Sesi';
      btnToggle.className = isOptionOpen
        ? 'px-4 py-2 text-xs font-bold rounded-xl text-white bg-rose-600 hover:bg-rose-700 shadow transition-all'
        : 'px-4 py-2 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow transition-all';
    }
    await loadAdminSessionReport(sessionId);
  }

  async function loadAdminSessionReport(sessionId) {
    if (!sessionId) return;
    try {
      const res = await runServer('apiGetSessionReport', AppState.token, sessionId);
      if (res && res.success && res.data) {
        const report = res.data;
        const summary = report.summary || {};
        const statP = document.getElementById('statPresentCount');
        const statL = document.getElementById('statLateCount');
        const statA = document.getElementById('statAbsentCount');
        if (statP) statP.innerText = summary.present || 0;
        if (statL) statL.innerText = summary.late || 0;
        if (statA) statA.innerText = summary.absent || 0;

        const tbody = document.getElementById('adminAttendanceTbody');
        if (tbody) {
          if (report.details && report.details.length > 0) {
            tbody.innerHTML = report.details.map(d => `
              <tr class="hover:bg-slate-50">
                <td class="p-3 font-semibold text-slate-800">${d.full_name}</td>
                <td class="p-3 text-slate-500">${d.division_id || '-'}</td>
                <td class="p-3">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${d.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                d.status === 'late' ? 'bg-amber-100 text-amber-700' :
                  d.status === 'excused' || d.status === 'sick' ? 'bg-blue-100 text-blue-700' :
                    'bg-rose-100 text-rose-700'
              }">${String(d.status || 'absent').toUpperCase()}</span>
                </td>
                <td class="p-3 text-slate-600">${d.checkin_time ? d.checkin_time.substring(11, 16) : '-'}</td>
                <td class="p-3 text-slate-500">${d.distance || '-'}</td>
                <td class="p-3">
                  ${d.selfie_file_id ? `<a href="https://drive.google.com/file/d/${d.selfie_file_id}/view" target="_blank" class="text-blue-600 hover:underline">Lihat Foto</a>` : '-'}
                </td>
              </tr>
            `).join('');
          } else {
            tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">Belum ada peserta yang terdata.</td></tr>';
          }
        }
      }
    } catch (e) {
      console.warn('loadAdminSessionReport error:', e);
    }
  }

  async function handleToggleCurrentSession() {
    const sel = document.getElementById('adminSessionSelect');
    if (!sel.value) {
      showToast('Pilih sesi terlebih dahulu', 'error');
      return;
    }
    const btn = document.getElementById('btnToggleSession');
    const newStatus = btn.innerText.includes('Buka') ? 'open' : 'closed';

    showLoading(true, 'Mengubah status sesi...');
    try {
      const res = await runServer('apiToggleSessionStatus', AppState.token, sel.value, newStatus);
      if (res.success) {
        showToast('Status sesi diperbarui', 'success');
        await loadAdminDashboard(sel.value);
      } else {
        showToast(res.message, 'error');
      }
    } catch (e) {
      showToast('Gagal mengubah sesi', 'error');
    } finally {
      showLoading(false);
    }
  }

  // Handle Export Laporan ke PDF / Google Sheets
  async function handleExport(type) {
    const sel = document.getElementById('adminSessionSelect');
    if (!sel || !sel.value) {
      showToast('Silakan pilih sesi kegiatan terlebih dahulu', 'error');
      return;
    }

    const sessionId = sel.value;
    showLoading(true, `Sedang mengenerate file ${type.toUpperCase()} di Google Drive...`);
    try {
      let res;
      if (type === 'pdf') {
        res = await runServer('apiExportReportPdf', AppState.token, sessionId);
      } else {
        res = await runServer('apiExportReportSpreadsheet', AppState.token, sessionId);
      }

      if (res.success && res.data && res.data.url) {
        showToast(res.message, 'success');
        // Buka file yang dihasilkan di tab baru
        window.open(res.data.url, '_blank');
      } else {
        showToast(res.message || 'Gagal mengekspor laporan', 'error');
      }
    } catch (e) {
      showToast('Terjadi kesalahan saat mengekspor: ' + e.message, 'error');
    } finally {
      showLoading(false);
    }
  }
  // ==========================================
  // LOGIKA TAB & CRUD SUPER ADMIN UI
  // ==========================================
  function switchAdminTab(tab) {
    const tabMonitoring = document.getElementById('adminTabMonitoring');
    const tabMembers = document.getElementById('adminTabMembers');
    const tabSpreadsheet = document.getElementById('adminTabSpreadsheet');
    const btnMonitoring = document.getElementById('tabBtnMonitoring');
    const btnMembers = document.getElementById('tabBtnMembers');
    const btnSpreadsheet = document.getElementById('tabBtnSpreadsheet');

    // Reset All Tabs
    [tabMonitoring, tabMembers, tabSpreadsheet].forEach(t => { if (t) t.classList.add('hidden'); });
    [btnMonitoring, btnMembers, btnSpreadsheet].forEach(b => {
      if (b) b.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all';
    });

    if (tab === 'monitoring') {
      tabMonitoring.classList.remove('hidden');
      btnMonitoring.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white shadow transition-all';
    } else if (tab === 'spreadsheet') {
      tabSpreadsheet.classList.remove('hidden');
      btnSpreadsheet.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white shadow transition-all';
      loadSpreadsheetDashboardData();
    } else {
      tabMembers.classList.remove('hidden');
      btnMembers.className = 'px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white shadow transition-all';
      loadAdminMembersList();
    }
  }

  // Buka Google Spreadsheet di tab baru
  async function handleOpenMainSpreadsheet() {
    showLoading(true, 'Mengambil link Google Spreadsheet...');
    try {
      const res = await runServer('apiGetSpreadsheetUrl', AppState.token);
      if (res.success && res.data && res.data.url) {
        window.open(res.data.url, '_blank');
      } else {
        showToast(res.message || 'Gagal membuka Spreadsheet', 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // ==========================================
  // LOGIKA PUSAT DATA GOOGLE SPREADSHEET (TAB 3)
  // ==========================================
  let currentSpreadsheetData = { kehadiran: [], izin_sakit: [], rekapitulasi: [] };
  let activeSpreadsheetSubTab = 'kehadiran';

  async function loadSpreadsheetDashboardData() {
    showLoading(true, 'Menyinkronkan data dari Google Spreadsheet...');
    try {
      const res = await runServer('apiGetSpreadsheetDashboardData', AppState.token);
      if (res.success && res.data) {
        currentSpreadsheetData = res.data;
        renderSpreadsheetSubTab();
      } else {
        showToast(res.message || 'Gagal memuat data spreadsheet', 'error');
      }
    } catch (e) {
      showToast('Error sinkronisasi: ' + e.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  function switchSpreadsheetSubTab(subTab) {
    activeSpreadsheetSubTab = subTab;
    ['subTabBtnKehadiran', 'subTabBtnIzin', 'subTabBtnRekap'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.className = 'px-3 py-1.5 font-bold rounded-lg text-slate-600 hover:bg-slate-100';
    });

    const activeBtn = subTab === 'kehadiran' ? 'subTabBtnKehadiran' :
      subTab === 'izin' ? 'subTabBtnIzin' : 'subTabBtnRekap';
    const b = document.getElementById(activeBtn);
    if (b) b.className = 'px-3 py-1.5 font-bold rounded-lg bg-blue-600 text-white shadow-sm';

    renderSpreadsheetSubTab();
  }

  function renderSpreadsheetSubTab() {
    const thead = document.getElementById('spreadsheetThead');
    const tbody = document.getElementById('spreadsheetTbody');
    const searchVal = document.getElementById('spreadsheetSearchInput').value.toLowerCase().trim();
    const dateVal = document.getElementById('spreadsheetDateFilter').value;

    let items = [];
    if (activeSpreadsheetSubTab === 'kehadiran') {
      items = currentSpreadsheetData.kehadiran || [];
      thead.innerHTML = `
        <tr>
          <th class="p-3">Nama Anggota</th>
          <th class="p-3">Divisi</th>
          <th class="p-3">Kegiatan / Sesi</th>
          <th class="p-3">Tanggal & Jam</th>
          <th class="p-3">Status</th>
          <th class="p-3">Jarak</th>
          <th class="p-3">Foto Selfie</th>
        </tr>
      `;
    } else if (activeSpreadsheetSubTab === 'izin') {
      items = currentSpreadsheetData.izin_sakit || [];
      thead.innerHTML = `
        <tr>
          <th class="p-3">Nama Anggota</th>
          <th class="p-3">Divisi</th>
          <th class="p-3">Jenis Izin</th>
          <th class="p-3">Alasan</th>
          <th class="p-3">Bukti</th>
          <th class="p-3">Status Pengajuan</th>
          <th class="p-3">Diproses Oleh</th>
        </tr>
      `;
    } else {
      items = currentSpreadsheetData.rekapitulasi || [];
      thead.innerHTML = `
        <tr>
          <th class="p-3">Kegiatan / Sesi</th>
          <th class="p-3">Tanggal</th>
          <th class="p-3">Target</th>
          <th class="p-3 text-emerald-600">Hadir</th>
          <th class="p-3 text-amber-600">Terlambat</th>
          <th class="p-3 text-blue-600">Izin/Sakit</th>
          <th class="p-3 text-rose-600">Belum Absen</th>
          <th class="p-3">Persentase</th>
        </tr>
      `;
    }

    // Filter data
    const filtered = items.filter(row => {
      const matchSearch = !searchVal || Object.values(row).some(v => String(v).toLowerCase().includes(searchVal));
      const matchDate = !dateVal || Object.values(row).some(v => String(v).includes(dateVal));
      return matchSearch && matchDate;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-slate-400">Tidak ada data ditemukan.</td></tr>';
      return;
    }

    if (activeSpreadsheetSubTab === 'kehadiran') {
      tbody.innerHTML = filtered.map(r => `
        <tr class="hover:bg-slate-50">
          <td class="p-3 font-bold text-slate-800">${r['Nama Lengkap'] || '-'} <br><span class="text-[10px] text-slate-400">${r['Nomor Anggota (NIM/ID)'] || '-'}</span></td>
          <td class="p-3 text-slate-600">${r['Divisi'] || '-'}</td>
          <td class="p-3 text-slate-600">${r['Nama Kegiatan'] || '-'} <span class="text-slate-400">&bull;</span> ${r['Sesi Kegiatan'] || '-'}</td>
          <td class="p-3 text-slate-500">${r['Tanggal Kehadiran'] || '-'} ${r['Jam Check-in'] || ''}</td>
          <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${r['Status Kehadiran'] === 'HADIR' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${r['Status Kehadiran'] || 'HADIR'}</span></td>
          <td class="p-3 text-slate-500">${r['Jarak GPS (meter)'] ? r['Jarak GPS (meter)'] + 'm' : '-'}</td>
          <td class="p-3">${r['URL Foto Selfie'] ? `<a href="${r['URL Foto Selfie']}" target="_blank" class="text-blue-600 hover:underline">Lihat Foto</a>` : '-'}</td>
        </tr>
      `).join('');
    } else if (activeSpreadsheetSubTab === 'izin') {
      tbody.innerHTML = filtered.map(r => `
        <tr class="hover:bg-slate-50">
          <td class="p-3 font-bold text-slate-800">${r['Nama Lengkap'] || '-'}</td>
          <td class="p-3 text-slate-600">${r['Divisi'] || '-'}</td>
          <td class="p-3 font-semibold text-blue-600">${r['Jenis Izin'] || 'IZIN'}</td>
          <td class="p-3 text-slate-600 max-w-xs truncate">${r['Alasan Izin'] || '-'}</td>
          <td class="p-3">${r['URL Bukti Pendukung'] ? `<a href="${r['URL Bukti Pendukung']}" target="_blank" class="text-blue-600 hover:underline">Lihat Bukti</a>` : '-'}</td>
          <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${r['Status Pengajuan'] === 'DISETUJUI' ? 'bg-emerald-100 text-emerald-700' : r['Status Pengajuan'] === 'DITOLAK' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}">${r['Status Pengajuan'] || 'MENUNGGU'}</span></td>
          <td class="p-3 text-slate-500">${r['Nama Operator'] || '-'}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = filtered.map(r => `
        <tr class="hover:bg-slate-50">
          <td class="p-3 font-bold text-slate-800">${r['Nama Kegiatan'] || '-'} <span class="text-slate-400">&bull;</span> ${r['Sesi Kegiatan'] || '-'}</td>
          <td class="p-3 text-slate-500">${r['Tanggal'] || '-'}</td>
          <td class="p-3 font-semibold text-slate-700">${r['Total Target Anggota'] || 0}</td>
          <td class="p-3 font-bold text-emerald-600">${r['Hadir'] || 0}</td>
          <td class="p-3 font-bold text-amber-600">${r['Terlambat'] || 0}</td>
          <td class="p-3 font-semibold text-blue-600">${(Number(r['Izin'] || 0) + Number(r['Sakit'] || 0))}</td>
          <td class="p-3 font-bold text-rose-600">${r['Belum Absen'] || 0}</td>
          <td class="p-3 font-extrabold text-slate-900">${r['Persentase Kehadiran (%)'] || 0}%</td>
        </tr>
      `).join('');
    }
  }

  function filterSpreadsheetTable() {
    renderSpreadsheetSubTab();
  }

  function resetSpreadsheetFilter() {
    document.getElementById('spreadsheetSearchInput').value = '';
    document.getElementById('spreadsheetDateFilter').value = '';
    renderSpreadsheetSubTab();
  }

  async function handleResyncAll() {
    showLoading(true, 'Menjalankan sinkronisasi ulang seluruh data ke Spreadsheet...');
    try {
      const res = await runServer('apiResyncSpreadsheet', AppState.token);
      if (res.success) {
        showToast(res.message, 'success');
        loadSpreadsheetDashboardData();
      } else {
        showToast(res.message || 'Gagal sinkron ulang', 'error');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // MODAL BUAT SESI
  function openModalCreateSession() {
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const dateInput = document.getElementById('newSessionDate');
    if (dateInput) dateInput.value = localDate;
    const errBox = document.getElementById('createSessionErrorBox');
    if (errBox) {
      errBox.classList.add('hidden');
      errBox.innerText = '';
    }
    document.getElementById('modalCreateSession').classList.remove('hidden');
  }

  function closeModalCreateSession() {
    const errBox = document.getElementById('createSessionErrorBox');
    if (errBox) {
      errBox.classList.add('hidden');
      errBox.innerText = '';
    }
    document.getElementById('modalCreateSession').classList.add('hidden');
  }

  function detectCurrentLocationForForm() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          document.getElementById('newLatitude').value = pos.coords.latitude;
          document.getElementById('newLongitude').value = pos.coords.longitude;
          showToast('Koordinat GPS berhasil dikunci!', 'success');
        },
        err => showToast('Gagal membaca GPS: ' + err.message, 'error')
      );
    }
  }

  async function handleFormCreateSession(e) {
    e.preventDefault();
    const errBox = document.getElementById('createSessionErrorBox');
    if (errBox) {
      errBox.classList.add('hidden');
      errBox.innerText = '';
    }

    if (!AppState.token) {
      const msg = 'Sesi login tidak ditemukan. Silakan login kembali sebagai Super Admin atau Operator.';
      if (errBox) {
        errBox.innerText = msg;
        errBox.classList.remove('hidden');
      }
      showToast(msg, 'error');
      showView('viewLogin');
      return;
    }

    const eventName = document.getElementById('newEventName').value.trim();
    const sessionName = document.getElementById('newSessionName').value.trim();
    const sessionDate = document.getElementById('newSessionDate').value;
    const startTime = document.getElementById('newStartTime').value || '08:00';
    const endTime = document.getElementById('newEndTime').value || '17:00';
    const lateAfter = Number(document.getElementById('newLateAfter').value) || 15;
    const geofenceRadius = Number(document.getElementById('newGeofenceRadius').value) || 100;
    const lat = document.getElementById('newLatitude').value.trim();
    const lon = document.getElementById('newLongitude').value.trim();

    if (!eventName) {
      const msg = 'Nama kegiatan wajib diisi!';
      if (errBox) { errBox.innerText = msg; errBox.classList.remove('hidden'); }
      showToast(msg, 'error');
      return;
    }
    if (!sessionName) {
      const msg = 'Nama sesi wajib diisi!';
      if (errBox) { errBox.innerText = msg; errBox.classList.remove('hidden'); }
      showToast(msg, 'error');
      return;
    }
    if (!sessionDate) {
      const msg = 'Tanggal kegiatan wajib diisi!';
      if (errBox) { errBox.innerText = msg; errBox.classList.remove('hidden'); }
      showToast(msg, 'error');
      return;
    }

    if (startTime === endTime) {
      const msg = 'Jam mulai dan jam selesai tidak boleh sama. Silakan perbaiki jadwal kegiatan.';
      if (errBox) { errBox.innerText = msg; errBox.classList.remove('hidden'); }
      showToast(msg, 'error');
      return;
    }

    showLoading(true, 'Menyimpan kegiatan dan membuka sesi...');
    const payload = {
      event_name: eventName,
      session_name: sessionName,
      session_date: sessionDate,
      start_time: startTime,
      end_time: endTime,
      late_after: lateAfter,
      geofence_radius_m: geofenceRadius,
      latitude: lat,
      longitude: lon
    };

    console.log('[CreateSession] Sending payload:', payload);

    try {
      const res = await runServer('apiCreateEventAndSession', AppState.token, payload);
      console.log('[CreateSession] Server response:', res);

      if (res && res.success) {
        closeModalCreateSession();
        document.getElementById('newEventName').value = '';
        document.getElementById('newSessionName').value = '';
        showToast('Sesi kegiatan berhasil dibuat dan langsung DIBUKA!', 'success');

        const createdSessionId = res.data && res.data.session_id;
        if (createdSessionId) {
          AppState.selectedSessionId = createdSessionId;
        }

        try {
          await loadAdminDashboard(createdSessionId, res.data);
        } catch (dashErr) {
          console.warn('[CreateSession] loadAdminDashboard warning:', dashErr);
        }
      } else {
        const errorMsg = (res && res.message) ? res.message : 'Gagal membuat sesi kegiatan.';
        if (errBox) {
          errBox.innerText = 'Peringatan: ' + errorMsg;
          errBox.classList.remove('hidden');
        }
        showToast(errorMsg, 'error');
      }
    } catch (err) {
      console.error('[CreateSession] Error:', err);
      const errMsg = 'Gagal membuat sesi: ' + (err.message || err);
      if (errBox) {
        errBox.innerText = errMsg;
        errBox.classList.remove('hidden');
      }
      showToast(errMsg, 'error');
    } finally {
      showLoading(false);
    }
  }

  // MODAL TAMBAH ANGGOTA
  async function openModalCreateUser() {
    // Muat daftar divisi untuk pilihan dropdown
    try {
      const res = await runServer('apiGetAllDivisions', AppState.token);
      const sel = document.getElementById('newDivisionSelect');
      sel.innerHTML = '<option value="">Tanpa Divisi</option>';
      if (res.success && res.data) {
        res.data.forEach(d => {
          sel.innerHTML += `<option value="${d.division_id}">${d.division_name}</option>`;
        });
      }
    } catch (e) {
      console.error(e);
    }
    document.getElementById('modalCreateUser').classList.remove('hidden');
  }

  function closeModalCreateUser() {
    document.getElementById('modalCreateUser').classList.add('hidden');
  }

  async function handleFormCreateUser(e) {
    e.preventDefault();
    showLoading(true, 'Mendaftarkan anggota baru...');
    const payload = {
      full_name: document.getElementById('newFullName').value,
      username: document.getElementById('newUsername').value,
      member_number: document.getElementById('newMemberNumber').value,
      email: document.getElementById('newEmail').value,
      division_id: document.getElementById('newDivisionSelect').value,
      role: document.getElementById('newRoleSelect').value
    };
    const password = document.getElementById('newUserPassword').value;

    try {
      const res = await runServer('apiCreateUser', AppState.token, payload);
      if (res.success) {
        if (password && res.data && res.data.user_id) {
          await runServer('apiSetUserPassword', AppState.token, res.data.user_id, password);
        }
        showToast('Anggota berhasil didaftarkan!', 'success');
        closeModalCreateUser();
        loadAdminMembersList();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err) {
      showToast('Gagal mendaftarkan anggota: ' + err.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // LOAD DAFTAR ANGGOTA DI TAB 2
  async function loadAdminMembersList() {
    const tbody = document.getElementById('adminMembersTbody');
    tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">Memuat anggota...</td></tr>';
    try {
      const res = await runServer('apiGetAllUsers', AppState.token, 1, 100);
      if (res.success && res.data && res.data.data) {
        const users = res.data.data;
        document.getElementById('statTotalUsers').innerText = res.data.totalRows || users.length;
        if (users.length > 0) {
          tbody.innerHTML = users.map(u => `
            <tr class="hover:bg-slate-50">
              <td class="p-3">
                <p class="font-bold text-slate-900">${u.full_name}</p>
                <p class="text-[10px] text-slate-400">${u.member_number || '-'}</p>
              </td>
              <td class="p-3 text-slate-600">${u.username} <span class="text-slate-400">&bull;</span> ${u.email || '-'}</td>
              <td class="p-3 text-slate-500">${u.division_id || '-'}</td>
              <td class="p-3">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
              u.role === 'OPERATOR' ? 'bg-indigo-100 text-indigo-700' :
                'bg-blue-100 text-blue-700'
            }">${u.role}</span>
              </td>
              <td class="p-3">
                <span class="text-[11px] font-bold ${u.status === 'active' ? 'text-emerald-600' : 'text-rose-500'}">
                  ${u.status ? u.status.toUpperCase() : 'ACTIVE'}
                </span>
              </td>
              <td class="p-3">
                <button onclick="handleDeleteMember('${u.user_id}', '${u.full_name}')" class="text-rose-600 hover:text-rose-800 font-bold text-xs">
                  Nonaktifkan
                </button>
              </td>
            </tr>
          `).join('');
        } else {
          tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">Belum ada anggota terdaftar.</td></tr>';
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteMember(userId, name) {
    if (!confirm(`Apakah Anda yakin ingin menonaktifkan anggota ${name}?`)) return;
    showLoading(true, 'Menonaktifkan anggota...');
    try {
      const res = await runServer('apiDeleteUser', AppState.token, userId);
      if (res.success) {
        showToast('Anggota berhasil dinonaktifkan', 'success');
        loadAdminMembersList();
      } else {
        showToast(res.message, 'error');
      }
    } catch (e) {
      showToast('Gagal: ' + e.message, 'error');
    } finally {
      showLoading(false);
    }
  }
