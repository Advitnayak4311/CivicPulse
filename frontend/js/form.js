/* ==========================================================================
   Smart Civic Issues Monitoring and Response System - Form Submission Script
   ========================================================================== */

let pickerMap;
let pickerMarker;
let duplicateComplaintId = null; // Stores target duplicate mongo _id
let bypassDuplicateCheck = false;

// Camera state variables
let cameraStream = null;
let currentFacingMode = 'environment'; // Default to back camera for environment reports

document.addEventListener('DOMContentLoaded', () => {
  // Protect route
  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');
  if (!user || !token || user.role !== 'citizen') {
    window.location.href = 'login.html';
    return;
  }

  // Initialize Map Picker
  initPickerMap();

  // Trigger location capture automatically on page load
  captureGPS();

  // GPS Auto-Capture Button
  document.getElementById('btn-auto-gps').addEventListener('click', captureGPS);

  // File Upload Preview & Removers
  document.getElementById('image').addEventListener('change', handleImageSelect);
  document.getElementById('btn-remove-photo').addEventListener('click', removePhoto);

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

  // Form Submit Handler
  document.getElementById('complaint-submit-form').addEventListener('submit', handleSubmit);

  // Duplicate Action Buttons
  document.getElementById('btn-support-duplicate').addEventListener('click', supportExistingComplaint);
  document.getElementById('btn-bypass-duplicate').addEventListener('click', () => {
    bypassDuplicateCheck = true;
    document.getElementById('duplicate-warning-box').classList.add('d-none');
    showToast('Duplicate check bypassed. Ready to file.', 'info');
  });

  // Voice Input listeners
  const btnVoiceTitle = document.getElementById('btn-voice-title');
  if (btnVoiceTitle) {
    btnVoiceTitle.addEventListener('click', () => startVoiceInput('title', 'btn-voice-title'));
  }
  const btnVoiceDesc = document.getElementById('btn-voice-desc');
  if (btnVoiceDesc) {
    btnVoiceDesc.addEventListener('click', () => startVoiceInput('description', 'btn-voice-desc'));
  }

  // AI Suggestions bindings
  document.getElementById('title').addEventListener('input', analyzeTextForAISuggestions);
  document.getElementById('description').addEventListener('input', analyzeTextForAISuggestions);
  document.getElementById('btn-apply-ai').addEventListener('click', applyAISuggestions);
});

/**
 * Initialize Leaflet Picker Map
 */
function initPickerMap() {
  const defaultLat = 12.9716;
  const defaultLon = 77.5946;

  pickerMap = L.map('map-picker').setView([defaultLat, defaultLon], 13);

  // Google Maps Roadmap tiles (Google Maps style - 100% free)
  L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps',
    maxZoom: 20
  }).addTo(pickerMap);

  // Set default starting point coordinates in form inputs before click
  document.getElementById('latitude').value = defaultLat.toFixed(6);
  document.getElementById('longitude').value = defaultLon.toFixed(6);

  // Listen to clicks on map
  pickerMap.on('click', (e) => {
    const { lat, lng } = e.latlng;
    setCoords(lat, lng);
  });
}

/**
 * Update coordinates in form inputs and place marker
 */
function setCoords(lat, lon) {
  const roundedLat = Number(lat).toFixed(6);
  const roundedLon = Number(lon).toFixed(6);
  
  document.getElementById('latitude').value = roundedLat;
  document.getElementById('longitude').value = roundedLon;

  const pickerIcon = L.divIcon({
    html: '<i class="bi bi-geo-alt-fill text-danger fs-2"></i>',
    className: 'custom-map-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 24]
  });

  if (pickerMarker) {
    pickerMarker.setLatLng([lat, lon]);
  } else {
    pickerMarker = L.marker([lat, lon], { icon: pickerIcon, draggable: true }).addTo(pickerMap);
    // Allow users to drag-refine the pin position
    pickerMarker.on('dragend', (e) => {
      const { lat: newLat, lng: newLon } = e.target.getLatLng();
      document.getElementById('latitude').value = newLat.toFixed(6);
      document.getElementById('longitude').value = newLon.toFixed(6);
      updateGpsStatus(`📍 Pin moved to (${newLat.toFixed(4)}, ${newLon.toFixed(4)})`, 'gps-success');
    });
  }

  pickerMap.panTo([lat, lon]);
}

