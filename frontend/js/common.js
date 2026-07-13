/* ==========================================================================
   Smart Civic Issues Monitoring and Response System - Shared Utilities
   ========================================================================== */

// Base API configuration (Render backend URL can replace this in production)
const API_BASE_URL = 'https://civicpulse-rkdp.onrender.com/api';

/**
 * Extract query parameters from URL
 */
function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Initialize Theme and App Settings
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  renderCommonNavbar();
  applyTranslations(localStorage.getItem('lang') || 'en');
  loadNotifications();
  initCivicAIChatbot();
});

/**
 * Initialize Light/Dark theme from localStorage
 */
function initTheme() {
  const currentTheme = localStorage.getItem('theme') || 'light';
  if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark-theme');
  } else {
    document.documentElement.classList.remove('dark-theme');
  }
}

/**
 * Toggle Light/Dark Theme
 */
function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark-theme');
  if (isDark) {
    document.documentElement.classList.remove('dark-theme');
    localStorage.setItem('theme', 'light');
    showToast('Theme set to Light Mode', 'info');
  } else {
    document.documentElement.classList.add('dark-theme');
    localStorage.setItem('theme', 'dark');
    showToast('Theme set to Dark Mode', 'info');
  }
  // Dispatches theme changed event for Leaflet maps to redraw or adapt
  window.dispatchEvent(new Event('themeChanged'));
}

/**
 * Standard fetch helper with JWT header inclusion, loading spinner, and global error handling.
 */
async function apiRequest(endpoint, options = {}) {
  // Show loading spinner
  showLoader();

  // Retrieve token from localStorage
  const token = localStorage.getItem('token');
  
  // Set headers
  const headers = { ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Do not set Content-Type if we're sending FormData (e.g. file uploads),
  // browser sets it automatically with the correct boundary
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(url, config);
    const result = await response.json();

    // Hide loading spinner
    hideLoader();

    if (!response.ok) {
      // Automatic session expiration handling
      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        logout(true); // Token expired or invalid
        throw new Error(result.message || 'Session expired. Please login again.');
      }
      const err = new Error(result.message || 'Something went wrong');
      err.status = response.status;
      err.code = result.code;
      throw err;
    }

    return result;
  } catch (error) {
    hideLoader();
    console.error(`API Error [${endpoint}]:`, error.message);
    if (error.code !== 'USER_NOT_FOUND') {
      showToast(error.message, 'danger');
    }
    throw error;
  }
}

/**
 * Loading Spinner display triggers
 */
function showLoader() {
  let loader = document.getElementById('global-spinner');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'global-spinner';
    loader.innerHTML = `
      <div class="position-fixed top-50 start-50 translate-middle d-flex align-items-center justify-content-center" style="z-index: 9999; background: rgba(0,0,0,0.4); width: 100vw; height: 100vh;">
        <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    `;
    document.body.appendChild(loader);
  }
  loader.style.display = 'block';
}

function hideLoader() {
  const loader = document.getElementById('global-spinner');
  if (loader) {
    loader.style.display = 'none';
  }
}

/**
 * Bootstrap Toast Notification System
 */
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container-root');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container-root';
    container.className = 'toast-container-custom';
    document.body.appendChild(container);
  }

  // Select icons and background borders
  let iconClass = 'bi-check-circle-fill';
  let borderClass = 'border-success';
  let textClass = 'text-success';

  if (type === 'danger') {
    iconClass = 'bi-exclamation-triangle-fill';
    borderClass = 'border-danger';
    textClass = 'text-danger';
  } else if (type === 'warning') {
    iconClass = 'bi-exclamation-circle-fill';
    borderClass = 'border-warning';
    textClass = 'text-warning';
  } else if (type === 'info') {
    iconClass = 'bi-info-circle-fill';
    borderClass = 'border-info';
    textClass = 'text-info';
  }

  const toastId = 'toast-' + Date.now();
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center border-start border-4 ${borderClass} show" style="background-color: var(--card-bg) !important; color: var(--text-color) !important;" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="4000">
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center">
          <i class="bi ${iconClass} me-2 fs-5 ${textClass}"></i>
          <span style="color: var(--text-color) !important;">${message}</span>
        </div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `;

  const div = document.createElement('div');
  div.innerHTML = toastHtml.trim();
  const toastElement = div.firstChild;
  container.appendChild(toastElement);

  // Initialize and show toast using Bootstrap
  const bsToast = new bootstrap.Toast(toastElement);
  bsToast.show();

  // Remove element from DOM after hidden
  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

/**
 * Get URL Parameters
 */
function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

/**
 * Format Date to readable format
 */
function formatDate(dateString, includeTime = true) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  return date.toLocaleDateString(undefined, options);
}

/**
 * Clear session and log out
 */
function logout(sessionExpired = false) {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  if (sessionExpired) {
    window.location.href = 'login.html?expired=true';
  } else {
    window.location.href = 'index.html?loggedout=true';
  }
}

/**
 * Render Navbar dynamically depending on the current user status
 */
function renderCommonNavbar() {
  const isDark = document.documentElement.classList.contains('dark-theme');
  const navbarElement = document.getElementById('common-navbar');
  if (!navbarElement) return;

  const user = JSON.parse(localStorage.getItem('user'));
  let navItems = '';

  if (user) {
    // Authenticated Users
    let dashboardHref = 'citizen.html';
    if (user.role === 'authority') dashboardHref = 'authority.html';
    if (user.role === 'admin') dashboardHref = 'admin.html';

    navItems = `
      <li class="nav-item">
        <a class="nav-link" href="${dashboardHref}"><i class="bi bi-speedometer2 me-1"></i><span data-translate="dashboard">Dashboard</span></a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="about.html" data-translate="about">About</a>
      </li>
      
      <!-- Notification Dropdown -->
      <li class="nav-item dropdown me-lg-2">
        <a class="nav-link position-relative dropdown-toggle" href="#" id="notificationDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false" style="padding-right: 15px;">
          <i class="bi bi-bell-fill fs-5"></i>
          <span class="position-absolute top-1 start-75 translate-middle badge rounded-pill bg-danger" id="notif-badge" style="font-size:0.6rem; display:none; padding: 0.25em 0.4em;">0</span>
        </a>
        <ul class="dropdown-menu dropdown-menu-end p-2" aria-labelledby="notificationDropdown" id="notif-list" style="width: 280px; max-height: 350px; overflow-y: auto;">
          <li class="dropdown-header text-center fw-bold" data-translate="recent_updates">Recent Updates</li>
          <li><hr class="dropdown-divider"></li>
          <div id="notif-items-container">
            <li class="text-center text-muted py-2 small" data-translate="no_notifications">No recent updates</li>
          </div>
        </ul>
      </li>

      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="bi bi-person-circle me-1"></i> ${user.name}
        </a>
        <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="navbarDropdown">
          <li><a class="dropdown-item" href="profile.html"><i class="bi bi-person me-2"></i><span data-translate="profile">Profile & Settings</span></a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item text-danger" href="#" onclick="logout(); return false;"><i class="bi bi-box-arrow-right me-2"></i><span data-translate="logout">Logout</span></a></li>
        </ul>
      </li>
    `;
  } else {
    // Guests
    navItems = `
      <li class="nav-item">
        <a class="nav-link" href="about.html" data-translate="about">About</a>
      </li>
      <li class="nav-item">
        <a class="btn ${isDark ? 'btn-outline-light' : 'btn-outline-primary'} ms-2 px-3" href="login.html" data-translate="login">Login</a>
      </li>
      <li class="nav-item">
        <a class="btn btn-primary ms-2 px-3" href="register.html" data-translate="register">Register</a>
      </li>
    `;
  }

  navbarElement.innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
      <div class="container">
        <a class="navbar-brand d-flex align-items-center" href="index.html">
          <span class="ka-logo-badge" title="Government of Karnataka">
            <img src="assets/karnataka-logo.png" alt="Karnataka Seal" onerror="this.parentElement.innerHTML='<span style=&quot;font-size:1rem;font-weight:700;color:#ffd700;&quot;>ಕ</span>'">
          </span>
          <i class="bi bi-shield-shaded me-2 text-primary fs-3"></i>
          <div class="d-flex flex-column">
            <span class="fw-bold lh-1">CivicPulse</span>
            <span style="font-size:0.55rem;color:rgba(255,255,255,0.55);letter-spacing:0.04em;">Govt. of Karnataka</span>
          </div>
        </a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarSupportedContent">
          <ul class="navbar-nav ms-auto align-items-center">
            ${navItems}
            <li class="nav-item ms-lg-3 mt-3 mt-lg-0">
              <select class="form-select form-select-sm" id="lang-selector" onchange="changeLanguage(this.value)" style="min-width: 148px; cursor: pointer; padding: 0.25rem 0.5rem;">
                <option value="en" class="text-dark">English</option>
                <option value="hi" class="text-dark">हिंदी (Hindi)</option>
                <option value="kn" class="text-dark">ಕನ್ನಡ (Kannada)</option>
                <option value="ta" class="text-dark">தமிழ் (Tamil)</option>
                <option value="te" class="text-dark">తెలుగు (Telugu)</option>
                <option value="ml" class="text-dark">മലയാളം (Malayalam)</option>
                <option value="es" class="text-dark">Español (Spanish)</option>
              </select>
            </li>
            <li class="nav-item ms-lg-3 mt-3 mt-lg-0">
              <button class="theme-toggle-btn" onclick="toggleTheme()" aria-label="Toggle dark mode">
                <i class="bi bi-brightness-high-fill" id="theme-icon"></i>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  `;

  // Adjust theme icon indicator state
  const icon = document.getElementById('theme-icon');
  if (icon) {
    if (isDark) {
      icon.className = 'bi bi-moon-fill text-warning';
    } else {
      icon.className = 'bi bi-brightness-high-fill text-warning';
    }
  }
}


/**
 * Injects HTML Skeleton Loading blocks
 */
function renderSkeletonTable(targetId, rows = 5, cols = 4) {
  const target = document.getElementById(targetId);
  if (!target) return;

  let skeletonHtml = '';
  for (let r = 0; r < rows; r++) {
    skeletonHtml += '<tr>';
    for (let c = 0; c < cols; c++) {
      skeletonHtml += `
        <td>
          <div class="skeleton skeleton-text ${c === 0 ? '' : 'short'}"></div>
        </td>
      `;
    }
    skeletonHtml += '</tr>';
  }
  target.innerHTML = skeletonHtml;
}

function renderSkeletonCards(targetId, cardsCount = 3) {
  const target = document.getElementById(targetId);
  if (!target) return;

  let skeletonHtml = '';
  for (let c = 0; c < cardsCount; c++) {
    skeletonHtml += `
      <div class="col-md-4 mb-4">
        <div class="card p-3">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text short"></div>
        </div>
      </div>
    `;
  }
  target.innerHTML = skeletonHtml;
}

/**
 * Fetch and load recent updates into Notification bell
 */
