/* ==========================================================================
   Smart Civic Issues Monitoring and Response System - Citizen script
   ========================================================================== */

let mapInstance;
let userComplaints = [];

document.addEventListener('DOMContentLoaded', () => {
  // Guard access
  const user = checkCitizenAccess();
  if (!user) return;

  // Set welcome message
  const activeLang = localStorage.getItem('lang') || 'en';
  const welcomeText = (TRANSLATIONS[activeLang] && TRANSLATIONS[activeLang]['welcome']) || 'Welcome';
  document.getElementById('citizen-welcome').innerText = `${welcomeText}, ${user.name}!`;

  // Fetch complaints
  fetchCitizenComplaints();

  // Attach search and filter event listeners
  document.getElementById('table-search').addEventListener('input', applyFilters);
  document.getElementById('filter-category').addEventListener('change', applyFilters);
  document.getElementById('filter-status').addEventListener('change', applyFilters);
});

/**
 * Ensure user is logged in as citizen
 */
function checkCitizenAccess() {
  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');
  
  if (!user || !token || user.role !== 'citizen') {
    logout(false);
    return null;
  }
  return user;
}

/**
 * Fetch complaints from server
 */
async function fetchCitizenComplaints() {
  renderSkeletonTable('citizen-complaints-tbody', 4, 8);
  
  try {
    const res = await apiRequest('/complaints/my-complaints');
    if (res.success) {
      userComplaints = res.data;
      updateMetrics(userComplaints);
      renderComplaintsTable(userComplaints);
      initCitizenMap(userComplaints);
    }
  } catch (error) {
    console.error('Failed to load citizen complaints:', error);
  }
}

/**
 * Update stats numbers
 */
function updateMetrics(complaints) {
  const total = complaints.length;
  const unresolved = complaints.filter(c => !['Resolved', 'Closed', 'Rejected'].includes(c.status)).length;
  const resolved = complaints.filter(c => ['Resolved', 'Closed'].includes(c.status)).length;

  document.getElementById('stat-total').innerText = total;
  document.getElementById('stat-pending').innerText = unresolved;
  document.getElementById('stat-resolved').innerText = resolved;
}

/**
 * Render Table Rows
 */
function renderComplaintsTable(complaints) {
  const tbody = document.getElementById('citizen-complaints-tbody');
  const emptyState = document.getElementById('citizen-empty-state');
  tbody.innerHTML = '';

  if (complaints.length === 0) {
    emptyState.classList.remove('d-none');
    applyTranslations(localStorage.getItem('lang') || 'en');
    return;
  } else {
    emptyState.classList.add('d-none');
  }

  const activeLang = localStorage.getItem('lang') || 'en';
  const dict = TRANSLATIONS[activeLang] || TRANSLATIONS['en'];

  complaints.forEach(item => {
    const priorityClass = getPriorityBadgeClass(item.priority);
    const statusClass = getStatusBadgeClass(item.status);

    const priorityText = dict['priority_' + item.priority.toLowerCase()] || item.priority;
    const statusText = dict['status_' + item.status.toLowerCase().replace(/ /g, '_')] || item.status;
    const categoryKey = 'cat_' + item.category.toLowerCase().replace(/ /g, '_');
    const categoryText = dict[categoryKey] || item.category;
    const trackText = dict['track'] || 'Track';
    const downloadText = dict['download_receipt'] || 'Receipt';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="text-primary fw-bold text-nowrap">${item.complaintId}</span></td>
      <td><div class="fw-semibold text-truncate" style="max-width: 180px;" title="${item.title}">${item.title}</div></td>
      <td><span class="small">${categoryText}</span></td>
      <td><span class="badge ${priorityClass}">${priorityText}</span></td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td class="text-center"><span class="badge bg-light text-dark border"><i class="bi bi-hand-thumbs-up-fill text-primary me-1"></i>${item.supportCount}</span></td>
      <td class="text-nowrap small">${formatDate(item.createdAt, false)}</td>
      <td class="text-center">
        <div class="d-flex gap-1 justify-content-center">
          <a href="complaint-details.html?id=${item._id}" class="btn btn-outline-primary btn-sm px-2" title="${trackText}">
            <i class="bi bi-eye"></i> ${trackText}
          </a>
          <button onclick="downloadReceipt(${JSON.stringify(item).replace(/"/g, '&quot;')})" 
                  class="btn btn-outline-secondary btn-sm px-2" title="${downloadText}">
            <i class="bi bi-download"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  applyTranslations(localStorage.getItem('lang') || 'en');
}

/**
 * Quick Track by Complaint ID
 * Navigates to complaint-details.html with the ref= param (public tracking)
 */
