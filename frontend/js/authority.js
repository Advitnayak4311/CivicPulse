/* ==========================================================================
   Smart Civic Issues Monitoring and Response System - Authority Dashboard script
   ========================================================================== */

let assignedComplaints = [];
let activeUpdateId = null; // MongoDB ObjectId
let bootstrapModalInstance;

document.addEventListener('DOMContentLoaded', () => {
  // Validate Officer access
  const user = checkAuthorityAccess();
  if (!user) return;

  // Set welcome message
  document.getElementById('authority-welcome').innerText = `Welcome, Officer ${user.name}`;

  // Fetch officer department details
  fetchOfficerDepartment(user.email);

  // Fetch assigned tasks
  fetchAssignedComplaints();

  // Attach search and filter event listeners
  document.getElementById('table-search').addEventListener('input', applyFilters);
  document.getElementById('filter-priority').addEventListener('change', applyFilters);
  document.getElementById('filter-status').addEventListener('change', applyFilters);

  // Form Submit updates
  document.getElementById('status-update-form').addEventListener('submit', handleStatusSubmit);

  // Modal instance handler
  bootstrapModalInstance = new bootstrap.Modal(document.getElementById('statusModal'));
});

/**
 * Access guard
 */
function checkAuthorityAccess() {
  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');
  
  if (!user || !token || user.role !== 'authority') {
    logout(false);
    return null;
  }
  return user;
}

/**
 * Fetch Officer's Division Name dynamically
 */
async function fetchOfficerDepartment(email) {
  try {
    const res = await apiRequest('/departments');
    if (res.success) {
      const match = res.data.find(d => d.officerEmail.toLowerCase() === email.toLowerCase());
      if (match) {
        document.getElementById('authority-dept-badge').innerText = match.departmentName;
      } else {
        document.getElementById('authority-dept-badge').innerText = 'Unlinked Division';
      }
    }
  } catch (error) {
    console.error('Failed to resolve department:', error);
  }
}

/**
 * Fetch assigned complaints from API
 */
async function fetchAssignedComplaints() {
  renderSkeletonTable('authority-complaints-tbody', 4, 7);
  
  try {
    const res = await apiRequest('/complaints');
    if (res.success) {
      assignedComplaints = res.data;
      updateMetrics(assignedComplaints);
      renderComplaintsTable(assignedComplaints);
    }
  } catch (error) {
    console.error('Failed to load assigned complaints:', error);
  }
}

/**
 * Update Metric Cards
 */
function updateMetrics(list) {
  const total = list.length;
  const emergency = list.filter(c => c.priority === 'Emergency').length;
  const wip = list.filter(c => ['Repair Started', 'Repair In Progress', 'Under Review', 'In Progress'].includes(c.status)).length;
  const resolved = list.filter(c => ['Resolved', 'Closed'].includes(c.status)).length;

  document.getElementById('stat-total').innerText = total;
  document.getElementById('stat-emergency').innerText = emergency;
  document.getElementById('stat-progress').innerText = wip;
  document.getElementById('stat-resolved').innerText = resolved;
}

/**
 * Render Complaints to Datagrid
 */