async function loadNotifications() {
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user) return;

  const container = document.getElementById('notif-items-container');
  const badge = document.getElementById('notif-badge');
  if (!container) return;

  try {
    const endpoint = user.role === 'citizen' ? '/complaints/my-complaints' : '/complaints';
    const res = await apiRequest(endpoint);
    
    if (res.success && res.data) {
      const complaints = res.data;
      const recentUpdates = [];

      for (const comp of complaints) {
        recentUpdates.push({
          id: comp.complaintId,
          mongoId: comp._id,
          title: comp.title,
          status: comp.status,
          updatedAt: comp.updatedAt || comp.createdAt
        });
      }

      // Sort by date desc
      recentUpdates.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      const listToShow = recentUpdates.slice(0, 5); // Show top 5 recent updates
      
      if (listToShow.length === 0) {
        container.innerHTML = '<li class="text-center text-muted py-2 small" data-translate="no_notifications">No recent updates</li>';
        if (badge) badge.style.display = 'none';
        return;
      }

      // We can count how many were updated in the last 24 hours for the badge
      const lastDay = Date.now() - 24 * 60 * 60 * 1000;
      const unreadCount = recentUpdates.filter(u => new Date(u.updatedAt).getTime() > lastDay).length;

      if (badge) {
        if (unreadCount > 0) {
          badge.textContent = unreadCount;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }

      container.innerHTML = '';
      listToShow.forEach(item => {
        const li = document.createElement('li');
        li.className = 'p-2 border-bottom border-custom';
        li.style.cursor = 'pointer';
        li.onclick = () => { window.location.href = `complaint-details.html?id=${item.mongoId}`; };
        
        const statusClass = getStatusBadgeClass(item.status);
        li.innerHTML = `
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="fw-bold text-primary small">${item.id}</span>
            <span class="badge ${statusClass}" style="font-size: 0.7rem;">${item.status}</span>
          </div>
          <div class="text-truncate small fw-semibold" style="max-width: 240px; font-size: 0.75rem; color: var(--text-color) !important;">${item.title}</div>
          <div class="text-muted-custom" style="font-size: 0.65rem;">Updated: ${formatDate(item.updatedAt)}</div>
        `;
        container.appendChild(li);
      });
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
  }
}

// Language Translation Map
const TRANSLATIONS = {
  en: {
    "dashboard": "Dashboard",
    "about": "About",
    "profile": "Profile & Settings",
    "logout": "Logout",
    "welcome": "Welcome",
    "report_issue": "Report New Issue",
    "total_reported": "Total Reported",
    "unresolved": "Unresolved Issues",
    "resolved": "Resolved Fixes",
    "complaint_history": "My Complaint History",
    "history": "History",
    "home": "Home",
    "track": "Track",
    "login": "Login",
    "register": "Register",
    "no_notifications": "No recent updates",
    "recent_updates": "Recent Updates",
    "report_new": "Report a New Civic Issue",
    "issue_title": "Short Title / Headline",
    "issue_category": "Issue Category",
    "issue_priority": "Urgency / Priority",
    "issue_description": "Detailed Description",
    "attach_photo": "Attach Photo",
    "submit_complaint": "Submit Complaint",
    "my_profile": "My Profile",
    "change_password": "Change Password",
    "save_changes": "Save Changes",
    "complaint_id": "Complaint Reference ID",
    "track_complaint": "Track Your Complaint",
    "issue_status": "Issue Status",
    "progress_lifecycle": "Issue Progress Lifecycle",
    "assigned_dept": "Assigned Department",
    "date_reported": "Date Reported",
    "support_votes": "Citizen Support Votes",
    "support_complaint": "Support Complaint",
    "report_coordinates": "Report Coordinates",
    "back_dashboard": "Back to Dashboard",
    "back_home": "Back to Home",
    "select_category": "Select a category",
    "use_gps": "Use GPS Location",
    "locating": "Locating...",
    "citizen_portal": "Citizen Portal",
    "authority_portal": "Authority Portal",
    "admin_portal": "Admin Portal",
    "empowering_communities": "Empowering Communities",
    "hero_title": "Smart Civic Issues Monitoring & Response",
    "hero_subtitle": "Report local infrastructure repairs directly to municipal offices. Capture location details instantly, track the live repair workflow, and help build smarter, cleaner cities.",
    "how_it_works": "How it Works",
    "track_instruction": "Enter your Complaint Reference ID to check the live status. No login required.",
    "track_placeholder": "CIV-XXXXXXXX-XXXXX",
    "track_btn": "Track",
    "sdg_title": "Supporting Global Sustainability",
    "sdg_subtitle": "Aligned with United Nations Sustainable Development Goals (SDGs).",
    "sdg_6_title": "Clean Water & Sanitation",
    "sdg_6_desc": "Reporting and resolving water leakages, drainage blockages, and public sanitation defects promptly.",
    "sdg_9_title": "Industry, Innovation & Infrastructure",
    "sdg_9_desc": "Deploying smart workflows to capture structural problems and schedule repair pipelines.",
    "sdg_11_title": "Sustainable Cities & Communities",
    "sdg_11_desc": "Promoting digital citizen participation to ensure clean roads, safe lighting, and community safety.",
    "emergency_card_title": "Facing a Critical Civic Emergency?",
    "emergency_card_desc": "Road cave-in, sewage overflow, fallen tree, exposed live wire? Report instantly — no account needed. Just verify with OTP.",
    "emergency_card_btn": "Report Emergency Now",
    "emergency_footer_note": "For police, fire, or medical emergencies, call 112 immediately.",
    "copyright": "© 2026 CivicPulse Municipal Corporation. All Rights Reserved.",
    "sidebar_dashboard": "Dashboard",
    "sidebar_report_issue": "Report Issue",
    "sidebar_profile": "My Profile",
    "sidebar_logout": "Logout",
    "form_report_new": "Report a New Civic Issue",
    "form_report_desc": "Provide detailed information and location details to help municipal engineers act quickly.",
    "form_title_label": "Short Title / Headline",
    "form_title_placeholder": "e.g. Large pothole near central crossroad",
    "form_category_label": "Issue Category",
    "form_category_placeholder": "Select a category",
    "form_priority_label": "Urgency / Priority",
    "form_desc_label": "Detailed Description",
    "form_desc_placeholder": "Describe the size, impact, hazards, and other helpful remarks...",
    "form_photo_label": "Attach Photo (Max 5MB • JPG, PNG)",
    "form_camera_btn": "Take Live Photo",
    "form_location_label": "Pinpoint Issue Location",
    "form_location_desc": "Click on the map or use the GPS button to set the exact coordinates.",
    "form_gps_btn": "Use GPS Location",
    "form_latitude_label": "Latitude",
    "form_longitude_label": "Longitude",
    "form_submit_btn": "Submit Complaint",
    "profile_settings_title": "Manage Profile Settings",
    "profile_settings_desc": "Keep your account contact information current.",
    "profile_role": "Account Role",
    "profile_name": "Full Name",
    "profile_name_placeholder": "John Doe",
    "profile_email": "Email Address (Registered)",
    "profile_email_help": "Registration emails cannot be changed.",
    "profile_phone": "Phone Number",
    "profile_phone_placeholder": "9998887776",
    "profile_lang": "Preferred System Language",
    "profile_address": "Home Address",
    "profile_address_placeholder": "Street, Area, City",
    "profile_change_pwd": "Change Password",
    "profile_change_pwd_desc": "Password updates require OTP verification for your security. Leave blank to keep current password.",
    "profile_new_pwd": "New Password",
    "profile_new_pwd_placeholder": "At least 6 characters",
    "profile_otp": "Verification OTP",
    "profile_send_otp": "Send OTP Code",
    "profile_otp_help": "OTP will be sent to your registered Email or Phone.",
    "profile_cancel": "Cancel",
    "profile_save": "Save Settings",
    "details_heading": "Complaint Tracking Details",
    "details_sub": "View the lifecycle progress and active department assignment of your reported issue.",
    "details_ref_id": "Complaint Reference ID",
    "details_status": "Issue Status",
    "details_category": "Issue Category",
    "details_priority": "Urgency / Priority",
    "details_description": "Detailed Description",
    "details_date": "Date Reported",
    "details_assigned": "Assigned Department",
    "details_officer": "Officer Name",
    "details_officer_phone": "Officer Phone",
    "details_officer_email": "Officer Email",
    "details_map_title": "Reported Coordinates",
    "details_support_votes": "Citizen Support Votes",
    "details_support_btn": "Support Complaint",
    "details_support_btn_already": "You Supported This",
    "details_feedback_title": "Rate Resolution Feedback",
    "details_feedback_desc": "Your satisfaction feedback helps us improve municipal response times.",
    "details_feedback_rating": "Resolution Rating",
    "details_feedback_remarks": "Comments / Remarks",
    "details_feedback_remarks_placeholder": "Tell us about your experience...",
    "details_feedback_submit": "Submit Feedback",
    "details_feedback_submitted": "Feedback Submitted",
    "details_history_title": "Update History",
    "details_back_dashboard": "Back to Dashboard",
    "emergency_title": "Emergency Civic Reporting",
    "emergency_subtitle": "Report critical hazards that pose an immediate risk to public safety. Direct escalation to emergency squads.",
    "emergency_step1": "1. Verify Identity (OTP)",
    "emergency_step2": "2. Detail Hazard & Location",
    "emergency_step3": "3. Broadcast to Emergency Squad",
    "emergency_phone_label": "Enter Your Mobile Number",
    "emergency_phone_placeholder": "10-digit mobile number",
    "emergency_send_otp": "Send Verification OTP",
    "emergency_enter_otp": "Enter 6-Digit OTP",
    "emergency_verify_otp": "Verify OTP Code",
    "emergency_verified": "Verified successfully! Please describe the emergency below.",
    "emergency_form_title": "Report Critical Civic Hazard",
    "emergency_hazard_type": "Emergency Hazard Type",
    "emergency_select_hazard": "Select hazard type",
    "emergency_hazard_desc": "Describe Situation & Hazard Level",
    "emergency_hazard_desc_placeholder": "Explain what requires immediate attention...",
    "emergency_mic_title": "Speak description",
    "emergency_photo": "Attach Hazard Photo (Highly Recommended)",
    "emergency_camera": "Open Camera",
    "emergency_gps_btn": "Use GPS Location",
    "emergency_submit_btn": "Broadcast Emergency Escalation",
    "how_title": "How CivicPulse Works",
    "how_subtitle": "Report and tracking has never been this straightforward.",
    "how_step1_title": "1. Capture Details",
    "how_step1_desc": "Select categories, upload photos of the breakdown, and pin location automatically via GPS or click the map.",
    "how_step2_title": "2. Auto-Assign",
    "how_step2_desc": "Our system assigns the issue to the relevant department immediately using rules to avoid response lag.",
    "how_step3_title": "3. Track Timeline",
    "how_step3_desc": "Follow the progress live, view images of repairs before/after, and verify execution status yourself.",
    "emergency_escalation": "Instant Escalation",
    "emergency_otp": "OTP Verified",
    "emergency_priority": "Highest Priority",
    "terms": "Terms of Service",
    "privacy": "Privacy Policy",
    "form_photo_help": "Upload visual evidence or take a photo to help workers locate the damage easily.",
    "form_remove_photo": "Remove Photo",
    "camera_accessing": "Accessing camera...",
    "camera_switch": "Switch Camera",
    "duplicate_warning_title": "Similar Unresolved Issue Detected Nearby!",
    "duplicate_warning_desc": "Our system detected a similar unresolved issue reported within 100 meters of your pinned coordinates. Supporting an existing ticket speeds up resolution and prevents administrative clutter.",
    "bypass_duplicate": "Create Duplicate Ticket Anyway",
    "ai_suggestion": "AI Suggestion",
    "apply_ai": "Apply AI Recommendations",
    "capture_photo": "Capture Photo",
    "print_receipt": "Print Receipt",
    "officer_contact": "Assigned Officer Contact",
    "uploaded_image": "Citizen Uploaded Image",
    "repair_visual": "Repair Visual Verification",
    "before_repair": "Before Repair",
    "after_repair": "After Repair",
    "support_widget_title": "Back This Issue",
    "support_widget_desc": "If you are also facing this civic issue, support it instead of filing a duplicate report. Authorities prioritize highly backed issues.",
    "select_rating": "Select Rating",
    "status_submitted": "Submitted",
    "status_verified": "Verified",
    "status_assigned": "Assigned",
    "status_under_review": "Under Review",
    "status_repair_started": "Repair Started",
    "status_repair_in_progress": "Repair In Progress",
    "status_resolved": "Resolved",
    "status_closed": "Closed",
    "status_rejected": "Rejected",
    "sub_submitted": "Complaint received by CivicPulse",
    "sub_verified": "Complaint verified by moderator",
    "sub_assigned": "Sent to department officer",
    "sub_under_review": "Officer reviewing field report",
    "sub_repair_started": "Repair work has begun",
    "sub_repair_in_progress": "Active repair ongoing at site",
    "sub_resolved": "Issue fixed and verified",
    "sub_closed": "Case closed after resolution",
    "sub_rejected": "Complaint was not approved",
    "sympathy_submitted_title": "Thank you for reporting!",
    "sympathy_submitted_body": "We're sorry for the inconvenience this issue has caused. Your complaint has been registered and will be reviewed shortly. We truly appreciate you helping make your city better.",
    "sympathy_verified_title": "We've verified your complaint.",
    "sympathy_verified_body": "Our team has confirmed your report is valid and is being prioritized. We understand this issue is disrupting your daily life, and we sincerely apologize for that.",
    "sympathy_assigned_title": "A team is on it!",
    "sympathy_assigned_body": "Your complaint has been assigned to the responsible department officer. Rest assured, we haven't forgotten you — action is being taken.",
    "sympathy_under_review_title": "Experts are reviewing your issue.",
    "sympathy_under_review_body": "Our field officers are assessing the situation. We deeply understand the inconvenience this has caused and are committed to resolving it as quickly as possible.",
    "sympathy_repair_started_title": "Repair work has begun!",
    "sympathy_repair_started_body": "We're happy to let you know that physical repair work has started at the reported location. Thank you for your patience — we're almost there!",
    "sympathy_repair_in_progress_title": "Active repair in progress.",
    "sympathy_repair_in_progress_body": "Our crew is actively working at the site. We're sorry it took this long and sincerely thank you for bearing with us. Your city is getting better because of you.",
    "sympathy_resolved_title": "Issue Resolved! 🎉",
    "sympathy_resolved_body": "We're delighted to inform you that your complaint has been resolved. Thank you for reporting this issue — your civic participation makes a real difference!",
    "sympathy_closed_title": "Case Closed.",
    "sympathy_closed_body": "This complaint has been fully addressed and closed. Thank you for helping us build a better city. We hope the resolution met your expectations!",
    "sympathy_rejected_title": "We regret to inform you.",
    "sympathy_rejected_body": "Your complaint could not be processed in this system. We sincerely apologize for any inconvenience. Please contact your local municipal office for alternative assistance.",
    "sympathy_delay_title": "We sincerely apologize for the delay.",
    "sympathy_delay_body": "Your complaint has been open for {days} days. We understand this is frustrating and we deeply apologize for the inconvenience. Your issue has been escalated for priority attention. Thank you for your patience.",
    "role_citizen": "Citizen",
    "role_authority": "Authority",
    "role_admin": "Admin",
    "action_by": "Action by",
    "system_user": "System",
    "no_history_logged": "No history logged yet",
    "no_login_needed": "No Login Needed",
    "email_otp": "Email OTP",
    "phone_otp": "Phone OTP",
    "email_otp_help": "OTP will be sent to this email for instant verification.",
    "phone_otp_help": "OTP will be sent via SMS to this phone number.",
    "otp_sent_to": "Enter the 6-digit OTP sent to",
    "dashboard_welcome_subtitle": "Help keep our city clean, safe, and operational.",
    "my_reported_locations": "My Reported Locations",
    "search_placeholder": "Search by ID, keyword...",
    "all_categories": "All Categories",
    "all_statuses": "All Statuses",
    "action_header": "Action",
    "no_complaints_found": "No complaints found",
    "no_complaints_help": "Submit a new complaint to get started.",
    "cat_road_damage": "Road Damage",
    "cat_potholes": "Potholes",
    "cat_garbage_overflow": "Garbage Overflow",
    "cat_drainage_blockage": "Drainage Blockage",
    "cat_street_light_failure": "Street Light Failure",
    "cat_water_leakage": "Water Leakage",
    "cat_water_supply_issue": "Water Supply Issue",
    "cat_public_sanitation": "Public Sanitation",
    "cat_tree_fallen": "Tree Fallen",
    "cat_broken_footpath": "Broken Footpath",
    "cat_traffic_signal_issue": "Traffic Signal Issue",
    "cat_public_property_damage": "Public Property Damage",
    "cat_other": "Other",
    "login_title": "CivicPulse Login",
    "login_desc": "Sign in to report issues or manage complaints",
    "login_username_label": "Email or Phone Number",
    "login_username_placeholder": "your@email.com or 9876543210",
    "login_password_label": "Password",
    "login_password_placeholder": "••••••••",
    "login_no_account": "Don't have an account?",
    "login_register_link": "Register Here",
    "register_title": "Citizen Registration",
    "register_desc": "Create an account to report issues and track repairs",
    "register_name_label": "Full Name",
    "register_name_placeholder": "John Doe",
    "register_email_label": "Email Address (Either Email or Phone is required)",
    "register_email_placeholder": "john@example.com",
    "register_phone_label": "Phone Number (Either Email or Phone is required)",
    "register_phone_placeholder": "9998887776",
    "register_password_placeholder": "At least 6 characters",
    "register_address_label": "Residential Address",
    "register_address_placeholder": "Street, Area, City",
    "register_btn": "Register Account",
    "register_already_account": "Already have an account?",
    "register_login_link": "Login Here",
    "otp_form_title": "Enter Verification Codes",
    "otp_form_desc": "We have sent security codes to verify your identity.",
    "otp_email_label": "Email Verification OTP",
    "otp_phone_label": "Phone Verification OTP",
    "otp_verify_btn": "Verify & Complete Register",
    "otp_back_btn": "Back to Registration Form",
    "copyright": "© 2026 CivicPulse. All Rights Reserved.",
    "forgot_password_link": "Forgot Password?",
    "forgot_password_title": "Reset Password",
    "forgot_password_desc": "Enter your registered email to receive a reset code.",
    "btn_send_reset_otp": "Send Reset Code",
    "reset_otp_label": "Verification OTP Code",
    "reset_otp_placeholder": "Enter 6-digit OTP",
    "new_password_label": "New Password",
    "new_password_placeholder": "At least 6 characters",
    "btn_reset_password": "Update Password",
    "back_to_login": "Back to Login"
  },
  hi: {
    "dashboard": "डैशबोर्ड",
    "about": "विवरण",
    "profile": "प्रोफ़ाइल और सेटिंग्स",
    "logout": "लॉग आउट",
    "welcome": "स्वागत",
    "report_issue": "नई समस्या रिपोर्ट",
    "total_reported": "कुल रिपोर्ट की गई",
    "unresolved": "अनसुलझी समस्याएँ",
    "resolved": "सुलझाए गए कार्य",
    "complaint_history": "मेरा शिकायत इतिहास",
    "history": "इतिहास",
    "home": "मुख्य पृष्ठ",
    "track": "ट्रैक करें",
    "login": "लॉगिन",
    "register": "पंजीकरण",
    "no_notifications": "कोई नया अपडेट नहीं",
    "recent_updates": "हाल के अपडेट",
    "report_new": "नई नागरिक समस्या रिपोर्ट करें",
    "issue_title": "संक्षिप्त शीर्षक",
    "issue_category": "समस्या श्रेणी",
    "issue_priority": "प्राथमिकता",
    "issue_description": "विस्तृत विवरण",
    "attach_photo": "फ़ोटो संलग्न करें",
    "submit_complaint": "शिकायत सबमिट करें",
    "my_profile": "मेरी प्रोफ़ाइल",
    "change_password": "पासवर्ड बदलें",
    "save_changes": "परिवर्तन सहेजें",
    "complaint_id": "शिकायत संदर्भ आईडी",
    "track_complaint": "अपनी शिकायत ट्रैक करें",
    "issue_status": "समस्या की स्थिति",
    "progress_lifecycle": "समस्या प्रगति",
    "assigned_dept": "नियुक्त विभाग",
    "date_reported": "रिपोर्ट की तारीख",
    "support_votes": "नागरिक समर्थन वोट",
    "support_complaint": "शिकायत का समर्थन करें",
    "report_coordinates": "रिपोर्ट निर्देशांक",
    "back_dashboard": "डैशबोर्ड पर वापस",
    "back_home": "मुखपृष्ठ पर वापस",
    "select_category": "श्रेणी चुनें",
    "use_gps": "GPS स्थान उपयोग करें",
    "locating": "खोज रहे हैं...",
    "citizen_portal": "नागरिक पोर्टल",
    "authority_portal": "प्राधिकरण पोर्टल",
    "admin_portal": "व्यवस्थापक पोर्टल",
    "empowering_communities": "समुदायों को सशक्त बनाना",
    "hero_title": "स्मार्ट नागरिक समस्या निगरानी और प्रतिक्रिया",
    "hero_subtitle": "स्थानीय बुनियादी ढांचे की मरम्मत की रिपोर्ट सीधे नगर पालिका को दें। स्थान का विवरण तुरंत कैप्चर करें, लाइव मरम्मत ट्रैक करें, और स्मार्ट और स्वच्छ शहर बनाने में मदद करें।",
    "how_it_works": "यह कैसे काम करता है",
    "track_instruction": "लाइव स्थिति की जांच करने के लिए अपनी शिकायत संदर्भ आईडी दर्ज करें। लॉगिन की आवश्यकता नहीं है।",
    "track_placeholder": "CIV-XXXXXXXX-XXXXX",
    "track_btn": "ट्रैक करें",
    "sdg_title": "वैश्विक स्थिरता का समर्थन",
    "sdg_subtitle": "संयुक्त राष्ट्र सतत विकास लक्ष्यों (SDGs) के अनुरूप।",
    "sdg_6_title": "स्वच्छ जल और स्वच्छता",
    "sdg_6_desc": "पानी के रिसाव, जल निकासी रुकावटों और सार्वजनिक स्वच्छता दोषों की तुरंत रिपोर्टिंग और समाधान।",
    "sdg_9_title": "उद्योग, नवाचार और बुनियादी ढांचा",
    "sdg_9_desc": "ढांचागत समस्याओं को पकड़ने और मरम्मत कार्यों को अनुसूचित करने के लिए स्मार्ट वर्कफ़्लो की तैनाती।",
    "sdg_11_title": "सतत शहर और समुदाय",
    "sdg_11_desc": "सड़क सुरक्षा, सुरक्षित प्रकाश व्यवस्था और सामुदायिक सुरक्षा सुनिश्चित करने के लिए डिजिटल नागरिक भागीदारी को बढ़ावा देना।",
    "emergency_card_title": "महत्वपूर्ण नागरिक आपातकाल का सामना कर रहे हैं?",
    "emergency_card_desc": "सड़क धंसना, सीवेज ओवरफ्लो, पेड़ गिरना, नंगे बिजली के तार? तुरंत रिपोर्ट करें — बिना अकाउंट के। बस OTP से सत्यापित करें।",
    "emergency_card_btn": "अभी आपातकालीन रिपोर्ट करें",
    "emergency_footer_note": "पुलिस, अग्निशमन या चिकित्सा आपात स्थिति के लिए तुरंत 112 पर कॉल करें।",
    "copyright": "© 2026 सिविकपल्स नगर निगम। सर्वाधिकार सुरक्षित।",
    "sidebar_dashboard": "डैशबोर्ड",
    "sidebar_report_issue": "समस्या रिपोर्ट",
    "sidebar_profile": "मेरी प्रोफ़ाइल",
    "sidebar_logout": "लॉग आउट",
    "form_report_new": "नई नागरिक समस्या रिपोर्ट करें",
    "form_report_desc": "नगरपालिका इंजीनियरों को त्वरित कार्रवाई करने में मदद करने के लिए विस्तृत जानकारी और स्थान विवरण प्रदान करें।",
    "form_title_label": "संक्षिप्त शीर्षक",
    "form_title_placeholder": "जैसे: मुख्य चौराहे के पास बड़ा गड्ढा",
    "form_category_label": "समस्या श्रेणी",
    "form_category_placeholder": "श्रेणी चुनें",
    "form_priority_label": "प्राथमिकता",
    "form_desc_label": "विस्तृत विवरण",
    "form_desc_placeholder": "आकार, प्रभाव, खतरों और अन्य उपयोगी टिप्पणियों का वर्णन करें...",
    "form_photo_label": "फोटो संलग्न करें (अधिकतम 5MB • JPG, PNG)",
    "form_camera_btn": "लाइव फोटो लें",
    "form_location_label": "समस्या का स्थान चिन्हित करें",
    "form_location_desc": "सटीक निर्देशांक सेट करने के लिए मानचित्र पर क्लिक करें या GPS बटन का उपयोग करें।",
    "form_gps_btn": "GPS स्थान का उपयोग करें",
    "form_latitude_label": "अक्षांश",
    "form_longitude_label": "देशांतर",
    "form_submit_btn": "शिकायत सबमिट करें",
    "profile_settings_title": "प्रोफ़ाइल सेटिंग प्रबंधित करें",
    "profile_settings_desc": "अपनी संपर्क जानकारी अद्यतित रखें।",
    "profile_role": "खाता भूमिका",
    "profile_name": "पूरा नाम",
    "profile_name_placeholder": "जॉन डो",
    "profile_email": "ईमेल पता (पंजीकृत)",
    "profile_email_help": "पंजीकरण ईमेल बदला नहीं जा सकता।",
    "profile_phone": "फ़ोन नंबर",
    "profile_phone_placeholder": "9998887776",
    "profile_lang": "पसंदीदा सिस्टम भाषा",
    "profile_address": "घर का पता",
    "profile_address_placeholder": "सड़क, क्षेत्र, शहर",
    "profile_change_pwd": "पासवर्ड बदलें",
    "profile_change_pwd_desc": "सुरक्षा के लिए पासवर्ड अपडेट के लिए OTP सत्यापन आवश्यक है। खाली छोड़ें यदि नहीं बदलना है।",
    "profile_new_pwd": "नया पासवर्ड",
    "profile_new_pwd_placeholder": "कम से कम 6 अक्षर",
    "profile_otp": "सत्यापन OTP",
    "profile_send_otp": "OTP कोड भेजें",
    "profile_otp_help": "OTP आपके पंजीकृत ईमेल या फोन पर भेजा जाएगा।",
    "profile_cancel": "रद्द करें",
    "profile_save": "सेटिंग्स सहेजें",
    "details_heading": "शिकायत ट्रैकिंग विवरण",
    "details_sub": "अपनी रिपोर्ट की गई समस्या की प्रगति और नियुक्त विभाग की जाँच करें।",
    "details_ref_id": "शिकायत संदर्भ आईडी",
    "details_status": "समस्या की स्थिति",
    "details_category": "समस्या श्रेणी",
    "details_priority": "प्राथमिकता",
    "details_description": "विस्तृत विवरण",
    "details_date": "रिपोर्ट की तारीख",
    "details_assigned": "नियुक्त विभाग",
    "details_officer": "अधिकारी का नाम",
    "details_officer_phone": "अधिकारी का फोन",
    "details_officer_email": "अधिकारी का ईमेल",
    "details_map_title": "रिपोर्ट निर्देशांक",
    "details_support_votes": "नागरिक समर्थन वोट",
    "details_support_btn": "शिकायत का समर्थन करें",
    "details_support_btn_already": "आपने इसका समर्थन किया है",
    "details_feedback_title": "समाधान पर प्रतिक्रिया दें",
    "details_feedback_desc": "आपकी प्रतिक्रिया नगर पालिका प्रतिक्रिया समय को बेहतर बनाने में मदद करती है।",
    "details_feedback_rating": "समाधान रेटिंग",
    "details_feedback_remarks": "टिप्पणियाँ / रिमार्क्स",
    "details_feedback_remarks_placeholder": "अपने अनुभव के बारे में बताएं...",
    "details_feedback_submit": "प्रतिक्रिया सबमिट करें",
    "details_feedback_submitted": "प्रतिक्रिया सबमिट हो गई",
    "details_history_title": "अद्यतन इतिहास",
    "details_back_dashboard": "डैशबोर्ड पर वापस",
    "emergency_title": "आपातकालीन नागरिक रिपोर्टिंग",
    "emergency_subtitle": "सार्वजनिक सुरक्षा के लिए तत्काल खतरा पैदा करने वाली महत्वपूर्ण समस्याओं की रिपोर्ट करें। आपातकालीन टीमों को सीधे एस्केलेशन।",
    "emergency_step1": "1. पहचान सत्यापित करें (OTP)",
    "emergency_step2": "2. खतरे और स्थान का विवरण",
    "emergency_step3": "3. आपातकालीन टीम को भेजें",
    "emergency_phone_label": "अपना मोबाइल नंबर दर्ज करें",
    "emergency_phone_placeholder": "10-अंकीय मोबाइल नंबर",
    "emergency_send_otp": "सत्यापन OTP भेजें",
    "emergency_enter_otp": "6-अंकीय OTP दर्ज करें",
    "emergency_verify_otp": "OTP कोड सत्यापित करें",
    "emergency_verified": "सफलतापूर्वक सत्यापित! कृपया नीचे आपातकाल का विवरण दें।",
    "emergency_form_title": "क्रिटिकल नागरिक खतरे की रिपोर्ट करें",
    "emergency_hazard_type": "आपातकालीन खतरे का प्रकार",
    "emergency_select_hazard": "खतरे का प्रकार चुनें",
    "emergency_hazard_desc": "स्थिति और खतरे के स्तर का विवरण",
    "emergency_hazard_desc_placeholder": "स्पष्ट करें कि तत्काल ध्यान देने की क्या आवश्यकता है...",
    "emergency_mic_title": "विवरण बोलें",
    "emergency_photo": "खतरे की तस्वीर संलग्न करें (अत्यधिक अनुशंसित)",
    "emergency_camera": "कैमरा खोलें",
    "emergency_gps_btn": "GPS स्थान का उपयोग करें",
    "emergency_submit_btn": "आपातकालीन एस्केलेशन प्रसारित करें",
    "how_title": "सिविकपल्स कैसे काम करता है",
    "how_subtitle": "रिपोर्ट और ट्रैकिंग कभी इतनी सीधी नहीं रही।",
    "how_step1_title": "1. विवरण कैप्चर करें",
    "how_step1_desc": "श्रेणियों का चयन करें, समस्या की तस्वीरें अपलोड करें, और जीपीएस के माध्यम से स्वचालित रूप से स्थान पिन करें या मानचित्र पर क्लिक करें।",
    "how_step2_title": "2. ऑटो-असाइन",
    "how_step2_desc": "प्रतिक्रिया समय कम करने के लिए हमारा सिस्टम तुरंत संबंधित विभाग को समस्या सौंप देता है।",
    "how_step3_title": "3. ट्रैक टाइमलाइन",
    "how_step3_desc": "प्रगति को लाइव ट्रैक करें, मरम्मत से पहले/बाद की तस्वीरें देखें, और स्वयं समाधान सत्यापित करें।",
    "emergency_escalation": "त्वरित समाधान",
    "emergency_otp": "ओटीपी सत्यापित",
    "emergency_priority": "उच्चतम प्राथमिकता",
    "terms": "सेवा की शर्तें",
    "privacy": "गोपनीयता नीति",
    "form_photo_help": "सड़क कर्मियों को नुकसान का पता लगाने में मदद के लिए फ़ोटो संलग्न करें।",
    "form_remove_photo": "फोटो हटाएं",
    "camera_accessing": "कैमरा सक्रिय हो रहा है...",
    "camera_switch": "कैमरा बदलें",
    "duplicate_warning_title": "आस-पास समान अनसुलझी समस्या पाई गई!",
    "duplicate_warning_desc": "आपके द्वारा चुने गए निर्देशांक के 100 मीटर के भीतर एक समान समस्या पहले से दर्ज है। उस शिकायत का समर्थन करने से निवारण तेज होगा।",
    "bypass_duplicate": "फिर भी डुप्लिकेट टिकट बनाएं",
    "ai_suggestion": "एआई सुझाव",
    "apply_ai": "एआई अनुशंसाएं लागू करें",
    "capture_photo": "फ़ोटो लें",
    "print_receipt": "रसीद प्रिंट करें",
    "officer_contact": "नियुक्त अधिकारी का संपर्क",
    "uploaded_image": "नागरिक द्वारा अपलोड की गई फ़ोटो",
    "repair_visual": "मरम्मत दृश्य सत्यापन",
    "before_repair": "मरम्मत से पहले",
    "after_repair": "मरम्मत के बाद",
    "support_widget_title": "इस शिकायत का समर्थन करें",
    "support_widget_desc": "यदि आप भी इस समस्या का सामना कर रहे हैं, तो दोबारा रिपोर्ट करने के बजाय इसका समर्थन करें। अधिकारी अधिक समर्थन वाली समस्याओं को प्राथमिकता देते हैं।",
    "select_rating": "रेटिंग चुनें",
    "status_submitted": "दर्ज की गई",
    "status_verified": "सत्यापित",
    "status_assigned": "सौंपा गया",
    "status_under_review": "समीक्षा के अधीन",
    "status_repair_started": "मरम्मत शुरू",
    "status_repair_in_progress": "मरम्मत प्रगति पर",
    "status_resolved": "सुलझाया गया",
    "status_closed": "बंद कर दिया गया",
    "status_rejected": "अस्वीकृत",
    "sub_submitted": "शिकायत सिविकपल्स द्वारा प्राप्त की गई",
    "sub_verified": "मध्यस्थ द्वारा शिकायत सत्यापित",
    "sub_assigned": "विभाग अधिकारी को भेजा गया",
    "sub_under_review": "अधिकारी फील्ड रिपोर्ट की समीक्षा कर रहे हैं",
    "sub_repair_started": "मरम्मत का काम शुरू हो गया है",
    "sub_repair_in_progress": "साइट पर सक्रिय मरम्मत जारी है",
    "sub_resolved": "समस्या ठीक और सत्यापित हो गई है",
    "sub_closed": "समाधान के बाद मामला बंद",
    "sub_rejected": "शिकायत स्वीकृत नहीं की गई थी",
    "sympathy_submitted_title": "रिपोर्ट करने के लिए धन्यवाद!",
    "sympathy_submitted_body": "हमें इस समस्या के कारण हुई असुविधा के लिए खेद है। आपकी शिकायत दर्ज कर ली गई है और जल्द ही इसकी समीक्षा की जाएगी। अपने शहर को बेहतर बनाने में मदद करने के लिए हम आपकी सराहना करते हैं।",
    "sympathy_verified_title": "हमने आपकी शिकायत का सत्यापन कर लिया है।",
    "sympathy_verified_body": "हमारी टीम ने पुष्टि की है कि आपकी रिपोर्ट मान्य है और इसे प्राथमिकता दी जा रही है। हम समझते हैं कि यह समस्या आपके दैनिक जीवन को प्रभावित कर रही है, और हम इसके लिए ईमानदारी से क्षमा चाहते हैं।",
    "sympathy_assigned_title": "एक टीम इस पर काम कर रही है!",
    "sympathy_assigned_body": "आपकी शिकायत संबंधित विभाग के अधिकारी को सौंप दी गई है। निश्चिंत रहें, हम आपको भूले नहीं हैं — कार्रवाई की जा रही है।",
    "sympathy_under_review_title": "विशेषज्ञ आपकी समस्या की समीक्षा कर रहे हैं।",
    "sympathy_under_review_body": "हमारे फील्ड अधिकारी स्थिति का आकलन कर रहे हैं। हम इस समस्या के कारण हुई असुविधा को समझते हैं और इसे जल्द से जल्द हल करने के लिए प्रतिबद्ध हैं।",
    "sympathy_repair_started_title": "मरम्मत का काम शुरू हो गया है!",
    "sympathy_repair_started_body": "हमें आपको सूचित करते हुए खुशी हो रही है कि रिपोर्ट किए गए स्थान पर मरम्मत का काम शुरू हो गया है। आपके धैर्य के लिए धन्यवाद — हम समाधान के बहुत करीब हैं!",
    "sympathy_repair_in_progress_title": "सक्रिय मरम्मत कार्य प्रगति पर है।",
    "sympathy_repair_in_progress_body": "हमारी टीम साइट पर सक्रिय रूप से काम कर रही है। हमें खेद है कि इसमें इतना समय लगा और हमारे साथ बने रहने के लिए धन्यवाद। आपकी वजह से आपका शहर बेहतर हो रहा है।",
    "sympathy_resolved_title": "समस्या का समाधान हो गया! 🎉",
    "sympathy_resolved_body": "हमें आपको यह सूचित करते हुए खुशी हो रही है कि आपकी शिकायत का समाधान हो गया है। इस समस्या की रिपोर्ट करने के लिए धन्यवाद — आपकी भागीदारी से बदलाव आता है!",
    "sympathy_closed_title": "मामला बंद कर दिया गया है।",
    "sympathy_closed_body": "यह शिकायत पूरी तरह से हल कर दी गई है और बंद कर दी गई है। बेहतर शहर बनाने में मदद के लिए धन्यवाद। हमें उम्मीद है कि समाधान आपकी अपेक्षाओं के अनुरूप था!",
    "sympathy_rejected_title": "हमें खेद है।",
    "sympathy_rejected_body": "इस प्रणाली में आपकी शिकायत पर कार्रवाई नहीं की जा सकी। असुविधा के लिए हम क्षमा चाहते हैं। कृपया सहायता के लिए अपने स्थानीय नगर पालिका कार्यालय से संपर्क करें।",
    "sympathy_delay_title": "देरी के लिए हम ईमानदारी से क्षमा चाहते हैं।",
    "sympathy_delay_body": "आपकी शिकायत {days} दिनों से खुली है। हम समझते हैं कि यह निराशाजनक है और हम इसके लिए क्षमा चाहते हैं। आपकी समस्या को प्राथमिकता दी गई है। धन्यवाद।",
    "role_citizen": "नागरिक",
    "role_authority": "प्राधिकरण",
    "role_admin": "व्यवस्थापक",
    "action_by": "कार्रवाई की",
    "system_user": "प्रणाली",
    "no_history_logged": "अभी तक कोई इतिहास दर्ज नहीं है",
    "no_login_needed": "लॉगिन की आवश्यकता नहीं",
    "email_otp": "ईमेल ओटीपी",
    "phone_otp": "फोन ओटीपी",
    "email_otp_help": "त्वरित सत्यापन के लिए इस ईमेल पर ओटीपी भेजा जाएगा।",
    "phone_otp_help": "इस फोन नंबर पर एसएमएस के माध्यम से ओटीपी भेजा जाएगा।",
    "otp_sent_to": "भेजे गए 6-अंकीय ओटीपी को दर्ज करें",
    "dashboard_welcome_subtitle": "हमारे शहर को साफ, सुरक्षित और चालू रखने में मदद करें।",
    "my_reported_locations": "मेरे द्वारा रिपोर्ट किए गए स्थान",
    "search_placeholder": "आईडी, कीवर्ड द्वारा खोजें...",
    "all_categories": "सभी श्रेणियां",
    "all_statuses": "सभी स्थितियाँ",
    "action_header": "कार्रवाई",
    "no_complaints_found": "कोई शिकायत नहीं मिली",
    "no_complaints_help": "शुरू करने के लिए एक नई शिकायत सबमिट करें।",
    "cat_road_damage": "सड़क क्षति",
    "cat_potholes": "गड्ढे",
    "cat_garbage_overflow": "कचरा ओवरफ्लो",
    "cat_drainage_blockage": "जल निकासी अवरोध",
    "cat_street_light_failure": "स्ट्रीट लाइट विफलता",
    "cat_water_leakage": "पानी का रिसाव",
    "cat_water_supply_issue": "पानी की आपूर्ति की समस्या",
    "cat_public_sanitation": "सार्वजनिक स्वच्छता",
    "cat_tree_fallen": "पेड़ गिरना",
    "cat_broken_footpath": "टूटा हुआ फुटपाथ",
    "cat_traffic_signal_issue": "यातायात संकेत समस्या",
    "cat_public_property_damage": "सार्वजनिक संपत्ति की क्षति",
    "cat_other": "अन्य",
    "login_title": "सिविकपल्स लॉगिन",
    "login_desc": "शिकायतों की रिपोर्ट करने या प्रबंधित करने के लिए साइन इन करें",
    "login_username_label": "ईमेल या फोन नंबर",
    "login_username_placeholder": "your@email.com या 9876543210",
    "login_password_label": "पासवर्ड",
    "login_password_placeholder": "••••••••",
    "login_no_account": "क्या आपके पास खाता नहीं है?",
    "login_register_link": "यहाँ पंजीकरण करें",
    "register_title": "नागरिक पंजीकरण",
    "register_desc": "समस्याओं की रिपोर्ट करने और मरम्मत को ट्रैक करने के लिए एक खाता बनाएं",
    "register_name_label": "पूरा नाम",
    "register_name_placeholder": "John Doe",
    "register_email_label": "ईमेल पता (ईमेल या फोन में से कोई एक आवश्यक है)",
    "register_email_placeholder": "john@example.com",
    "register_phone_label": "फोन नंबर (ईमेल या फोन में से कोई एक आवश्यक है)",
    "register_phone_placeholder": "9998887776",
    "register_password_placeholder": "कम से कम 6 वर्ण",
    "register_address_label": "आवासीय पता",
    "register_address_placeholder": "गली, क्षेत्र, शहर",
    "register_btn": "खाता पंजीकृत करें",
    "register_already_account": "क्या आपके पास पहले से एक खाता है?",
    "register_login_link": "यहाँ लॉगिन करें",
    "otp_form_title": "सत्यापन कोड दर्ज करें",
    "otp_form_desc": "हमने आपकी पहचान सत्यापित करने के लिए सुरक्षा कोड भेजे हैं।",
    "otp_email_label": "ईमेल सत्यापन ओटीपी",
    "otp_phone_label": "फोन सत्यापन ओटीपी",
    "otp_verify_btn": "सत्यापित करें और पंजीकरण पूरा करें",
    "otp_back_btn": "पंजीकरण फॉर्म पर वापस जाएं",
    "copyright": "© 2026 CivicPulse. सर्वाधिकार सुरक्षित‌।",
    "forgot_password_link": "पासवर्ड भूल गए?",
    "forgot_password_title": "पासवर्ड रीसेट करें",
    "forgot_password_desc": "रीसेट कोड प्राप्त करने के लिए अपना पंजीकृत ईमेल दर्ज करें।",
    "btn_send_reset_otp": "रीसेट कोड भेजें",
    "reset_otp_label": "सत्यापन ओटीपी कोड",
    "reset_otp_placeholder": "6-अंकीय ओटीपी दर्ज करें",
    "new_password_label": "नया पासवर्ड",
    "new_password_placeholder": "कम से कम 6 वर्ण",
    "btn_reset_password": "पासवर्ड अपडेट करें",
    "back_to_login": "लॉगिन पर वापस जाएं"
  },
  kn: {
    "dashboard": "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    "about": "ಬಗ್ಗೆ",
    "profile": "ಪ್ರೊಫೈಲ್ ಮತ್ತು ಸೆಟ್ಟಿಂಗ್ಸ್",
    "logout": "ಲಾಗ್ ಔಟ್",
    "welcome": "ಸ್ವಾಗತ",
    "report_issue": "ಹೊಸ ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ",
    "total_reported": "ಒಟ್ಟು ವರದಿಯಾಗಿದೆ",
    "unresolved": "ಬಗೆಹರಿಯದ ಸಮಸ್ಯೆಗಳು",
    "resolved": "ಪರಿಹರಿಸಲಾದ ಸಮಸ್ಯೆಗಳು",
    "complaint_history": "ನನ್ನ ದೂರುಗಳ ಇತಿಹಾಸ",
    "history": "ಇತಿಹಾಸ",
    "home": "ಮುಖಪುಟ",
    "track": "ಟ್ರ್ಯಾಕ್ ಮಾಡಿ",
    "login": "ಲಾಗಿನ್",
    "register": "ನೋಂದಣಿ",
    "no_notifications": "ಯಾವುದೇ ಇತ್ತೀಚಿನ ಅಪ್ಡೇಟ್ ಇಲ್ಲ",
    "recent_updates": "ಇತ್ತೀಚಿನ ಅಪ್ಡೇಟ್‌ಗಳು",
    "report_new": "ಹೊಸ ನಾಗರಿಕ ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ",
    "issue_title": "ಸಮಸ್ಯೆ ಶೀರ್ಷಿಕೆ",
    "issue_category": "ಸಮಸ್ಯೆ ವರ್ಗ",
    "issue_priority": "ಆದ್ಯತೆ",
    "issue_description": "ವಿವರವಾದ ವಿವರಣೆ",
    "attach_photo": "ಫೋಟೋ ಲಗತ್ತಿಸಿ",
    "submit_complaint": "ದೂರು ಸಲ್ಲಿಸಿ",
    "my_profile": "ನನ್ನ ಪ್ರೊಫೈಲ್",
    "change_password": "ಪಾಸ್‌ವರ್ಡ್ ಬದಲಿಸಿ",
    "save_changes": "ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ",
    "complaint_id": "ದೂರು ಉಲ್ಲೇಖ ಐಡಿ",
    "track_complaint": "ನಿಮ್ಮ ದೂರನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ",
    "issue_status": "ಸಮಸ್ಯೆ ಸ್ಥಿತಿ",
    "progress_lifecycle": "ಸಮಸ್ಯೆ ಪ್ರಗತಿ",
    "assigned_dept": "ನಿಯೋಜಿತ ಇಲಾಖೆ",
    "date_reported": "ವರದಿ ಮಾಡಿದ ದಿನಾಂಕ",
    "support_votes": "ನಾಗರಿಕ ಬೆಂಬಲ ಮತಗಳು",
    "support_complaint": "ದೂರಿಗೆ ಬೆಂಬಲ",
    "report_coordinates": "ಸ್ಥಳ ನಿರ್ದೇಶಾಂಕಗಳು",
    "back_dashboard": "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹಿಂತಿರುಗಿ",
    "back_home": "ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ",
    "select_category": "ವರ್ಗ ಆಯ್ಕೆಮಾಡಿ",
    "use_gps": "GPS ಸ್ಥಳ ಬಳಸಿ",
    "locating": "ಪತ್ತೆ ಮಾಡಲಾಗುತ್ತಿದೆ...",
    "citizen_portal": "ನಾಗರಿಕ ಪೋರ್ಟಲ್",
    "authority_portal": "ಪ್ರಾಧಿಕಾರ ಪೋರ್ಟಲ್",
    "admin_portal": "ಆಡಳಿತ ಪೋರ್ಟಲ್",
    "empowering_communities": "ಸಮುದಾಯಗಳ ಸಬಲೀಕರಣ",
    "hero_title": "ಸ್ಮಾರ್ಟ್ ನಾಗರಿಕ ಸಮಸ್ಯೆಗಳ ಮೇಲ್ವಿಚಾರಣೆ ಮತ್ತು ಪ್ರತಿಕ್ರಿಯೆ",
    "hero_subtitle": "ಸ್ಥಳೀಯ ಮೂಲಸೌಕರ್ಯ ಸಮಸ್ಯೆಗಳನ್ನು ನೇರವಾಗಿ ಮುನ್ಸಿಪಲ್ ಕಚೇರಿಗಳಿಗೆ ವರದಿ ಮಾಡಿ. ಸ್ಥಳದ ವಿವರಗಳನ್ನು ತಕ್ಷಣ ಪಡೆದುಕೊಳ್ಳಿ, ಲೈವ್ ದುರಸ್ತಿ ಪ್ರಕ್ರಿಯೆಯನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ, ಮತ್ತು ಸ್ವಚ್ಛ ನಗರ ನಿರ್ಮಾಣಕ್ಕೆ ಸಹಾಯ ಮಾಡಿ.",
    "how_it_works": "ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
    "track_instruction": "ಲೈವ್ ಸ್ಥಿತಿಯನ್ನು ಪರಿಶೀಲಿಸಲು ನಿಮ್ಮ ದೂರು ಉಲ್ಲೇಖ ಐಡಿಯನ್ನು ნಮೂದಿಸಿ. ಲಾಗಿನ್ ಅಗತ್ಯವಿಲ್ಲ.",
    "track_placeholder": "CIV-XXXXXXXX-XXXXX",
    "track_btn": "ಟ್ರ್ಯಾಕ್ ಮಾಡಿ",
    "sdg_title": "ಜಾಗತಿಕ ಸುಸ್ಥಿರತೆಗೆ ಬೆಂಬಲ",
    "sdg_subtitle": "ವಿಶ್ವಸಂಸ್ಥೆಯ ಸುಸ್ಥಿರ ಅಭಿವೃದ್ಧಿ ಗುರಿಗಳಿಗೆ (SDGs) ಹೊಂದಿಕೊಂಡಿದೆ.",
    "sdg_6_title": "ಶುದ್ಧ ನೀರು ಮತ್ತು ನೈರ್ಮಲ್ಯ",
    "sdg_6_desc": "ನೀರು ಸೋರಿಕೆ, ಒಳಚರಂಡಿ ಬ್ಲಾಕ್ ಮತ್ತು ಸಾರ್வಜನಿಕ ನೈರ್ಮಲ್ಯದ ದೋಷಗಳನ್ನು ತಕ್ಷಣ ವರದಿ ಮಾಡುವುದು ಮತ್ತು ಪರಿಹರಿಸುವುದು.",
    "sdg_9_title": "ಉದ್ಯಮ, ನಾವೀನ್ಯತೆ ಮತ್ತು ಮೂಲಸೌಕರ್ಯ",
    "sdg_9_desc": "ರಚನಾತ್ಮಕ ಸಮಸ್ಯೆಗಳನ್ನು ಪತ್ತೆಹಚ್ಚಲು ಮತ್ತು ದುರಸ್ತಿ ಕಾರ್ಯಗಳನ್ನು ನಿಗದಿಪಡಿಸಲು ಸ್ಮಾರ್ಟ್ ಪ್ರಕ್ರಿಯೆಗಳ ಬಳಕೆ.",
    "sdg_11_title": "ಸುಸ್ಥಿರ ನಗರಗಳು ಮತ್ತು ಸಮುದಾಯಗಳು",
    "sdg_11_desc": "ರಸ್ತೆ ಸುರಕ್ಷತೆ, ಸುರಕ್ಷಿತ ಬೆಳಕು ಮತ್ತು ಸಮುದಾಯದ ಭದ್ರತೆಯನ್ನು ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಲು ನಾಗರಿಕರ ಡಿಜಿಟಲ್ ಭಾಗವಹಿಸುವಿಕೆಯನ್ನು ಉತ್ತೇಜಿಸುವುದು.",
    "emergency_card_title": "ತುರ್ತು ನಾಗರಿಕ ಸಮಸ್ಯೆಯನ್ನು ಎದುರಿಸುತ್ತಿದ್ದೀರಾ?",
    "emergency_card_desc": "ರಸ್ತೆ ಕುಸಿತ, ಒಳಚರಂಡಿ ಉಕ್ಕಿ ಹರಿಯುವುದು, ಮರ ಬಿದ್ದಿರುವುದು, ವಿದ್ಯುತ್ ತಂತಿ ತುಂಡಾಗಿರುವುದು? ತಕ್ಷಣ ವರದಿ ಮಾಡಿ — ಖಾತೆಯ ಅಗತ್ಯವಿಲ್ಲ. OTP ಮೂಲಕ ಪರಿಶೀಲಿಸಿ.",
    "emergency_card_btn": "ತುರ್ತು ವರದಿ ಈಗಲೇ ಮಾಡಿ",
    "emergency_footer_note": "ಪೊಲೀಸ್, ಅಗ್ನಿಶಾಮಕ ಅಥವಾ ವೈದ್ಯಕೀಯ ತುರ್ತು ಸಂದರ್ಭಗಳಿಗಾಗಿ ತಕ್ಷಣ 112 ಗೆ ಕರೆ ಮಾಡಿ.",
    "copyright": "© 2026 ಸಿವಿಕ್ ಪಲ್ಸ್ ಮಹಾನಗರ ಪಾಲಿಕೆ. ಎಲ್ಲಾ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ.",
    "sidebar_dashboard": "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
    "sidebar_report_issue": "ಸಮಸ್ಯೆ ವರದಿ",
    "sidebar_profile": "ನನ್ನ ಪ್ರೊಫೈಲ್",
    "sidebar_logout": "ಲಾಗ್ ಔಟ್",
    "form_report_new": "ಹೊಸ ನಾಗರಿಕ ಸಮಸ್ಯೆ ವರದಿ ಮಾಡಿ",
    "form_report_desc": "ಪಾಲಿಕೆ ಇಂಜಿನಿಯರ್‌ಗಳು ತ್ವರಿತವಾಗಿ ಕಾರ್ಯನಿರ್ವಹಿಸಲು ವಿವರವಾದ ಮಾಹಿತಿ ಮತ್ತು ಸ್ಥಳದ ವಿವರಗಳನ್ನು ಒದಗಿಸಿ.",
    "form_title_label": "ಸಮಸ್ಯೆ ಶೀರ್ಷಿಕೆ",
    "form_title_placeholder": "ಉದಾ: ಮುಖ್ಯ ರಸ್ತೆಯ ಹತ್ತಿರ ದೊಡ್ಡ ಹಳ್ಳ ಬಿದ್ದಿದೆ",
    "form_category_label": "ಸಮಸ್ಯೆ ವರ್ಗ",
    "form_category_placeholder": "ವರ್ಗ ಆಯ್ಕೆಮಾಡಿ",
    "form_priority_label": "ಆದ್ಯತೆ",
    "form_desc_label": "ವಿವರವಾದ ವಿವರಣೆ",
    "form_desc_placeholder": "ಸಮಸ್ಯೆಯ ಗಾತ್ರ, ಪ್ರಭಾವ, ಅಪಾಯಗಳು ಮತ್ತು ಇತರ ಉಪಯುಕ್ತ ಮಾಹಿತಿಯನ್ನು ವಿವರಿಸಿ...",
    "form_photo_label": "ಫೋಟೋ ಲಗತ್ತಿಸಿ (ಗರಿಷ್ಠ 5MB • JPG, PNG)",
    "form_camera_btn": "ಲೈವ್ ಫೋಟೋ ತೆಗೆದುಕೊಳ್ಳಿ",
    "form_location_label": "ಸಮಸ್ಯೆಯ ಸ್ಥಳ ಗುರುತಿಸಿ",
    "form_location_desc": "ಸರಿಯಾದ ಸ್ಥಳವನ್ನು ಹೊಂದಿಸಲು ನಕ್ಷೆಯ ಮೇಲೆ ಕ್ಲಿಕ್ ಮಾಡಿ ಅಥವಾ GPS ಬಟನ್ ಬಳಸಿ.",
    "form_gps_btn": "GPS ಸ್ಥಳ ಬಳಸಿ",
    "form_latitude_label": "ಅಕ್ಷಾಂಶ",
    "form_longitude_label": "ರೇಖಾಂಶ",
    "form_submit_btn": "ದೂರು ಸಲ್ಲಿಸಿ",
    "profile_settings_title": "ಪ್ರೊಫೈಲ್ ಸೆಟ್ಟಿಂಗ್ಸ್ ನಿರ್ವಹಿಸಿ",
    "profile_settings_desc": "ನಿಮ್ಮ ಸಂಪರ್ಕ ಮಾಹಿತಿಯನ್ನು ನವೀಕೃತವಾಗಿರಿಸಿ.",
    "profile_role": "ಖಾತೆಯ ಪಾತ್ರ",
    "profile_name": "ಪೂರ್ಣ ಹೆಸರು",
    "profile_name_placeholder": "ಜಾನ್ ಡೋ",
    "profile_email": "ಇಮೇಲ್ ವಿಳಾಸ (ನೋಂದಾಯಿತ)",
    "profile_email_help": "ನೋಂದಾಯಿತ ಇಮೇಲ್ ಬದಲಾಯಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ.",
    "profile_phone": "ಫೋನ್ ಸಂಖ್ಯೆ",
    "profile_phone_placeholder": "9998887776",
    "profile_lang": "ಸಿಸ್ಟಂ ಭಾಷೆ",
    "profile_address": "ಮನೆಯ ವಿಳಾಸ",
    "profile_address_placeholder": "ರಸ್ತೆ, ಪ್ರದೇಶ, ನಗರ",
    "profile_change_pwd": "ಪಾಸ್‌ವರ್ಡ್ ಬದಲಿಸಿ",
    "profile_change_pwd_desc": "ಭದ್ರತೆಗಾಗಿ ಪಾಸ್‌ವರ್ಡ್ ನವೀಕರಣಕ್ಕೆ OTP ಪರಿಶೀಲನೆ ಅಗತ್ಯವಿದೆ. ಬದಲಾಯಿಸದಿದ್ದರೆ ಖಾಲಿ ಬಿಡಿ.",
    "profile_new_pwd": "ಹೊಸ ಪಾಸ್‌ವರ್ಡ್",
    "profile_new_pwd_placeholder": "ಕನಿಷ್ಠ 6 ಅಕ್ಷರಗಳು",
    "profile_otp": "ಪರಿಶೀಲನೆ OTP",
    "profile_send_otp": "OTP ಕೋಡ್ ಕಳುಹಿಸಿ",
    "profile_otp_help": "ನೋಂದಾಯಿತ ಇಮೇಲ್ ಅಥವಾ ಫೋನ್‌ಗೆ OTP ಕಳುಹಿಸಲಾಗುತ್ತದೆ.",
    "profile_cancel": "ರದ್ದುಮಾಡಿ",
    "profile_save": "ಸೆಟ್ಟಿಂಗ್ಸ್ ಉಳಿಸಿ",
    "details_heading": "ದೂರು ಟ್ರ್ಯಾಕಿಂಗ್ ವಿವರಗಳು",
    "details_sub": "ನಿಮ್ಮ ವರದಿಯಾದ ಸಮಸ್ಯೆಯ ಪ್ರಗತಿ ಮತ್ತು ನಿಯೋಜಿತ ಇಲಾಖೆಯನ್ನು ಪರಿಶೀಲಿಸಿ.",
    "details_ref_id": "ದೂರು ಉಲ್ಲೇಖ ಐಡಿ",
    "details_status": "ಸಮಸ್ಯೆ ಸ್ಥಿತಿ",
    "details_category": "ಸಮಸ್ಯೆ ವರ್ಗ",
    "details_priority": "ಆದ್ಯತೆ",
    "details_description": "ವಿವರವಾದ ವಿವರಣೆ",
    "details_date": "ವರದಿ ಮಾಡಿದ ದಿನಾಂಕ",
    "details_assigned": "ನಿಯೋಜಿತ ಇಲಾಖೆ",
    "details_officer": "ಅಧಿಕಾರಿಯ ಹೆಸರು",
    "details_officer_phone": "ಅಧಿಕಾರಿಯ ಫೋನ್",
    "details_officer_email": "ಅಧಿಕಾರಿಯ ಇಮೇಲ್",
    "details_map_title": "ವರದಿಯಾದ ಸ್ಥಳ",
    "details_support_votes": "nಾಗರಿಕ ಬೆಂಬಲ ಮತಗಳು",
    "details_support_btn": "ದೂರಿಗೆ ಬೆಂಬಲ ನೀಡಿ",
    "details_support_btn_already": "ನೀವು ಇದಕ್ಕೆ ಬೆಂಬಲ ನೀಡಿದ್ದೀರಿ",
    "details_feedback_title": "ಪರಿಹಾರದ ಬಗ್ಗೆ ಪ್ರತಿಕ್ರಿಯೆ ನೀಡಿ",
    "details_feedback_desc": "ನಿಮ್ಮ ಪ್ರತಿಕ್ರಿಯೆಯು ಪಾಲಿಕೆ ಸ್ಪಂದನ ಸಮಯವನ್ನು ಸುಧಾರಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.",
    "details_feedback_rating": "ಪರಿಹಾರ ರೇಟಿಂಗ್",
    "details_feedback_remarks": "ಅಭಿಪ್ರಾಯಗಳು / ಟಿಪ್ಪಣಿಗಳು",
    "details_feedback_remarks_placeholder": "ನಿಮ್ಮ ಅನುಭವದ ಬಗ್ಗೆ ತಿಳಿಸಿ...",
    "details_feedback_submit": "ಪ್ರತಿಕ್ರಿಯೆ ಸಲ್ಲಿಸಿ",
    "details_feedback_submitted": "ಪ್ರತಿಕ್ರಿಯೆ ಸಲ್ಲಿಸಲಾಗಿದೆ",
    "details_history_title": "ನವೀಕರಣ ಇತಿಹಾಸ",
    "details_back_dashboard": "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹಿಂತಿರುಗಿ",
    "emergency_title": "ತುರ್ತು ನಾಗರಿಕ ವರದಿ",
    "emergency_subtitle": "ಸಾರ್ವಜನಿಕ ಸುರಕ್ಷತೆಗೆ ತಕ್ಷಣದ ಅಪಾಯವನ್ನುಂಟುಮಾಡುವ ಪ್ರಮುಖ ಸಮಸ್ಯೆಗಳನ್ನು ವರದಿ ಮಾಡಿ. ತುರ್ತು ತಂಡಗಳಿಗೆ ನೇರ ನಿಯೋಜನೆ.",
    "emergency_step1": "1. ಗುರುತು ಪರಿಶೀಲಿಸಿ (OTP)",
    "emergency_step2": "2. ಅಪಾಯ ಮತ್ತು ಸ್ಥಳದ ವಿವರ",
    "emergency_step3": "3. ತುರ್ತು ತಂಡಕ್ಕೆ ಕಳುಹಿಸಿ",
    "emergency_phone_label": "ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ",
    "emergency_phone_placeholder": "10-ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ",
    "emergency_send_otp": "ಪರಿಶೀಲನೆ OTP ಕಳುಹಿಸಿ",
    "emergency_enter_otp": "6-ಅಂಕಿಯ OTP ನಮೂದಿಸಿ",
    "emergency_verify_otp": "OTP ಕೋಡ್ ಪರಿಶೀಲಿಸಿ",
    "emergency_verified": "ಪರಿಶೀಲನೆ ಯಶಸ್ವಿಯಾಗಿದೆ! ದಯವಿಟ್ಟು ತುರ್ತು ಸ್ಥಿತಿಯ ವಿವರವನ್ನು ಕೆಳಗೆ ಬರೆಯಿರಿ.",
    "emergency_form_title": "ಪ್ರಮುಖ ಸಾರ್ವಜನಿಕ ಅಪಾಯವನ್ನು ವರದಿ ಮಾಡಿ",
    "emergency_hazard_type": "ತುರ್ತು ಅಪಾಯದ ಪ್ರಕಾರ",
    "emergency_select_hazard": "ಅಪಾಯದ ಪ್ರಕಾರವನ್ನು ಆರಿಸಿ",
    "emergency_hazard_desc": "ಪರಿಸ್ಥಿತಿ ಮತ್ತು ಅಪಾಯದ ಮಟ್ಟವನ್ನು ವಿವರಿಸಿ",
    "emergency_hazard_desc_placeholder": "ತಕ್ಷಣದ ಗಮನ ಹರಿಸಬೇಕಾದ ಅಗತ್ಯತೆಯನ್ನು ವಿವರಿಸಿ...",
    "emergency_mic_title": "ವಿವರಣೆಯನ್ನು ಮಾತನಾಡಿ",
    "emergency_photo": "ಅಪಾಯದ ಫೋಟೋ ಲಗತ್ತಿಸಿ (ಅತ್ಯಂತ ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ)",
    "emergency_camera": "ಕ್ಯಾಮೆರಾ ತೆರೆಯಿರಿ",
    "emergency_gps_btn": "GPS ಸ್ಥಳ ಬಳಸಿ",
    "emergency_submit_btn": "ತುರ್ತು ಪರಿಸ್ಥಿತಿಯನ್ನು ಪ್ರಸಾರ ಮಾಡಿ",
    "how_title": "ಸಿವಿಕ್ ಪಲ್ಸ್ ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ",
    "how_subtitle": "ವರದಿ ಮತ್ತು ಟ್ರ್ಯಾಕಿಂಗ್ ಎಂದಿಗೂ ಇಷ್ಟು ಸರಳವಾಗಿರಲಿಲ್ಲ.",
    "how_step1_title": "1. ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ",
    "how_step1_desc": "ವರ್ಗಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ, ಸಮಸ್ಯೆಯ ಫೋಟೋಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ, ಮತ್ತು ಜಿಪಿಎಸ್ ಮೂಲಕ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಸ್ಥಳವನ್ನು ಗುರುತಿಸಿ ಅಥವಾ ನಕ್ಷೆಯ ಮೇಲೆ ಕ್ಲಿಕ್ ಮಾಡಿ.",
    "how_step2_title": "2. ಸ್ವಯಂಚಾಲಿತ ನಿಯೋಜನೆ",
    "how_step2_desc": "ವಿಳಂಬವನ್ನು ತಪ್ಪಿಸಲು ನಮ್ಮ ವ್ಯವಸ್ಥೆಯು ಸಂಬಂಧಪಟ್ಟ ಇಲಾಖೆಗೆ ತಕ್ಷಣವೇ ಸಮಸ್ಯೆಯನ್ನು ನಿಯೋಜಿಸುತ್ತದೆ.",
    "how_step3_title": "3. ಪ್ರಗತಿ ಟ್ರ್ಯಾಕ್ ಮಾಡಿ",
    "how_step3_desc": "ದುರಸ್ತಿಯ ಪ್ರಗತಿಯನ್ನು ಲೈವ್ ಆಗಿ ವೀಕ್ಷಿಸಿ, ದುರಸ್ತಿ ಪೂರ್ವ/ನಂತರದ ಫೋಟೋಗಳನ್ನು ನೋಡಿ ಮತ್ತು ಪರಿಹಾರವನ್ನು ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.",
    "emergency_escalation": "ತ್ವರಿത ನಿಯೋಜನೆ",
    "emergency_otp": "OTP ಪರಿಶೀಲಿಸಲಾಗಿದೆ",
    "emergency_priority": "ಅತ್ಯಂತ ಆದ್ಯತೆ",
    "terms": "ಸೇವಾ ನಿಯಮಗಳು",
    "privacy": "ಗೌಪ್ಯತೆ ನೀತಿ",
    "form_photo_help": "ಸಹಾಯ ಮಾಡಲು ಚಿತ್ರವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ ಅಥವಾ ಲೈವ್ ಫೋಟೋ ತೆಗೆದುಕೊಳ್ಳಿ.",
    "form_remove_photo": "ಫೋಟೋ ತೆಗೆದುಹಾಕಿ",
    "camera_accessing": "ಕ್ಯಾಮೆರಾ ತೆರೆಯಲಾಗುತ್ತಿದೆ...",
    "camera_switch": "ಕ್ಯಾಮೆರಾ ಬದಲಿಸಿ",
    "duplicate_warning_title": "ಸುತ್ತಮುತ್ತ ಒಂದೇ ರೀತಿಯ ಬಗೆಹರಿಯದ ಸಮಸ್ಯೆ ಪತ್ತೆಯಾಗಿದೆ!",
    "duplicate_warning_desc": "ನಿಮ್ಮ ಸ್ಥಳದ 100 ಮೀಟರ್ ಒಳಗೆ ಈಗಾಗಲೇ ಇದೇ ರೀತಿಯ ಸಮಸ್ಯೆ ವರದಿಯಾಗಿದೆ. ಆ ದೂರನ್ನು ಬೆಂಬಲಿಸುವುದು ವೇಗವಾಗಿ ಪರಿಹರಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.",
    "bypass_duplicate": "ಹಾಗಿದ್ದರೂ ನಕಲು ದೂರನ್ನು ಸಲ್ಲಿಸಿ",
    "ai_suggestion": "AI ಸಲಹೆ",
    "apply_ai": "AI ಶಿಫಾರಸುಗಳನ್ನು ಅನ್ವಯಿಸಿ",
    "capture_photo": "ಫೋಟೋ ತೆಗೆಯಿರಿ",
    "print_receipt": "ರಶೀದಿ ಮುದ್ರಿಸಿ",
    "officer_contact": "ನಿಯೋಜಿತ ಅಧಿಕಾರಿಯ ಸಂಪರ್ಕ",
    "uploaded_image": "ನಾಗರಿಕರು ಅಪ್‌ಲೋಡ್ ಮಾಡಿದ ಫೋಟೋ",
    "repair_visual": "ದುರಸ್ತಿಯ ಚಿತ್ರಗಳ ಪರಿಶೀಲನೆ",
    "before_repair": "ದುರಸ್ತಿಗೆ ಮುನ್ನ",
    "after_repair": "ದುರಸ್ತಿ ನಂತರ",
    "support_widget_title": "ಈ ದೂರನ್ನು ಬೆಂಬಲಿಸಿ",
    "support_widget_desc": "ನೀವು ಕೂಡ ಈ ಸಮಸ್ಯೆಯನ್ನು ಎದುರಿಸುತ್ತಿದ್ದರೆ, ಹೊಸದಾಗಿ ದೂರನ್ನು ಸಲ್ಲಿಸುವ ಬದಲು ಈ ದೂರನ್ನು ಬೆಂಬಲಿಸಿ. ಹೆಚ್ಚಿನ ಬೆಂಬಲವಿರುವ ದೂರುಗಳಿಗೆ ಆದ್ಯತೆ ನೀಡಲಾಗುತ್ತದೆ.",
    "select_rating": "ರೇಟಿಂಗ್ ಆಯ್ಕೆಮಾಡಿ",
    "status_submitted": "ಸಲ್ಲಿಸಲಾಗಿದೆ",
    "status_verified": "ಪರಿಶೀಲಿಸಲಾಗಿದೆ",
    "status_assigned": "ನಿಯೋಜಿಸಲಾಗಿದೆ",
    "status_under_review": "ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ",
    "status_repair_started": "ದುರಸ್ತಿ ಪ್ರಾರಂಭವಾಗಿದೆ",
    "status_repair_in_progress": "ದುರಸ್ತಿ ಪ್ರಗತಿಯಲ್ಲಿದೆ",
    "status_resolved": "ಪರಿಹರಿಸಲಾಗಿದೆ",
    "status_closed": "ಮುಚ್ಚಲಾಗಿದೆ",
    "status_rejected": "ತಿರಸ್ಕರಿಸಲಾಗಿದೆ",
    "sub_submitted": "ದೂರು ಸಿವಿಕ್‌ಪಲ್ಸ್‌ನಲ್ಲಿ ದಾಖಲಾಗಿದೆ",
    "sub_verified": "ಮಧ್ಯಸ್ಥಗಾರರಿಂದ ದೂರು ಪರಿಶೀಲಿಸಲಾಗಿದೆ",
    "sub_assigned": "ಇಲಾಖಾ ಅಧಿಕಾರಿಗೆ ಕಳುಹಿಸಲಾಗಿದೆ",
    "sub_under_review": "ಅಧಿಕಾರಿ ಸ್ಥಳ ಪರಿಶೀಲನೆ ನಡೆಸುತ್ತಿದ್ದಾರೆ",
    "sub_repair_started": "ಸ್ಥಳದಲ್ಲಿ ದುರಸ್ತಿ ಕೆಲಸ ಪ್ರಾರಂಭವಾಗಿದೆ",
    "sub_repair_in_progress": "ದುರಸ್ತಿ ಕಾರ್ಯ ಪ್ರಗತಿಯಲ್ಲಿದೆ",
    "sub_resolved": "ಸಮಸ್ಯೆಯನ್ನು ಬಗೆಹರಿಸಿ ಪರಿಶೀಲಿಸಲಾಗಿದೆ",
    "sub_closed": "ಪರಿಹಾರದ ನಂತರ ಪ್ರಕರಣ ಮುಚ್ಚಲಾಗಿದೆ",
    "sub_rejected": "ದೂರನ್ನು ಅನುಮೋದಿಸಲಾಗಿಲ್ಲ",
    "sympathy_submitted_title": "ವರದಿ ಮಾಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು!",
    "sympathy_submitted_body": "ಈ ಸಮಸ್ಯೆಯಿಂದ ನಿಮಗೆ ಉಂಟಾದ ಅನಾನುಕೂಲತೆಗಾಗಿ ನಾವು ವಿಷಾದಿಸುತ್ತೇವೆ. ನಿಮ್ಮ ದೂರನ್ನು ನೋಂದಾಯಿಸಲಾಗಿದ್ದು, ಶೀಘ್ರದಲ್ಲೇ ಪರಿಶೀಲಿಸಲಾಗುವುದು. ನಗರವನ್ನು ಸುಧಾರಿಸಲು ಸಹಾಯ ಮಾಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು.",
    "sympathy_verified_title": "ನಿಮ್ಮ ದೂರನ್ನು ನಾವು ಪರಿಶೀಲಿಸಿದ್ದೇವೆ.",
    "sympathy_verified_body": "ನಿಮ್ಮ ವರದಿ ಸರಿಯಾಗಿದೆ ಎಂದು ನಮ್ಮ ತಂಡವು ದೃಢಪಡಿಸಿದೆ ಮತ್ತು ಆದ್ಯತೆ ನೀಡಲಾಗುತ್ತಿದೆ. ಇದರಿಂದ ನಿಮ್ಮ ದೈನಂದಿನ ಜೀವನಕ್ಕೆ ತೊಂದರೆಯಾಗಿದೆ ಎಂಬುದನ್ನು ನಾವು ಅರ್ಥಮಾಡಿಕೊಂಡಿದ್ದೇವೆ ಮತ್ತು ವಿಷಾದಿಸುತ್ತೇವೆ.",
    "sympathy_assigned_title": "ತಂಡವು ಕಾರ್ಯಪ್ರವೃತ್ತವಾಗಿದೆ!",
    "sympathy_assigned_body": "ನಿಮ್ಮ ದೂರನ್ನು ಸಂಬಂಧಪಟ್ಟ ಇಲಾಖೆಯ ಅಧಿಕಾರಿಗೆ ನಿಯೋಜಿಸಲಾಗಿದೆ. ಚಿಂತಿಸಬೇಡಿ, ಸೂಕ್ತ ಕ್ರಮ ಕೈಗೊಳ್ಳಲಾಗುತ್ತಿದೆ.",
    "sympathy_under_review_title": "ತಜ್ಞರು ನಿಮ್ಮ ಸಮಸ್ಯೆಯನ್ನು ಪರಿಶೀಲಿಸುತ್ತಿದ್ದಾರೆ.",
    "sympathy_under_review_body": "ನಮ್ಮ ಅಧಿಕಾರಿಗಳು ಸ್ಥಳದ ಪರಿಸ್ಥಿತಿಯನ್ನು ಪರಿಶೀಲಿಸುತ್ತಿದ್ದಾರೆ. ಉಂಟಾದ ಅನಾನುಕೂಲತೆಯನ್ನು ನಾವು ಅರ್ಥಮಾಡಿಕೊಂಡಿದ್ದು, ಶೀಘ್ರದಲ್ಲೇ ಪರಿಹರಿಸಲು ಬದ್ಧರಾಗಿದ್ದೇವೆ.",
    "sympathy_repair_started_title": "ದುರಸ್ತಿ ಕೆಲಸ ಪ್ರಾರಂಭವಾಗಿದೆ!",
    "sympathy_repair_started_body": "ವರದಿಯಾದ ಸ್ಥಳದಲ್ಲಿ ಭೌತಿಕ ದುರಸ್ತಿ ಕೆಲಸ ಪ್ರಾರಂಭವಾಗಿದೆ ಎಂದು ತಿಳಿಸಲು ನಮಗೆ ಸಂತೋಷವಾಗಿದೆ. ನಿಮ್ಮ ತಾಳ್ಮೆಗೆ ಧನ್ಯವಾದಗಳು — ಪರಿಹಾರ ಶೀಘ್ರದಲ್ಲೇ ಸಿಗಲಿದೆ!",
    "sympathy_repair_in_progress_title": "ದುರಸ್ತಿ ಕಾರ್ಯ ಪ್ರಗತಿಯಲ್ಲಿದೆ.",
    "sympathy_repair_in_progress_body": "ನಮ್ಮ ಸಿಬ್ಬಂದಿ ಸ್ಥಳದಲ್ಲಿ ಸಕ್ರಿಯವಾಗಿ ಕೆಲಸ ಮಾಡುತ್ತಿದ್ದಾರೆ. ವಿಳಂಬಕ್ಕಾಗಿ ವಿಷಾದಿಸುತ್ತೇವೆ ಮತ್ತು ನಮ್ಮೊಂದಿಗೆ ಸಹಕರಿಸಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮಿಂದ ನಮ್ಮ ನಗರ ಸುಧಾರಿಸುತ್ತಿದೆ.",
    "sympathy_resolved_title": "ಸಮಸ್ಯೆ ಬಗೆಹರಿದಿದೆ! 🎉",
    "sympathy_resolved_body": "ನಿಮ್ಮ ದೂರನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಬಗೆಹರಿಸಲಾಗಿದೆ ಎಂದು ತಿಳಿಸಲು ನಮಗೆ ಸಂತೋಷವಾಗಿದೆ. ವರದಿ ಮಾಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು — ನಿಮ್ಮ ಭಾಗವಹಿಸುವಿಕೆ ಬದಲಾವಣೆ ತರುತ್ತದೆ!",
    "sympathy_closed_title": "ಪ್ರಕರಣ ಮುಚ್ಚಲಾಗಿದೆ.",
    "sympathy_closed_body": "ಈ ದೂರನ್ನು ಸಂಪೂರ್ಣವಾಗಿ ಬಗೆಹರಿಸಿ ಮುಚ್ಚಲಾಗಿದೆ. ಉತ್ತಮ ನಗರ ನಿರ್ಮಾಣಕ್ಕೆ ಸಹಾಯ ಮಾಡಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. ಪರಿಹಾರವು ನಿಮ್ಮ ನಿರೀಕ್ಷೆಗೆ ತಕ್ಕಂತೆ ಇತ್ತೆಂದು ನಂಬುತ್ತೇವೆ!",
    "sympathy_rejected_title": "ತಿರಸ್ಕರಿಸಲಾಗಿದೆ ಎಂದು ತಿಳಿಸಲು ವಿಷಾದಿಸುತ್ತೇವೆ.",
    "sympathy_rejected_body": "ನಿಮ್ಮ ದೂರನ್ನು ಈ ವ್ಯವಸ್ಥೆಯಲ್ಲಿ ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಅನಾನುಕೂലತೆಗಾಗಿ ಕ್ಷಮೆಯಿರಲಿ. ದಯವಿಟ್ಟು ಪರ್ಯಾಯ ಸಹಾಯಕ್ಕಾಗಿ ನಿಮ್ಮ ಸ್ಥಳೀಯ ಮುನ್ಸಿಪಲ್ ಕಚೇರಿಯನ್ನು ಸಂಪರ್ಕಿಸಿ.",
    "sympathy_delay_title": "ವಿಳಂಬಕ್ಕಾಗಿ ನಾವು ಪ್ರಾಮಾಣಿಕವಾಗಿ ಕ್ಷಮೆಯಾಚಿಸುತ್ತೇವೆ.",
    "sympathy_delay_body": "ನಿಮ್ಮ ದೂರು {days} ದಿನಗಳಿಂದ ಮುಕ್ತವಾಗಿದೆ. ಇದು ಬೇಸರ ತಂದಿದೆ ಎಂಬುದನ್ನು ನಾವು ಬಲ್ಲೆವು. ಇದಕ್ಕೆ ತಕ್ಷಣದ ಆದ್ಯತೆ ನೀಡಲಾಗಿದೆ. ನಿಮ್ಮ ತಾಳ್ಮೆಗೆ ಧನ್ಯವಾದಗಳು.",
    "role_citizen": "ನಾಗರಿಕ",
    "role_authority": "ಅಧಿಕಾರ",
    "role_admin": "ನಿರ್ವಾಹಕ",
    "action_by": "ಕ್ರಮ ಕೈಗೊಂಡವರು",
    "system_user": "ವ್ಯವಸ್ಥೆ",
    "no_history_logged": "ಇನ್ನೂ ಯಾವುದೇ ಇತಿಹಾಸ ದಾಖಲಾಗಿಲ್ಲ",
    "no_login_needed": "ಲಾಗಿನ್ ಅಗತ್ಯವಿಲ್ಲ",
    "email_otp": "ಇಮೇಲ್ OTP",
    "phone_otp": "ಫೋನ್ OTP",
    "email_otp_help": "ತ್ವರಿತ ಪರಿಶೀಲನೆಗಾಗಿ ಈ ಇಮೇಲ್‌ಗೆ OTP ಕಳುಹಿಸಲಾಗುತ್ತದೆ.",
    "phone_otp_help": "ಈ ಫೋನ್ ಸಂಖ್ಯೆಗೆ SMS ಮೂಲಕ OTP ಕಳುಹಿಸಲಾಗುತ್ತದೆ.",
    "otp_sent_to": "ಕಳುಹಿಸಲಾದ 6-ಅಂಕಿಯ OTP ಅನ್ನು ನಮೂದಿಸಿ",
    "dashboard_welcome_subtitle": "ನಮ್ಮ ನಗರವನ್ನು ಸ್ವಚ್ಛವಾಗಿ, ಸುರಕ್ಷಿತವಾಗಿ ಮತ್ತು ಸುಸ್ಥಿತಿಯಲ್ಲಿಡಲು ಸಹಾಯ ಮಾಡಿ.",
    "my_reported_locations": "ನನ್ನ ವರದಿಯಾದ ಸ್ಥಳಗಳು",
    "search_placeholder": "ID, ಕೀವರ್ಡ್ ಮೂಲಕ ಹುಡುಕಿ...",
    "all_categories": "ಎಲ್ಲಾ ವರ್ಗಗಳು",
    "all_statuses": "ಎಲ್ಲಾ ಸ್ಥಿತಿಗಳು",
    "action_header": "ಕ್ರಿಯೆ",
    "no_complaints_found": "ಯಾವುದೇ ದೂರುಗಳು ಕಂಡುಬಂದಿಲ್ಲ",
    "no_complaints_help": "ಪ್ರಾರಂಭಿಸಲು ಹೊಸ ದೂರನ್ನು ಸಲ್ಲಿಸಿ.",
    "cat_road_damage": "ರಸ್ತೆ ಹಾನಿ",
    "cat_potholes": "ಗುಂಡಿಗಳು",
    "cat_garbage_overflow": "ಕಸದ ರಾಶಿ",
    "cat_drainage_blockage": "ಚರಂಡಿ ಬ್ಲಾಕ್",
    "cat_street_light_failure": "ಬೀದಿ ದೀಪದ ವೈಫಲ್ಯ",
    "cat_water_leakage": "ನೀರು ಸೋರಿಕೆ",
    "cat_water_supply_issue": "ನೀರು ಸರಬರಾಜು ಸಮಸ್ಯೆ",
    "cat_public_sanitation": "ಸಾರ್ವಜನಿಕ ನೈರ್ಮಲ್ಯ",
    "cat_tree_fallen": "ಮರ ಬಿದ್ದಿರುವುದು",
    "cat_broken_footpath": "ಫುಟ್‌ಪಾತ್ ಹಾನಿ",
    "cat_traffic_signal_issue": "ಟ್ರಾಫಿಕ್ ಸಿಗ್ನಲ್ ಸಮಸ್ಯೆ",
    "cat_public_property_damage": "ಸಾರ್ವಜನಿಕ ಆಸ್ತಿ ಹಾನಿ",
    "cat_other": "ಇತರೆ",
    "login_title": "ಸಿವಿಕ್‌ಪಲ್ಸ್ ಲಾಗಿನ್",
    "login_desc": "ದೂರುಗಳನ್ನು ವರದಿ ಮಾಡಲು ಅಥವಾ ನಿರ್ವಹಿಸಲು ಸೈನ್ ಇನ್ ಮಾಡಿ",
    "login_username_label": "ಇಮೇಲ್ ಅಥವಾ ಫೋನ್ ಸಂಖ್ಯೆ",
    "login_username_placeholder": "your@email.com ಅಥವಾ 9876543210",
    "login_password_label": "ಪಾಸ್‌ವರ್ಡ್",
    "login_password_placeholder": "••••••••",
    "login_no_account": "ಖಾತೆ ಇಲ್ಲವೇ?",
    "login_register_link": "ಇಲ್ಲಿ ನೋಂದಾಯಿಸಿ",
    "register_title": "ನಾಗರಿಕ ನೋಂದಣಿ",
    "register_desc": "ಸಮಸ್ಯೆಗಳನ್ನು ವರದಿ ಮಾಡಲು ಮತ್ತು ದುರಸ್ತಿಗಳನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಲು ಖಾತೆಯನ್ನು ರಚಿಸಿ",
    "register_name_label": "ಪೂರ್ಣ ಹೆಸರು",
    "register_name_placeholder": "John Doe",
    "register_email_label": "ಇಮೇಲ್ ವಿಳಾಸ (ಇಮೇಲ್ ಅಥವಾ ಫೋನ್ ಯಾವುದಾದರೂ ಒಂದು ಕಡ್ಡಾಯ)",
    "register_email_placeholder": "john@example.com",
    "register_phone_label": "ಫೋನ್ ಸಂಖ್ಯೆ (ಇಮೇಲ್ ಅಥವಾ ಫೋನ್ ಯಾವುದಾದರೂ ಒಂದು ಕಡ್ಡಾಯ)",
    "register_phone_placeholder": "9998887776",
    "register_password_placeholder": "ಕನಿಷ್ಠ 6 ಅಕ್ಷರಗಳು",
    "register_address_label": "ವಸತಿ ವಿಳಾಸ",
    "register_address_placeholder": "ಬೀದಿ, ಪ್ರದೇಶ, ನಗರ",
    "register_btn": "ಖಾತೆಯನ್ನು ನೋಂದಾಯಿಸಿ",
    "register_already_account": "ಈಗಾಗಲೇ ಖಾತೆ ಹೊಂದಿದ್ದೀರಾ?",
    "register_login_link": "ಇಲ್ಲಿ ಲಾಗಿನ್ ಮಾಡಿ",
    "otp_form_title": "ಪರಿಶೀಲನಾ ಕೋಡ್‌ಗಳನ್ನು ನಮೂದಿಸಿ",
    "otp_form_desc": "ನಿಮ್ಮ ಗುರುತನ್ನು ಪರಿಶೀಲಿಸಲು ನಾವು ಭದ್ರತಾ ಕೋಡ್‌ಗಳನ್ನು ಕಳುಹಿಸಿದ್ದೇವೆ.",
    "otp_email_label": "ಇಮೇಲ್ ಪರಿಶೀಲನೆ OTP",
    "otp_phone_label": "ಫೋನ್ ಪರಿಶೀಲನೆ OTP",
    "otp_verify_btn": "ಪರಿಶೀಲಿಸಿ ಮತ್ತು ನೋಂದಣಿ ಪೂರ್ಣಗೊಳಿಸಿ",
    "otp_back_btn": "ನೋಂದಣಿ ಫಾರ್ಮ್‌ಗೆ ಹಿಂತಿರುಗಿ",
    "copyright": "© 2026 ಸಿವಿಕ್‌ಪಲ್ಸ್. ಎಲ್ಲಾ ಹಕ್ಕುಗಳನ್ನು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ.",
    "forgot_password_link": "ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ?",
    "forgot_password_title": "ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸಿ",
    "forgot_password_desc": "ಮರುಹೊಂದಿಸುವ ಕೋಡ್ ಸ್ವೀಕರಿಸಲು ನಿಮ್ಮ ನೋಂದಾಯಿತ ಇಮೇಲ್ ನಮೂದಿಸಿ.",
    "btn_send_reset_otp": "ಕೋಡ್ ಕಳುಹಿಸಿ",
    "reset_otp_label": "ಪರಿಶೀಲನಾ OTP ಕೋಡ್",
    "reset_otp_placeholder": "6-ಅಂಕಿಯ OTP ನಮೂದಿಸಿ",
    "new_password_label": "ಹೊಸ ಪಾಸ್‌ವರ್ಡ್",
    "new_password_placeholder": "ಕನಿಷ್ಠ 6 ಅಕ್ಷರಗಳು",
    "btn_reset_password": "ಪಾಸ್‌ವರ್ಡ್ ನವೀಕರಿಸಿ",
    "back_to_login": "ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ"
  },
  ta: {
    "dashboard": "டாஷ்போர்டு",
    "about": "பற்றி",
    "profile": "சுயவிவரம் & அமைப்புகள்",
    "logout": "வெளியேறு",
    "welcome": "வரவேற்பு",
    "report_issue": "புதிய புகாரை பதிவு செய்",
    "total_reported": "மொத்த புகார்கள்",
    "unresolved": "தீர்க்கப்படாதவை",
    "resolved": "தீர்க்கப்பட்டவை",
    "complaint_history": "எனது புகார் வரலாறு",
    "history": "வரலாறு",
    "home": "முகப்பு",
    "track": "தொடரவும்",
    "login": "உள்நுழை",
    "register": "பதிவு செய்",
    "no_notifications": "புதிய அறிவிப்புகள் இல்லை",
    "recent_updates": "சமீபத்திய அறிவிப்புகள்",
    "report_new": "புதிய குடிமைப் புகாரைப் பதிவு செய்",
    "issue_title": "சுருக்கமான தலைப்பு",
    "issue_category": "புகார் வகை",
    "issue_priority": "முன்னுரிமை",
    "issue_description": "விரிவான விளக்கம்",
    "attach_photo": "புகைப்படத்தை இணைக்கவும்",
    "submit_complaint": "புகாரைச் சமர்ப்பிக்கவும்",
    "my_profile": "எனது சுயவிவரம்",
    "change_password": "கடவுச்சொல்லை மாற்றுக",
    "save_changes": "மாற்றங்களைச் சேமிக்கவும்",
    "complaint_id": "புகார் குறிப்பு எண்",
    "track_complaint": "உங்கள் புகாரைக் கண்காணிக்கவும்",
    "issue_status": "புகாரின் நிலை",
    "progress_lifecycle": "புகார் முன்னேற்றம்",
    "assigned_dept": "ஒதுக்கப்பட்ட துறை",
    "date_reported": "புகார் செய்த தேதி",
    "support_votes": "குடிமக்கள் ஆதரவு வாக்குகள்",
    "support_complaint": "புகாரை ஆதரிக்கவும்",
    "report_coordinates": "இருப்பிட ஒருங்கிணைப்புகள்",
    "back_dashboard": "டாஷ்போர்டுக்கு திரும்பு",
    "back_home": "முகப்பிற்கு திரும்பு",
    "select_category": "வகையைத் தேர்ந்தெடுக்கவும்",
    "use_gps": "GPS இருப்பிடத்தைப் பயன்படுத்துக",
    "locating": "கண்டறியப்படுகிறது...",
    "citizen_portal": "குடிமக்கள் போர்டல்",
    "authority_portal": "அதிகாரிகள் போர்டல்",
    "admin_portal": "நிர்வாகி போர்டல்",
    "empowering_communities": "சமூகங்களை மேம்படுத்துதல்",
    "hero_title": "ஸ்மார்ட் குடிமைப் புகார்கள் கண்காணிப்பு மற்றும் பதில்",
    "hero_subtitle": "உள்ளூர் உள்கட்டமைப்பு பழுதுகளை நேரடியாக நகராட்சி அலுவலகங்களுக்கு புகாரளிக்கவும். இருப்பிட விவரங்களை உடனடியாகப் பிடிக்கவும், நேரடி பழுதுபார்க்கும் பணியைக் கண்காணிக்கவும், மேலும் தூய்மையான நகரங்களை உருவாக்க உதவவும்.",
    "how_it_works": "இது எப்படி செயல்படுகிறது",
    "track_instruction": "நேரடி நிலையைக் கண்டறிய உங்கள் புகார் குறிப்பு எண்ணை உள்ளிடவும். உள்நுழைய தேவையில்லை.",
    "track_placeholder": "CIV-XXXXXXXX-XXXXX",
    "track_btn": "தொடரவும்",
    "sdg_title": "உலகளாவிய நிலைத்தன்மையை ஆதரித்தல்",
    "sdg_subtitle": "ஐக்கிய நாடுகள் சபையின் நிலையான வளர்ச்சி இலக்குகளுடன் (SDGs) இணைக்கப்பட்டுள்ளது.",
    "sdg_6_title": "சுத்தமான நீர் & சுகாதாரம்",
    "sdg_6_desc": "நீர் கசிவு, கழிவுநீர் அடைப்பு மற்றும் பொது சுகாதார குறைபாடுகளை உடனடியாக புகாரளித்து தீர்ப்பது.",
    "sdg_9_title": "தொழில், புதுமை & உள்கட்டமைப்பு",
    "sdg_9_desc": "கட்டமைப்பு சிக்கல்களைக் கண்டறிந்து பழுதுபார்க்கும் பணிகளை அட்டவணைப்படுத்த ஸ்மார்ட் பணிப்பாய்வுகளைப் பயன்படுத்துதல்.",
    "sdg_11_title": "நிலையான நகரங்கள் & சமூகங்கள்",
    "sdg_11_desc": "சுத்தமான சாலைகள், பாதுகாப்பான விளக்குகள் மற்றும் சமூகப் பாதுகாப்பை உறுதி செய்ய டிஜிட்டல் குடிமக்கள் பங்கேற்பை ஊக்குவித்தல்.",
    "emergency_card_title": "முக்கியமான அவசர நிலையை எதிர்கொள்கிறீர்களா?",
    "emergency_card_desc": "சாலை சரிவு, கழிவுநீர் பெருக்கெடுத்தல், மரம் விழுந்தது, மின்சார கம்பி அறுந்தது? உடனடியாகப் புகாரளிக்கவும் — கணக்கு தேவையில்லை. OTP மூலம் சரிபார்க்கவும்.",
    "emergency_card_btn": "அவசரப் புகாரை இப்போது பதிவு செய்",
    "emergency_footer_note": "காவல்துறை, தீயணைப்பு அல்லது மருத்துவ அவசரநிலைகளுக்கு, உடனடியாக 112 ஐ அழைக்கவும்.",
    "copyright": "© 2026 சிவிக்பல்ஸ் நகராட்சி நிறுவனம். அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.",
    "sidebar_dashboard": "டாஷ்போர்டு",
    "sidebar_report_issue": "புகாரை பதிவு செய்",
    "sidebar_profile": "எனது சுயவிவரம்",
    "sidebar_logout": "வெளியேறு",
    "form_report_new": "புதிய குடிமைப் புகாரை பதிவு செய்",
    "form_report_desc": "நகராட்சி பொறியாளர்கள் விரைவாக செயல்பட விரிவான தகவல் மற்றும் இருப்பிட விவரங்களை வழங்கவும்.",
    "form_title_label": "சுருக்கமான தலைப்பு",
    "form_title_placeholder": "எ.கா: பிரதான சந்திப்பிற்கு அருகில் பெரிய குழி",
    "form_category_label": "புகார் வகை",
    "form_category_placeholder": "வகையைத் தேர்ந்தெடுக்கவும்",
    "form_priority_label": "முன்னுரிமை",
    "form_desc_label": "விரிவான விளக்கம்",
    "form_desc_placeholder": "அளவு, தாக்கம், ஆபத்துகள் மற்றும் இதர பயனுள்ள கருத்துக்களை விவரிக்கவும்...",
    "form_photo_label": "புகைப்படத்தை இணைக்கவும் (அதிகபட்சம் 5MB • JPG, PNG)",
    "form_camera_btn": "நேரடி புகைப்படம் எடுக்கவும்",
    "form_location_label": "புகார் செய்யும் இருப்பிடத்தைக் குறிக்கவும்",
    "form_location_desc": "சரியான இருப்பிடத்தை அமைக்க வரைபடத்தில் கிளிக் செய்யவும் அல்லது GPS பொத்தானைப் பயன்படுத்தவும்.",
    "form_gps_btn": "GPS இருப்பிடத்தைப் பயன்படுத்துக",
    "form_latitude_label": "அட்சரேகை",
    "form_longitude_label": "தீர்க்கரேகை",
    "form_submit_btn": "புகாரைச் சமர்ப்பிக்கவும்",
    "profile_settings_title": "சுயவிவர அமைப்புகளை நிர்வகிக்கவும்",
    "profile_settings_desc": "உங்கள் தொடர்புத் தகவலைத் தற்போதைய நிலையில் வைத்திருங்கள்.",
    "profile_role": "கணக்கு பங்கு",
    "profile_name": "முழு பெயர்",
    "profile_name_placeholder": "ஜான் டோ",
    "profile_email": "மின்னஞ்சல் முகவரி (பதிவு செய்யப்பட்டது)",
    "profile_email_help": "பதிவு செய்த மின்னஞ்சலை மாற்ற முடியாது.",
    "profile_phone": "தொலைபேசி எண்",
    "profile_phone_placeholder": "9998887776",
    "profile_lang": "விருப்பமான கணினி மொழி",
    "profile_address": "வீட்டு முகவரி",
    "profile_address_placeholder": "தெரு, பகுதி, நகரம்",
    "profile_change_pwd": "கடவுச்சொல்லை மாற்றுக",
    "profile_change_pwd_desc": "பாதுகாப்பிற்காக கடவுச்சொல் மாற்றத்திற்கு OTP சரிபார்ப்பு தேவை. மாற்ற வேண்டாமா எனில் காலியாக விடவும்.",
    "profile_new_pwd": "புதிய கடவுச்சொல்",
    "profile_new_pwd_placeholder": "குறைந்தது 6 எழுத்துக்கள்",
    "profile_otp": "சரிபார்ப்பு OTP",
    "profile_send_otp": "OTP குறியீட்டை அனுப்பவும்",
    "profile_otp_help": "OTP உங்கள் பதிவு செய்யப்பட்ட மின்னஞ்சல் அல்லது தொலைபேசிக்கு அனுப்பப்படும்.",
    "profile_cancel": "ரத்துசெய்",
    "profile_save": "அமைப்புகளைச் சேமிக்கவும்",
    "details_heading": "புகார் கண்காணிப்பு விவரங்கள்",
    "details_sub": "உங்கள் புகாரின் முன்னேற்றம் மற்றும் ஒதுக்கப்பட்ட துறையைச் சரிபார்க்கவும்.",
    "details_ref_id": "புகார் குறிப்பு எண்",
    "details_status": "புகாரின் நிலை",
    "details_category": "புகார் வகை",
    "details_priority": "முன்னுரிமை",
    "details_description": "விரிவான விளக்கம்",
    "details_date": "புகார் செய்த தேதி",
    "details_assigned": "ஒதுக்கப்பட்ட துறை",
    "details_officer": "அதிகாரியின் பெயர்",
    "details_officer_phone": "அதிகாரியின் தொலைபேசி",
    "details_officer_email": "அதிகாரியின் மின்னஞ்சல்",
    "details_map_title": "குறிக்கப்பட்ட இருப்பிடம்",
    "details_support_votes": "குடிமக்கள் ஆதரவு வாக்குகள்",
    "details_support_btn": "புகாரை ஆதரிக்கவும்",
    "details_support_btn_already": "நீங்கள் இதை ஆதரித்துள்ளீர்கள்",
    "details_feedback_title": "தீர்வுக்கான கருத்துக்களை வழங்குக",
    "details_feedback_desc": "உங்கள் கருத்து நகராட்சியின் மறுமொழி நேரத்தை மேம்படுத்த உதவுகிறது.",
    "details_feedback_rating": "மதிப்பீடு",
    "details_feedback_remarks": "கருத்துகள் / குறிப்புகள்",
    "details_feedback_remarks_placeholder": "உங்கள் அனுபவத்தைப் பற்றி சொல்லுங்கள்...",
    "details_feedback_submit": "கருத்தை சமர்ப்பிக்கவும்",
    "details_feedback_submitted": "கருத்து சமர்ப்பிக்கப்பட்டது",
    "details_history_title": "புதுப்பிப்பு வரலாறு",
    "details_back_dashboard": "டாஷ்போர்டுக்கு திரும்பு",
    "emergency_title": "குடிமக்கள் அவசரப் புகார்",
    "emergency_subtitle": "பொதுப் பாதுகாப்பிற்கு உடனடி அச்சுறுத்தலாக இருக்கும் சிக்கல்களைப் புகாரளிக்கவும். அவசரக் குழுக்களுக்கு நேரடி ஒதுக்கீடு.",
    "emergency_step1": "1. அடையாளத்தைச் சரிபார்க்கவும் (OTP)",
    "emergency_step2": "2. ஆபத்து மற்றும் இருப்பிட விவரங்கள்",
    "emergency_step3": "3. அவசரக் குழுவுக்கு அனுப்பவும்",
    "emergency_phone_label": "உங்கள் அலைபேசி எண்ணை உள்ளிடவும்",
    "emergency_phone_placeholder": "10-இலக்க அலைபேசி எண்",
    "emergency_send_otp": "சரிபார்ப்பு OTP-ஐ அனுப்பவும்",
    "emergency_enter_otp": "6-இலக்க OTP-ஐ உள்ளிடவும்",
    "emergency_verify_otp": "OTP குறியீட்டைச் சரிபார்க்கவும்",
    "emergency_verified": "வெற்றிகரமாக சரிபார்க்கப்பட்டது! அவசர நிலையை கீழே விவரிக்கவும்.",
    "emergency_form_title": "அதிமுக்கிய பொது ஆபத்தைப் புகாரளிக்கவும்",
    "emergency_hazard_type": "அவசர ஆபத்து வகை",
    "emergency_select_hazard": "ஆபத்து வகையைத் தேர்ந்தெடுக்கவும்",
    "emergency_hazard_desc": "நிலைமை மற்றும் ஆபத்து அளவை விவரிக்கவும்",
    "emergency_hazard_desc_placeholder": "உடனடி கவனம் தேவைப்படுவதை விளக்கவும்...",
    "emergency_mic_title": "விளக்கத்தைக் கூறவும்",
    "emergency_photo": "ஆபத்து புகைப்படத்தை இணைக்கவும் (மிகவும் பரிந்துரைக்கப்படுகிறது)",
    "emergency_camera": "கேமராவைத் திறக்கவும்",
    "emergency_gps_btn": "GPS இருப்பிடத்தைப் பயன்படுத்துக",
    "emergency_submit_btn": "அவசரகால அச்சுறுத்தலை அனுப்பவும்",
    "how_title": "சிவிக் பல்ஸ் எவ்வாறு செயல்படுகிறது",
    "how_subtitle": "புகாரளிப்பதும் கண்காணிப்பதும் எப்போதும் இவ்வளவு எளிமையாக இருந்ததில்லை.",
    "how_step1_title": "1. விபரங்களை பதிவு செய்",
    "how_step1_desc": "வகைகளைத் தேர்ந்தெடுத்து, புகாரின் படங்களை பதிവേற்றி, வரைபடம் அல்லது ஜிபிஎஸ் மூலம் இருப்பிடத்தைக் குறிக்கவும்.",
    "how_step2_title": "2. தானியங்கி ஒதுக்கீடு",
    "how_step2_desc": "விளம்பரங்கள் மற்றும் தாமதங்களைத் தவிர்க்க எங்கள் கணினி உடனடியாக உரிய துறைக்கு புகாரை ஒதுக்குகிறது.",
    "how_step3_title": "3. முன்னேற்றம் கண்காணிப்பு",
    "how_step3_desc": "பழுதுபார்க்கும் பணிகளை நேரலையில் கண்காணிக்கவும், பழுதுக்கு முன்/பின் படங்களை பார்த்து தீர்வினை உறுதிப்படுத்தவும்.",
    "emergency_escalation": "உடனடி தீர்வு",
    "emergency_otp": "OTP சரிபார்க்கப்பட்டது",
    "emergency_priority": "மிக முக்கிய முன்னுரிமை",
    "terms": "சேவை விதிமுறைகள்",
    "privacy": "தனியுரிமைக் கொள்கை",
    "form_photo_help": "பணியாளர்கள் எளிதில் பழுதைக் கண்டறிய புகைப்படத்தை பதிவேற்றவும்.",
    "form_remove_photo": "புகைப்படத்தை நீக்கு",
    "camera_accessing": "கேமரா அணுகப்படுகிறது...",
    "camera_switch": "கேமராவை மாற்று",
    "duplicate_warning_title": "அருகில் இதே போன்ற தீர்க்கப்படாத பிரச்சனை கண்டறியப்பட்டுள்ளது!",
    "duplicate_warning_desc": "உங்களது இருப்பிடத்திலிருந்து 100 மீட்டர் தொலைவிற்குள் இதே போன்ற புகார் உள்ளது. அந்தப் புகாரை ஆதரிப்பது தீர்வை விரைவுபடுத்தும்.",
    "bypass_duplicate": "இருப்பினும் புதிய புகார் உருவாக்கு",
    "ai_suggestion": "AI பரிந்துரை",
    "apply_ai": "AI பரிந்துரைகளைப் பயன்படுத்து",
    "capture_photo": "புகைப்படம் எடு",
    "print_receipt": "ரசீது அச்சிடுக",
    "officer_contact": "ஒதுக்கப்பட்ட அதிகாரியின் தொடர்பு",
    "uploaded_image": "குடிமகன் பதிவேற்றிய படம்",
    "repair_visual": "பழுதுபார்ப்பு காட்சி சரிபார்ப்பு",
    "before_repair": "பழுதுபார்க்கும் முன்",
    "after_repair": "பழுதுபார்க்கும் பின்",
    "support_widget_title": "இப்பிரச்சினையை ஆதரிக்கவும்",
    "support_widget_desc": "நீங்களும் இதே சிக்கலை எதிர்கொண்டால், புதிய புகார் உருவாக்குவதற்கு பதில் இதையே ஆதரியுங்கள். அதிக ஆதரவு பெற்ற புகார்கள் விரைந்து தீர்க்கப்படும்.",
    "select_rating": "மதிப்பீட்டைத் தேர்ந்தெடுக்கவும்",
    "status_submitted": "சமர்ப்பிக்கப்பட்டது",
    "status_verified": "சரிபார்க்கப்பட்டது",
    "status_assigned": "ஒதுக்கப்பட்டது",
    "status_under_review": "மதிப்பாய்வில் உள்ளது",
    "status_repair_started": "பழுதுபார்ப்பு தொடங்கியது",
    "status_repair_in_progress": "பழுதுபார்ப்பு நடக்கிறது",
    "status_resolved": "தீர்க்கப்பட்டது",
    "status_closed": "மூடப்பட்டது",
    "status_rejected": "நிராகரிக்கப்பட்டது",
    "sub_submitted": "புகார் சிவிக் பல்ஸ் மூலம் பெறப்பட்டது",
    "sub_verified": "புகார் மதிப்பீட்டாளரால் சரிபார்க்கப்பட்டது",
    "sub_assigned": "துறை அதிகாரிக்கு அனுப்பப்பட்டது",
    "sub_under_review": "அதிகாரி கள அறிக்கையை ஆய்வு செய்கிறார்",
    "sub_repair_started": "பழுதுபார்க்கும் பணி தொடங்கியுள்ளது",
    "sub_repair_in_progress": "தளத்தில் பழுதுபார்க்கும் பணி நடக்கிறது",
    "sub_resolved": "பிரச்சனை சரிசெய்யப்பட்டு சரிபார்க்கப்பட்டது",
    "sub_closed": "தீர்வுக்குப் பிறகு வழக்கு மூடப்பட்டது",
    "sub_rejected": "புகார் அங்கீகரிக்கப்படவில்லை",
    "sympathy_submitted_title": "புகாரளித்ததற்கு நன்றி!",
    "sympathy_submitted_body": "இந்தப் பிரச்சினையால் உங்களுக்கு ஏற்பட்ட சிரமத்திற்கு வருந்துகிறோம். உங்கள் புகார் பதிவு செய்யப்பட்டுள்ளது, விரைவில் மதிப்பாய்வு செய்யப்படும். உங்கள் நகரத்தை மேம்படுத்த உதவியதற்கு நன்றி.",
    "sympathy_verified_title": "உங்கள் புகாரை நாங்கள் சரிபார்த்துள்ளோம்.",
    "sympathy_verified_body": "உங்கள் அறிக்கை சரியானது என்பதை எங்கள் குழு உறுதி செய்துள்ளது. இதனால் உங்கள் அன்றாட வாழ்க்கைக்கு இடையூறு ஏற்பட்டுள்ளதை நாங்கள் உணர்ந்து வருந்துகிறோம்.",
    "sympathy_assigned_title": "குழு செயல்படுகிறது!",
    "sympathy_assigned_body": "உங்கள் புகார் சம்பந்தப்பட்ட துறை அதிகாரிக்கு ஒதுக்கப்பட்டுள்ளது. கவலைப்பட வேண்டாம், தகுந்த நடவடிக்கை எடுக்கப்பட்டு வருகிறது.",
    "sympathy_under_review_title": "நிபுணர்கள் உங்கள் பிரச்சினையை ஆய்வு செய்கிறார்கள்.",
    "sympathy_under_review_body": "எங்கள் அதிகாரிகள் சம்பவ இடத்தை ஆய்வு செய்து வருகின்றனர். ஏற்பட்டுள்ள சிரமத்தை நாங்கள் புரிந்து கொண்டுள்ளோம், விரைவில் தீர்க்க உறுதியளித்துள்ளோம்.",
    "sympathy_repair_started_title": "பழுதுபார்க்கும் பணி தொடங்கியுள்ளது!",
    "sympathy_repair_started_body": "புகாரளிக்கப்பட்ட இடத்தில் பழுதுபார்க்கும் பணி தொடங்கியுள்ளது என்பதைத் தெரிவிப்பதில் மகிழ்ச்சியடைகிறோம். உங்கள் பொறுமைக்கு நன்றி — தீர்வு விரைவில் கிடைக்கும்!",
    "sympathy_repair_in_progress_title": "பழுதுபார்க்கும் பணி நடக்கிறது.",
    "sympathy_repair_in_progress_body": "எங்கள் பணியாளர்கள் சம்பவ இடத்தில் தீவிரமாக பணியாற்றி வருகின்றனர். தாமதத்திற்கு வருந்துகிறோம். உங்களால் எங்கள் நகரம் மேம்படுகிறது.",
    "sympathy_resolved_title": "பிரச்சனை தீர்க்கப்பட்டது! 🎉",
    "sympathy_resolved_body": "உங்கள் புகார் வெற்றிகரமாக தீர்க்கப்பட்டது என்பதைத் தெரிவிப்பதில் மகிழ்ச்சியடைகிறோம். புகாரளித்ததற்கு நன்றி — உங்கள் பங்களிப்பு மாற்றத்தை ஏற்படுத்துகிறது!",
    "sympathy_closed_title": "வழக்கு மூடப்பட்டது.",
    "sympathy_closed_body": "இந்த புகார் முழுமையாக தீர்க்கப்பட்டு மூடப்பட்டது. சிறந்த நகரத்தை உருவாக்க உதவியதற்கு நன்றி. தீர்வு உங்கள் எதிர்பார்ப்புக்கு ஏற்ப இருக்கும் என்று நம்புகிறோம்!",
    "sympathy_rejected_title": "நிராகரிக்கப்பட்டது என்பதைத் தெரிவிக்க வருந்துகிறோம்.",
    "sympathy_rejected_body": "உங்கள் புகாரை இந்த அமைப்பில் செயல்படுத்த முடியவில்லை. சிரமத்திற்கு மன்னிக்கவும். தயவுசெய்து மாற்று உதவிக்கு உங்கள் உள்ளூர் நகராட்சி அலுவலகத்தைத் தொடர்பு கொள்ளவும்.",
    "sympathy_delay_title": "தாமதத்திற்கு நாங்கள் மனப்பூர்வமாக மன்னிப்பு ಕೇಳுகிறோம்.",
    "sympathy_delay_body": "உங்கள் புகார் {days} நாட்களாக திறக்கப்பட்டுள்ளது. இது உங்களுக்கு ஏமாற்றத்தை அளித்துள்ளது என்பதை நாங்கள் அறிவோம். இதற்கு முன்னுரிமை அளிக்கப்பட்டுள்ளது. உங்கள் பொறுமைக்கு நன்றி.",
    "role_citizen": "குடிமகன்",
    "role_authority": "அதிகாரம்",
    "role_admin": "நிர்வாகி",
    "action_by": "நடவடிக்கை எடுத்தவர்",
    "system_user": "அமைப்பு",
    "no_history_logged": "இதுவரை வரலாறு எதுவும் பதிவு செய்யப்படவில்லை",
    "no_login_needed": "உள்நுழைவு தேவையில்லை",
    "email_otp": "மின்னஞ்சல் OTP",
    "phone_otp": "தொலைபேசி OTP",
    "email_otp_help": "உடனடி சரிபார்ப்பிற்காக இந்த மின்னஞ்சலுக்கு OTP அனுப்பப்படும்.",
    "phone_otp_help": "இந்த தொலைபேசி எண்ணுக்கு SMS மூலம் OTP அனுப்பப்படும்.",
    "otp_sent_to": "அனுப்பப்பட்ட 6-இலக்க OTP ஐ உள்ளிடவும்",
    "dashboard_welcome_subtitle": "எங்கள் நகரத்தை சுத்தமாகவும், பாதுகாப்பாகவும், நல்ல நிலையிலும் வைத்திருக்க உதவுங்கள்.",
    "my_reported_locations": "நான் புகாரளித்த இடங்கள்",
    "search_placeholder": "ID, முக்கிய வார்த்தை மூலம் தேடுங்கள்...",
    "all_categories": "அனைத்து பிரிவுகள்",
    "all_statuses": "அனைத்து நிலைகள்",
    "action_header": "நடவடிக்கை",
    "no_complaints_found": "புகார்கள் எதுவும் காணப்படவில்லை",
    "no_complaints_help": "தொடங்குவதற்கு புதிய புகாரைச் சமர்ப்பிக்கவும்.",
    "cat_road_damage": "சாலை சேதம்",
    "cat_potholes": "பள்ளங்கள்",
    "cat_garbage_overflow": "குப்பை தேக்கம்",
    "cat_drainage_blockage": "வடிகால் அடைப்பு",
    "cat_street_light_failure": "தெருவிளக்கு பழுது",
    "cat_water_leakage": "நீர் கசிவு",
    "cat_water_supply_issue": "குடிநீர் விநியோகப் பிரச்சினை",
    "cat_public_sanitation": "பொது சுகாதாரம்",
    "cat_tree_fallen": "மரம் விழுந்தது",
    "cat_broken_footpath": "சேதமடைந்த நடைபாதை",
    "cat_traffic_signal_issue": "போக்குவரத்து சிக்னல் பழுது",
    "cat_public_property_damage": "பொது சொத்து சேதம்",
    "cat_other": "இதர",
    "login_title": "சிவிக் பல்ஸ் உள்நுழைவு",
    "login_desc": "புகார்களைப் புகாரளிக்க அல்லது நிர்வகிக்க உள்நுழையவும்",
    "login_username_label": "மின்னஞ்சல் அல்லது தொலைபேసి எண்",
    "login_username_placeholder": "your@email.com அல்லது 9876543210",
    "login_password_label": "கடவுச்சொல்",
    "login_password_placeholder": "••••••••",
    "login_no_account": "கணக்கு இல்லையா?",
    "login_register_link": "இங்கே பதிவு செய்யவும்",
    "register_title": "குடிமகன் பதிவு",
    "register_desc": "சிக்கல்களைப் புகாரளிக்கவும் பழுதுபார்ப்புகளைக் கண்காணிக்கவும் கணக்கை உருவாக்கவும்",
    "register_name_label": "முழு பெயர்",
    "register_name_placeholder": "John Doe",
    "register_email_label": "மின்னஞ்சல் முகவரி (மின்னஞ்சல் அல்லது தொலைபேசி ஏதேனும் ஒன்று தேவை)",
    "register_email_placeholder": "john@example.com",
    "register_phone_label": "தொலைபேசி எண் (மின்னஞ்சல் அல்லது தொலைபேசி ஏதேனும் ஒன்று தேவை)",
    "register_phone_placeholder": "9998887776",
    "register_password_placeholder": "குறைந்தது 6 எழுத்துக்கள்",
    "register_address_label": "இருப்பிட முகவரி",
    "register_address_placeholder": "தெரு, பகுதி, நகரம்",
    "register_btn": "கணக்கை பதிவு செய்யவும்",
    "register_already_account": "ஏற்கனவே கணக்கு உள்ளதா?",
    "register_login_link": "இங்கே உள்நுழையவும்",
    "otp_form_title": "சரிபார்ப்புக் குறியீடுகளை உள்ளிடவும்",
    "otp_form_desc": "உங்கள் அடையாளத்தை சரிபார்க்க பாதுகாப்பு குறியீடுகளை அனுப்பியுள்ளோம்.",
    "otp_email_label": "மின்னஞ்சல் சரிபார்ப்பு OTP",
    "otp_phone_label": "தொலைபேசி சரிபார்ப்பு OTP",
    "otp_verify_btn": "சரிபார்த்து பதிவை முடிக்கவும்",
    "otp_back_btn": "பதிவுப் படிவத்திற்குத் திரும்புக",
    "copyright": "© 2026 சிவிக்பல்ஸ். அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.",
    "forgot_password_link": "கடவுச்சொல்லை மறந்துவிட்டீர்களா?",
    "forgot_password_title": "கடவுச்சொல்லை மீட்டமை",
    "forgot_password_desc": "மீட்டமைப்பு குறியீட்டைப் பெற உங்கள் பதிவுசெய்த மின்னஞ்சலை உள்ளிடவும்.",
    "btn_send_reset_otp": "குறியீட்டை அனுப்பு",
    "reset_otp_label": "சரிபார்ப்பு OTP குறியீடு",
    "reset_otp_placeholder": "6-இலக்க OTP ஐ உள்ளிடவும்",
    "new_password_label": "புதிய கடவுச்சொல்",
    "new_password_placeholder": "குறைந்தது 6 எழுத்துக்கள்",
    "btn_reset_password": "கடவுச்சொல்லைப் புதுப்பி",
    "back_to_login": "உள்நுழைவுக்குத் திரும்பு"
  },
  te: {
    "dashboard": "டாష్‌బోర్డ్",
    "about": "గురించి",
    "profile": "ప్రొఫైల్ & సెట్టింగులు",
    "logout": "లాగ్ అవుట్",
    "welcome": "స్వాగతం",
    "report_issue": "కొత్త ఫిర్యాదు చేయండి",
    "total_reported": "మొత్తం ఫిర్యాదులు",
    "unresolved": "పరిష్కారం కానివి",
    "resolved": "పరిష్కరించబడినవి",
    "complaint_history": "నా ఫిర్యాదుల చరిత్ర",
    "history": "చరిత్ర",
    "home": "హోమ్",
    "track": "ట్రాక్ చేయండి",
    "login": "లాగిన్",
    "register": "రిజిస్టర్",
    "no_notifications": "తాజా అప్‌డేట్‌లు లేవు",
    "recent_updates": "తాజా అప్‌డేట్‌లు",
    "report_new": "కొత్త పౌర సమస్యను నివేదించండి",
    "issue_title": "చిన్న శీర్షిక",
    "issue_category": "సమస్య వర్గం",
    "issue_priority": "ప్రాధాన్యత",
    "issue_description": "వివరణాత్మక నివేదిక",
    "attach_photo": "ఫోటో జత చేయండి",
    "submit_complaint": "ఫిర్యాదును సమర్పించండి",
    "my_profile": "నా ప్రొఫైల్",
    "change_password": "పాస్‌వర్డ్ మార్చండి",
    "save_changes": "మార్పులను సేవ్ చేయండి",
    "complaint_id": "ఫిర్యాదు గుర్తింపు సంఖ్య",
    "track_complaint": "మీ ఫిర్యాదును ట్రాక్ చేయండి",
    "issue_status": "సమస్య స్థితి",
    "progress_lifecycle": "ఫిర్యాదు పురోగతి",
    "assigned_dept": "కేటాయించిన విభాగం",
    "date_reported": "నివేదించిన తేదీ",
    "support_votes": "పౌర మద్దతు ఓట్లు",
    "support_complaint": "ఫిర్యాదుకు మద్దతు ఇవ్వండి",
    "report_coordinates": "స్థాన కోఆర్డినేట్లు",
    "back_dashboard": "డ్యాష్‌బోర్డ్‌కు తిరిగి వెళ్ళు",
    "back_home": "హోమ్‌కు తిరిగి వెళ్ళు",
    "select_category": "వర్గాన్ని ఎంచుకోండి",
    "use_gps": "GPS స్థానాన్ని ఉపయోగించండి",
    "locating": "కనుగొనబడుతోంది...",
    "citizen_portal": "పౌర పోర్టల్",
    "authority_portal": "అధికార పోర్టల్",
    "admin_portal": "అడ్మిన్ పోర్టల్",
    "empowering_communities": "సముదాయాల సబలీకరణ",
    "hero_title": "స్మార్ట్ పౌర సమస్యల పర్యవేక్షణ & ప్రతిస్పందన",
    "hero_subtitle": "స్థానిక మౌలిక సదుపాయాల సమస్యలను నేరుగా మున్సిపల్ కార్యాలయాలకు నివేదించండి. స్థాన వివరాలను తక్షణమే క్యాప్చర్ చేయండి, దురస్తి పురోగతిని ట్రాక్ చేయండి, మరి స్వచ్ఛమైన నగరాల నిర్మాణంలో సహాయపడండి.",
    "how_it_works": "ఇది ఎలా పనిచేస్తుంది",
    "track_instruction": "లైవ్ స్థితిని తనిఖీ చేయడానికి మీ ఫిర్యాదు గుర్తింపు సంఖ్యను నమోదు చేయండి. లాగిన్ అవసరం లేదు.",
    "track_placeholder": "CIV-XXXXXXXX-XXXXX",
    "track_btn": "ట్రాక్ చేయండి",
    "sdg_title": "ప్రపంచ సుస్థిరతకు మద్దతు",
    "sdg_subtitle": "ఐక్యరాజ్యసమితి సుస్థిర అభివృద్ధి లక్ష్యాలకు (SDGs) అనుగుణంగా ఉంది.",
    "sdg_6_title": "స్వచ్ఛమైన నీరు & పారిశుధ్యం",
    "sdg_6_desc": "నీటి లీకేజీలు, మురుగునీటి అడ్డంకులు మరియు బహిరంగ పారిశుధ్య లోపాలను తక్షణమే నివేదించడం మరియు పరిష్కరించడం.",
    "sdg_9_title": "పరిశ్రమ, ఆవిష్కరణ & మౌలిక సదుపాయాలు",
    "sdg_9_desc": "నిర్మాణాత్మక సమస్యలను గుర్తించడానికి మరియు దురస్తి పనులను షెడ్యూల్ చేయడానికి స్మార్ట్ వర్క్‌ఫ్లోల ఉపయోగం.",
    "sdg_11_title": "సుస్థిర నగరాలు & సముదాయాలు",
    "sdg_11_desc": "స్వచ్ఛమైన రోడ్లు, సురక్షితమైన లైట్లు మరియు సమాజ భద్రతను నిర్ధారించడానికి డిజిటల్ పౌర భాగస్వామ్యాన్ని ప్రోత్సహించడం.",
    "emergency_card_title": "ముఖ్యమైన పౌర అత్యవసర పరిస్థితిని ఎదుర్కొంటున్నారా?",
    "emergency_card_desc": "రోడ్డు కుంగిపోవడం, మురుగునీరు పొంగిపారడం, చెట్టు కూలిపోవడం, విద్యుత్ తీగ తెగిపోవడం? తక్షణమే నివేదించండి — ఖాతా అవసరం లేదు. కేవలం OTP తో ధృవీకరించండి.",
    "emergency_card_btn": "అత్యవసర నివేదికను ఇప్పుడే చేయండి",
    "emergency_footer_note": "పోలీస్, ఫైర్ లేదా వైద్య అత్యవసర పరిస్థితుల కోసం తక్షణమే 112 కి కాల్ చేయండి.",
    "copyright": "© 2026 సివిక్‌పల్స్ మున్సిపల్ కార్పొరేషన్. అన్ని హక్కులూ ప్రత్యేకించబడినవి.",
    "sidebar_dashboard": "డాష్‌బోర్డ్",
    "sidebar_report_issue": "ఫిర్యాదు చేయి",
    "sidebar_profile": "నా ప్రొఫైల్",
    "sidebar_logout": "లాగ్ అవుట్",
    "form_report_new": "కొత్త పౌర సమస్యను నివేదించండి",
    "form_report_desc": "మున్సిపల్ ఇంజనీర్లు త్వరగా స్పందించడానికి వివరణాత్మక సమాచారం మరియు స్థాన వివరాలను అందించండి.",
    "form_title_label": "చిన్న శీర్షిక",
    "form_title_placeholder": "ఉదా: ప్రధాన కూడలి వద్ద పెద్ద గుంత",
    "form_category_label": "సమస్య వర్గం",
    "form_category_placeholder": "వర్గాన్ని ఎంచుకోండి",
    "form_priority_label": "ప్రాధాన్యత",
    "form_desc_label": "వివరణాత్మక నివేదిక",
    "form_desc_placeholder": "సమస్య పరిమాణం, ప్రభావం, ప్రమాదాలు మరియు ఇతర ఉపయోగకరమైన వివరాలను వివరించండి...",
    "form_photo_label": "ఫోటోను జత చేయండి (గరిష్టంగా 5MB • JPG, PNG)",
    "form_camera_btn": "లైవ్ ఫోటో తీయండి",
    "form_location_label": "సమస్య స్థానాన్ని గుర్తించండి",
    "form_location_desc": "ఖచ్చితమైన కోఆర్డినేట్లను సెట్ చేయడానికి మ్యాప్‌పై క్లిక్ చేయండి లేదా GPS బటన్ ఉపయోగించండి.",
    "form_gps_btn": "GPS స్థానాన్ని ఉపయోగించండి",
    "form_latitude_label": "అక్షాంశం",
    "form_longitude_label": "రేఖాంశం",
    "form_submit_btn": "ఫిర్యాదును సమర్పించండి",
    "profile_settings_title": "ప్రొఫైల్ సెట్టింగులను నిర్వహించండి",
    "profile_settings_desc": "మీ సంప్రదింపు సమాచారాన్ని తాజా స్థితిలో ఉంచండి.",
    "profile_role": "ఖాతా పాత్ర",
    "profile_name": "పూర్తి పేరు",
    "profile_name_placeholder": "జాన్ డో",
    "profile_email": "ఈమెయిల్ చిరునామా (నమోదిత)",
    "profile_email_help": "నమోదు చేసిన ఈమెయిల్ మార్చడం సాధ్యం కాదు.",
    "profile_phone": "ఫోన్ నంబర్",
    "profile_phone_placeholder": "9998887776",
    "profile_lang": "సిస్టమ్ భాష",
    "profile_address": "ఇంటి చిరునామా",
    "profile_address_placeholder": "వీధి, ప్రాంతం, నగరం",
    "profile_change_pwd": "పాస్‌వర్డ్ మార్చండి",
    "profile_change_pwd_desc": "భద్రత కోసం పాస్‌వర్డ్ మార్పుకు OTP ధృవీకరణ అవసరం. మార్చకూడదనుకుంటే ఖాళీగా ఉంచండి.",
    "profile_new_pwd": "కొత్త పాస్‌వర్డ్",
    "profile_new_pwd_placeholder": "కనీసం 6 అక్షరాలు",
    "profile_otp": "ధృవీకరణ OTP",
    "profile_send_otp": "OTP కోడ్ పంపండి",
    "profile_otp_help": "OTP మీ నమోదిత ఈమెయిల్ లేదా ఫోన్‌కు పంపబడుతుంది.",
    "profile_cancel": "రద్దు చేయి",
    "profile_save": "సెట్టింగులను సేవ్ చేయి",
    "details_heading": "ఫిర్యాదు ట్రాకింగ్ వివరాలు",
    "details_sub": "మీ ఫిర్యాదు పురోగతి మరియు కేటాయించిన విభాగాన్ని తనిఖీ చేయండి.",
    "details_ref_id": "ఫिర్యాదు గుర్తింపు సంఖ్య",
    "details_status": "సమస్య స్థితి",
    "details_category": "సమస్య వర్గం",
    "details_priority": "ప్రాధాన్యత",
    "details_description": "వివరణాత్మక నివేదిక",
    "details_date": "నివేదించిన తేదీ",
    "details_assigned": "కేటాయించిన విభాగం",
    "details_officer": "అధికారి పేరు",
    "details_officer_phone": "అధికారి ఫోన్",
    "details_officer_email": "అధికారి ఈమెయిల్",
    "details_map_title": "నివేదించిన స్థానం",
    "details_support_votes": "పౌర మద్దతు ఓట్లు",
    "details_support_btn": "ఫిర్యాదుకు మద్దతు ఇవ్వండి",
    "details_support_btn_already": "మీరు దీనికి మద్దతు ఇచ్చారు",
    "details_feedback_title": "పరిష్కారంపై మీ అభిప్రాయాన్ని తెలపండి",
    "details_feedback_desc": "మీ అభిప్రాయం మున్సిపల్ ప్రతిస్పందన సమయాన్ని మెరుగుపరచడంలో సహాయపడుతుంది.",
    "details_feedback_rating": "పరిష్కార రేటింగ్",
    "details_feedback_remarks": "అభిప్రాయాలు / వ్యాఖ్యలు",
    "details_feedback_remarks_placeholder": "మీ అనుభవం గురించి చెప్పండి...",
    "details_feedback_submit": "అభిప్రాయాన్ని సమర్పించండి",
    "details_feedback_submitted": "అభిప్రాయం సమర్పించబడింది",
    "details_history_title": "నవీకరణ చరిత్ర",
    "details_back_dashboard": "డ్యాష్‌బోర్డ్‌కు తిరిగి వెళ్ళు",
    "emergency_title": "పౌర అత్యవసర నివేదిక",
    "emergency_subtitle": "ప్రజల భద్రతకు తక్షణ ముప్పు కలిగించే కీలక సమస్యలను నివేదించండి. అత్యవసర బృందాలకు నేరుగా బదిలీ చేయబడుతుంది.",
    "emergency_step1": "1. గుర్తింపు ధృవీకరణ (OTP)",
    "emergency_step2": "2. ప్రమాదం మరియు స్థల వివరాలు",
    "emergency_step3": "3. అత్యవసర బృందానికి పంపండి",
    "emergency_phone_label": "మీ మొబైల్ నంబర్ నమోదు చేయండి",
    "emergency_phone_placeholder": "10-అంకెల మొబైల్ నంబర్",
    "emergency_send_otp": "ధృవీకరణ OTP పంపండి",
    "emergency_enter_otp": "6-అంకెల OTP నమోదు చేయండి",
    "emergency_verify_otp": "OTP కోడ్‌ను ధృవీకరించండి",
    "emergency_verified": "ధృవీకరణ విజయవంతమైంది! దయచేసి అత్యవసర పరిస్థితిని కింద వివరించండి.",
    "emergency_form_title": "కీలకమైన పౌర ప్రమాదాన్ని నివేదించండి",
    "emergency_hazard_type": "అత్యవసర ప్రమాద రకం",
    "emergency_select_hazard": "ప్రమాద రకాన్ని ఎంచుకోండి",
    "emergency_hazard_desc": "పరిస్థితి మరియు ప్రమాద స్థాయిని వివరించండి",
    "emergency_hazard_desc_placeholder": "తక్షణ శ్రద్ధ అవసరమయ్యే పరిస్థితిని వివరించండి...",
    "emergency_mic_title": "వివరణను మాట్లాడండి",
    "emergency_photo": "ప్రమాద స్థలం ఫోటోను జత చేయండి (అత్యంత సిఫార్సు చేయబడింది)",
    "emergency_camera": "కెమెరాను తెరవండి",
    "emergency_gps_btn": "GPS స్థానాన్ని ఉపయోగించండి",
    "emergency_submit_btn": "అత్యవసర పరిస్థితిని ప్రసారం చేయండి",
    "how_title": "సివిక్ పల్స్ ఎలా పనిచేస్తుంది",
    "how_subtitle": "నివేదించడం మరియు ట్రాక్ చేయడం ఎప్పుడూ ఇంత సుభం కాలేదు.",
    "how_step1_title": "1. వివరాలు నమోదు చేయండి",
    "how_step1_desc": "వర్గాలను ఎంచుకోండి, సమస్య ఫోటోలను అప్‌లోడ్ చేయండి మరియు మ్యాప్ లేదా GPS ద్వారా స్థానాన్ని గుర్తించండి.",
    "how_step2_title": "2. ఆటో-అసైన్",
    "how_step2_desc": "జాప్యం లేకుండా పరిష్కరించడానికి మా సిస్టమ్ వెంటనే సంబంధిత విభాగానికి సమస్యను కేటాయిస్తుంది.",
    "how_step3_title": "3. పురోగతిని ట్రాక్ చేయండి",
    "how_step3_desc": "సమస్య పరిష్కార పురోగతిని లైవ్‌గా ట్రాక్ చేయండి, ఫోటోలను సరిపోల్ചండి మరియు పరిష్కారాన్ని ధృవీకరించుకోండి.",
    "emergency_escalation": "తక్షణ పరిష్కారం",
    "emergency_otp": "OTP ధృవీకరించబడింది",
    "emergency_priority": "అత్యంత ప్రాధాన్యత",
    "terms": "సేవా నిబంధనలు",
    "privacy": "గోప్యాతా విధానం",
    "form_photo_help": "సమస్యను త్వరగా గుర్తించడానికి ఫోటో లేదా ప్రత్యక్ష చిత్రాన్ని జత చేయండి.",
    "form_remove_photo": "ఫోటో తీసివేయి",
    "camera_accessing": "కెమెరాను యాక్సెస్ చేస్తోంది...",
    "camera_switch": "కెమెరాను మార్చు",
    "duplicate_warning_title": "సమీపంలో ఇలాంటి పరిష్కారం కాని సమస్య కనుగొనబడింది!",
    "duplicate_warning_desc": "మీరు ఎంచుకున్న ప్రాంతానికి 100 మీటర్ల లోపల ఇప్పటికే ఒక ఫిర్యాదు నమోదైంది. దానికి మద్దతు ఇవ్వడం వల్ల త్వరగా పరిష్కారమవుతుంది.",
    "bypass_duplicate": "అయినప్పటికీ కొత్త ఫిర్యాదు చేయి",
    "ai_suggestion": "AI సూచన",
    "apply_ai": "AI సూచనలను వర్తింపజేయి",
    "capture_photo": "ఫోటో తీయి",
    "print_receipt": "రశీదు ముద్రించు",
    "officer_contact": "కేటాయించిన అధికారి సంప్రదింపు",
    "uploaded_image": "పౌరుడు అప్‌లోడ్ చేసిన చిత్రం",
    "repair_visual": "దురస్తి దృశ్య ధృవీకరణ",
    "before_repair": "దురస్తికి ముందు",
    "after_repair": "దురస్తి తర్వాత",
    "support_widget_title": "ఈ సమస్యకు మద్దతు ఇవ్వండి",
    "support_widget_desc": "మీరు కూడా ఇదే సమస్యను ఎదుర్కొంటుంటే, కొత్తగా ఫిర్యాదు చేసే బదులు దీనికి మద్దతు ఇవ్వండి. ఎక్కువ మద్దతు ఉన్న సమస్యలను అధికారులు త్వరగా పరిష్కరిస్తారు.",
    "select_rating": "రేటింగ్ ఎంచుకోండి",
    "status_submitted": "సమర్పించబడింది",
    "status_verified": "ధృవీకరించబడింది",
    "status_assigned": "కేటాయించబడింది",
    "status_under_review": "పరిశీలనలో ఉంది",
    "status_repair_started": "దురస్తి ప్రారంభమైంది",
    "status_repair_in_progress": "దురస్తి పురోగతిలో ఉంది",
    "status_resolved": "పరిష్కరించబడింది",
    "status_closed": "మూసివేయబడింది",
    "status_rejected": "తిరస్కరించబడింది",
    "sub_submitted": "ఫిర్యాదు సివిక్ పల్స్ ద్వారా స్వీకరించబడింది",
    "sub_verified": "ఫిర్యాదు మోడరేటర్ ద్వారా ధృవీకరించబడింది",
    "sub_assigned": "విభాగం అధికారికి పంపబడింది",
    "sub_under_review": "అధికారి క్షేత్ర నివేదికను సమీక్షిస్తున్నారు",
    "sub_repair_started": "సైట్‌లో దురస్తి పని ప్రారంభమైంది",
    "sub_repair_in_progress": "దురస్తి పని పురోగతిలో ఉంది",
    "sub_resolved": "సమస్య పరిష్కరించబడింది & ధృవీకరించబడింది",
    "sub_closed": "పరిష్కారం తర్వాత కేసు మూసివేయబడింది",
    "sub_rejected": "ఫిర్యాదు ఆమోదించబడలేదు",
    "sympathy_submitted_title": "ఫిర్యాదు చేసినందుకు ధన్యవాదాలు!",
    "sympathy_submitted_body": "ఈ సమస్య వల్ల మీకు కలిగిన అసౌకర్యానికి విచారం వ్యక్తం చేస్తున్నాము. మీ ఫిర్యాదు నమోదు చేయబడింది, త్వరలో సమీక్షించబడుతుంది. నగరాన్ని మెరుగుపరచడానికి సహాయం చేసినందుకు ధన్యవాదాలు.",
    "sympathy_verified_title": "మేము మీ ఫిర్యాదును ధృవీకరించాము.",
    "sympathy_verified_body": "మీ నివేదిక సరైనదని మా బృందం నిర్ధారించింది. దీనివల్ల మీ దైనందిన జీవితానికి అంతరాయం కలిగినందుకు మేము విచారం వ్యక్తం చేస్తున్నాము.",
    "sympathy_assigned_title": "బృందం రంగంలోకి దిగింది!",
    "sympathy_assigned_body": "మీ ఫిర్యాదు సంబంధిత విభాగం అధికారికి కేటాయించబడింది. చింతించకండి, తగిన చర్యలు తీసుకోబడుతున్నాయి.",
    "sympathy_under_review_title": "నిపుణులు మీ సమస్యను సమీక్షిస్తున్నారు.",
    "sympathy_under_review_body": "మా అధికారులు క్షేత్రస్థాయి పరిశీలన జరుపుతున్నారు. కలిగిన అసౌకర్యాన్ని మేము అర్థం చేసుకున్నాము, త్వరలోనే పరిష్కరించడానికి కట్టుబడి ఉన్నాము.",
    "sympathy_repair_started_title": "దురస్తి పని ప్రారంభమైంది!",
    "sympathy_repair_started_body": "నివేదించబడిన స్థలంలో దురస్తి పని ప్రారంభమైందని తెలియజేయడానికి మేము సంతోషిస్తున్నాము. మీ ఓపికకు ధన్యవాదాలు — పరిష్కారం త్వరలోనే లభిస్తుంది!",
    "sympathy_repair_in_progress_title": "దురస్తి పని పురోగతిలో ఉంది.",
    "sympathy_repair_in_progress_body": "మా సిబ్బంది సంఘటనా స్థలంలో చురుగ్గా పనిచేస్తున్నారు. జాప్యానికి క్షమించండి. మీ వల్లే మా నగరం మెరుగవుతోంది.",
    "sympathy_resolved_title": "సమస్య పరిష్కరించబడింది! 🎉",
    "sympathy_resolved_body": "మీ ఫిర్యాదు విజయవంతంగా పరిష్కరించబడిందని తెలియజేయడానికి సంతోషిస్తున్నాము. ఫిర్యాదు చేసినందుకు ధన్యవాదాలు — మీ భాగస్వామ్యం మార్పును తెస్తుంది!",
    "sympathy_closed_title": "కేసు మూసివేయబడింది.",
    "sympathy_closed_body": "ఈ ఫిర్యాదు పూర్తిగా పరిష్కరించబడి మూసివేయబడింది. మెరుగైన నగరం నిర్మాణానికి సహాయపడినందుకు ధన్యవాదాలు. పరిష్కారం మీ నిరీక్షణకు తగ్గట్టుగా ఉంటుందని ఆశిస్తున్నాము!",
    "sympathy_rejected_title": "తిరస్కరించబడిందని తెలియజేయడానికి చింతిస్తున్నాము.",
    "sympathy_rejected_body": "మీ ఫిర్యాదును ఈ వ్యవస్థలో ప్రాసెస్ చేయడం సాధ్యపడలేదు. అసౌకర్యానికి క్షమించండి. దయచేసి ప్రత్యామ్నాయ సహాయం కోసం మీ స్థానిక మునిసిపల్ కార్యాలయాన్ని సంప్రదించండి.",
    "sympathy_delay_title": "జాప్యానికి మేము మనస్ఫూర్తిగా క్షమాపణలు కోరుతున్నాము.",
    "sympathy_delay_body": "మీ ఫిర్యాదు {days} రోజులుగా తెరిచి ఉంది. ఇది మీకు నిరాశ కలిగించిందని మాకు తెలుసు. దీనికి అత్యంత ప్రాధాన్యత ఇవ్వబడింది. మీ ఓపికకు ధన్యవాదాలు.",
    "role_citizen": "పౌరుడు",
    "role_authority": "అధికారం",
    "role_admin": "నిర్వాహకుడు",
    "action_by": "చర్య తీసుకున్న వారు",
    "system_user": "వ్యవస్థ",
    "no_history_logged": "ఇంకా ఎలాంటి చరిత్ర నమోదు కాలేదు",
    "no_login_needed": "లాగిన్ అవసరం లేదు",
    "email_otp": "ఇమెయిల్ OTP",
    "phone_otp": "ఫోన్ OTP",
    "email_otp_help": "తక్షణ ధృవీకరణ కోసం ఈ ఇమెయిల్‌కు OTP పంపబడుతుంది.",
    "phone_otp_help": "ఈ ఫోన్ నంబర్‌కు SMS ద్వారా OTP పంపబడుతుంది.",
    "otp_sent_to": "పంపిన 6-అంకెల OTP ని నమోదు చేయండి",
    "dashboard_welcome_subtitle": "మన నగరాన్ని పరిశుభ్రంగా, సురక్షితంగా మరియు సుస్థితిలో ఉంచడానికి సహాయపడండి.",
    "my_reported_locations": "నేను నివేదించిన స్థలాలు",
    "search_placeholder": "ID, కీవర్డ్ ద్వారా వెతకండి...",
    "all_categories": "అన్ని వర్గాలు",
    "all_statuses": "అన్ని స్థితులు",
    "action_header": "చర్య",
    "no_complaints_found": "ఫిర్యాదులు ఏవీ కనుగొనబడలేదు",
    "no_complaints_help": "ప్రారంభించడానికి కొత్త ఫిర్యాదును సమర్పించండి.",
    "cat_road_damage": "రోడ్డు దెబ్బతినడం",
    "cat_potholes": "గుంతలు",
    "cat_garbage_overflow": "చెత్త పేరుకుపోవడం",
    "cat_drainage_blockage": "డ్రైనేజీ పూడిక",
    "cat_street_light_failure": "వీధి దీపాల వైఫల్యం",
    "cat_water_leakage": "నీటి లీకేజీ",
    "cat_water_supply_issue": "నీటి సరఫరా సమస్య",
    "cat_public_sanitation": "సార్వజనిక నైర్మల్యం",
    "cat_tree_fallen": "చెట్టు కూలిపోవడం",
    "cat_broken_footpath": "ఫుట్‌పాత్ దెబ్బతినడం",
    "cat_traffic_signal_issue": "ట్రాఫిక్ సిగ్నల్ సమస్య",
    "cat_public_property_damage": "ప్రభుత్వ ఆస్తి నష్టం",
    "cat_other": "ఇతర",
    "login_title": "సివిక్ పల్స్ లాగిన్",
    "login_desc": "ఫిర్యాదులను నివేదించడానికి లేదా నిర్వహించడానికి సైన్ ఇన్ చేయండి",
    "login_username_label": "ఇమెయిల్ లేదా ఫోన్ నంబర్",
    "login_username_placeholder": "your@email.com లేదా 9876543210",
    "login_password_label": "పాస్‌వర్డ్",
    "login_password_placeholder": "••••••••",
    "login_no_account": "ఖాతా లేదా?",
    "login_register_link": "ఇక్కడ నమోదు చేసుకోండి",
    "register_title": "పౌర నమోదు",
    "register_desc": "సమస్యలను నివేదించడానికి మరియు మరమ్మతులను ట్రాక్ చేయడానికి ఖాతాను సృష్టించండి",
    "register_name_label": "పూర్తి పేరు",
    "register_name_placeholder": "John Doe",
    "register_email_label": "ఇమెయిల్ చిరునామా (ఇమెయిల్ లేదా ఫోన్ ఏదో ఒకటి అవసరం)",
    "register_email_placeholder": "john@example.com",
    "register_phone_label": "ఫోన్ నంబర్ (ఇమెయిల్ లేదా ఫోన్ ఏదో ఒకటి అవసరం)",
    "register_phone_placeholder": "9998887776",
    "register_password_placeholder": "కనీసం 6 అక్షరాలు",
    "register_address_label": "నివాస చిరునామా",
    "register_address_placeholder": "వీధి, ప్రాంతం, నగరం",
    "register_btn": "ఖాతాను నమోదు చేయండి",
    "register_already_account": "ఇప్పటికే ఖాతా ఉందా?",
    "register_login_link": "ఇక్కడ లాగిన్ అవ్వండి",
    "otp_form_title": "ధృవీకరణ కోడ్‌లను నమోదు చేయండి",
    "otp_form_desc": "మీ గుర్తింపును ధృవీకరించడానికి మేము భద్రతా కోడ్‌లను పంపాము.",
    "otp_email_label": "ఇమెయిల్ ధృవీకరణ OTP",
    "otp_phone_label": "ఫోన్ ధృవీకరణ OTP",
    "otp_verify_btn": "ధృవీకరించి నమోదు పూర్తి చేయండి",
    "otp_back_btn": "నమోదు ఫారమ్‌కు తిరిగి వెళ్ళండి",
    "copyright": "© 2026 సివిక్‌పల్స్. అన్ని హక్కులూ ప్రత్యేకించబడినవి."
  },
  ml: {
    "dashboard": "ഡാഷ്‌ബോർഡ്",
    "about": "കുറിച്ച്",
    "profile": "പ്രൊഫൈലും ക്രമീകരണങ്ങളും",
    "logout": "ലോഗ് ഔട്ട്",
    "welcome": "സ്വാഗതം",
    "report_issue": "പുതിയ പരാതി നൽകുക",
    "total_reported": "ആകെ പരാതികൾ",
    "unresolved": "പരിഹരിക്കാത്തവ",
    "resolved": "പരിഹരിച്ചവ",
    "complaint_history": "എന്റെ പരാതി ചരിത്രം",
    "history": "ചരിത്രം",
    "home": "ഹോം",
    "track": "ട്രാക്ക് ചെയ്യുക",
    "login": "ലോഗിൻ",
    "register": "രജിസ്റ്റർ",
    "no_notifications": "പുതിയ അറിയിപ്പുകൾ ഇല്ല",
    "recent_updates": "സമീപകാല അപ്ഡേറ്റുകൾ",
    "report_new": "പുതിയ സിവിക് പരാതി രജിസ്റ്റർ ചെയ്യുക",
    "issue_title": "ലഘുവായ തലക്കെട്ട്",
    "issue_category": "പരാതി വിഭാഗം",
    "issue_priority": "മുൻഗണന",
    "issue_description": "വിശദമായ വിവരണം",
    "attach_photo": "ഫോട്ടോ അറ്റാച്ചുചെയ്യുക",
    "submit_complaint": "പരാതി സമർപ്പിക്കുക",
    "my_profile": "എന്റെ പ്രൊഫൈൽ",
    "change_password": "പാസ്‌വേഡ് മാറ്റുക",
    "save_changes": "മാറ്റങ്ങൾ സംരക്ഷിക്കുക",
    "complaint_id": "പരാതി റഫറൻസ് ഐഡി",
    "track_complaint": "പരാതി ട്രാക്ക് ചെയ്യുക",
    "issue_status": "പരാതിയുടെ നില",
    "progress_lifecycle": "പരാതി പരിഹാര പുരോഗതി",
    "assigned_dept": "നിയോഗിച്ച വകുപ്പ്",
    "date_reported": "പരാതി നൽകിയ തീയതി",
    "support_votes": "പൗരന്മാരുടെ പിന്തുണ വോട്ടുകൾ",
    "support_complaint": "പരാതിയെ പിന്തുണയ്ക്കുക",
    "report_coordinates": "ലൊക്കേഷൻ കോർഡിനേറ്റുകൾ",
    "back_dashboard": "ഡാഷ്‌ബോർഡിലേക്ക് മടങ്ങുക",
    "back_home": "ഹോമിലേക്ക് മടങ്ങുക",
    "select_category": "വിഭാഗം തിരഞ്ഞെടുക്കുക",
    "use_gps": "GPS ലൊക്കേഷൻ ഉപയോഗിക്കുക",
    "locating": "ലൊക്കേഷൻ കണ്ടെത്തുന്നു...",
    "citizen_portal": "പൗരന്മാരുടെ പോർട്ടൽ",
    "authority_portal": "ഉദ്യോഗസ്ഥരുടെ പോർട്ടൽ",
    "admin_portal": "അഡ്മിൻ പോർട്ടൽ",
    "empowering_communities": "സമൂഹങ്ങളെ ശാക്തീകരിക്കുന്നു",
    "hero_title": "സ്മാർട്ട് സിവിക് പ്രശ്ന പരിഹാര പോർട്ടൽ",
    "hero_subtitle": "പ്രാദേശിക അടിസ്ഥാന സൗകര്യ പ്രശ്നങ്ങൾ നേരിട്ട് മുനിസിപ്പൽ ഓഫീസുകളിൽ റിപ്പോർട്ട് ചെയ്യുക. ലൊക്കേഷൻ വിവരങ്ങൾ തൽക്ഷണം രേഖപ്പെടുത്തുക, പരാതി പരിഹാര പുരോഗതി ട്രാക്ക് ചെയ്യുക, ഒപ്പം വൃത്തിയുള്ള നഗര നിർമ്മാണത്തിൽ പങ്കാളിയാകുക.",
    "how_it_works": "ഇത് എങ്ങനെ പ്രവർത്തിക്കുന്നു",
    "track_instruction": "പരാതിയുടെ നില പരിശോധിക്കാൻ റഫറൻസ് ഐഡി നൽകുക. ലോഗിൻ ചെയ്യേണ്ടതില്ല.",
    "track_placeholder": "CIV-XXXXXXXX-XXXXX",
    "track_btn": "ട്രാക്ക് ചെയ്യുക",
    "sdg_title": "ആഗോള സുസ്ഥിരതയ്ക്കുള്ള പിന്തുണ",
    "sdg_subtitle": "ഐക്യരാഷ്ട്രസഭയുടെ സുസ്ഥിര വികസന ലക്ഷ്യങ്ങളുമായി (SDGs) പൊരുത്തപ്പെടുന്നു.",
    "sdg_6_title": "ശുദ്ധജലവും ശുചിത്വവും",
    "sdg_6_desc": "കുടിവെള്ള ചോർച്ച, ഡ്രെയിനേജ് തടസ്സങ്ങൾ, പൊതു ശുചിത്വ പ്രശ്നങ്ങൾ എന്നിവ തൽക്ഷണം റിപ്പോർട്ട് ചെയ്യുക.",
    "sdg_9_title": "വ്യവസായം, നവീകരണം & അടിസ്ഥാന സൗകര്യങ്ങൾ",
    "sdg_9_desc": "അടിസ്ഥാന സൗകര്യങ്ങളിലെ തകരാറുകൾ കണ്ടെത്താനും പരിഹാര പ്രവർത്തനങ്ങൾ ആസൂത്രണം ചെയ്യാനും സ്മാർട്ട് വർക്ക്ഫ്ലോ ഉപയോഗിക്കുന്നു.",
    "sdg_11_title": "സുസ്ഥിര നഗരങ്ങളും സമൂഹങ്ങളും",
    "sdg_11_desc": "റോഡ് സുരക്ഷ, തെരുവ് വിളക്കുകളുടെ പ്രവർത്തനം, സാമൂഹിക സുരക്ഷ എന്നിവ ഉറപ്പാക്കാൻ പൗരന്മാരുടെ പങ്കാളിത്തം ഉറപ്പാക്കുന്നു.",
    "emergency_card_title": "അടിയന്തിര സ്വഭാവമുള്ള സിവിക് പ്രശ്നം നേരിടുന്നുണ്ടോ?",
    "emergency_card_desc": "റോഡ് ഇടിഞ്ഞുതാഴൽ, സെവേജ് ഓവർഫ്ലോ, മരം വീഴൽ, വൈദ്യുതി ലൈൻ പൊട്ടിവീഴൽ? തൽക്ഷണം റിപ്പോർട്ട് ചെയ്യുക — ലോഗിൻ ആവശ്യമില്ല. OTP വഴി മാത്രം വെരിഫൈ ചെയ്യുക.",
    "emergency_card_btn": "അടിയന്തിര പരാതി ഇപ്പോൾ നൽകുക",
    "emergency_footer_note": "പോലീസ്, ഫയർഫോഴ്സ്, അല്ലെങ്കിൽ മെഡിക്കൽ അടിയന്തിര സാഹചര്യങ്ങളിൽ ഉടൻ 112 ലേക്ക് വിളിക്കുക.",
    "copyright": "© 2026 സിവിക്പൾസ് മുനിസിപ്പൽ കോർപ്പറേഷൻ. എല്ലാ അവകാശങ്ങളും നിക്ഷിപ്തം.",
    "sidebar_dashboard": "ഡാഷ്‌ബോർഡ്",
    "sidebar_report_issue": "പരാതി നൽകുക",
    "sidebar_profile": "എന്റെ പ്രൊഫൈൽ",
    "sidebar_logout": "ലോഗ് ഔട്ട്",
    "form_report_new": "പുതിയ സിവിക് പരാതി രജിസ്റ്റർ ചെയ്യുക",
    "form_report_desc": "മുനിസിപ്പൽ എഞ്ചിനീയർമാർക്ക് ത്വരിത നടപടി സ്വീകരിക്കാൻ വിശദമായ വിവരങ്ങളും ലൊക്കേഷനും നൽകുക.",
    "form_title_label": "ലഘുവായ തലക്കെട്ട്",
    "form_title_placeholder": "ഉദാ: പ്രധാന കവലയ്ക്ക് സമീപം വലിയ കുഴി",
    "form_category_label": "പരാതി വിഭാഗം",
    "form_category_placeholder": "വിഭാഗം തിരഞ്ഞെടുക്കുക",
    "form_priority_label": "മുൻഗണന",
    "form_desc_label": "വിശദമായ വിവരണം",
    "form_desc_placeholder": "തകരാറിന്റെ വലിപ്പം, പ്രത്യാഘാതം, അപകടസാധ്യത തുടങ്ങിയ വിവരങ്ങൾ നൽകുക...",
    "form_photo_label": "ഫോട്ടോ ചേർക്കുക (പരമാവധി 5MB • JPG, PNG)",
    "form_camera_btn": "ലൈവ് ഫോട്ടോ എടുക്കുക",
    "form_location_label": "തകരാർ സംഭവിച്ച സ്ഥലം അടയാളപ്പെടുത്തുക",
    "form_location_desc": "കൃത്യമായ ലൊക്കേഷൻ രേഖപ്പെടുത്താൻ മാപ്പിൽ ക്ലിക്ക് ചെയ്യുകയോ GPS ബട്ടൺ ഉപയോഗിക്കുകയോ ചെയ്യുക.",
    "form_gps_btn": "GPS ലൊക്കേഷൻ ഉപയോഗിക്കുക",
    "form_latitude_label": "അക്ഷാംശം",
    "form_longitude_label": "രേഖാംശം",
    "form_submit_btn": "പരാതി സമർപ്പിക്കുക",
    "profile_settings_title": "പ്രൊഫൈൽ ക്രമീകരണങ്ങൾ നിയന്ത്രിക്കുക",
    "profile_settings_desc": "നിങ്ങളുടെ ബന്ധപ്പെടാനുള്ള വിവരങ്ങൾ കൃത്യമായി സൂക്ഷിക്കുക.",
    "profile_role": "അക്കൗണ്ട് റോൾ",
    "profile_name": "പൂർണ്ണനാമം",
    "profile_name_placeholder": "ജോൺ ഡോ",
    "profile_email": "ഇമെയിൽ വിലാസം (രജിസ്റ്റർ ചെയ്തത്)",
    "profile_email_help": "രജിസ്റ്റർ ചെയ്ത ഇമെയിൽ മാറ്റാൻ സാധിക്കില്ല.",
    "profile_phone": "ഫോൺ നമ്പർ",
    "profile_phone_placeholder": "9998887776",
    "profile_lang": "മുൻഗണനാ സിസ്റ്റം ഭാഷ",
    "profile_address": "വീട്ടു വിലാസം",
    "profile_address_placeholder": "തെരുവ്, പ്രദേശം, നഗരം",
    "profile_change_pwd": "പാസ്‌വേഡ് മാറ്റുക",
    "profile_change_pwd_desc": "സുരക്ഷയ്ക്കായി പാസ്‌വേഡ് അപ്‌ഡേറ്റുകൾക്ക് OTP വെരിഫിക്കേഷൻ ആവശ്യമാണ്. മാറ്റേണ്ടതില്ലെങ്കിൽ മാറ്റമില്ലാതെ വിടുക.",
    "profile_new_pwd": "പുതിയ പാസ്‌വേഡ്",
    "profile_new_pwd_placeholder": "കുറഞ്ഞത് 6 അക്ഷരങ്ങൾ",
    "profile_otp": "വെരിഫിക്കേഷൻ OTP",
    "profile_send_otp": "OTP കോഡ് അയയ്ക്കുക",
    "profile_otp_help": "OTP രജിസ്റ്റർ ചെയ്ത ഇമെയിലിലേക്കോ ഫോണിലേക്കോ അയയ്ക്കും.",
    "profile_cancel": "റദ്ദാക്കുക",
    "profile_save": "ക്രമീകരണങ്ങൾ സംരക്ഷിക്കുക",
    "details_heading": "പരാതി ട്രാക്കിംഗ് വിവരങ്ങൾ",
    "details_sub": "പരാതിയുടെ നിലവിലെ പുരോഗതിയും നിയോഗിച്ച വകുപ്പും പരിശോധിക്കുക.",
    "details_ref_id": "പരാതി റഫറൻസ് ഐഡി",
    "details_status": "പരാതിയുടെ നില",
    "details_category": "പരാതി വിഭാഗം",
    "details_priority": "മുൻഗണന",
    "details_description": "വിശദമായ വിവരണം",
    "details_date": "പരാതി നൽകിയ തീയതി",
    "details_assigned": "നിയോഗിച്ച വകുപ്പ്",
    "details_officer": "ഉദ്യോഗസ്ഥന്റെ പേര്",
    "details_officer_phone": "ഉദ്യോഗസ്ഥന്റെ ഫോൺ",
    "details_officer_email": "ഉദ്യോഗസ്ഥന്റെ ഇമെയിൽ",
    "details_map_title": "രേഖപ്പെടുത്തിയ ലൊക്കേഷൻ",
    "details_support_votes": "പൗരന്മാരുടെ പിന്തുണ വോട്ടുകൾ",
    "details_support_btn": "പരാതിയെ പിന്തുണയ്ക്കുക",
    "details_support_btn_already": "നിങ്ങൾ പരാതിയെ പിന്തുണച്ചു",
    "details_feedback_title": "പരിഹാരത്തെക്കുറിച്ചുള്ള അഭിപ്രായം രേഖപ്പെടുത്തുക",
    "details_feedback_desc": "നിങ്ങളുടെ പ്രതികരണം മുനിസിപ്പൽ സേവനങ്ങളുടെ സമയം മെച്ചപ്പെടുത്താൻ സഹായിക്കും.",
    "details_feedback_rating": "പരിഹാര റേറ്റിംഗ്",
    "details_feedback_remarks": "അഭിപ്രായങ്ങൾ / കുറിപ്പുകൾ",
    "details_feedback_remarks_placeholder": "നിങ്ങളുടെ അനുഭവത്തെക്കുറിച്ച് പറയുക...",
    "details_feedback_submit": "അഭിപ്രായം സമർപ്പിക്കുക",
    "details_feedback_submitted": "അഭിപ്രായം സമർപ്പിച്ചു",
    "details_history_title": "അപ്‌ഡേറ്റ് ചരിത്രം",
    "details_back_dashboard": "ഡാഷ്‌ബോർഡിലേക്ക് മടങ്ങുക",
    "emergency_title": "അടിയന്തിര സിവിക് റിപ്പോർട്ടിംഗ്",
    "emergency_subtitle": "പൊതു സുരക്ഷയ്ക്ക് പെട്ടെന്ന് ഭീഷണിയായേക്കാവുന്ന നിർണായക പ്രശ്നങ്ങൾ റിപ്പോർട്ട് ചെയ്യുക. നേരിട്ട് എമർജൻസി ടീമിലേക്ക് അപ്‌ഡേറ്റ് അയക്കും.",
    "emergency_step1": "1. ഐഡന്റിറ്റി വെരിഫൈ ചെയ്യുക (OTP)",
    "emergency_step2": "2. പ്രശ്നവും ലൊക്കേഷനും വിശദമാക്കുക",
    "emergency_step3": "3. എമർജൻസി ടീമിലേക്ക് അയക്കുക",
    "emergency_phone_label": "മൊബൈൽ നമ്പർ നൽകുക",
    "emergency_phone_placeholder": "10-അക്ക മൊബൈൽ നമ്പർ",
    "emergency_send_otp": "വെരിഫിക്കേഷൻ OTP അയയ്ക്കുക",
    "emergency_enter_otp": "6-അക്ക OTP നൽകുക",
    "emergency_verify_otp": "OTP കോഡ് വെരിഫൈ ചെയ്യുക",
    "emergency_verified": "വിജയകരമായി വെരിഫൈ ചെയ്തു! പ്രശ്ന വിവരങ്ങൾ താഴെ വിശദീകരിക്കുക.",
    "emergency_form_title": "ഗുരുതരമായ സിവിക് പ്രശ്നം റിപ്പോർട്ട് ചെയ്യുക",
    "emergency_hazard_type": "അടിയന്തിര പ്രശ്ന തരം",
    "emergency_select_hazard": "പ്രശ്ന തരം തിരഞ്ഞെടുക്കുക",
    "emergency_hazard_desc": "സാഹചര്യവും അപകടസാധ്യതയും വിശദീകരിക്കുക",
    "emergency_hazard_desc_placeholder": "ഉടൻ ശ്രദ്ധിക്കേണ്ട കാര്യങ്ങൾ വിശദീകരിക്കുക...",
    "emergency_mic_title": "വിവരണം പറയുക",
    "emergency_photo": "തകരാറിന്റെ ഫോട്ടോ ചേർക്കുക (ശുപാർശ ചെയ്യുന്നത്)",
    "emergency_camera": "ക്യാമറ തുറക്കുക",
    "emergency_gps_btn": "GPS ലൊക്കേഷൻ ഉപയോഗിക്കുക",
    "emergency_submit_btn": "അടിയന്തിര പ്രക്ഷേപണം നടത്തുക",
    "how_title": "സിവിക് പൾസ് എങ്ങനെ പ്രവർത്തിക്കുന്നു",
    "how_subtitle": "പരാതി രജിസ്റ്റർ ചെയ്യുന്നതും ട്രാക്ക് ചെയ്യുന്നതും ഇത്ര ലളിതമായിരുന്നില്ല.",
    "how_step1_title": "1. വിവരങ്ങൾ രേഖപ്പെടുത്തുക",
    "how_step1_desc": "വിഭാഗം തിരഞ്ഞെടുക്കുക, തകരാറുകളുടെ ഫോട്ടോ അപ്‌ലോഡ് ചെയ്യുക, മാപ്പിലോ ജിപിഎസ് വഴിയോ ലൊക്കേഷൻ അടയാളപ്പെടുത്തുക.",
    "how_step2_title": "2. വകുപ്പ് നിയോഗിക്കൽ",
    "how_step2_desc": "താമസമില്ലാതെ പരിഹരിക്കുന്നതിനായി ഞങ്ങളുടെ സിസ്റ്റം ബന്ധപ്പെട്ട വകുപ്പിന് ഉടൻ തന്നെ പരാതി കൈമാറുന്നു.",
    "how_step3_title": "3. പരിഹാര പുരോഗതി",
    "how_step3_desc": "പരാതി പരിഹാര പുരോഗതി തത്സമയം ട്രാക്ക് ചെയ്യുക, ചിത്രങ്ങൾ പരിശോധിച്ച് പരിഹാരം ഉറപ്പാക്കുക.",
    "emergency_escalation": "തൽക്ഷണ പരിഹാരം",
    "emergency_otp": "OTP വെരിഫൈ ചെയ്തു",
    "emergency_priority": "അതിതീവ്ര മുൻഗണന",
    "terms": "സേവന നിബന്ധനകൾ",
    "privacy": "സ്വകാര്യതാ നയം",
    "form_photo_help": "തകരാർ വേഗത്തിൽ കണ്ടെത്താൻ ഫോട്ടോ ചേർക്കുകയോ ലൈവ് ഫോട്ടോ എടുക്കുകയോ ചെയ്യുക.",
    "form_remove_photo": "ഫോട്ടോ ഒഴിവാക്കുക",
    "camera_accessing": "ക്യാമറ ലഭ്യമാക്കുന്നു...",
    "camera_switch": "ക്യാമറ മാറ്റുക",
    "duplicate_warning_title": "സമീപത്ത് സമാനമായ പരിഹരിക്കപ്പെടാത്ത പ്രശ്നം കണ്ടെത്തിയിരിക്കുന്നു!",
    "duplicate_warning_desc": "നിങ്ങൾ അടയാളപ്പെടുത്തിയ ലൊക്കേഷന്റെ 100 മീറ്ററിനുള്ളിൽ സമാനമായ പരാതി നിലവിലുണ്ട്. ആ പരാതിയെ പിന്തുണയ്ക്കുന്നത് പ്രശ്നപരിഹാരം വേഗത്തിലാക്കും.",
    "bypass_duplicate": "എങ്കിലും പുതിയ പരാതി നൽകുക",
    "ai_suggestion": "AI നിർദ്ദേശം",
    "apply_ai": "AI നിർദ്ദേശങ്ങൾ സ്വീകരിക്കുക",
    "capture_photo": "ഫോട്ടോ എടുക്കുക",
    "print_receipt": "രസീത് പ്രിന്റ് ചെയ്യുക",
    "officer_contact": "നിയോഗിച്ച ഉദ്യോഗസ്ഥന്റെ ബന്ധപ്പെടേണ്ട വിവരങ്ങൾ",
    "uploaded_image": "പൗരൻ അപ്‌ലോഡ് ചെയ്ത ചിത്രം",
    "repair_visual": "പരിഹാര ദൃശ്യ വെരിഫിക്കേഷൻ",
    "before_repair": "പരിഹാരത്തിന് മുൻപ്",
    "after_repair": "പരിഹാരത്തിന് ശേഷം",
    "support_widget_title": "ഈ പരാതിയെ പിന്തുണയ്ക്കുക",
    "support_widget_desc": "നിങ്ങളും ഈ പ്രശ്നം നേരിടുന്നുണ്ടെങ്കിൽ, പുതിയ പരാതി നൽകുന്നതിന് പകരം ഈ പരാതിയെ പിന്തുണയ്ക്കുക. കൂടുതൽ പിന്തുണ ലഭിക്കുന്ന പരാതികൾ അധികാരികൾ മുൻഗണനയോടെ പരിഹരിക്കും.",
    "select_rating": "റേറ്റിംഗ് തിരഞ്ഞെടുക്കുക",
    "status_submitted": "സമർപ്പിച്ചു",
    "status_verified": "സ്ഥിരീകരിച്ചു",
    "status_assigned": "നിയോഗിച്ചു",
    "status_under_review": "പരിശോധനയിലാണ്",
    "status_repair_started": "അറ്റകുറ്റപ്പണി തുടങ്ങി",
    "status_repair_in_progress": "അറ്റകുറ്റപ്പണി നടക്കുന്നു",
    "status_resolved": "പരിഹരിച്ചു",
    "status_closed": "അടച്ചു",
    "status_rejected": "നിരസിച്ചു",
    "sub_submitted": "പരാതി സിവിക് പൾസിന് ലഭിച്ചു",
    "sub_verified": "പരാതി മോഡറേറ്റർ സ്ഥിരീകരിച്ചു",
    "sub_assigned": "വകുപ്പ് ഉദ്യോഗസ്ഥന് കൈമാറി",
    "sub_under_review": "ഉദ്യോഗസ്ഥൻ ഫീൽഡ് റിപ്പോർട്ട് അവലോകനം ചെയ്യുന്നു",
    "sub_repair_started": "സൈറ്റിൽ അറ്റകുറ്റപ്പണികൾ ആരംഭിച്ചു",
    "sub_repair_in_progress": "അറ്റകുറ്റപ്പണി പുരോഗമിക്കുന്നു",
    "sub_resolved": "പ്രശ്നം പരിഹരിച്ച് സ്ഥിരീകരിച്ചു",
    "sub_closed": "പരിഹാരത്തിന് ശേഷം കേസ് അടച്ചു",
    "sub_rejected": "പരാതി അംഗീകരിച്ചില്ല",
    "sympathy_submitted_title": "പരാതി നൽകിയതിന് നന്ദി!",
    "sympathy_submitted_body": "ഈ പ്രശ്നം മൂലമുണ്ടായ ബുദ്ധിമുട്ടിൽ ഞങ്ങൾ ഖേദിക്കുന്നു. നിങ്ങളുടെ പരാതി രജിസ്റ്റർ ചെയ്തിട്ടുണ്ട്, ഉടൻ തന്നെ അവലോകനം ചെയ്യും. നഗരം മികച്ചതാക്കാൻ സഹായിച്ചതിന് നന്ദി.",
    "sympathy_verified_title": "നിങ്ങളുടെ പരാതി ഞങ്ങൾ സ്ഥിരീകരിച്ചു.",
    "sympathy_verified_body": "നിങ്ങളുടെ റിപ്പോർട്ട് ശരിയാണെന്ന് ഞങ്ങളുടെ ടീം സ്ഥിരീകരിച്ചു. ഇത് നിങ്ങളുടെ ദൈനംദിന ജീവിതത്തെ ബാധിച്ചതിൽ ഞങ്ങൾ ഖേദിക്കുന്നു.",
    "sympathy_assigned_title": "ടീം രംഗത്തുണ്ട്!",
    "sympathy_assigned_body": "നിങ്ങളുടെ പരാതി ബന്ധപ്പെട്ട വകുപ്പ് ഉദ്യോഗസ്ഥന് കൈമാറിയിട്ടുണ്ട്. ആശങ്കപ്പെടേണ്ടതില്ല, ഉചിതമായ നടപടികൾ സ്വീകരിക്കുന്നുണ്ട്.",
    "sympathy_under_review_title": "വിദഗ്ദ്ധർ നിങ്ങളുടെ പ്രശ്നം പരിശോധിക്കുന്നു.",
    "sympathy_under_review_body": "ഞങ്ങളുടെ ഉദ്യോഗസ്ഥർ സംഭവസ്ഥലം സന്ദർശിച്ച് വിലയിരുത്തുന്നു. ഉണ്ടായ ബുദ്ധിമുട്ടുകൾ ഞങ്ങൾ മനസ്സിലാക്കുന്നു, ഉടൻ പരിഹരിക്കാൻ ശ്രമിക്കും.",
    "sympathy_repair_started_title": "അറ്റകുറ്റപ്പണി ആരംഭിച്ചു!",
    "sympathy_repair_started_body": "റിപ്പോർട്ട് ചെയ്ത സ്ഥലത്ത് അറ്റകുറ്റപ്പണികൾ ആരംഭിച്ചുവെന്ന് അറിയിക്കുന്നതിൽ സന്തോഷമുണ്ട്. നിങ്ങളുടെ ക്ഷമയ്ക്ക് നന്ദി — പരിഹാരം ഉടൻ ലഭിക്കും!",
    "sympathy_repair_in_progress_title": "അറ്റകുറ്റപ്പണി പുരോഗമിക്കുന്നു.",
    "sympathy_repair_in_progress_body": "ഞങ്ങളുടെ തൊഴിലാളികൾ സ്ഥലത്ത് സജീവമായി ജോലി ചെയ്യുന്നുണ്ട്. വൈകിയതിൽ ഖേദിക്കുന്നു. നിങ്ങളുടെ നഗരം കൂടുതൽ മികച്ചതാവുകയാണ്.",
    "sympathy_resolved_title": "പ്രശ്നം പരിഹരിച്ചു! 🎉",
    "sympathy_resolved_body": "നിങ്ങളുടെ പരാതി വിജയകരമായി പരിഹരിച്ചുവെന്ന് അറിയിക്കുന്നതിൽ സന്തോഷമുണ്ട്. പരാതി നൽകിയതിന് നന്ദി — നിങ്ങളുടെ പങ്കാളിത്തം മാറ്റം വരുത്തുന്നു!",
    "sympathy_closed_title": "കേസ് അടച്ചു.",
    "sympathy_closed_body": "ഈ പരാതി പൂർണ്ണമായി പരിഹരിച്ച് അടച്ചു. മികച്ച നഗര നിർമ്മാണത്തിന് സഹായിച്ചതിന് നന്ദി. പരിഹാരം നിങ്ങളുടെ പ്രതീക്ഷയ്ക്ക് അനുസരിച്ചുള്ളതാണെന്ന് കരുതുന്നു!",
    "sympathy_rejected_title": "നിരസിച്ച വിവരം അറിയിക്കുന്നതിൽ ഖേദിക്കുന്നു.",
    "sympathy_rejected_body": "നിങ്ങളുടെ പരാതി ഈ സിസ്റ്റത്തിൽ പ്രോസസ്സ് ചെയ്യാൻ സാധിച്ചില്ല. ബുദ്ധിമുട്ടിൽ ഖേദിക്കുന്നു. ദയവായി സഹായത്തിനായി നിങ്ങളുടെ തദ്ദേശ സ്വയംഭരണ സ്ഥാപനത്തെ ബന്ധപ്പെടുക.",
    "sympathy_delay_title": "വൈകിയതിന് ഞങ്ങൾ ആത്മാർത്ഥമായി ക്ഷമ ചോദിക്കുന്നു.",
    "sympathy_delay_body": "നിങ്ങളുടെ പരാതി {days} ദിവസമായി തുറന്നു കിടക്കുകയാണ്. ഇത് നിങ്ങളെ ബുദ്ധിമുട്ടിച്ചുവെന്ന് ഞങ്ങൾക്കറിയാം. ഇതിന് മുൻഗണന നൽകിയിട്ടുണ്ട്. നിങ്ങളുടെ ക്ഷമയ്ക്ക് നന്ദി.",
    "role_citizen": "പൗരൻ",
    "role_authority": "അധികാരി",
    "role_admin": "അഡ്മിൻ",
    "action_by": "നടപടി എടുത്തത്",
    "system_user": "സിസ്റ്റം",
    "no_history_logged": "ചരിത്രം ഇതുവരെ രേഖപ്പെടുത്തിയിട്ടില്ല",
    "no_login_needed": "ലോഗിൻ ആവശ്യമില്ല",
    "email_otp": "ഇമെയിൽ OTP",
    "phone_otp": "ഫോൺ OTP",
    "email_otp_help": "ഉടൻ സ്ഥിരീകരിക്കുന്നതിനായി ഈ ഇമെയിലിലേക്ക് OTP അയയ്ക്കും.",
    "phone_otp_help": "ഈ ഫോൺ നമ്പറിലേക്ക് SMS വഴി OTP അയയ്ക്കും.",
    "otp_sent_to": "അയച്ച 6-അക്ക OTP നൽകുക",
    "dashboard_welcome_subtitle": "നമ്മുടെ നഗരം വൃത്തിയായും സുരക്ഷിതമായും സൂക്ഷിക്കാൻ സഹായിക്കുക.",
    "my_reported_locations": "ഞാൻ റിപ്പോർട്ട് ചെയ്ത സ്ഥലങ്ങൾ",
    "search_placeholder": "ID, കീവേഡ് വഴി തിരയുക...",
    "all_categories": "എല്ലാ വിഭാഗങ്ങളും",
    "all_statuses": "എല്ലാ നിലകളും",
    "action_header": "നടപടി",
    "no_complaints_found": "പരാതികൾ ഒന്നും കണ്ടെത്തിയില്ല",
    "no_complaints_help": "ആരംഭിക്കുന്നതിനായി പുതിയ പരാതി സമർപ്പിക്കുക.",
    "cat_road_damage": "റോഡ് തകരാർ",
    "cat_potholes": "കുഴികൾ",
    "cat_garbage_overflow": "മാലിന്യക്കൂമ്പാരം",
    "cat_drainage_blockage": "ഓട തടസ്സം",
    "cat_street_light_failure": "തെരുവ് വിളക്ക് കേടുപാടുകൾ",
    "cat_water_leakage": "പൈപ്പ് പൊട്ടൽ",
    "cat_water_supply_issue": "കുടിവെള്ള വിതരണ പ്രശ്നം",
    "cat_public_sanitation": "പൊതു ശുചിത്വം",
    "cat_tree_fallen": "മരം വീണത്",
    "cat_broken_footpath": "നടപ്പാത തകരാർ",
    "cat_traffic_signal_issue": "ট്രാഫിക് സിഗ്നൽ കേട്",
    "cat_public_property_damage": "പൊതുമുതൽ നശിപ്പിക്കൽ",
    "cat_other": "മറ്റുള്ളവ",
    "login_title": "സിവിക് പൾസ് ലോഗിൻ",
    "login_desc": "പരാതികൾ നൽകുന്നതിനും നിയന്ത്രിക്കുന്നതിനും ലോഗിൻ ചെയ്യുക",
    "login_username_label": "ഇമെയിൽ അല്ലെങ്കിൽ ഫോൺ നമ്പർ",
    "login_username_placeholder": "your@email.com അല്ലെങ്കിൽ 9876543210",
    "login_password_label": "പാസ്‌വേഡ്",
    "login_password_placeholder": "••••••••",
    "login_no_account": "അക്കൗണ്ട് ഇല്ലേ?",
    "login_register_link": "ഇവിടെ രജിസ്റ്റർ ചെയ്യുക",
    "register_title": "സിറ്റിസൺ രജിസ്ട്രേഷൻ",
    "register_desc": "പരാതികൾ നൽകുന്നതിനും ട്രാക്ക് ചെയ്യുന്നതിനും അക്കൗണ്ട് സൃഷ്ടിക്കുക",
    "register_name_label": "പൂർണ്ണ നാമം",
    "register_name_placeholder": "John Doe",
    "register_email_label": "ഇമെയിൽ വിലാസം (ഇമെയിൽ അല്ലെങ്കിൽ ഫോൺ ഏതെങ്കിലും ഒന്ന് ആവശ്യമാണ്)",
    "register_email_placeholder": "john@example.com",
    "register_phone_label": "ഫോൺ നമ്പർ (ഇമെയിൽ അല്ലെങ്കിൽ ഫോൺ ഏതെങ്കിലും ഒന്ന് ആവശ്യമാണ്)",
    "register_phone_placeholder": "9998887776",
    "register_password_placeholder": "കുറഞ്ഞത് 6 അക്ഷരങ്ങൾ",
    "register_address_label": "വിലാസം",
    "register_address_placeholder": "സ്ട്രീറ്റ്, ഏരിയ, സിറ്റി",
    "register_btn": "രജിസ്റ്റർ ചെയ്യുക",
    "register_already_account": "ഇതിനകം ഒരു അക്കൗണ്ട് ഉണ്ടോ?",
    "register_login_link": "ഇവിടെ ലോഗിൻ ചെയ്യുക",
    "otp_form_title": "വെരിഫിക്കേഷൻ കോഡ് നൽകുക",
    "otp_form_desc": "നിങ്ങളുടെ ഐഡന്റിറ്റി സ്ഥിരീകരിക്കുന്നതിനായി ഞങ്ങൾ സെക്യൂരിറ്റി കോഡുകൾ അയച്ചിട്ടുണ്ട്.",
    "otp_email_label": "ഇമെയിൽ വെരിഫിക്കേഷൻ OTP",
    "otp_phone_label": "ഫോൺ വെരിഫിക്കേഷൻ OTP",
    "otp_verify_btn": "സ്ഥിരീകരിച്ച് രജിസ്ട്രേഷൻ പൂർത്തിയാക്കുക",
    "otp_back_btn": "തിരികെ രജിസ്ട്രേഷൻ ഫോമിലേക്ക് പോകുക",
    "copyright": "© 2026 സിവിക് പൾസ്. എല്ലാ അവകാശങ്ങളും നിക്ഷിപ്തം.",
    "forgot_password_link": "പാസ്‌വേഡ് മറന്നുപോയോ?",
    "forgot_password_title": "പാസ്‌വേഡ് റീസെറ്റ് ചെയ്യുക",
    "forgot_password_desc": "റീസെറ്റ് കോഡ് ലഭിക്കുന്നതിന് നിങ്ങളുടെ രജിസ്റ്റർ ചെയ്ത ഇമെയിൽ നൽകുക.",
    "btn_send_reset_otp": "റീസെറ്റ് കോഡ് അയക്കുക",
    "reset_otp_label": "വെരിഫിക്കേഷൻ OTP കോഡ്",
    "reset_otp_placeholder": "6-അക്ക OTP നൽകുക",
    "new_password_label": "പുതിയ പാസ്‌വേഡ്",
    "new_password_placeholder": "കുറഞ്ഞത് 6 അക്ഷരങ്ങൾ",
    "btn_reset_password": "പാസ്‌വേഡ് പുതുക്കുക",
    "back_to_login": "ലോഗിനിലേക്ക് മടങ്ങുക"
  },
  es: {
    "dashboard": "Tablero",
    "about": "Acerca de",
    "profile": "Perfil y Ajustes",
    "logout": "Cerrar sesión",
    "welcome": "Bienvenido",
    "report_issue": "Reportar problema",
    "total_reported": "Total reportados",
    "unresolved": "Pendientes",
    "resolved": "Resueltos",
    "complaint_history": "Historial de quejas",
    "history": "Historial",
    "home": "Inicio",
    "track": "Seguir",
    "login": "Iniciar sesión",
    "register": "Registrarse",
    "no_notifications": "No hay actualizaciones recientes",
    "recent_updates": "Actualizaciones recientes",
    "copyright": "© 2026 CivicPulse Corporation. Todos los derechos reservados.",
    "how_title": "Cómo funciona CivicPulse",
    "how_subtitle": "El reporte y seguimiento nunca han sido tan sencillos.",
    "how_step1_title": "1. Capturar detalles",
    "how_step1_desc": "Seleccione categorías, sube fotos de la avería y fije la ubicación automáticamente por GPS o mapa.",
    "how_step2_title": "2. Asignación automática",
    "how_step2_desc": "Nuestro sistema asigna el problema al departamento correspondiente de inmediato para evitar retrasos.",
    "how_step3_title": "3. Línea de tiempo",
    "how_step3_desc": "Siga el progreso en vivo, vea fotos del antes y después y verifique la resolución usted mismo.",
    "emergency_escalation": "Escalada instantánea",
    "emergency_otp": "Verificado por OTP",
    "emergency_priority": "Máxima prioridad",
    "terms": "Términos de servicio",
    "privacy": "Política de privacidad",
    "form_photo_help": "Suba evidencia visual o tome una foto para ayudar a ubicar los daños.",
    "form_remove_photo": "Eliminar foto",
    "camera_accessing": "Accediendo a la cámara...",
    "camera_switch": "Cambiar cámara",
    "duplicate_warning_title": "¡Se detectó un problema similar sin resolver cerca!",
    "duplicate_warning_desc": "Nuestro sistema detectó un reporte similar a menos de 100 metros. Apoyar la queja existente acelera el trámite.",
    "bypass_duplicate": "Crear ticket duplicado de todos modos",
    "ai_suggestion": "Sugerencia de IA",
    "apply_ai": "Aplicar recomendaciones de IA",
    "capture_photo": "Capturar foto",
    "print_receipt": "Imprimir recibo",
    "officer_contact": "Contacto del oficial asignado",
    "uploaded_image": "Imagen subida por el ciudadano",
    "repair_visual": "Verificación visual de la reparación",
    "before_repair": "Antes de la reparación",
    "after_repair": "Después de la reparación",
    "support_widget_title": "Apoyar este reporte",
    "support_widget_desc": "Si también enfrenta este problema cívico, apóyelo en lugar de presentar un reporte duplicado. Las autoridades priorizan los reportes muy apoyados.",
    "select_rating": "Seleccionar calificación",
    "status_submitted": "Enviado",
    "status_verified": "Verificado",
    "status_assigned": "Asignado",
    "status_under_review": "Bajo revisión",
    "status_repair_started": "Reparación iniciada",
    "status_repair_in_progress": "Reparación en curso",
    "status_resolved": "Resuelto",
    "status_closed": "Cerrado",
    "status_rejected": "Rechazado",
    "sub_submitted": "Reporte recibido por CivicPulse",
    "sub_verified": "Reporte verificado por el moderador",
    "sub_assigned": "Enviado al oficial del departamento",
    "sub_under_review": "Oficial revisando el informe de campo",
    "sub_repair_started": "Comenzó el trabajo de reparación en el sitio",
    "sub_repair_in_progress": "Reparación activa en curso en el sitio",
    "sub_resolved": "Problema solucionado y verificado",
    "sub_closed": "Caso cerrado tras la resolución",
    "sub_rejected": "El reporte no fue aprobado",
    "sympathy_submitted_title": "¡Gracias por reportar!",
    "sympathy_submitted_body": "Lamentamos las molestias que este problema le haya causado. Su queja ha sido registrada y será revisada en breve. Agradecemos sinceramente su ayuda para mejorar su ciudad.",
    "sympathy_verified_title": "Hemos verificado su reporte.",
    "sympathy_verified_body": "Nuestro equipo ha verificado que su reporte es válido y se le está dando prioridad. Entendemos que este problema afecta su vida diaria y nos disculpamos.",
    "sympathy_assigned_title": "¡Un equipo está trabajando en ello!",
    "sympathy_assigned_body": "Su reporte ha sido asignado al oficial del departamento responsable. Tenga la seguridad de que no lo hemos olvidado, se están tomando medidas.",
    "sympathy_under_review_title": "Los expertos están revisando su problema.",
    "sympathy_under_review_body": "Nuestros oficiales de campo están evaluando la situación. Entendemos perfectamente las molestias causadas y nos comprometemos a resolverlo rápidamente.",
    "sympathy_repair_started_title": "¡Los trabajos de reparación han comenzado!",
    "sympathy_repair_started_body": "Nos complace informarle que se han iniciado los trabajos de reparación física en la ubicación reportada. ¡Gracias por su paciencia, casi terminamos!",
    "sympathy_repair_in_progress_title": "Reparación activa en curso.",
    "sympathy_repair_in_progress_body": "Nuestro equipo está trabajando activamente en el sitio. Lamentamos que haya tardado tanto y agradecemos sinceramente su paciencia. Su ciudad está mejorando gracias a usted.",
    "sympathy_resolved_title": "¡Problema resuelto! 🎉",
    "sympathy_resolved_body": "Nos complace informarle que su reporte ha sido resuelto. ¡Gracias por reportar este problema, su participación ciudadana marca la diferencia!",
    "sympathy_closed_title": "Caso cerrado.",
    "sympathy_closed_body": "Este reporte ha sido completamente abordado y cerrado. Gracias por ayudarnos a construir una mejor ciudad. ¡Esperamos que la resolución haya cumplido sus expectativas!",
    "sympathy_rejected_title": "Lamentamos informarle.",
    "sympathy_rejected_body": "Su reporte no pudo ser procesado en este sistema. Nos disculpamos sinceramente por cualquier inconveniente. Comuníquese con su oficina municipal local.",
    "sympathy_delay_title": "Nos disculpamos sinceramente por la demora.",
    "sympathy_delay_body": "Su reporte ha estado abierto por {days} días. Entendemos que esto es frustrante y nos disculpamos profundamente. Su caso ha sido escalado. Gracias por su paciencia.",
    "role_citizen": "Ciudadano",
    "role_authority": "Autoridad",
    "role_admin": "Administrador",
    "action_by": "Acción por",
    "system_user": "Sistema",
    "no_history_logged": "Aún no hay historial registrado",
    "no_login_needed": "No se requiere iniciar sesión",
    "email_otp": "OTP por correo electrónico",
    "phone_otp": "OTP por teléfono",
    "email_otp_help": "El código OTP se enviará a este correo electrónico para verificación instantánea.",
    "phone_otp_help": "El código OTP se enviará por SMS a este número de teléfono.",
    "otp_sent_to": "Ingrese el código OTP de 6 dígitos enviado a",
    "dashboard_welcome_subtitle": "Ayude a mantener nuestra ciudad limpia, segura y en funcionamiento.",
    "my_reported_locations": "Mis ubicaciones reportadas",
    "search_placeholder": "Buscar por ID, palabra clave...",
    "all_categories": "Todas las categorías",
    "all_statuses": "Todos los estados",
    "action_header": "Acción",
    "no_complaints_found": "No se encontraron reportes",
    "no_complaints_help": "Envíe un nuevo reporte para comenzar.",
    "cat_road_damage": "Daños en la carretera",
    "cat_potholes": "Baches",
    "cat_garbage_overflow": "Desbordamiento de basura",
    "cat_drainage_blockage": "Bloqueo de drenaje",
    "cat_street_light_failure": "Fallo de alumbrado público",
    "cat_water_leakage": "Fuga de agua",
    "cat_water_supply_issue": "Problema de suministro de agua",
    "cat_public_sanitation": "Saneamiento público",
    "cat_tree_fallen": "Árbol caído",
    "cat_broken_footpath": "Acera rota",
    "cat_traffic_signal_issue": "Problema de señal de tráfico",
    "cat_public_property_damage": "Daño a la propiedad pública",
    "cat_other": "Otro",
    "login_title": "Iniciar sesión en CivicPulse",
    "login_desc": "Inicie sesión para reportar problemas o administrar reportes",
    "login_username_label": "Correo electrónico o número de teléfono",
    "login_username_placeholder": "su@correo.com o 9876543210",
    "login_password_label": "Contraseña",
    "login_password_placeholder": "••••••••",
    "login_no_account": "¿No tiene una cuenta?",
    "login_register_link": "Regístrese aquí",
    "register_title": "Registro de ciudadano",
    "register_desc": "Cree una cuenta para reportar problemas y realizar el seguimiento de reparaciones",
    "register_name_label": "Nombre completo",
    "register_name_placeholder": "John Doe",
    "register_email_label": "Dirección de correo electrónico (se requiere correo electrónico o teléfono)",
    "register_email_placeholder": "john@example.com",
    "register_phone_label": "Número de teléfono (se requiere correo electrónico o teléfono)",
    "register_phone_placeholder": "9998887776",
    "register_password_placeholder": "Al menos 6 caracteres",
    "register_address_label": "Dirección residencial",
    "register_address_placeholder": "Calle, Área, Ciudad",
    "register_btn": "Registrar cuenta",
    "register_already_account": "¿Ya tiene una cuenta?",
    "register_login_link": "Inicie sesión aquí",
    "otp_form_title": "Ingrese los códigos de verificación",
    "otp_form_desc": "Hemos enviado códigos de seguridad para verificar su identidad.",
    "otp_email_label": "Código OTP de verificación de correo electrónico",
    "otp_phone_label": "Código OTP de verificación de teléfono",
    "otp_verify_btn": "Verificar y completar registro",
    "otp_back_btn": "Volver al formulario de registro",
    "copyright": "© 2026 CivicPulse. Todos los derechos reservados.",
    "forgot_password_link": "¿Olvidó su contraseña?",
    "forgot_password_title": "Restablecer contraseña",
    "forgot_password_desc": "Ingrese su correo registrado para recibir un código de restablecimiento.",
    "btn_send_reset_otp": "Enviar código de restablecimiento",
    "reset_otp_label": "Código OTP de verificación",
    "reset_otp_placeholder": "Ingrese el OTP de 6 dígitos",
    "new_password_label": "Nueva contraseña",
    "new_password_placeholder": "Al menos 6 caracteres",
    "btn_reset_password": "Actualizar contraseña",
    "back_to_login": "Volver a Iniciar Sesión"
  }
};
function changeLanguage(lang) {
  localStorage.setItem('lang', lang);
  applyTranslations(lang);
}

function applyTranslations(lang) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];

  // Translate textContent of labelled elements
  document.querySelectorAll('[data-translate]').forEach(el => {
    const key = el.getAttribute('data-translate');
    if (dict[key]) el.textContent = dict[key];
  });

  // Translate placeholder attributes
  document.querySelectorAll('[data-translate-placeholder]').forEach(el => {
    const key = el.getAttribute('data-translate-placeholder');
    if (dict[key]) el.placeholder = dict[key];
  });

  // Translate title/aria-label attributes
  document.querySelectorAll('[data-translate-title]').forEach(el => {
    const key = el.getAttribute('data-translate-title');
    if (dict[key]) el.title = dict[key];
  });

  const selector = document.getElementById('lang-selector');
  if (selector) selector.value = lang;
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

