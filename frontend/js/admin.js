/* ==========================================================================
   Smart Civic Issues Monitoring and Response System - Admin Dashboard script
   ========================================================================== */

let adminMap;
let categoryChartInstance;
let departmentChartInstance;
let priorityChartInstance;
let monthlyChartInstance;

// Complaints Pagination parameters
let complaintsPage = 1;
let complaintsTotalPages = 1;

document.addEventListener('DOMContentLoaded', () => {
  // Validate Admin Access
  const user = checkAdminAccess();
  if (!user) return;

  // Initialize Analytics & Map
  loadAnalytics();

  // Load secondary lists
  fetchManageComplaints();
  fetchAdminUsers();
  fetchAdminDepartments();

  // Attach search and filter event listeners for management tabs
  document.getElementById('complaints-search').addEventListener('input', () => { complaintsPage = 1; fetchManageComplaints(); });
  document.getElementById('complaints-filter-category').addEventListener('change', () => { complaintsPage = 1; fetchManageComplaints(); });
  document.getElementById('complaints-filter-status').addEventListener('change', () => { complaintsPage = 1; fetchManageComplaints(); });

  // Bind creators
  document.getElementById('create-authority-form').addEventListener('submit', handleCreateAuthority);
  document.getElementById('create-dept-form').addEventListener('submit', handleCreateDept);

  // Bind Export Actions
  document.getElementById('btn-export-csv').addEventListener('click', exportComplaintsToCSV);
  document.getElementById('btn-export-excel').addEventListener('click', exportComplaintsToExcel);
  document.getElementById('btn-print-pdf').addEventListener('click', printPDFReport);

  // Re-adjust map rendering when shifting tabs in Bootstrap
  const tabEl = document.querySelector('button[data-bs-target="#tab-analytics"]');
  if (tabEl) {
    tabEl.addEventListener('shown.bs.tab', () => {
      if (adminMap) {
        adminMap.invalidateSize();
      }
    });
  }
});

/**
 * Access Guard
 */
function checkAdminAccess() {
  const userStr = localStorage.getItem('user');
  const token = localStorage.getItem('token');

  let user = null;
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    console.error('Corrupted user data in localStorage', e);
  }
  
  if (!user || !token) {
    // Show message before redirect
    showToast('⚠️ Please log in to access the Admin Portal.', 'warning');
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
    return null;
  }
  if (user.role !== 'admin') {
    showToast('🚫 Access denied. Admin privileges required.', 'danger');
    setTimeout(() => { window.location.href = 'citizen.html'; }, 1200);
    return null;
  }
  return user;
}

/**
 * Fetch stats, maps, and generate charts
 */
async function loadAnalytics() {
  try {
    const res = await apiRequest('/admin/analytics');
    if (res.success) {
      const data = res.data;
      
      // Update counters (with null checks)
      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val ?? '0'; };
      setEl('admin-total-complaints', data.summary.totalComplaints);
      setEl('admin-open-complaints', data.summary.openComplaints);
      setEl('admin-resolved-complaints', data.summary.resolvedComplaints);
      setEl('admin-rejected-complaints', data.summary.rejectedComplaints);
      setEl('admin-todays-complaints', data.summary.todaysComplaints);

      // Draw Maps & Charts
      renderAdminMap();
      drawCharts(data);
    } else {
      showToast('⚠️ Could not load analytics data. Please try refreshing the page.', 'warning');
    }
  } catch (error) {
    console.error('Failed to load analytics details:', error);
    showToast(`❌ Admin dashboard error: ${error.message || 'Connection failed'}. Is the backend server running?`, 'danger');
  }
}

/**
 * Fetch and plot all complaints to Leaflet heatmap
 */