/**
 * Capture GPS with permission-first flow:
 * 1. Check if permission is already denied (show guidance)
 * 2. Try high-accuracy GPS
 * 3. If slow/fails, try low-accuracy network location
 * 4. Fallback to IP geolocation
 */
async function captureGPS() {
  setLocatingState(true);
  updateGpsStatus('Requesting location...', '');

  if (!navigator.geolocation) {
    updateGpsStatus('GPS not supported in this browser.', 'gps-error');
    fallbackToIPLocation();
    return;
  }

  // Check browser permission status before prompting
  if (navigator.permissions) {
    try {
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      if (perm.state === 'denied') {
        updateGpsStatus('❌ Location blocked. Enable in browser settings (🔒 address bar).', 'gps-error');
        showToast(
          '📍 Location access is blocked. Click the 🔒 padlock in the address bar → Site settings → Allow Location, then try again.',
          'danger'
        );
        setLocatingState(false);
        return;
      }
    } catch (e) {
      // permissions API not supported, proceed normally
    }
  }

  // Try high-accuracy GPS with reasonable timeout
  const tryHighAccuracy = () => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000
    });
  });

  // Fallback: network/cell-tower based (faster, less accurate)
  const tryNetworkLocation = () => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 120000
    });
  });

  try {
    let pos;
    try {
      pos = await tryHighAccuracy();
    } catch (highAccErr) {
      if (highAccErr.code === 1) {
        // Permission denied
        updateGpsStatus('❌ Location access denied. Enable in browser settings.', 'gps-error');
        showToast('📍 Location blocked. Open 🔒 address bar → Site settings → Allow Location.', 'danger');
        setLocatingState(false);
        return;
      }
      // TIMEOUT or UNAVAILABLE → try network location
      pos = await tryNetworkLocation();
    }

    const { latitude, longitude, accuracy } = pos.coords;
    setCoords(latitude, longitude);
    const src = accuracy <= 50 ? 'GPS' : accuracy <= 500 ? 'network' : 'approximate';
    const label = `📍 ${src} location (±${Math.round(accuracy)}m)`;
    updateGpsStatus(`✅ ${label} — You can drag the pin to refine.`, 'gps-success');
    showToast(label + ' captured successfully!', 'success');
    setLocatingState(false);

  } catch (err) {
    console.warn('GPS failed, falling back to IP location:', err);
    updateGpsStatus('⚠️ GPS unavailable. Estimating via IP...', '');
    fallbackToIPLocation();
  }
}

/**
 * Update the GPS status display element if it exists
 */
function updateGpsStatus(msg, cssClass) {
  const el = document.getElementById('gps-status-display');
  if (!el) return;
  el.textContent = msg;
  el.className = '';
  if (cssClass) el.classList.add(cssClass);
}

/**
 * Fallback to IP address geolocation lookup
 */
async function fallbackToIPLocation() {
  try {
    const ipRes = await fetch('https://ipapi.co/json/');
    const ipData = await ipRes.json();
    
    if (ipData && ipData.latitude && ipData.longitude) {
      setCoords(ipData.latitude, ipData.longitude);
      showToast('Location estimated via IP network.', 'success');
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
        setCoords(latitude, longitude);
        showToast('Location estimated via IP network (backup).', 'success');
        setLocatingState(false);
        return;
      }
      throw new Error('ipinfo.io returned invalid response');
    } catch (err2) {
      console.error('Secondary IP location estimation failed:', err2);
      // Hard fallback to city center (Bangalore)
      setCoords(12.9716, 77.5946);
      showToast('Could not resolve GPS or IP location. Marker placed at city center. Drag or click map to correct.', 'info');
      setLocatingState(false);
    }
  }
}

