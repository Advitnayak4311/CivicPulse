/* ==========================================================================
   Smart Civic Issues Monitoring and Response System - Details Tracking Script
   ========================================================================== */

let detailsMap;
let complaintIdMongo;

document.addEventListener('DOMContentLoaded', () => {
  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');

  // Set Back Button target based on role (if logged in)
  const backBtn = document.getElementById('back-dashboard-btn');
  if (backBtn) {
    if (!user) {
      backBtn.href = 'index.html';
      backBtn.innerHTML = '<i class="bi bi-arrow-left me-1"></i>Back to Home';
    } else if (user.role === 'admin') backBtn.href = 'admin.html';
    else if (user.role === 'authority') backBtn.href = 'authority.html';
    else backBtn.href = 'citizen.html';
  }

  // Get URL params
  const mongoId = getUrlParam('id');          // Used when logged-in user clicks "Track"
  const refId = getUrlParam('ref');           // Used for public tracking by complaint reference ID

  if (mongoId && token) {
    // Authenticated: load by MongoDB _id
    complaintIdMongo = mongoId;
    fetchComplaintByMongoId(mongoId);
  } else if (refId) {
    // Public: load by complaint reference ID (e.g. CIV-20240710-XXXXX)
    fetchComplaintByRefId(refId.toUpperCase());
  } else if (mongoId && !token) {
    // Has an id but no token — try public track by ID (our public route resolves both ObjectID & Reference ID)
    complaintIdMongo = mongoId;
    fetchComplaintByRefId(mongoId);
  } else {
    showToast('No complaint ID specified.', 'danger');
    setTimeout(() => { window.location.href = 'index.html'; }, 1500);
    return;
  }

  // Bind support action click (only for logged-in citizens)
  const supportBtn = document.getElementById('btn-support-action');
  if (supportBtn) {
    supportBtn.addEventListener('click', supportComplaintAction);
  }
});

/**
 * Fetch complaint details by MongoDB ObjectId (for logged-in users)
 */
async function fetchComplaintByMongoId(id) {
  try {
    const res = await apiRequest(`/complaints/${id}`);
    if (res.success) {
      complaintIdMongo = res.data._id;
      populateDetails(res.data, res.hasSupported);
      if (res.data.latitude && res.data.longitude) {
        renderDetailsMap(res.data.latitude, res.data.longitude, res.data.title, res.data.status);
      }
      renderTimeline(res.timeline, res.data.status, res.data.createdAt);
      generateQRCode();
      applyTranslations(localStorage.getItem('lang') || 'en');
    }
  } catch (error) {
    console.error('Failed to load complaint details:', error);
  }
}

/**
 * Fetch complaint details by public complaint reference ID (no login required)
 * Uses the public /track/:complaintId endpoint
 */
async function fetchComplaintByRefId(refId) {
  try {
    // Direct fetch without auth header - public endpoint
    showLoader();
    const response = await fetch(`${API_BASE_URL}/complaints/track/${refId}`);
    const res = await response.json();
    hideLoader();

    if (res.success) {
      complaintIdMongo = res.data._id;
      // Hide support widget for public/non-authenticated users
      const widget = document.getElementById('citizen-support-widget');
      if (widget) widget.classList.add('d-none');

      populateDetails(res.data, false);
      if (res.data.latitude && res.data.longitude) {
        renderDetailsMap(res.data.latitude, res.data.longitude, res.data.title, res.data.status);
      }
      renderTimeline(res.timeline, res.data.status, res.data.createdAt);
      generateQRCode();
      applyTranslations(localStorage.getItem('lang') || 'en');
    } else {
      showToast(res.message || 'Complaint not found.', 'danger');
    }
  } catch (error) {
    hideLoader();
    console.error('Failed to track complaint:', error);
    showToast('Could not connect to the server. Please try again.', 'danger');
  }
}

/**
 * Populate values on page
 */