function renderComplaintsTable(list) {
  const tbody = document.getElementById('authority-complaints-tbody');
  const emptyState = document.getElementById('authority-empty-state');
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
    const canAccept = ['Pending', 'Verified', 'Assigned', 'Submitted'].includes(item.status);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="text-primary fw-bold text-nowrap">${item.complaintId}</span></td>
      <td>
        <div class="fw-semibold text-truncate" style="max-width: 220px;">${item.title}</div>
        <small class="text-muted-custom">Category: ${item.category}</small>
      </td>
      <td><span class="badge ${priorityClass}">${item.priority}</span></td>
      <td><span class="badge ${statusClass}">${item.status}</span></td>
      <td class="text-center"><span class="badge bg-light text-dark border"><i class="bi bi-hand-thumbs-up-fill text-primary me-1"></i>${item.supportCount}</span></td>
      <td class="text-nowrap">${formatDate(item.createdAt, false)}</td>
      <td class="text-center">
        <div class="d-flex gap-1 justify-content-center flex-wrap">
          ${canAccept ? `
            <button type="button" class="btn btn-outline-success btn-sm px-2" onclick="acceptComplaint('${item._id}', '${item.complaintId}')" title="Accept Complaint & Begin Repair">
              <i class="bi bi-check-circle-fill"></i> Accept
            </button>
          ` : ''}
          <button type="button" class="btn btn-primary btn-sm px-2" onclick="openUpdateModal('${item._id}', '${item.complaintId}', '${item.status}', \`${item.remarks ? item.remarks.replace(/'/g, "\\'") : ''}\`)">
            <i class="bi bi-pencil-square"></i> Action
          </button>
          <a href="complaint-details.html?id=${item._id}" class="btn btn-outline-secondary btn-sm px-2">
            <i class="bi bi-eye"></i> Track
          </a>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Apply filters client-side
 */
function applyFilters() {
  const searchVal = document.getElementById('table-search').value.toLowerCase().trim();
  const priorityVal = document.getElementById('filter-priority').value;
  const statusVal = document.getElementById('filter-status').value;

  const filtered = assignedComplaints.filter(c => {
    const matchesSearch = c.complaintId.toLowerCase().includes(searchVal) ||
                          c.title.toLowerCase().includes(searchVal) ||
                          c.description.toLowerCase().includes(searchVal);
    const matchesPriority = !priorityVal || c.priority === priorityVal;
    const matchesStatus = !statusVal || c.status === statusVal;

    return matchesSearch && matchesPriority && matchesStatus;
  });

  renderComplaintsTable(filtered);
}

/**
 * Open bootstrap status modal
 */
window.openUpdateModal = function(mongoId, complaintId, currentStatus, currentRemarks) {
  activeUpdateId = mongoId;
  document.getElementById('modal-complaint-id').innerText = complaintId;
  document.getElementById('modal-status-select').value = currentStatus;
  document.getElementById('modal-remarks').value = currentRemarks || '';
  
  // Clear file inputs
  document.getElementById('beforeImage').value = '';
  document.getElementById('afterImage').value = '';

  bootstrapModalInstance.show();
};

/**
 * Submit Status updates via Multipart
 */
async function handleStatusSubmit(e) {
  e.preventDefault();
  const form = e.target;

  if (!form.checkValidity()) {
    e.stopPropagation();
    form.classList.add('was-validated');
    return;
  }

  const status = document.getElementById('modal-status-select').value;
  const remarks = document.getElementById('modal-remarks').value.trim();
  const beforeFile = document.getElementById('beforeImage').files[0];
  const afterFile = document.getElementById('afterImage').files[0];

  try {
    const formData = new FormData();
    formData.append('status', status);
    formData.append('remarks', remarks);
    
    if (beforeFile) formData.append('beforeImage', beforeFile);
    if (afterFile) formData.append('afterImage', afterFile);

    const res = await apiRequest(`/complaints/${activeUpdateId}/status`, {
      method: 'PUT',
      body: formData
    });

    if (res.success) {
      showToast('Complaint stage updated successfully!', 'success');
      bootstrapModalInstance.hide();
      fetchAssignedComplaints(); // Refresh data
    }
  } catch (error) {
    console.error('Update status submit error:', error);
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

// Global chart variables to avoid overlapping instances
let chartResolution = null;
let chartPriority = null;
let chartMonthly = null;

/**
 * Accept assignment for a complaint instantly
 */
window.acceptComplaint = async function(mongoId, complaintId) {
  if (confirm(`Accept assignment for complaint ${complaintId}? This will set status to "In Progress" and notify the citizen.`)) {
    try {
      const formData = new FormData();
      formData.append('status', 'In Progress');
      formData.append('remarks', 'Complaint accepted by department officer. Resolution is underway.');

      const res = await apiRequest(`/complaints/${mongoId}/status`, {
        method: 'PUT',
        body: formData
      });

      if (res.success) {
        showToast(`Complaint ${complaintId} accepted successfully!`, 'success');
        fetchAssignedComplaints(); // Refresh inbox list & metrics
      }
    } catch (error) {
      console.error('Failed to accept complaint:', error);
    }
  }
};

/**
 * Export assigned complaints to Excel/CSV
 */
window.exportAuthorityCSV = function() {
  if (assignedComplaints.length === 0) {
    showToast('No complaints available to export.', 'warning');
    return;
  }

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Complaint ID,Title,Category,Priority,Status,Date Reported,Citizen Name,Citizen Email,Remarks\n";

  assignedComplaints.forEach(c => {
    const id = c.complaintId || '';
    const title = `"${(c.title || '').replace(/"/g, '""')}"`;
    const category = c.category || '';
    const priority = c.priority || '';
    const status = c.status || '';
    const date = formatDate(c.createdAt, false) || '';
    const name = `"${(c.citizenId ? c.citizenId.name : 'Unknown').replace(/"/g, '""')}"`;
    const email = c.citizenId ? c.citizenId.email : 'N/A';
    const remarks = `"${(c.remarks || '').replace(/"/g, '""')}"`;

    csvContent += `${id},${title},${category},${priority},${status},${date},${name},${email},${remarks}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  const badge = document.getElementById('authority-dept-badge');
  const deptName = badge ? badge.innerText.replace(/\s+/g, '_') : 'Division';
  link.setAttribute("download", `CivicPulse_${deptName}_Report.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('CSV Report downloaded successfully!', 'success');
};

/**
 * Export assigned complaints to PDF (printable format)
 */
window.exportAuthorityPDF = function() {
  if (assignedComplaints.length === 0) {
    showToast('No complaints available to print.', 'warning');
    return;
  }

  const badge = document.getElementById('authority-dept-badge');
  const deptName = badge ? badge.innerText : 'Municipal Division';
  
  let html = `
    <html>
      <head>
        <title>CivicPulse Operations Report — ${deptName}</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; }
          .report-header { border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px; }
          .report-title { color: #1e3a8a; font-weight: bold; }
          .table th { background-color: #f1f5f9 !important; color: #1e293b !important; }
        </style>
      </head>
      <body>
        <div class="report-header d-flex justify-content-between align-items-center">
          <div>
            <h1 class="report-title mb-1">CivicPulse Operations Report</h1>
            <p class="text-muted mb-0">Department: <strong>${deptName}</strong> | Date Generated: <strong>${new Date().toLocaleDateString()}</strong></p>
          </div>
          <div class="text-end">
            <span class="badge bg-primary fs-6">Govt. of Karnataka</span>
          </div>
        </div>

        <table class="table table-bordered table-striped">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Citizen Name</th>
              <th>Date Reported</th>
            </tr>
          </thead>
          <tbody>
  `;

  assignedComplaints.forEach(c => {
    html += `
      <tr>
        <td><strong>${c.complaintId}</strong></td>
        <td>${c.title}</td>
        <td>${c.category}</td>
        <td>${c.priority}</td>
        <td>${c.status}</td>
        <td>${c.citizenId ? c.citizenId.name : 'Unknown'}</td>
        <td>${formatDate(c.createdAt, false)}</td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>

        <div class="mt-5 text-center text-muted" style="font-size: 11px;">
          This is a computer-generated operations summary from CivicPulse.
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 1000);
          };
        </script>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

/**
 * Render ChartJS visualizations for assigned complaints
 */
window.renderAuthorityCharts = function() {
  if (assignedComplaints.length === 0) return;

  // Wait a short moment for Bootstrap tab fade transition to finish
  setTimeout(() => {
    // 1. Resolution Metrics Pie Chart
    const resolvedCount = assignedComplaints.filter(c => ['Resolved', 'Closed'].includes(c.status)).length;
    const wipCount = assignedComplaints.filter(c => ['Repair Started', 'Repair In Progress', 'Under Review', 'In Progress'].includes(c.status)).length;
    const pendingCount = assignedComplaints.length - resolvedCount - wipCount;

    const ctxRes = document.getElementById('chart-authority-resolution');
    if (ctxRes) {
      if (chartResolution) chartResolution.destroy();
      chartResolution = new Chart(ctxRes, {
        type: 'pie',
        data: {
          labels: ['Pending / Assigned', 'In Progress', 'Resolved / Closed'],
          datasets: [{
            data: [pendingCount, wipCount, resolvedCount],
            backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || '#333' } }
          }
        }
      });
    }

    // 2. Priority Distribution Doughnut Chart
    const lowCount = assignedComplaints.filter(c => c.priority === 'Low').length;
    const medCount = assignedComplaints.filter(c => c.priority === 'Medium').length;
    const highCount = assignedComplaints.filter(c => c.priority === 'High').length;
    const emergCount = assignedComplaints.filter(c => c.priority === 'Emergency').length;

    const ctxPri = document.getElementById('chart-authority-priority');
    if (ctxPri) {
      if (chartPriority) chartPriority.destroy();
      chartPriority = new Chart(ctxPri, {
        type: 'doughnut',
        data: {
          labels: ['Low', 'Medium', 'High', 'Emergency'],
          datasets: [{
            data: [lowCount, medCount, highCount, emergCount],
            backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || '#333' } }
          }
        }
      });
    }

    // 3. Monthly Trend Line Chart
    const monthlyCounts = {};
    assignedComplaints.forEach(c => {
      const d = new Date(c.createdAt);
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      monthlyCounts[label] = (monthlyCounts[label] || 0) + 1;
    });

    const months = Object.keys(monthlyCounts);
    const dataCounts = Object.values(monthlyCounts);

    const ctxMon = document.getElementById('chart-authority-monthly');
    if (ctxMon) {
      if (chartMonthly) chartMonthly.destroy();
      chartMonthly = new Chart(ctxMon, {
        type: 'line',
        data: {
          labels: months.length > 0 ? months : ['No Data'],
          datasets: [{
            label: 'Complaints Assigned',
            data: dataCounts.length > 0 ? dataCounts : [0],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { display: false }, ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || '#333' } },
            y: { beginAtZero: true, ticks: { stepSize: 1, color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || '#333' } }
          },
          plugins: {
            legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || '#333' } }
          }
        }
      });
    }
  }, 150);
};

