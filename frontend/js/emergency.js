/* ==========================================================================
   CivicPulse - Emergency Complaint JS
   Handles: OTP send, OTP verify, GPS capture, category select, form submit
   ========================================================================== */

const API = 'http://localhost:5000/api';

let emergencyMap;
let emergencyMarker;
let selectedLat = null;
let selectedLon = null;
let selectedCategory = '';
let otpTimerInterval = null;
let resendTimerInterval = null;
let otpVerified = false;

// ── Initialize Leaflet Map for emergency page ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initEmergencyMap();
  startResendTimer(); // Will be activated after OTP send

  // Camera Event Listeners
  const openCameraBtn = document.getElementById('btn-open-camera');
  if (openCameraBtn) {
    openCameraBtn.addEventListener('click', () => {
      const cameraModalEl = document.getElementById('cameraModal');
      const cameraModal = new bootstrap.Modal(cameraModalEl);
      cameraModal.show();
    });
  }

  const cameraModalEl = document.getElementById('cameraModal');
  if (cameraModalEl) {
    cameraModalEl.addEventListener('shown.bs.modal', startCamera);
    cameraModalEl.addEventListener('hidden.bs.modal', stopCamera);
  }

  const captureBtn = document.getElementById('btn-camera-capture');
  if (captureBtn) {
    captureBtn.addEventListener('click', capturePhoto);
  }

  const switchCameraBtn = document.getElementById('btn-switch-camera');
  if (switchCameraBtn) {
    switchCameraBtn.addEventListener('click', toggleCameraFacing);
  }

  // Voice Input listeners for Emergency
  const btnVoiceEmTitle = document.getElementById('btn-voice-em-title');
  if (btnVoiceEmTitle) {
    btnVoiceEmTitle.addEventListener('click', () => startVoiceInput('em-title', 'btn-voice-em-title'));
  }
  const btnVoiceEmDesc = document.getElementById('btn-voice-em-desc');
  if (btnVoiceEmDesc) {
    btnVoiceEmDesc.addEventListener('click', () => startVoiceInput('em-description', 'btn-voice-em-desc'));
  }
});

function initEmergencyMap() {
  const defaultLat = 12.9716, defaultLon = 77.5946;
  emergencyMap = L.map('emergency-map').setView([defaultLat, defaultLon], 12);

  // Google Maps tiles
  L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps',
    maxZoom: 20
  }).addTo(emergencyMap);

  // Allow clicking map to pin location
  emergencyMap.on('click', (e) => {
    const { lat, lng } = e.latlng;
    setMapPin(lat, lng);
  });
}

/**
 * Set a pin on the map at given coordinates
 */