function populateDetails(item, hasSupported) {
  const BACKEND_HOST = API_BASE_URL.replace('/api', '');
  const user = JSON.parse(localStorage.getItem('user'));

  // Fill text fields
  document.getElementById('details-complaint-id').innerText = item.complaintId;
  document.getElementById('details-title').innerText = item.title;
  document.getElementById('details-description').innerText = item.description;
  document.getElementById('details-category').innerText = item.category;
  document.getElementById('details-date').innerText = formatDate(item.createdAt);
  document.getElementById('details-supports').innerText = item.supportCount;

  // Set Last Updated Date
  document.getElementById('details-last-updated').innerText = formatDate(item.updatedAt || item.createdAt);
  
  // Calculate and Set ETA
  let etaText = 'N/A';
  if (['Resolved', 'Closed', 'Rejected'].includes(item.status)) {
    etaText = 'Completed / Closed';
  } else {
    switch (item.priority) {
      case 'Emergency': etaText = 'Within 24 Hours'; break;
      case 'High': etaText = 'Within 3 Days'; break;
      case 'Medium': etaText = 'Within 7 Days'; break;
      case 'Low': etaText = 'Within 14 Days'; break;
      default: etaText = 'Within 7 Days';
    }
  }
  document.getElementById('details-eta').innerText = etaText;

  const latVal = (typeof item.latitude === 'number' && !isNaN(item.latitude)) ? item.latitude.toFixed(6) : 'N/A';
  const lonVal = (typeof item.longitude === 'number' && !isNaN(item.longitude)) ? item.longitude.toFixed(6) : 'N/A';
  document.getElementById('details-lat').innerText = latVal;
  document.getElementById('details-lon').innerText = lonVal;

  // Set Department Name
  const deptName = item.departmentId ? item.departmentId.departmentName : 'Unassigned';
  document.getElementById('details-department').innerText = deptName;

  // Set Officer Details (only if assigned)
  const officerBox = document.getElementById('details-officer-info-box');
  if (item.departmentId) {
    officerBox.classList.remove('d-none');
    document.getElementById('details-officer-name').innerText = item.departmentId.officerName;
    document.getElementById('details-officer-phone').innerText = item.departmentId.phone;
    document.getElementById('details-officer-email').innerText = item.departmentId.officerEmail;
  } else {
    officerBox.classList.add('d-none');
  }

  // Set Citizen Details (only for admin or officer)
  const citizenBox = document.getElementById('details-citizen-info-box');
  if (citizenBox) {
    if (user && (user.role === 'admin' || user.role === 'authority') && item.citizenId) {
      citizenBox.classList.remove('d-none');
      document.getElementById('details-citizen-name').innerText = item.citizenId.name || 'N/A';
      document.getElementById('details-citizen-phone').innerText = item.citizenId.phone || 'N/A';
      document.getElementById('details-citizen-email').innerText = item.citizenId.email || 'N/A';
    } else {
      citizenBox.classList.add('d-none');
    }
  }

  // Setup Badges
  const statusBadge = document.getElementById('details-status-badge');
  statusBadge.className = 'badge ' + getStatusBadgeClass(item.status);
  statusBadge.innerText = item.status;

  const priorityBadge = document.getElementById('details-priority-badge');
  priorityBadge.className = 'badge ' + getPriorityBadgeClass(item.priority);
  priorityBadge.innerText = item.priority;

  // Handle Main image
  const imgElement = document.getElementById('details-image');
  const imgBox = document.getElementById('details-image-box');
  if (item.image) {
    imgElement.src = `${BACKEND_HOST}${item.image}`;
    imgBox.classList.remove('d-none');
  } else {
    imgBox.classList.add('d-none');
  }

  // Before / After images
  const repairBox = document.getElementById('repair-images-box');
  const beforeImg = document.getElementById('details-before-image');
  const beforePlaceholder = document.getElementById('before-img-placeholder');
  const afterImg = document.getElementById('details-after-image');
  const afterPlaceholder = document.getElementById('after-img-placeholder');

  if (item.beforeImage || item.afterImage) {
    repairBox.classList.remove('d-none');
    
    if (item.beforeImage) {
      beforeImg.src = `${BACKEND_HOST}${item.beforeImage}`;
      beforeImg.classList.remove('d-none');
      beforePlaceholder.classList.add('d-none');
    } else {
      beforeImg.classList.add('d-none');
      beforePlaceholder.classList.remove('d-none');
    }

    if (item.afterImage) {
      afterImg.src = `${BACKEND_HOST}${item.afterImage}`;
      afterImg.classList.remove('d-none');
      afterPlaceholder.classList.add('d-none');
    } else {
      afterImg.classList.add('d-none');
      afterPlaceholder.classList.remove('d-none');
    }
  } else {
    repairBox.classList.add('d-none');
  }

  // Configure Support Widget
  const widget = document.getElementById('citizen-support-widget');
  const supportBtn = document.getElementById('btn-support-action');

  if (!user || user.role !== 'citizen' || ['Resolved', 'Closed', 'Rejected'].includes(item.status)) {
    if (widget) widget.classList.add('d-none');
  } else {
    if (widget) {
      widget.classList.remove('d-none');
      const activeLang = localStorage.getItem('lang') || 'en';
      const dict = TRANSLATIONS[activeLang] || TRANSLATIONS['en'];
      if (hasSupported) {
        supportBtn.disabled = true;
        supportBtn.className = 'btn btn-success w-100 fw-bold py-2';
        supportBtn.innerHTML = `<i class="bi bi-patch-check-fill me-2"></i>${dict['details_support_btn_already'] || 'You Supported This'}`;
      } else {
        supportBtn.disabled = false;
        supportBtn.className = 'btn btn-primary w-100 fw-bold py-2';
        supportBtn.innerHTML = `<i class="bi bi-hand-thumbs-up me-2"></i>${dict['details_support_btn'] || 'Support Complaint'}`;
      }
    }
  }

  // Configure Feedback Widget
  const feedbackWidget = document.getElementById('citizen-feedback-widget');
  if (feedbackWidget) {
    if (user && user.role === 'citizen' && ['Resolved', 'Closed'].includes(item.status)) {
      feedbackWidget.classList.remove('d-none');
      
      const form = document.getElementById('feedback-form');
      const readonlyContainer = document.getElementById('feedback-readonly-container');
      
      if (item.rating) {
        // Already rated
        form.classList.add('d-none');
        readonlyContainer.classList.remove('d-none');
        
        // Render readonly stars
        const starsBox = document.getElementById('readonly-stars');
        starsBox.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
          starsBox.innerHTML += i <= item.rating ? '<i class="bi bi-star-fill me-1"></i>' : '<i class="bi bi-star me-1"></i>';
        }
        document.getElementById('readonly-remarks').innerText = item.feedback || 'No remarks provided.';
      } else {
        // Needs rating
        form.classList.remove('d-none');
        readonlyContainer.classList.add('d-none');
        setupFeedbackListeners();
      }
    } else {
      feedbackWidget.classList.add('d-none');
    }
  }
}