async function renderAdminMap() {
  try {
    const res = await apiRequest('/complaints?limit=1000'); // Fetch a large batch to map
    if (!res.success) return;
    const complaints = res.data;

    let centerLat = 12.9716;
    let centerLon = 77.5946;
    
    // Find first valid coordinates
    const withLocation = complaints.find(c => c.latitude && c.longitude);
    if (withLocation) {
      centerLat = withLocation.latitude;
      centerLon = withLocation.longitude;
    }

    if (adminMap) {
      adminMap.remove();
    }

    adminMap = L.map('map').setView([centerLat, centerLon], 12);

    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: '&copy; Google Maps',
      maxZoom: 20
    }).addTo(adminMap);

    complaints.forEach(item => {
      if (!item.latitude || !item.longitude) return;

      // Pin Color based on priority
      let pinColor = 'blue';
      if (item.priority === 'High') pinColor = 'orange';
      if (item.priority === 'Emergency') pinColor = 'red';
      if (item.status === 'Resolved' || item.status === 'Closed') pinColor = 'green';

      const customIcon = L.divIcon({
        html: `<i class="bi bi-geo-alt-fill text-${pinColor === 'red' ? 'danger' : pinColor === 'orange' ? 'warning' : pinColor === 'green' ? 'success' : 'primary'} fs-3"></i>`,
        className: 'custom-map-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 24]
      });

      const marker = L.marker([item.latitude, item.longitude], { icon: customIcon }).addTo(adminMap);
      
      marker.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; min-width: 150px;">
          <span class="badge ${getStatusBadgeClass(item.status)} mb-2">${item.status}</span>
          <h6 class="fw-bold mb-1">${item.title}</h6>
          <p class="text-muted small mb-2">${item.category} • Priority: ${item.priority}</p>
          <a href="complaint-details.html?id=${item._id}" class="btn btn-primary btn-sm w-100 py-1 text-white text-decoration-none">
            <i class="bi bi-eye"></i> Track
          </a>
        </div>
      `);
    });
  } catch (error) {
    console.error('Failed to plot admin map:', error);
  }
}

/**
 * Draw ChartJS Panels
 */
function drawCharts(analytics) {
  // Chart Colors
  const chartColors = ['#3b82f6', '#10b981', '#f59e0b', '#dc2626', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

  // 1. Category Chart
  const categoryCanvas = document.getElementById('chart-category');
  if (categoryCanvas) {
    if (categoryChartInstance) categoryChartInstance.destroy();
    
    const labels = analytics.categoryWise.map(c => c._id || 'Unclassified');
    const counts = analytics.categoryWise.map(c => c.count);

    categoryChartInstance = new Chart(categoryCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: chartColors.slice(0, labels.length),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12 } }
        }
      }
    });
  }

  // 2. Department Chart
  const departmentCanvas = document.getElementById('chart-department');
  if (departmentCanvas) {
    if (departmentChartInstance) departmentChartInstance.destroy();

    const depts = analytics.departmentWise.map(d => d.departmentName);
    const totals = analytics.departmentWise.map(d => d.total);
    const resolved = analytics.departmentWise.map(d => d.resolved);

    departmentChartInstance = new Chart(departmentCanvas, {
      type: 'bar',
      data: {
        labels: depts,
        datasets: [
          {
            label: 'Assigned Issues',
            data: totals,
            backgroundColor: '#3b82f6'
          },
          {
            label: 'Resolved Fixes',
            data: resolved,
            backgroundColor: '#10b981'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  // 3. Priority Chart
  const priorityCanvas = document.getElementById('chart-priority');
  if (priorityCanvas) {
    if (priorityChartInstance) priorityChartInstance.destroy();

    const labels = analytics.priorityWise.map(p => p._id);
    const counts = analytics.priorityWise.map(p => p.count);

    priorityChartInstance = new Chart(priorityCanvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#7f1d1d'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }

  // 4. Monthly Ingestion Chart
  const monthlyCanvas = document.getElementById('chart-monthly');
  if (monthlyCanvas) {
    if (monthlyChartInstance) monthlyChartInstance.destroy();

    const labels = analytics.monthlyTrends.map(m => m.label);
    const counts = analytics.monthlyTrends.map(m => m.count);

    monthlyChartInstance = new Chart(monthlyCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Complaints Ingested',
          data: counts,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
}

/**
 * Tab 2: Manage Complaints (Paginated, Searchable)
 */
async function fetchManageComplaints() {
  const keyword = document.getElementById('complaints-search').value.toLowerCase().trim();
  const category = document.getElementById('complaints-filter-category').value;
  const status = document.getElementById('complaints-filter-status').value;

  renderSkeletonTable('admin-complaints-tbody', 5, 7);

  try {
    const res = await apiRequest(`/complaints?page=${complaintsPage}&limit=10&keyword=${keyword}&category=${category}&status=${status}`);
    if (res.success) {
      renderManageComplaintsTable(res.data);
      renderPaginationControls(res.pagination);
    }
  } catch (error) {
    console.error('Failed to load global complaints:', error);
  }
}

function renderManageComplaintsTable(list) {
  const tbody = document.getElementById('admin-complaints-tbody');
  const emptyState = document.getElementById('admin-complaints-empty');
  tbody.innerHTML = '';

  if (list.length === 0) {
    emptyState.classList.remove('d-none');
    return;
  } else {
    emptyState.classList.add('d-none');
  }

  list.forEach(item => {
    const priorityClass = getPriorityBadgeClass(item.priority);
    const statusClass = getStatusBadgeClass(item.status);
    const deptName = item.departmentId ? item.departmentId.departmentName : 'Unassigned';

    // Enable/disable verify action based on current status
    const canVerify = !['Resolved', 'Closed', 'Rejected'].includes(item.status);
    const canEscalate = item.priority !== 'Emergency' && !['Resolved', 'Closed', 'Rejected'].includes(item.status);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="text-primary fw-bold text-nowrap">${item.complaintId}</span></td>
      <td>
        <div class="fw-semibold text-truncate" style="max-width: 170px;" title="${item.title}">${item.title}</div>
        <small class="text-muted-custom">Dept: ${deptName}</small>
      </td>
      <td><span class="small">${item.category}</span></td>
      <td><span class="badge ${priorityClass}">${item.priority}</span></td>
      <td><span class="badge ${statusClass}">${item.status}</span></td>
      <td class="text-center"><span class="badge bg-light text-dark border">${item.supportCount}</span></td>
      <td class="text-center">
        <div class="d-flex gap-1 justify-content-center flex-wrap">
          <a href="complaint-details.html?id=${item._id}" class="btn btn-outline-primary btn-sm py-0.5 px-1.5" title="Track & Details">
            <i class="bi bi-eye"></i> Track
          </a>
          <button type="button" class="btn btn-outline-success btn-sm py-0.5 px-1.5" 
                  onclick="openVerifyModal(${JSON.stringify(item).replace(/"/g, '&quot;')})" 
                  ${canVerify ? '' : 'disabled'} title="Verify & Assign Department">
            <i class="bi bi-patch-check"></i> Verify
          </button>
          <button type="button" class="btn btn-outline-warning btn-sm py-0.5 px-1.5" 
                  onclick="confirmEscalateComplaint('${item._id}', '${item.complaintId}')" 
                  ${canEscalate ? '' : 'disabled'} title="Escalate to Emergency">
            <i class="bi bi-lightning-fill"></i> Escalate
          </button>
          <button type="button" class="btn btn-outline-danger btn-sm py-0.5 px-1.5" onclick="confirmDeleteComplaint('${item._id}', '${item.complaintId}')" title="Delete Complaint">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}


function renderPaginationControls(p) {
  complaintsTotalPages = p.pages;
  document.getElementById('complaints-pagination-info').innerText = `Showing page ${p.page} of ${p.pages} (${p.total} total complaints)`;
  
  const container = document.getElementById('complaints-pagination');
  container.innerHTML = '';

  // Prev button
  const prevLi = document.createElement('li');
  prevLi.className = `page-item ${p.page === 1 ? 'disabled' : ''}`;
  prevLi.innerHTML = `<a class="page-link" href="#" onclick="changeComplaintsPage(${p.page - 1}); return false;">Previous</a>`;
  container.appendChild(prevLi);

  // Pages
  for (let i = 1; i <= p.pages; i++) {
    const li = document.createElement('li');
    li.className = `page-item ${p.page === i ? 'active' : ''}`;
    li.innerHTML = `<a class="page-link" href="#" onclick="changeComplaintsPage(${i}); return false;">${i}</a>`;
    container.appendChild(li);
  }

  // Next button
  const nextLi = document.createElement('li');
  nextLi.className = `page-item ${p.page === p.pages ? 'disabled' : ''}`;
  nextLi.innerHTML = `<a class="page-link" href="#" onclick="changeComplaintsPage(${p.page + 1}); return false;">Next</a>`;
  container.appendChild(nextLi);
}

window.changeComplaintsPage = function(pageNum) {
  if (pageNum < 1 || pageNum > complaintsTotalPages) return;
  complaintsPage = pageNum;
  fetchManageComplaints();
};

window.confirmDeleteComplaint = async function(mongoId, complaintId) {
  if (confirm(`Are you sure you want to delete complaint ${complaintId} and all its associated timeline logs? This action is irreversible.`)) {
    try {
      const res = await apiRequest(`/admin/complaints/${mongoId}`, {
        method: 'DELETE'
      });

      if (res.success) {
        showToast(`Complaint ${complaintId} deleted successfully`, 'success');
        fetchManageComplaints(); // Reload complaints list
        loadAnalytics(); // Reload metrics/maps
      }
    } catch (error) {
      console.error('Failed to delete complaint:', error);
    }
  }
};

window.confirmEscalateComplaint = async function(mongoId, complaintId) {
  if (confirm(`Are you sure you want to ESCALATE complaint ${complaintId} to EMERGENCY priority? This will log an escalation timeline update and email the assigned division officer.`)) {
    try {
      const res = await apiRequest(`/admin/complaints/${mongoId}/escalate`, {
        method: 'PUT'
      });

      if (res.success) {
        showToast(`Complaint ${complaintId} escalated to Emergency priority!`, 'success');
        fetchManageComplaints(); // Reload complaints list
        loadAnalytics(); // Reload metrics/maps
      }
    } catch (error) {
      console.error('Failed to escalate complaint:', error);
    }
  }
};


/**
 * Tab 3: Manage Users & Roles
 */
async function fetchAdminUsers() {
  try {
    const res = await apiRequest('/admin/users');
    if (res.success) {
      renderAdminUsersTable(res.data);
    }
  } catch (error) {
    console.error('Failed to load users:', error);
  }
}

function renderAdminUsersTable(list) {
  const tbody = document.getElementById('admin-users-tbody');
  tbody.innerHTML = '';

  list.forEach(item => {
    const roleBadge = item.role === 'authority' ? 'bg-indigo text-dark border border-indigo' : 'bg-light text-dark border';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="fw-semibold">${item.name}</div></td>
      <td>${item.email}</td>
      <td>${item.phone}</td>
      <td><span class="badge ${roleBadge}">${item.role}</span></td>
      <td>
        <span class="badge ${item.isActive ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'}">
          ${item.isActive ? 'Active' : 'Deactivated'}
        </span>
      </td>
      <td class="text-center">
        <div class="form-check form-switch d-inline-block">
          <input class="form-check-input" type="checkbox" role="switch" ${item.isActive ? 'checked' : ''} onchange="toggleUserActiveState('${item._id}', '${item.name}')">
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.toggleUserActiveState = async function(userId, name) {
  try {
    const res = await apiRequest(`/admin/users/${userId}/toggle-status`, {
      method: 'PUT'
    });

    if (res.success) {
      showToast(res.message, 'success');
      fetchAdminUsers(); // Refresh users list
    }
  } catch (error) {
    console.error('Failed to toggle user status:', error);
  }
};

/**
 * Create Government Authority User
 */
async function handleCreateAuthority(e) {
  e.preventDefault();
  const form = e.target;

  if (!form.checkValidity()) {
    e.stopPropagation();
    form.classList.add('was-validated');
    return;
  }

  const name = document.getElementById('auth-name').value.trim();
  const email = document.getElementById('auth-email').value.trim();
  const phone = document.getElementById('auth-phone').value.trim();
  const password = document.getElementById('auth-password').value;
  const deptSelect = document.getElementById('auth-dept');
  const departmentId = deptSelect.value || null;

  try {
    const res = await apiRequest('/admin/authorities', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone, password, departmentId })
    });

    if (res.success) {
      showToast('Government Officer created successfully!', 'success');
      form.reset();
      form.classList.remove('was-validated');
      fetchAdminUsers(); // Reload table
      fetchAdminDepartments(); // Reload departments to see linked info
    }
  } catch (error) {
    console.error('Failed to create officer credentials:', error);
  }
}

/**
 * Tab 4: Manage Departments
 */
async function fetchAdminDepartments() {
  try {
    const res = await apiRequest('/departments');
    if (res.success) {
      renderAdminDeptsTable(res.data);
      populateDeptDropdowns(res.data);
    }
  } catch (error) {
    console.error('Failed to load departments:', error);
  }
}

function renderAdminDeptsTable(depts) {
  const tbody = document.getElementById('admin-depts-tbody');
  tbody.innerHTML = '';

  depts.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="fw-bold">${item.departmentName}</div></td>
      <td>${item.officerName || '<span class="text-muted">Unassigned</span>'}</td>
      <td>${item.officerEmail}</td>
      <td>${item.phone}</td>
      <td class="text-center">
        <button type="button" class="btn btn-outline-danger btn-sm py-0.5 px-2" onclick="confirmDeleteDepartment('${item._id}', '${item.departmentName}')" title="Delete Department">
          <i class="bi bi-trash"></i> Delete
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}


function populateDeptDropdowns(depts) {
  const dropdown = document.getElementById('auth-dept');
  dropdown.innerHTML = '<option value="">Do Not Link Directly</option>';
  
  depts.forEach(item => {
    const option = document.createElement('option');
    option.value = item._id;
    option.innerText = item.departmentName;
    dropdown.appendChild(option);
  });
}

async function handleCreateDept(e) {
  e.preventDefault();
  const form = e.target;

  if (!form.checkValidity()) {
    e.stopPropagation();
    form.classList.add('was-validated');
    return;
  }

  const departmentName = document.getElementById('dept-name').value.trim();
  const officerName = document.getElementById('dept-officer').value.trim();
  const officerEmail = document.getElementById('dept-email').value.trim();
  const phone = document.getElementById('dept-phone').value.trim();

  try {
    const res = await apiRequest('/departments', {
      method: 'POST',
      body: JSON.stringify({ departmentName, officerName, officerEmail, phone })
    });

    if (res.success) {
      showToast('Department created successfully!', 'success');
      form.reset();
      form.classList.remove('was-validated');
      fetchAdminDepartments(); // Reload table
      loadAnalytics(); // Reload metrics & charts
    }
  } catch (error) {
    console.error('Failed to create department:', error);
  }
}

window.confirmDeleteDepartment = async function(deptId, deptName) {
  if (confirm(`Are you sure you want to delete department "${deptName}"? This will unassign any active complaints currently routed to this department.`)) {
    try {
      const res = await apiRequest(`/departments/${deptId}`, {
        method: 'DELETE'
      });

      if (res.success) {
        showToast(res.message, 'success');
        fetchAdminDepartments(); // Refresh table
        loadAnalytics(); // Refresh analytics counters
      }
    } catch (error) {
      console.error('Failed to delete department:', error);
    }
  }
};


/**
 * Export all complaints to CSV (Bonus Feature)
 */
async function exportComplaintsToCSV() {
  try {
    // Fetch all complaints at once
    const res = await apiRequest('/complaints?limit=99999');
    if (!res.success) return;
    const list = res.data;

    // CSV Headers
    let csvContent = 'Complaint ID,Title,Description,Category,Priority,Status,Latitude,Longitude,Support Count,Date Reported,Remarks\n';

    // Loop complaints and format row
    list.forEach(item => {
      const escape = (text) => `"${(text || '').toString().replace(/"/g, '""')}"`;
      
      const row = [
        item.complaintId,
        escape(item.title),
        escape(item.description),
        item.category,
        item.priority,
        item.status,
        item.latitude,
        item.longitude,
        item.supportCount,
        formatDate(item.createdAt),
        escape(item.remarks)
      ].join(',');

      csvContent += row + '\n';
    });

    // Create Download Link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CivicPulse_Complaints_Report_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('CSV Report downloaded successfully!', 'success');
  } catch (error) {
    console.error('CSV Export Error:', error);
    showToast('Failed to export CSV report', 'danger');
  }
}