/**
 * Helper to update locating spinner state
 */
function setLocatingState(isLocating) {
  const btn = document.getElementById('btn-auto-gps');
  if (!btn) return;
  if (isLocating) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Locating...';
  } else {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-cursor-fill me-1"></i>Use GPS Location';
  }
}

/**
 * Display Image Preview and Check size limit
 */
function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Validate File Size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast('File size exceeds the 5MB limit.', 'warning');
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = function (event) {
    const previewImg = document.getElementById('image-preview');
    const previewContainer = document.getElementById('image-preview-container');
    
    previewImg.src = event.target.result;
    previewContainer.classList.remove('d-none');
  };
  reader.readAsDataURL(file);
}

/**
 * Reset photo attachment inputs
 */
function removePhoto() {
  document.getElementById('image').value = '';
  document.getElementById('image-preview-container').classList.add('d-none');
  document.getElementById('image-preview').src = '#';
}

/**
 * Submit Form handler
 */
async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;

  // Perform bootstrap standard validation checks
  if (!form.checkValidity()) {
    e.stopPropagation();
    form.classList.add('was-validated');
    showToast('Please check the required fields', 'warning');
    return;
  }

  const title = document.getElementById('title').value.trim();
  const category = document.getElementById('category').value;
  const priority = document.getElementById('priority').value;
  const description = document.getElementById('description').value.trim();
  const latitude = document.getElementById('latitude').value;
  const longitude = document.getElementById('longitude').value;
  const fileInput = document.getElementById('image');

  if (!latitude || !longitude) {
    showToast('Please select a location on the map first.', 'warning');
    return;
  }

  try {
    // 1. Run Duplicate check if not bypassed
    if (!bypassDuplicateCheck) {
      const dupCheck = await apiRequest('/complaints/check-duplicate', {
        method: 'POST',
        body: JSON.stringify({ category, latitude, longitude })
      });

      if (dupCheck.success && dupCheck.hasDuplicate) {
        // Show Duplicate Warning Alert
        const dupItem = dupCheck.duplicates[0].complaint;
        const dist = dupCheck.duplicates[0].distance;

        duplicateComplaintId = dupItem._id;
        
        document.getElementById('duplicate-title').innerText = dupItem.title;
        document.getElementById('duplicate-desc').innerText = dupItem.description;
        document.getElementById('duplicate-status').innerText = dupItem.status;
        document.getElementById('duplicate-distance').innerText = `${dist} meters away`;

        // Style the duplicate status tag
        const badge = document.getElementById('duplicate-status');
        badge.className = 'badge bg-info text-dark';

        // Unhide duplicate alert and scroll up
        const warningBox = document.getElementById('duplicate-warning-box');
        warningBox.classList.remove('d-none');
        warningBox.scrollIntoView({ behavior: 'smooth' });
        
        showToast('A matching unresolved ticket exists nearby. Please review.', 'warning');
        return;
      }
    }

    // 2. Submit the Ticket using Multipart/FormData
    const formData = new FormData();
    formData.append('title', title);
    formData.append('category', category);
    formData.append('priority', priority);
    formData.append('description', description);
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
    formData.append('bypassDuplicate', bypassDuplicateCheck ? 'true' : 'false');
    
    if (fileInput.files[0]) {
      formData.append('image', fileInput.files[0]);
    }

    const res = await apiRequest('/complaints', {
      method: 'POST',
      body: formData
    });

    if (res.success) {
      const complaint = res.data;
      const deptName = complaint.departmentId ? (complaint.departmentId.departmentName || 'Concerned Department') : 'Concerned Department';

      // ── Comprehensive Acknowledgement Overlay ──────────────────────────────
      const overlay = document.createElement('div');
      overlay.id = 'ack-overlay';
      overlay.style.cssText = [
        'position:fixed;inset:0;z-index:9999;overflow-y:auto;',
        'background:linear-gradient(160deg,#0f172a 0%,#1e3a8a 50%,#0f766e 100%);',
        'display:flex;align-items:flex-start;justify-content:center;',
        'padding:2rem 1rem;'
      ].join('');

      overlay.innerHTML = `
        <div style="max-width:560px;width:100%;animation:fadeInUp 0.5s ease;">

          <!-- ✅ Header -->
          <div style="text-align:center;padding:2rem 0 1.5rem;">
            <div style="width:80px;height:80px;background:rgba(16,185,129,0.15);border:2px solid #10b981;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.2rem;font-size:2.5rem;">✅</div>
            <h2 style="font-weight:800;color:#fff;margin-bottom:0.4rem;font-size:1.8rem;">Complaint Registered!</h2>
            <p style="color:rgba(255,255,255,0.7);margin:0;font-size:1rem;">Your civic issue has been successfully submitted to CivicPulse.</p>
          </div>

          <!-- 🆔 Complaint ID Card -->
          <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:1.5rem;margin-bottom:1.2rem;text-align:center;">
            <div style="font-size:0.8rem;color:rgba(255,255,255,0.6);letter-spacing:1px;text-transform:uppercase;margin-bottom:0.4rem;">Your Complaint Reference ID</div>
            <div style="font-size:1.8rem;font-weight:800;color:#60a5fa;letter-spacing:2px;font-family:monospace;">${complaint.complaintId}</div>
            <div style="font-size:0.78rem;color:rgba(255,255,255,0.5);margin-top:0.4rem;">Save this ID to track your complaint status anytime</div>
          </div>

          <!-- 🏢 Department + Priority Row -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-bottom:1.2rem;">
            <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:1rem;text-align:center;">
              <div style="font-size:1.3rem;margin-bottom:0.3rem;">🏛️</div>
              <div style="font-size:0.72rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px;">Assigned To</div>
              <div style="font-size:0.9rem;font-weight:700;color:#fff;margin-top:0.2rem;">${complaint.departmentId?.departmentName || 'Being Assigned'}</div>
            </div>
            <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:1rem;text-align:center;">
              <div style="font-size:1.3rem;margin-bottom:0.3rem;">⚡</div>
              <div style="font-size:0.72rem;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.5px;">Priority</div>
              <div style="font-size:0.9rem;font-weight:700;color:${complaint.priority==='Emergency'?'#f87171':complaint.priority==='High'?'#fb923c':complaint.priority==='Medium'?'#facc15':'#4ade80'};margin-top:0.2rem;">${complaint.priority}</div>
            </div>
          </div>

          <!-- 🔄 Status Lifecycle Stepper -->
          <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:1.4rem;margin-bottom:1.2rem;">
            <div style="font-size:0.78rem;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:1px;margin-bottom:1rem;">What Happens Next</div>
            <div style="display:flex;align-items:center;gap:0;overflow-x:auto;">
              ${['Submitted','Verified','Assigned','In Progress','Resolved'].map((step, i) => `
                <div style="display:flex;align-items:center;flex:1;min-width:0;">
                  <div style="display:flex;flex-direction:column;align-items:center;flex:1;">
                    <div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0;
                      ${i===0 ? 'background:#10b981;color:#fff;box-shadow:0 0 12px rgba(16,185,129,0.5);' : 'background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);'}">
                      ${i===0 ? '✓' : i+1}
                    </div>
                    <div style="font-size:0.65rem;color:${i===0?'#10b981':'rgba(255,255,255,0.35)'};margin-top:0.4rem;text-align:center;white-space:nowrap;">${step}</div>
                  </div>
                  ${i<4 ? `<div style="flex:1;height:2px;background:${i===0?'rgba(16,185,129,0.4)':'rgba(255,255,255,0.1)'};margin:0 2px;margin-bottom:18px;"></div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 📋 What Happens Now -->
          <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.25);border-radius:16px;padding:1.2rem;margin-bottom:1.4rem;">
            <div style="font-weight:700;color:#93c5fd;margin-bottom:0.8rem;font-size:0.9rem;">📋 What Happens Now?</div>
            <div style="display:flex;flex-direction:column;gap:0.5rem;">
              <div style="display:flex;gap:0.6rem;align-items:flex-start;">
                <span style="color:#10b981;font-size:0.9rem;flex-shrink:0;">1️⃣</span>
                <span style="color:rgba(255,255,255,0.75);font-size:0.82rem;">Your complaint is reviewed by the system and verified by authorities.</span>
              </div>
              <div style="display:flex;gap:0.6rem;align-items:flex-start;">
                <span style="color:#10b981;font-size:0.9rem;flex-shrink:0;">2️⃣</span>
                <span style="color:rgba(255,255,255,0.75);font-size:0.82rem;">It is assigned to the <strong style="color:#93c5fd;">${complaint.departmentId?.departmentName || 'concerned department'}</strong> for repair.</span>
              </div>
              <div style="display:flex;gap:0.6rem;align-items:flex-start;">
                <span style="color:#10b981;font-size:0.9rem;flex-shrink:0;">3️⃣</span>
                <span style="color:rgba(255,255,255,0.75);font-size:0.82rem;">Track status anytime using your Complaint ID: <strong style="color:#60a5fa;">${complaint.complaintId}</strong></span>
              </div>
            </div>
          </div>

          <!-- 🔘 Action Buttons -->
          <div style="display:flex;flex-direction:column;gap:0.7rem;margin-bottom:1.5rem;">
            <a href="complaint-details.html?id=${complaint._id}" 
               style="display:block;background:#3b82f6;color:#fff;text-decoration:none;border-radius:12px;padding:0.9rem;text-align:center;font-weight:700;font-size:0.95rem;transition:opacity 0.2s;"
               onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
              🔍 Track Your Complaint
            </a>
            <a href="complaint-form.html"
               style="display:block;background:rgba(255,255,255,0.1);color:#fff;text-decoration:none;border-radius:12px;padding:0.9rem;text-align:center;font-weight:600;font-size:0.95rem;border:1px solid rgba(255,255,255,0.15);"
               onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">
              ➕ Report Another Issue
            </a>
            <a href="citizen.html"
               style="display:block;background:transparent;color:rgba(255,255,255,0.6);text-decoration:none;border-radius:12px;padding:0.7rem;text-align:center;font-size:0.85rem;">
              ← Back to Dashboard
            </a>
          </div>

          <!-- ⏱ Auto-redirect countdown -->
          <div style="text-align:center;font-size:0.78rem;color:rgba(255,255,255,0.4);" id="ack-countdown">
            Auto-redirecting to dashboard in 8 seconds...
          </div>
        </div>
      `;

      // Inject fadeInUp keyframes if not present
      if (!document.getElementById('ack-keyframes')) {
        const style = document.createElement('style');
        style.id = 'ack-keyframes';
        style.textContent = '@keyframes fadeInUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}';
        document.head.appendChild(style);
      }

      document.body.appendChild(overlay);

      // Countdown + auto-redirect
      let count = 8;
      const countEl = overlay.querySelector('#ack-countdown');
      const interval = setInterval(() => {
        count--;
        if (countEl) countEl.textContent = `Auto-redirecting to dashboard in ${count} second${count !== 1 ? 's' : ''}...`;
        if (count <= 0) {
          clearInterval(interval);
          window.location.href = 'citizen.html';
        }
      }, 1000);
    }

  } catch (error) {
    console.error('Submission failed:', error);
  }
}