/**
 * Render Leaflet Map
 */
function renderDetailsMap(lat, lon, title, status) {
  if (detailsMap) {
    detailsMap.remove();
  }

  detailsMap = L.map('map').setView([lat, lon], 14);

  L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps',
    maxZoom: 20
  }).addTo(detailsMap);

  const markerIcon = L.divIcon({
    html: '<i class="bi bi-geo-alt-fill text-danger fs-2"></i>',
    className: 'custom-map-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 24]
  });

  const marker = L.marker([lat, lon], { icon: markerIcon }).addTo(detailsMap);
  marker.bindPopup(`<strong>${title}</strong><br>Status: ${status}`).openPopup();
}

/**
 * Full lifecycle stages in order (excluding Rejected which is a branch)
 */
const LIFECYCLE_STAGES = [
  { status: 'Submitted',         icon: 'bi-file-earmark-plus',    label: 'Submitted',          sub: 'Complaint received by CivicPulse' },
  { status: 'Verified',          icon: 'bi-patch-check',          label: 'Verified',            sub: 'Complaint verified by moderator' },
  { status: 'Assigned',          icon: 'bi-person-badge',         label: 'Assigned',            sub: 'Sent to relevant department officer' },
  { status: 'Under Review',      icon: 'bi-search',               label: 'Under Review',        sub: 'Officer reviewing field report' },
  { status: 'Repair Started',    icon: 'bi-tools',                label: 'Repair Started',      sub: 'On-site repair work has begun' },
  { status: 'Repair In Progress',icon: 'bi-gear-wide-connected',  label: 'Repair In Progress',  sub: 'Active repair ongoing at site' },
  { status: 'Resolved',          icon: 'bi-check-circle',         label: 'Resolved',            sub: 'Issue fixed and verified' },
  { status: 'Closed',            icon: 'bi-archive',              label: 'Closed',              sub: 'Case closed after resolution' }
];