/**
 * Civic AI Assistant Floating Chatbot UI & Logic
 */
function initCivicAIChatbot() {
  if (document.getElementById('civic-ai-chatbot')) return;

  const chatContainer = document.createElement('div');
  chatContainer.id = 'civic-ai-chatbot';
  chatContainer.className = 'no-print';
  chatContainer.innerHTML = `
    <!-- Floating toggle button -->
    <button id="chatbot-toggle-btn" class="btn btn-primary rounded-circle shadow-lg d-flex align-items-center justify-content-center" style="width: 56px; height: 56px; position: fixed; bottom: 24px; right: 24px; z-index: 1050; border: none; outline: none;">
      <i class="bi bi-robot fs-3 text-white"></i>
    </button>
    
    <!-- Chat window -->
    <div id="chatbot-window" class="card shadow-lg d-none" style="width: 350px; height: 480px; position: fixed; bottom: 90px; right: 24px; z-index: 1050; border-radius: 14px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); background: #0f172a;">
      <!-- Header -->
      <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center py-2 px-3" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-robot fs-4 text-white"></i>
          <div>
            <h6 class="fw-bold mb-0 text-white" style="font-size: 0.95rem;">CivicPulse AI</h6>
            <small class="text-white-50" style="font-size: 0.7rem;">Grievance Assistant</small>
          </div>
        </div>
        <button type="button" class="btn-close btn-close-white" id="chatbot-close-btn" style="font-size: 0.75rem; box-shadow: none;"></button>
      </div>
      
      <!-- Messages -->
      <div class="card-body p-3 overflow-y-auto d-flex flex-column gap-3" id="chatbot-messages" style="height: calc(100% - 110px); background: radial-gradient(circle at 50% 50%, #1e293b 0%, #0f172a 100%);">
        <div class="d-flex align-items-start gap-2">
          <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 26px; height: 26px; font-size: 0.7rem; flex-shrink: 0;">🤖</div>
          <div class="p-2 rounded-3 chatbot-msg-bot small" style="max-width: 85%;">
            Namaskara! I'm your CivicPulse AI Assistant. Ask me anything or track a complaint by pasting its reference ID (e.g., CIV-XXXXXXXX-XXXX).
            <div class="mt-2 d-flex flex-column gap-1">
              <button type="button" class="btn btn-outline-secondary btn-sm text-start chatbot-quick-query">How do I report a pothole?</button>
              <button type="button" class="btn btn-outline-secondary btn-sm text-start chatbot-quick-query">Suggest title/description improvements</button>
              <button type="button" class="btn btn-outline-secondary btn-sm text-start chatbot-quick-query">Explain automatic priority routing</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Input Form -->
      <form id="chatbot-form" class="card-footer p-2 bg-slate-900 border-top border-secondary border-opacity-25 d-flex gap-2 align-items-center" style="background: #0f172a;">
        <input type="text" id="chatbot-input" class="form-control form-control-sm bg-dark text-white border-secondary" placeholder="Ask Civic AI..." required style="font-size: 0.85rem; box-shadow: none; border-color: rgba(255,255,255,0.1) !important;">
        <button type="submit" class="btn btn-primary btn-sm px-2.5 py-1" style="height: 31px;"><i class="bi bi-send-fill text-white" style="font-size: 0.85rem;"></i></button>
      </form>
    </div>
  `;

  document.body.appendChild(chatContainer);

  const toggleBtn = document.getElementById('chatbot-toggle-btn');
  const windowEl = document.getElementById('chatbot-window');
  const closeBtn = document.getElementById('chatbot-close-btn');
  const form = document.getElementById('chatbot-form');
  const input = document.getElementById('chatbot-input');
  const messagesBox = document.getElementById('chatbot-messages');

  // Toggle open/close
  toggleBtn.addEventListener('click', () => {
    windowEl.classList.toggle('d-none');
    if (!windowEl.classList.contains('d-none')) {
      input.focus();
    }
  });

  closeBtn.addEventListener('click', () => {
    windowEl.classList.add('d-none');
  });

  // Quick query handler
  function setupQuickQueries() {
    document.querySelectorAll('.chatbot-quick-query').forEach(btn => {
      // Clone to remove old listener just in case
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', (e) => {
        const text = e.currentTarget.textContent;
        input.value = text;
        form.dispatchEvent(new Event('submit'));
      });
    });
  }

  setupQuickQueries();

  // Form submit handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    input.value = '';

    // Append User Message
    appendMessage(text, 'user');

    // Append Loading indicator
    const loadingId = 'chatbot-loading-' + Date.now();
    const loadingHtml = `
      <div class="d-flex align-items-start gap-2" id="${loadingId}">
        <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 26px; height: 26px; font-size: 0.7rem; flex-shrink: 0;">🤖</div>
        <div class="p-2 rounded-3 chatbot-msg-bot small d-flex align-items-center gap-2">
          <div class="spinner-grow spinner-grow-sm text-primary" role="status" style="width: 0.6rem; height: 0.6rem;"></div>
          <span class="text-white-50">Thinking...</span>
        </div>
      </div>
    `;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = loadingHtml.trim();
    messagesBox.appendChild(tempDiv.firstChild);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    try {
      const response = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: text })
      });
      const data = await response.json();
      
      // Remove loading indicator
      const loader = document.getElementById(loadingId);
      if (loader) loader.remove();

      if (data.success) {
        appendMessage(data.response, 'bot');
      } else {
        appendMessage('Sorry, I encountered an error. Please try again.', 'bot');
      }
    } catch (err) {
      const loader = document.getElementById(loadingId);
      if (loader) loader.remove();
      appendMessage('Could not connect to AI service. Check your connection.', 'bot');
    }
  });

  function appendMessage(msg, sender) {
    const div = document.createElement('div');
    div.className = sender === 'user' ? 'd-flex justify-content-end w-100' : 'd-flex align-items-start gap-2';
    
    // Convert basic markdown format (bold/lists/links) to HTML
    let formattedMsg = msg
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-info fw-bold text-decoration-none">$1</a>')
      .replace(/\n/g, '<br>');

    if (sender === 'user') {
      div.innerHTML = `
        <div class="p-2.5 rounded-3 chatbot-msg-user small shadow-sm" style="max-width: 85%; font-size: 0.8rem; word-break: break-word;">
          ${formattedMsg}
        </div>
      `;
    } else {
      div.innerHTML = `
        <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style="width: 26px; height: 26px; font-size: 0.7rem; flex-shrink: 0; margin-top: 2px;">🤖</div>
        <div class="p-2.5 rounded-3 chatbot-msg-bot small shadow-sm" style="max-width: 85%; font-size: 0.8rem; word-break: break-word;">
          ${formattedMsg}
        </div>
      `;
    }
    
    messagesBox.appendChild(div);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    // Setup listeners for any newly rendered quick links/buttons if needed
    setupQuickQueries();
  }
}