/**
 * Support the duplicate complaint instead of reporting again
 */
async function supportExistingComplaint() {
  if (!duplicateComplaintId) return;

  try {
    const res = await apiRequest(`/complaints/${duplicateComplaintId}/support`, {
      method: 'POST'
    });

    if (res.success) {
      showToast('Support vote recorded! Thank you for reducing duplicates.', 'success');
      setTimeout(() => {
        window.location.href = 'citizen.html';
      }, 1200);
    }
  } catch (error) {
    console.error('Support duplicate submit failed:', error);
  }
}

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
        facingMode: currentFacingMode
      },
      audio: false
    };
    
    // Stop any existing stream first to release the camera lock
    stopCamera();
    
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    if (video) {
      video.srcObject = cameraStream;
      video.onloadedmetadata = () => {
        if (loader) loader.classList.add('d-none');
        video.play().catch(err => console.warn('Video play deferred:', err));
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
    showToast('Could not access camera. Please check browser permissions.', 'danger');
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
  stopCamera(); // Release camera lock first
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
    showToast('Camera is not active yet.', 'warning');
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
      
      const fileInput = document.getElementById('image');
      if (fileInput) {
        fileInput.files = dataTransfer.files;
        // Trigger handleImageSelect to display the preview
        handleImageSelect({ target: fileInput });
      }
      
      showToast('Photo captured successfully!', 'success');
      
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
let activeRecognition = null; // prevent double-start

function startVoiceInput(targetInputId, buttonId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('🎤 Voice input is not supported in this browser. Please use Chrome or Edge.', 'danger');
    return;
  }

  // If already listening, stop it (toggle behavior)
  if (activeRecognition) {
    try { activeRecognition.stop(); } catch(e) {}
    activeRecognition = null;
    return;
  }

  const btn = document.getElementById(buttonId);
  const input = document.getElementById(targetInputId);
  if (!btn || !input) return;

  _startRecognition(SpeechRecognition, btn, input, buttonId);
}

/**
 * Internal helper that creates and starts the recognition session.
 * Separated to allow async permission pre-check before calling.
 */
function _startRecognition(SpeechRecognition, btn, input, buttonId) {
  // Detect Brave browser for a specific guidance note
  const isBrave = navigator.brave !== undefined;

  const recognition = new SpeechRecognition();
  activeRecognition = recognition;

  // BCP-47 language based on app language setting
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
    btn.classList.remove('btn-danger', 'text-white', 'btn-mic-active');
    btn.classList.add('btn-outline-secondary');
    activeRecognition = null;
    if (silenceTimer) clearTimeout(silenceTimer);
  }

  recognition.onstart = () => {
    btn.innerHTML = '<i class="bi bi-mic-fill"></i> <span class="spinner-grow spinner-grow-sm" role="status"></span>';
    btn.classList.add('btn-danger', 'text-white', 'btn-mic-active');
    btn.classList.remove('btn-outline-secondary');
    showToast('🎤 Listening… speak now clearly.', 'info');
    silenceTimer = setTimeout(() => {
      if (!hasResult) {
        try { recognition.stop(); } catch(e) {}
      }
    }, 10000);
  };

  recognition.onresult = (event) => {
    hasResult = true;
    if (silenceTimer) clearTimeout(silenceTimer);
    let finalTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      }
    }
    if (finalTranscript.trim()) {
      input.value = (input.value ? input.value + ' ' : '') + finalTranscript.trim();
      input.dispatchEvent(new Event('input'));
      showToast('✅ Speech captured successfully!', 'success');
    }
  };

  recognition.onerror = (e) => {
    restoreBtn();
    if (e.error === 'not-allowed') {
      showToast(
        '🎤 Microphone access denied. Click 🔒 padlock → Site settings → Allow Microphone, then refresh.',
        'warning'
      );
    } else if (e.error === 'no-speech') {
      showToast('🎤 No speech detected. Please speak louder or closer to the mic.', 'warning');
    } else if (e.error === 'network') {
      if (isBrave) {
        showToast(
          '🦁 Brave browser blocks Google Speech by default. Go to brave://settings/ → Privacy → Enable "Google Services for Speech Recognition", then retry.',
          'danger'
        );
      } else {
        showToast('🎤 Network error during speech recognition. Please check your internet connection.', 'danger');
      }
    } else {
      showToast(`🎤 Speech error: ${e.error}. Try again.`, 'warning');
    }
  };

  recognition.onend = () => {
    restoreBtn();
  };

  try {
    recognition.start();
  } catch (err) {
    console.error('Speech recognition start failed:', err);
    restoreBtn();
  }
} // end _startRecognition