/**
 * Render Flipkart/Amazon-style full lifecycle stepper
 */
function renderLifecycleStepper(currentStatus, timeline) {
  const container = document.getElementById('details-lifecycle-stepper');
  if (!container) return;

  const isRejected = currentStatus === 'Rejected';

  // Build a set of reached statuses from timeline
  const reachedStatuses = new Set((timeline || []).map(t => t.status));
  reachedStatuses.add(currentStatus);

  // Find active index in the ordered list
  const stageIndex = LIFECYCLE_STAGES.findIndex(s => s.status === currentStatus);

  const activeLang = localStorage.getItem('lang') || 'en';
  const dict = TRANSLATIONS[activeLang] || TRANSLATIONS['en'];

  let html = '<div class="lifecycle-stepper">';

  if (isRejected) {
    // Special rejected path: show Submitted → Rejected
    const labelSubmitted = dict['status_submitted'] || 'Submitted';
    const subSubmitted = dict['sub_submitted'] || 'Complaint received by CivicPulse';
    const labelRejected = dict['status_rejected'] || 'Rejected';
    const subRejected = dict['sub_rejected'] || 'Complaint was not approved';

    html += `
      <div class="lifecycle-step step-done">
        <div class="lifecycle-step-line"></div>
        <div class="lifecycle-step-icon"><i class="bi bi-file-earmark-plus"></i></div>
        <div class="lifecycle-step-content">
          <div class="lifecycle-step-title">${labelSubmitted}</div>
          <div class="lifecycle-step-sub">${subSubmitted}</div>
        </div>
      </div>
      <div class="lifecycle-step step-rejected">
        <div class="lifecycle-step-icon"><i class="bi bi-x-circle"></i></div>
        <div class="lifecycle-step-content">
          <div class="lifecycle-step-title">${labelRejected}</div>
          <div class="lifecycle-step-sub">${subRejected}</div>
        </div>
      </div>`;
  } else {
    LIFECYCLE_STAGES.forEach((stage, idx) => {
      const isDone = reachedStatuses.has(stage.status) && (stageIndex === -1 ? false : idx < stageIndex || currentStatus === 'Closed' || currentStatus === 'Resolved');
      const isActive = stage.status === currentStatus;

      let stepClass = '';
      if (isDone) stepClass = 'step-done';
      else if (isActive) stepClass = 'step-active';

      const iconHtml = isDone
        ? '<i class="bi bi-check-lg"></i>'
        : `<i class="${stage.icon}"></i>`;

      const statusKey = 'status_' + stage.status.toLowerCase().replace(/ /g, '_');
      const subKey = 'sub_' + stage.status.toLowerCase().replace(/ /g, '_');

      const label = dict[statusKey] || stage.label;
      const sub = dict[subKey] || stage.sub;

      html += `
        <div class="lifecycle-step ${stepClass}">
          <div class="lifecycle-step-line"></div>
          <div class="lifecycle-step-icon">${iconHtml}</div>
          <div class="lifecycle-step-content">
            <div class="lifecycle-step-title">${label}${isActive ? ' <span class="badge bg-primary" style="font-size:0.6rem;vertical-align:middle;">CURRENT</span>' : ''}</div>
            <div class="lifecycle-step-sub">${sub}</div>
          </div>
        </div>`;
    });
  }

  html += '</div>';
  container.innerHTML = html;
}