function quickTrackComplaint() {
  const input = document.getElementById('quick-track-input');
  if (!input) return;
  const val = input.value.trim().toUpperCase();
  if (!val) {
    showToast('Please enter a Complaint ID to track.', 'warning');
    input.focus();
    return;
  }
  // Validate format loosely: CIV- prefix
  if (!val.startsWith('CIV-')) {
    showToast('Please enter a valid Complaint ID starting with CIV-', 'warning');
    input.focus();
    return;
  }
  window.location.href = `complaint-details.html?ref=${encodeURIComponent(val)}`;
}

/**
 * Generate and open a printable receipt for a complaint
 */
function downloadReceipt(item) {
  const BACKEND_HOST = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL.replace('/api', '') : 'http://localhost:5000';
  const imgSrc = item.image ? `${BACKEND_HOST}${item.image}` : '';
  const deptName = item.departmentId ? (item.departmentId.departmentName || 'Assigned Department') : 'Being Assigned';

  const statusSteps = ['Submitted', 'Verified', 'Assigned', 'In Progress', 'Resolved'];
  const currentIdx = statusSteps.indexOf(item.status);
  const stepperHtml = statusSteps.map((step, i) => {
    const done = i < currentIdx;
    const active = i === currentIdx;
    const color = done ? '#10b981' : active ? '#3b82f6' : '#d1d5db';
    const bg = done ? '#d1fae5' : active ? '#dbeafe' : '#f9fafb';
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;">
      <div style="width:30px;height:30px;border-radius:50%;background:${bg};border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:${color};">
        ${done ? '✓' : i + 1}
      </div>
      <div style="font-size:0.62rem;margin-top:4px;color:${active ? '#1e40af' : '#6b7280'};text-align:center;font-weight:${active ? 700 : 400};">${step}</div>
    </div>${i < statusSteps.length - 1 ? `<div style="flex:1;height:2px;background:${done ? '#10b981' : '#e5e7eb'};margin-bottom:20px;"></div>` : ''}`;
  }).join('');

  const receiptHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Complaint Receipt - ${item.complaintId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #f8fafc; padding: 0; }
    .page { max-width: 700px; margin: 20px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1e3a8a, #0f766e); color: white; padding: 24px 28px; }
    .header h1 { font-size: 1.4rem; font-weight: 800; margin-bottom: 4px; }
    .header p { opacity: 0.75; font-size: 0.8rem; }
    .complaint-id { font-size: 1.6rem; font-weight: 800; letter-spacing: 2px; font-family: monospace; color: #93c5fd; margin: 8px 0; }
    .body { padding: 24px 28px; }
    .section-title { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; margin-bottom: 8px; margin-top: 18px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .info-item label { display: block; font-size: 0.7rem; color: #64748b; margin-bottom: 2px; }
    .info-item span { font-weight: 600; font-size: 0.88rem; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; background: #dbeafe; color: #1e40af; }
    .priority-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; }
    .stepper { display: flex; align-items: center; margin: 16px 0; }
    .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; font-size: 0.75rem; color: #64748b; text-align: center; }
    .qr-placeholder { width: 70px; height: 70px; background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; color: #94a3b8; }
    .top-row { display: flex; justify-content: space-between; align-items: flex-start; }
    .desc-box { background: #f8fafc; border-left: 3px solid #3b82f6; padding: 10px 14px; border-radius: 4px; font-size: 0.85rem; line-height: 1.5; }
    @media print { body { background: white; } .page { margin: 0; border-radius: 0; border: none; } }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="top-row">
      <div>
        <h1>🏛️ CivicPulse</h1>
        <p>Smart Civic Issues Monitoring &amp; Response System</p>
        <div class="complaint-id">${item.complaintId}</div>
        <div style="font-size:0.8rem;opacity:0.8;">Official Complaint Receipt</div>
      </div>
      <div class="qr-placeholder" title="Scan QR to track online">QR</div>
    </div>
  </div>

  <div class="body">
    <div class="section-title">📋 Complaint Information</div>
    <div class="info-grid" style="margin-bottom:12px;">
      <div class="info-item"><label>Title</label><span>${item.title}</span></div>
      <div class="info-item"><label>Category</label><span>${item.category}</span></div>
      <div class="info-item"><label>Priority</label><span>${item.priority}</span></div>
      <div class="info-item"><label>Status</label><span class="status-badge">${item.status}</span></div>
      <div class="info-item"><label>Assigned Department</label><span>${deptName}</span></div>
      <div class="info-item"><label>Date Submitted</label><span>${new Date(item.createdAt).toLocaleString('en-IN')}</span></div>
      <div class="info-item"><label>Citizen Support Votes</label><span>👍 ${item.supportCount}</span></div>
      <div class="info-item"><label>ETA</label><span>${item.priority === 'Emergency' ? 'Within 24 Hours' : item.priority === 'High' ? 'Within 3 Days' : item.priority === 'Medium' ? 'Within 7 Days' : 'Within 14 Days'}</span></div>
    </div>

    <div class="section-title">📝 Description</div>
    <div class="desc-box">${item.description}</div>

    <div class="section-title">🔄 Current Progress</div>
    <div class="stepper">${stepperHtml}</div>

    ${item.latitude ? `<div class="section-title">📍 Location</div>
    <div class="info-grid">
      <div class="info-item"><label>Latitude</label><span>${item.latitude}</span></div>
      <div class="info-item"><label>Longitude</label><span>${item.longitude}</span></div>
    </div>` : ''}

    <div class="section-title">ℹ️ What Happens Next</div>
    <ol style="font-size:0.82rem;padding-left:18px;line-height:1.8;color:#475569;">
      <li>Your complaint is reviewed and verified by the admin.</li>
      <li>It is assigned to the <strong>${deptName}</strong> for action.</li>
      <li>The department officer updates the status as work progresses.</li>
      <li>You will see the status change from <em>Submitted → In Progress → Resolved</em>.</li>
      <li>Track anytime using your Complaint ID: <strong>${item.complaintId}</strong></li>
    </ol>
  </div>

  <div class="footer">
    <strong>CivicPulse</strong> — Karnataka Government Smart Civic Monitoring System &nbsp;|&nbsp;
    Track online at <em>http://localhost:3000/complaint-details.html?ref=${item.complaintId}</em><br>
    Generated on ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp; This is an auto-generated receipt.
  </div>
</div>
<script>window.onload=()=>{window.print();}<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(receiptHtml);
    win.document.close();
  } else {
    showToast('Please allow popups to download the receipt.', 'warning');
  }
}


/**
 * Priority Badge CSS Mapping
 */
function getPriorityBadgeClass(priority) {
  switch (priority) {
    case 'Low': return 'badge-priority-low';
    case 'Medium': return 'badge-priority-medium';
    case 'High': return 'badge-priority-high';
    case 'Emergency': return 'badge-priority-emergency';
    default: return 'bg-secondary';
  }
}

/**
 * Status Badge CSS Mapping
 */
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

/**
 * Filter complaints dynamically on search or drop-down changes
 */
function applyFilters() {
  const searchVal = document.getElementById('table-search').value.toLowerCase().trim();
  const categoryVal = document.getElementById('filter-category').value;
  const statusVal = document.getElementById('filter-status').value;

  const filtered = userComplaints.filter(c => {
    const matchesSearch = c.complaintId.toLowerCase().includes(searchVal) ||
                          c.title.toLowerCase().includes(searchVal) ||
                          c.description.toLowerCase().includes(searchVal);
    const matchesCategory = !categoryVal || c.category === categoryVal;
    const matchesStatus = !statusVal || c.status === statusVal;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  renderComplaintsTable(filtered);
}

/**
 * Initialize Leaflet map with complaint pin positions
 */
function initCitizenMap(complaints) {
  // If there are coordinates, center map there. Otherwise center on standard coords
  let centerLat = 12.9716;
  let centerLon = 77.5946;

  // Find first complaint with location
  const withLocation = complaints.find(c => c.latitude && c.longitude);
  if (withLocation) {
    centerLat = withLocation.latitude;
    centerLon = withLocation.longitude;
  }

  // Destroy map if it exists
  if (mapInstance) {
    mapInstance.remove();
  }

  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  mapInstance = L.map('map').setView([centerLat, centerLon], 13);

  // Set tile layer (Google Maps style)
  L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps',
    maxZoom: 20
  }).addTo(mapInstance);

  // Add markers
  complaints.forEach(item => {
    if (!item.latitude || !item.longitude) return;

    // Determine marker color based on priority
    let markerColor = 'blue';
    if (item.priority === 'High') markerColor = 'orange';
    if (item.priority === 'Emergency') markerColor = 'red';

    // Simple custom marker html
    const customIcon = L.divIcon({
      html: `<i class="bi bi-geo-alt-fill text-${markerColor === 'red' ? 'danger' : markerColor === 'orange' ? 'warning' : 'primary'} fs-3"></i>`,
      className: 'custom-map-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 24]
    });

    const marker = L.marker([item.latitude, item.longitude], { icon: customIcon }).addTo(mapInstance);
    
    // Popup binding
    marker.bindPopup(`
      <div style="font-family: 'Inter', sans-serif;">
        <span class="badge ${getStatusBadgeClass(item.status)} mb-2">${item.status}</span>
        <h6 class="fw-bold mb-1">${item.title}</h6>
        <p class="text-muted small mb-2">${item.category} • Priority: ${item.priority}</p>
        <a href="complaint-details.html?id=${item._id}" class="btn btn-primary btn-sm w-100 py-1 text-white text-decoration-none">
          <i class="bi bi-eye"></i> Track Details
        </a>
      </div>
    `);
  });
}