let aiSuggestedCategory = '';
let aiSuggestedPriority = '';

/**
 * Keyword-based AI categorization suggestions
 */
function analyzeTextForAISuggestions() {
  const title = document.getElementById('title').value.trim();
  const desc = document.getElementById('description').value.trim();
  const text = `${title} ${desc}`.toLowerCase();

  if (text.length < 5) {
    document.getElementById('ai-suggestion-box').classList.add('d-none');
    return;
  }

  let category = '';
  let priority = '';

  // Category matching
  if (text.includes('pothole') || text.includes('cave-in') || text.includes('crater') || text.includes('footpath') || text.includes('sidewalk') || text.includes('road') || text.includes('street')) {
    category = 'Potholes';
  } else if (text.includes('light') || text.includes('dark') || text.includes('street-light') || text.includes('streetlight') || text.includes('bulb') || text.includes('electricity') || text.includes('spark')) {
    category = 'Street Light Failure';
  } else if (text.includes('drain') || text.includes('sewage') || text.includes('clog') || text.includes('overflow') || text.includes('sewer') || text.includes('drainage')) {
    category = 'Drainage Blockage';
  } else if (text.includes('water supply') || text.includes('drinking water') || text.includes('water leak') || text.includes('pipeline burst') || text.includes('no water')) {
    category = 'Water Supply Issue';
  } else if (text.includes('garbage') || text.includes('trash') || text.includes('waste') || text.includes('dump') || text.includes('litter') || text.includes('refuse')) {
    category = 'Garbage Overflow';
  } else if (text.includes('tree') || text.includes('branch') || text.includes('fallen tree')) {
    category = 'Tree Fallen';
  }

  // Priority matching (Escalation / Emergency triggers)
  if (
    text.includes('accident') ||
    text.includes('injured') ||
    text.includes('hospital') ||
    text.includes('danger') ||
    text.includes('hazard') ||
    text.includes('sparking') ||
    text.includes('live wire') ||
    text.includes('fire') ||
    text.includes('collapse') ||
    text.includes('blocking road') ||
    text.includes('flooding')
  ) {
    priority = 'Emergency';
  } else if (
    text.includes('severe') ||
    text.includes('broken') ||
    text.includes('risk') ||
    text.includes('disruptive') ||
    text.includes('terrible') ||
    text.includes('urgent')
  ) {
    priority = 'High';
  } else if (
    text.includes('minor') ||
    text.includes('low') ||
    text.includes('non-blocking')
  ) {
    priority = 'Low';
  }

  if (category || priority) {
    aiSuggestedCategory = category || document.getElementById('category').value;
    aiSuggestedPriority = priority || document.getElementById('priority').value;

    const categoryText = aiSuggestedCategory ? `Category <strong>'${aiSuggestedCategory}'</strong>` : '';
    const priorityText = aiSuggestedPriority ? `Priority <strong>'${aiSuggestedPriority}'</strong>` : '';
    const combinedText = [categoryText, priorityText].filter(Boolean).join(' & ');

    document.getElementById('ai-suggestion-text').innerHTML = `${combinedText}`;
    document.getElementById('ai-suggestion-box').classList.remove('d-none');
  } else {
    document.getElementById('ai-suggestion-box').classList.add('d-none');
  }
}

/**
 * Apply suggestion values directly to selector fields
 */
function applyAISuggestions() {
  if (aiSuggestedCategory) {
    document.getElementById('category').value = aiSuggestedCategory;
  }
  if (aiSuggestedPriority) {
    document.getElementById('priority').value = aiSuggestedPriority;
  }
  document.getElementById('ai-suggestion-box').classList.add('d-none');
  showToast('AI suggestions applied successfully!', 'success');
}