/**
 * Get a contextual sympathy/empathy message based on complaint status and age
 */
function getSympathyMessage(status, createdAt) {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  const activeLang = localStorage.getItem('lang') || 'en';
  const dict = TRANSLATIONS[activeLang] || TRANSLATIONS['en'];

  const statusKey = status.toLowerCase().replace(/ /g, '_');
  
  let title = dict[`sympathy_${statusKey}_title`] || 'We\'re working on it.';
  let body = dict[`sympathy_${statusKey}_body`] || 'Your complaint is being processed. Thank you for your patience.';

  // Add delay apology for older unresolved complaints
  if (ageDays > 7 && !['Resolved', 'Closed', 'Rejected'].includes(status)) {
    title = dict['sympathy_delay_title'] || 'We sincerely apologize for the delay.';
    const rawBody = dict['sympathy_delay_body'] || 'Your complaint has been open for {days} days. We understand this is frustrating and we deeply apologize for the inconvenience. Your issue has been escalated for priority attention. Thank you for your patience.';
    body = rawBody.replace('{days}', ageDays);
  }

  // Get matching icon based on status
  let icon = 'bi-info-circle-fill';
  if (status === 'Submitted') icon = 'bi-heart-fill';
  else if (status === 'Verified') icon = 'bi-shield-check';
  else if (status === 'Assigned') icon = 'bi-person-check-fill';
  else if (status === 'Under Review') icon = 'bi-clipboard-check';
  else if (status === 'Repair Started') icon = 'bi-tools';
  else if (status === 'Repair In Progress') icon = 'bi-gear-wide-connected';
  else if (status === 'Resolved') icon = 'bi-check-circle-fill';
  else if (status === 'Closed') icon = 'bi-archive-fill';
  else if (status === 'Rejected') icon = 'bi-x-circle-fill';

  return { icon, title, body };
}

/**
 * Render sympathy card on the details page
 */
function renderSympathyCard(status, createdAt) {
  const container = document.getElementById('sympathy-message-box');
  if (!container) return;

  const msg = getSympathyMessage(status, createdAt);
  container.innerHTML = `
    <div class="card sympathy-card p-3 mb-4 no-print">
      <div class="d-flex align-items-start gap-3">
        <div class="sympathy-icon flex-shrink-0">
          <i class="bi ${msg.icon}"></i>
        </div>
        <div>
          <h6 class="fw-bold text-white mb-1">${msg.title}</h6>
          <p class="mb-0">${msg.body}</p>
        </div>
      </div>
    </div>`;
}

/**
 * Render Tracking Timeline (detailed history log)
 */
function renderTimeline(timeline, currentStatus, createdAt) {
  // Render the lifecycle stepper first
  renderLifecycleStepper(currentStatus, timeline);
  renderSympathyCard(currentStatus, createdAt);

  const container = document.getElementById('details-timeline-box');
  container.innerHTML = '';

  const activeLang = localStorage.getItem('lang') || 'en';
  const dict = TRANSLATIONS[activeLang] || TRANSLATIONS['en'];

  if (!timeline || timeline.length === 0) {
    container.innerHTML = `<div class="text-muted small">${dict['no_history_logged'] || 'No history logged yet'}</div>`;
    return;
  }

  timeline.forEach((log) => {
    const isCompleted = ['Resolved', 'Closed'].includes(log.status);
    const isRejected = log.status === 'Rejected';

    let stateClass = '';
    if (isCompleted) stateClass = 'completed';
    else if (isRejected) stateClass = 'rejected';

    const systemText = dict['system_user'] || 'System';
    const updatedByName = log.updatedBy ? log.updatedBy.name : systemText;
    const updatedByRole = log.updatedBy ? `(${dict['role_' + log.updatedBy.role.toLowerCase()] || log.updatedBy.role})` : '';

    const statusText = dict['status_' + log.status.toLowerCase().replace(/ /g, '_')] || log.status;
    const actionByText = dict['action_by'] || 'Action by';

    const div = document.createElement('div');
    div.className = `timeline-item ${stateClass}`;
    div.innerHTML = `
      <div class="timeline-date">${formatDate(log.createdAt)}</div>
      <h6 class="fw-bold mb-1">${statusText}</h6>
      <p class="mb-1 text-muted-custom small">${log.remarks || 'Status updated.'}</p>
      <div class="small text-muted-custom" style="font-size:0.75rem;">${actionByText}: ${updatedByName} ${updatedByRole}</div>
    `;
    container.appendChild(div);
  });
}