/**
 * Export all complaints to Excel format (Tab Separated)
 */
async function exportComplaintsToExcel() {
  try {
    const res = await apiRequest('/complaints?limit=99999');
    if (!res.success) return;
    const list = res.data;

    let excelContent = 'Complaint ID\tTitle\tDescription\tCategory\tPriority\tStatus\tLatitude\tLongitude\tSupport Count\tDate Reported\tRemarks\n';

    list.forEach(item => {
      const escape = (text) => (text || '').toString().replace(/\t/g, ' ').replace(/\n/g, ' ');
      
      const row = [
        item.complaintId,
        escape(item.title),
        escape(item.description),
        item.category,
        item.priority,
        item.status,
        item.latitude,
        item.longitude,
        item.supportCount,
        formatDate(item.createdAt),
        escape(item.remarks)
      ].join('\t');

      excelContent += row + '\n';
    });

    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `CivicPulse_Complaints_Report_${Date.now()}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Excel Report downloaded successfully!', 'success');
  } catch (error) {
    console.error('Excel Export Error:', error);
    showToast('Failed to export Excel report', 'danger');
  }
}

let currentVerifyComplaintId = null;

window.openVerifyModal = async function(complaint) {
  currentVerifyComplaintId = complaint._id;
  
  // Fill modal text fields
  document.getElementById('verify-modal-complaint-id').innerText = complaint.complaintId;
  document.getElementById('verify-modal-title').innerText = complaint.title;
  document.getElementById('verify-modal-category').innerText = complaint.category;
  document.getElementById('verify-modal-description').innerText = complaint.description;
  
  const statusBadge = document.getElementById('verify-modal-status-badge');
  const statusClass = getStatusBadgeClass(complaint.status);
  statusBadge.innerHTML = `<span class="badge ${statusClass}">${complaint.status}</span>`;
  
  const deptName = complaint.departmentId ? (complaint.departmentId.departmentName || 'Unassigned') : 'Unassigned';
  document.getElementById('verify-modal-current-dept').innerText = deptName;
  
  // Clear remarks
  document.getElementById('verify-remarks').value = '';
  
  // Populate departments dropdown dynamically
  try {
    const res = await apiRequest('/departments');
    if (res.success) {
      const select = document.getElementById('verify-dept-select');
      select.innerHTML = '<option value="">— Keep Existing Department (No Change) —</option>';
      res.data.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept._id;
        opt.innerText = dept.departmentName;
        // Pre-select if currently assigned
        if (complaint.departmentId && (complaint.departmentId._id === dept._id || complaint.departmentId === dept._id)) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    }
  } catch (error) {
    console.error('Failed to load departments for verify modal:', error);
  }
  
  // Open Bootstrap modal
  const modalEl = document.getElementById('verifyModal');
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
};

// Bind Verify assignment form submit
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('verify-assign-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentVerifyComplaintId) return;
      
      const departmentId = document.getElementById('verify-dept-select').value;
      const remarks = document.getElementById('verify-remarks').value.trim();
      
      const submitBtn = document.getElementById('verify-submit-btn');
      if (submitBtn) submitBtn.disabled = true;
      
      try {
        const res = await apiRequest(`/admin/complaints/${currentVerifyComplaintId}/verify`, {
          method: 'PUT',
          body: JSON.stringify({ departmentId, remarks })
        });
        
        if (res.success) {
          showToast('Complaint verified and department assigned successfully!', 'success');
          
          // Hide modal
          const modalEl = document.getElementById('verifyModal');
          const modalInstance = bootstrap.Modal.getInstance(modalEl);
          if (modalInstance) modalInstance.hide();
          
          // Reload dashboard
          fetchManageComplaints();
          loadAnalytics();
        }
      } catch (error) {
        console.error('Failed to verify complaint:', error);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
});

/**
 * Print Admin Dashboard Analytics Report to PDF
 */
function printPDFReport() {
  showToast('Opening PDF Print Preview...', 'info');
  setTimeout(() => {
    window.print();
  }, 500);
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