function setMapPin(lat, lng) {
  selectedLat = lat.toFixed(6);
  selectedLon = lng.toFixed(6);
  document.getElementById('em-lat').value = selectedLat;
  document.getElementById('em-lon').value = selectedLon;

  const icon = L.divIcon({
    html: '<i class="bi bi-geo-alt-fill text-danger" style="font-size:28px;"></i>',
    className: 'custom-map-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  });

  if (emergencyMarker) {
    emergencyMarker.setLatLng([lat, lng]);
  } else {
    emergencyMarker = L.marker([lat, lng], { icon }).addTo(emergencyMap);
  }
  emergencyMap.setView([lat, lng], 15);
}

/**
 * Capture GPS using a parallel race strategy (emergency flow)
 */
function captureGPS() {
  setLocatingState(true);
  if (!navigator.geolocation) {
    fallbackToIPLocation();
    return;
  }

  let settled = false;
  function onPosition(pos) {
    if (settled) return;
    settled = true;
    const { latitude, longitude, accuracy } = pos.coords;
    setMapPin(latitude, longitude);
    const src = accuracy <= 50 ? 'GPS' : accuracy <= 500 ? 'network' : 'approximate';
    showEmAlert(`📍 Location captured via ${src} (±${Math.round(accuracy)}m).`, 'success');
    setLocatingState(false);
  }
  function onError() {
    if (settled) return;
    settled = true;
    fallbackToIPLocation();
  }

  const watchId = navigator.geolocation.watchPosition(onPosition, () => {}, {
    enableHighAccuracy: true,
    timeout: 8000,
    maximumAge: 30000
  });

  navigator.geolocation.getCurrentPosition(onPosition, () => {}, {
    enableHighAccuracy: false,
    timeout: 5000,
    maximumAge: 120000
  });

  setTimeout(() => {
    navigator.geolocation.clearWatch(watchId);
    if (!settled) onError();
  }, 10000);
}

/**
 * Fallback to IP address geolocation lookup for emergency flow
 */
async function fallbackToIPLocation() {
  try {
    const ipRes = await fetch('https://ipapi.co/json/');
    const ipData = await ipRes.json();
    
    if (ipData && ipData.latitude && ipData.longitude) {
      setMapPin(ipData.latitude, ipData.longitude);
      showEmAlert('✅ Location estimated via IP network.', 'success');
      setLocatingState(false);
      return;
    }
    throw new Error('ipapi.co returned invalid or rate-limited response');
  } catch (error) {
    console.warn('First IP location attempt (ipapi.co) failed. Trying secondary IP lookup...', error.message);
    try {
      const ipRes = await fetch('https://ipinfo.io/json');
      const ipData = await ipRes.json();
      if (ipData && ipData.loc) {
        const [latitude, longitude] = ipData.loc.split(',').map(Number);
        setMapPin(latitude, longitude);
        showEmAlert('✅ Location estimated via IP network (backup).', 'success');
        setLocatingState(false);
        return;
      }
      throw new Error('ipinfo.io returned invalid response');
    } catch (err2) {
      console.error('Secondary IP location estimation failed:', err2);
      // Hard fallback to city center (Bangalore)
      setMapPin(12.9716, 77.5946);
      showEmAlert('Could not resolve GPS or IP location. Marker placed at city center. Click map to correct.', 'info');
      setLocatingState(false);
    }
  }
}

/**
 * Helper to update locating spinner state in emergency flow
 */
function setLocatingState(isLocating) {
  const btn = document.querySelector('button[onclick="captureGPS()"]');
  if (!btn) return;
  if (isLocating) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Locating...';
  } else {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-crosshair2 me-1"></i>Use My GPS Location';
  }
}

/**
 * Category selection handler
 */
function selectCategory(el) {
  document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  selectedCategory = el.getAttribute('data-val');
  document.getElementById('em-category').value = selectedCategory;
}

// ── Step navigation helpers ────────────────────────────────────────────────

function showStep(n) {
  ['step-1', 'step-2', 'step-3', 'step-success'].forEach((id, i) => {
    document.getElementById(id).classList.add('d-none');
  });
  if (n === 'success') {
    document.getElementById('step-success').classList.remove('d-none');
  } else {
    document.getElementById(`step-${n}`).classList.remove('d-none');
  }
  updateStepDots(n);

  if (typeof applyTranslations === 'function') {
    applyTranslations(localStorage.getItem('lang') || 'en');
  }
}

function updateStepDots(activeStep) {
  const steps = [1, 2, 3];
  steps.forEach(s => {
    const dot = document.getElementById(`dot-${s}`);
    if (!dot) return;
    dot.classList.remove('active', 'done');
    if (s < activeStep) dot.classList.add('done'), (dot.innerHTML = '<i class="bi bi-check-lg"></i>');
    else if (s === activeStep) dot.classList.add('active'), (dot.innerHTML = s);
    else dot.innerHTML = s;

    const line = document.getElementById(`line-${s}`);
    if (line) line.classList.toggle('done', s < activeStep);
  });
}

// ── STEP 1: Send OTP ──────────────────────────────────────────────────────

async function sendOtp() {
  const emailTab = document.getElementById('email-tab');
  const isEmail = emailTab && emailTab.classList.contains('active');
  let email = '';
  let phone = '';

  if (isEmail) {
    email = document.getElementById('em-email').value.trim();
    if (!email) {
      showEmAlert('Please enter your email address.', 'danger'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showEmAlert('Please enter a valid email address.', 'danger'); return;
    }
  } else {
    phone = document.getElementById('em-phone').value.trim();
    if (!phone) {
      showEmAlert('Please enter your phone number.', 'danger'); return;
    }
    if (!/^\d{10}$/.test(phone)) {
      showEmAlert('Please enter a valid 10-digit phone number.', 'danger'); return;
    }
  }

  const btn = document.getElementById('btn-send-otp');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending OTP...';

  try {
    const payload = isEmail ? { email } : { phone };
    const res = await fetch(`${API}/emergency/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      const targetLabel = isEmail ? email : phone;
      document.getElementById('otp-target-email').textContent = targetLabel;
      
      // If server returned OTP (development/demo mode), show a clear Toast notification with the OTP code
      if (data.otp) {
        showEmAlert(`🔑 Demo Mode: Your OTP is ${data.otp}. (It is also logged in the server console)`, 'info');
      } else {
        showEmAlert(`OTP sent to ${targetLabel}.`, 'success');
      }

      showStep(2);
      startOtpTimer();
      startResendCountdown();
      // Auto-focus first OTP box
      setTimeout(() => {
        const firstBox = document.querySelectorAll('.otp-digit')[0];
        if (firstBox) firstBox.focus();
      }, 200);
    } else {
      showEmAlert(data.message || 'Failed to send OTP.', 'danger');
    }
  } catch (e) {
    showEmAlert('Could not reach the server. Make sure the backend is running.', 'danger');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-lightning-fill me-2"></i>Send OTP Code';
  }
}

// ── OTP Input Handling ─────────────────────────────────────────────────────

function otpInput(el) {
  el.value = el.value.replace(/\D/g, ''); // digits only
  if (el.value.length === 1) {
    el.classList.add('filled');
    const next = document.querySelector(`.otp-digit[data-idx="${parseInt(el.dataset.idx) + 1}"]`);
    if (next) next.focus();
  } else {
    el.classList.remove('filled');
  }
}

function otpKeydown(e, el) {
  if (e.key === 'Backspace' && !el.value) {
    const prev = document.querySelector(`.otp-digit[data-idx="${parseInt(el.dataset.idx) - 1}"]`);
    if (prev) { prev.value = ''; prev.classList.remove('filled'); prev.focus(); }
  }
  // Allow pasting full 6-digit OTP
  if (e.key === 'v' && (e.ctrlKey || e.metaKey)) return;
}

// Handle paste of full OTP
document.addEventListener('paste', (e) => {
  const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
  if (text.length === 6) {
    document.querySelectorAll('.otp-digit').forEach((input, i) => {
      input.value = text[i] || '';
      input.classList.toggle('filled', !!text[i]);
    });
  }
});

function getOtpValue() {
  return Array.from(document.querySelectorAll('.otp-digit')).map(i => i.value).join('');
}

// ── STEP 2: Verify OTP ────────────────────────────────────────────────────

async function verifyOtp() {
  const otp = getOtpValue();
  if (otp.length !== 6) {
    showEmAlert('Please enter the complete 6-digit OTP.', 'danger'); return;
  }

  const btn = document.getElementById('btn-verify-otp');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...';

  try {
    otpVerified = true;
    clearInterval(otpTimerInterval);
    showStep(3);
    // Invalidate map size and trigger automatic location capture
    setTimeout(() => { 
      if (emergencyMap) emergencyMap.invalidateSize(); 
      captureGPS(); // Automatically locate emergency user
    }, 300);
  } catch (e) {
    showEmAlert('Error verifying OTP. Try again.', 'danger');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>Verify OTP & Continue';
  }
}

// ── STEP 3: Submit Emergency Complaint ────────────────────────────────────

async function submitEmergency() {
  const title       = document.getElementById('em-title').value.trim();
  const description = document.getElementById('em-description').value.trim();
  const otp         = getOtpValue();
  
  const emailTab    = document.getElementById('email-tab');
  const isEmail     = emailTab && emailTab.classList.contains('active');
  const email       = isEmail ? document.getElementById('em-email').value.trim() : '';
  const phone       = !isEmail ? document.getElementById('em-phone').value.trim() : '';
  const imageFile   = document.getElementById('em-image').files[0];

  if (!selectedCategory) { showEmAlert('Please select an issue category.', 'danger'); return; }
  if (!title)             { showEmAlert('Please enter a complaint title.', 'danger'); return; }
  if (!description)       { showEmAlert('Please describe the emergency.', 'danger'); return; }
  if (!selectedLat || !selectedLon) { showEmAlert('Please pin the location on the map.', 'danger'); return; }

  const btn = document.getElementById('btn-submit-emergency');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';

  const formData = new FormData();
  formData.append('otpCode',     otp);
  formData.append('name',        'Emergency User');
  if (email) {
    formData.append('email',     email);
    formData.append('phone',     '0000000000');
  } else if (phone) {
    formData.append('phone',     phone);
  }
  formData.append('title',       title);
  formData.append('description', description);
  formData.append('category',    selectedCategory);
  formData.append('latitude',    selectedLat);
  formData.append('longitude',   selectedLon);
  if (imageFile) formData.append('image', imageFile);

  try {
    const res = await fetch(`${API}/emergency/submit`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById('success-complaint-id').textContent = data.data.complaintId;
      document.getElementById('btn-track-success').onclick = () => {
        window.location.href = `complaint-details.html?ref=${data.data.complaintId}`;
      };
      updateStepDots('success');
      showStep('success');
    } else {
      showEmAlert(data.message || 'Submission failed. Please try again.', 'danger');
    }
  } catch (e) {
    showEmAlert('Could not reach the server. Make sure the backend is running.', 'danger');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-send-fill me-2"></i>Submit Emergency Complaint';
  }
}

// ── Resend OTP ─────────────────────────────────────────────────────────────
async function resendOtp() {
  document.querySelectorAll('.otp-digit').forEach(i => { i.value = ''; i.classList.remove('filled'); });
  document.getElementById('btn-resend').disabled = true;
  await sendOtp();
  startResendCountdown();
}

// ── Timers ─────────────────────────────────────────────────────────────────

function startOtpTimer() {
  let seconds = 600; // 10 minutes
  clearInterval(otpTimerInterval);
  otpTimerInterval = setInterval(() => {
    seconds--;
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    const el = document.getElementById('otp-timer');
    if (el) el.textContent = `⏱ OTP valid for ${m}:${s}`;
    if (seconds <= 0) {
      clearInterval(otpTimerInterval);
      if (el) el.textContent = '❌ OTP expired — please resend.';
    }
  }, 1000);
}

function startResendCountdown() {
  let sec = 30;
  clearInterval(resendTimerInterval);
  const btn  = document.getElementById('btn-resend');
  const span = document.getElementById('resend-timer');
  if (btn) btn.disabled = true;
  resendTimerInterval = setInterval(() => {
    sec--;
    if (span) span.textContent = `(${sec}s)`;
    if (sec <= 0) {
      clearInterval(resendTimerInterval);
      if (btn) btn.disabled = false;
      if (span) span.textContent = '';
    }
  }, 1000);
}

// ── Alert helper ──────────────────────────────────────────────────────────

function showEmAlert(msg, type = 'danger') {
  // Use the common showToast from common.js if available
  if (typeof showToast === 'function') {
    showToast(msg, type);
  } else {
    alert(msg);
  }
}

// Camera state variables
let cameraStream = null;
let currentFacingMode = 'environment'; // Default to back camera for environment reports

/**
 * Start video stream from the user's camera
 */
async function startCamera() {
  const video = document.getElementById('camera-stream');
  const loader = document.getElementById('camera-loader');
  const switchBtn = document.getElementById('btn-switch-camera');
  
  if (loader) loader.classList.remove('d-none');
  
  try {
    const constraints = {
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };
    
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    if (video) {
      video.srcObject = cameraStream;
      video.onloadedmetadata = () => {
        if (loader) loader.classList.add('d-none');
      };
    }
    
    // Check if there are multiple video inputs to show switch button
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    if (videoDevices.length > 1) {
      if (switchBtn) switchBtn.classList.remove('d-none');
    }
  } catch (err) {
    console.error('Camera access error:', err);
    if (loader) {
      loader.innerHTML = `
        <i class="bi bi-exclamation-triangle-fill text-danger fs-3 mb-2 d-block"></i>
        <div class="text-danger small">Camera permission denied or unavailable.</div>
      `;
    }
    showEmAlert('Could not access camera. Please check browser permissions.', 'danger');
  }
}

/**
 * Stop active camera video stream
 */
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  const video = document.getElementById('camera-stream');
  if (video) video.srcObject = null;
}

/**
 * Switch between front (user) and back (environment) camera
 */
function toggleCameraFacing() {
  currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
  const video = document.getElementById('camera-stream');
  if (video) {
    if (currentFacingMode === 'user') {
      video.style.transform = 'scaleX(-1)'; // Mirror front camera
    } else {
      video.style.transform = 'scaleX(1)';
    }
  }
  startCamera();
}

/**
 * Capture frame from video, convert to File and bind to input
 */
function capturePhoto() {
  const video = document.getElementById('camera-stream');
  const canvas = document.getElementById('camera-canvas');
  
  if (!video || !canvas || !cameraStream) {
    showEmAlert('Camera is not active yet.', 'warning');
    return;
  }
  
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  
  // Draw current frame from video onto canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  canvas.toBlob((blob) => {
    if (blob) {
      // Create a File object from the blob
      const file = new File([blob], `live_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      // Programmatically assign file to input element using DataTransfer API
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      const fileInput = document.getElementById('em-image');
      if (fileInput) {
        fileInput.files = dataTransfer.files;
      }
      
      showEmAlert('Photo captured successfully!', 'success');
      
      // Close modal
      const cameraModalEl = document.getElementById('cameraModal');
      const modalInstance = bootstrap.Modal.getInstance(cameraModalEl);
      if (modalInstance) modalInstance.hide();
    }
  }, 'image/jpeg', 0.9);
}

/**
 * Speech Recognition / Dictation trigger
 */
let activeEmRecognition = null;

function startVoiceInput(targetInputId, buttonId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showEmAlert('Voice input is not supported in this browser. Try Chrome or Edge.', 'danger');
    return;
  }

  if (activeEmRecognition) {
    activeEmRecognition.stop();
    activeEmRecognition = null;
    return;
  }

  const btn = document.getElementById(buttonId);
  const input = document.getElementById(targetInputId);
  if (!btn || !input) return;

  const recognition = new SpeechRecognition();
  activeEmRecognition = recognition;

  const activeLang = localStorage.getItem('lang') || 'en';
  const langMap = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN', ta: 'ta-IN', te: 'te-IN', ml: 'ml-IN' };
  recognition.lang = langMap[activeLang] || 'en-IN';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  const originalHtml = btn.innerHTML;
  let silenceTimer = null;
  let hasResult = false;

  function restoreBtn() {
    btn.innerHTML = originalHtml;
    btn.classList.remove('btn-danger', 'text-white');
    btn.classList.add('btn-outline-danger');
    activeEmRecognition = null;
    if (silenceTimer) clearTimeout(silenceTimer);
  }

  recognition.onstart = () => {
    btn.innerHTML = '<i class="bi bi-mic-fill text-danger"></i> <span class="spinner-grow spinner-grow-sm text-danger" role="status"></span>';
    btn.classList.add('btn-danger', 'text-white');
    btn.classList.remove('btn-outline-danger');
    showEmAlert('🎤 Listening… speak now.', 'info');
    silenceTimer = setTimeout(() => { if (!hasResult) recognition.stop(); }, 10000);
  };

  recognition.onresult = (event) => {
    hasResult = true;
    if (silenceTimer) clearTimeout(silenceTimer);
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
    }
    if (finalTranscript.trim()) {
      input.value = (input.value ? input.value + ' ' : '') + finalTranscript.trim();
      showEmAlert('✅ Speech captured successfully!', 'success');
    }
  };

  recognition.onerror = (e) => {
    restoreBtn();
    if (e.error === 'not-allowed') {
      showEmAlert('Microphone blocked. Enable mic in browser settings (🔒 padlock icon).', 'warning');
    } else if (e.error === 'no-speech') {
      showEmAlert('No speech detected. Please try again and speak clearly.', 'warning');
    } else if (e.error === 'network') {
      showEmAlert('Network error during speech recognition. Note: Brave browser disables Google Speech Recognition by default. Please enable "Google Services for Speech Recognition" in Brave settings or try Chrome/Edge.', 'danger');
    } else {
      showEmAlert(`Recognition error: ${e.error}. Please try again.`, 'warning');
    }
  };

  recognition.onend = () => { restoreBtn(); };

  // Start Speech Recognition directly
  try {
    recognition.start();
  } catch (err) {
    console.error('Speech recognition start failed:', err);
    activeEmRecognition = null;
  }
}