/**
 * Generate QR Code referencing details page
 */
function generateQRCode() {
  const qrBox = document.getElementById('qrcode-box');
  qrBox.innerHTML = ''; // Clear previous
  new QRCode(qrBox, {
    text: window.location.href,
    width: 72,
    height: 72,
    colorDark: '#0f172a',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });
}

/**
 * Handle support click
 */
async function supportComplaintAction() {
  if (!complaintIdMongo) return;

  try {
    const res = await apiRequest(`/complaints/${complaintIdMongo}/support`, {
      method: 'POST'
    });

    if (res.success) {
      showToast('Thank you for supporting this issue!', 'success');
      // Refresh details
      fetchComplaintByMongoId(complaintIdMongo);
    }
  } catch (error) {
    console.error('Failed to register support:', error);
  }
}

function getPriorityBadgeClass(priority) {
  switch (priority) {
    case 'Low': return 'badge-priority-low';
    case 'Medium': return 'badge-priority-medium';
    case 'High': return 'badge-priority-high';
    case 'Emergency': return 'badge-priority-emergency';
    default: return 'bg-secondary';
  }
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Pending': return 'badge-status-pending';
    case 'In Progress': return 'badge-status-inprogress';
    case 'Submitted': return 'badge-status-submitted';
    case 'Verified': return 'badge-status-verified';
    case 'Assigned': return 'badge-status-assigned';
    case 'Under Review': return 'badge-status-under-review';
    case 'Repair Started': return 'badge-status-repair-started';
    case 'Repair In Progress': return 'badge-status-repair-in-progress';
    case 'Resolved': return 'badge-status-resolved';
    case 'Closed': return 'badge-status-closed';
    case 'Rejected': return 'badge-status-rejected';
    default: return 'bg-secondary';
  }
}

let feedbackListenersAttached = false;

function setupFeedbackListeners() {
  if (feedbackListenersAttached) return;
  feedbackListenersAttached = true;

  // Bind star clicks
  const starContainer = document.getElementById('star-rating-container');
  if (starContainer) {
    const stars = starContainer.querySelectorAll('.star-btn');
    stars.forEach(star => {
      star.addEventListener('click', (e) => {
        const rating = parseInt(e.currentTarget.getAttribute('data-val'));
        document.getElementById('feedback-rating-val').value = rating;
        
        // Highlight stars
        stars.forEach(s => {
          const val = parseInt(s.getAttribute('data-val'));
          if (val <= rating) {
            s.className = 'bi bi-star-fill star-btn';
          } else {
            s.className = 'bi bi-star star-btn';
          }
        });
      });
    });
  }

  // Bind form submission
  const form = document.getElementById('feedback-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rating = document.getElementById('feedback-rating-val').value;
      const feedback = document.getElementById('feedback-remarks').value.trim();

      if (!rating) {
        showToast('Please select a star rating.', 'warning');
        return;
      }

      try {
        const res = await apiRequest(`/complaints/${complaintIdMongo}/feedback`, {
          method: 'POST',
          body: JSON.stringify({ rating, feedback })
        });

        if (res.success) {
          showToast('Feedback submitted successfully!', 'success');
          // Refresh details
          if (complaintIdMongo) {
            fetchComplaintByMongoId(complaintIdMongo);
          }
        }
      } catch (error) {
        console.error('Failed to submit feedback:', error);
      }
    });
  }
}
