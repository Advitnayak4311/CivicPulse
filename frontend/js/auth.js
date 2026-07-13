/* ==========================================================================
   Smart Civic Issues Monitoring and Response System - Authentication Script
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Check for URL messages on load
  checkUrlParameters();
  
  // Prevent logged in users from visiting auth pages
  redirectIfAuthenticated();

  // Prefill check on registration page
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    const prefillVal = getUrlParam('prefill');
    if (prefillVal) {
      if (prefillVal.includes('@')) {
        document.getElementById('email').value = prefillVal;
      } else {
        document.getElementById('phone').value = prefillVal;
      }
      showToast('Account not found. Please register first. We pre-filled your contact info.', 'info');
    }

    // Register Form Handler (Step 1: request OTPs)
    registerForm.addEventListener('submit', handleRegisterSendOtp);
  }

  // OTP Verification Form Handler (Step 2: verify OTPs & register)
  const otpForm = document.getElementById('otp-form');
  if (otpForm) {
    otpForm.addEventListener('submit', handleRegisterVerify);
  }

  // Back button on OTP Form
  const btnBackRegister = document.getElementById('btn-back-register');
  if (btnBackRegister) {
    btnBackRegister.addEventListener('click', () => {
      document.getElementById('otp-form').classList.add('d-none');
      document.getElementById('register-form').classList.remove('d-none');
    });
  }

  // Login Form Handler
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Forgot Password Toggle Links
  const linkForgotPassword = document.getElementById('link-forgot-password');
  const btnsBackToLogin = document.querySelectorAll('.btn-back-to-login');
  
  if (linkForgotPassword) {
    linkForgotPassword.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('login-form').classList.add('d-none');
      document.getElementById('forgot-send-otp-form').classList.remove('d-none');
    });
  }

  btnsBackToLogin.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('forgot-send-otp-form').classList.add('d-none');
      document.getElementById('forgot-reset-form').classList.add('d-none');
      document.getElementById('login-form').classList.remove('d-none');
    });
  });

  // Forgot Password Send OTP Submission
  const forgotSendOtpForm = document.getElementById('forgot-send-otp-form');
  if (forgotSendOtpForm) {
    forgotSendOtpForm.addEventListener('submit', handleForgotPasswordSendOtp);
  }

  // Forgot Password Reset Password Submission
  const forgotResetForm = document.getElementById('forgot-reset-form');
  if (forgotResetForm) {
    forgotResetForm.addEventListener('submit', handleForgotPasswordReset);
  }
});

/**
 * Handle Forgot Password Send OTP Step
 */
async function handleForgotPasswordSendOtp(e) {
  e.preventDefault();
  const form = e.target;

  if (!form.checkValidity()) {
    e.stopPropagation();
    form.classList.add('was-validated');
    return;
  }

  const email = document.getElementById('forgot-email').value.trim();

  try {
    const btn = document.getElementById('btn-forgot-send');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Sending...';

    const res = await apiRequest('/auth/forgot-password/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email })
    });

    btn.disabled = false;
    btn.innerHTML = originalText;

    if (res.success) {
      showToast(res.message || 'Verification code sent to your email.', 'success');
      
      // Hide Step 1, Show Step 2
      document.getElementById('forgot-send-otp-form').classList.add('d-none');
      document.getElementById('forgot-reset-form').classList.remove('d-none');

      // Demo mode OTP hint:
      const hintEl = document.getElementById('forgot-otp-demo-hint');
      if (res.otp) {
        showToast(`[DEMO MODE] Reset OTP is: ${res.otp}`, 'info');
        if (hintEl) {
          hintEl.textContent = `[Demo OTP: ${res.otp}]`;
        }
      } else {
        if (hintEl) {
          hintEl.textContent = '';
        }
      }
    }
  } catch (error) {
    const btn = document.getElementById('btn-forgot-send');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-send-fill me-2"></i><span data-translate="btn_send_reset_otp">Send Reset Code</span>';
    }
    console.error('Forgot password send OTP error:', error);
  }
}

/**
 * Handle Forgot Password Reset Step
 */
async function handleForgotPasswordReset(e) {
  e.preventDefault();
  const form = e.target;

  if (!form.checkValidity()) {
    e.stopPropagation();
    form.classList.add('was-validated');
    return;
  }

  const email = document.getElementById('forgot-email').value.trim();
  const otp = document.getElementById('forgot-otp').value.trim();
  const password = document.getElementById('forgot-new-password').value;

  if (password.length < 6) {
    showToast('Password must be at least 6 characters.', 'warning');
    return;
  }

  try {
    const btn = document.getElementById('btn-forgot-verify');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating...';

    const res = await apiRequest('/auth/forgot-password/reset', {
      method: 'POST',
      body: JSON.stringify({ email, otp, password })
    });

    btn.disabled = false;
    btn.innerHTML = originalText;

    if (res.success) {
      showToast('Password updated successfully! Please log in with your new password.', 'success');
      
      // Reset forms and toggle back to login
      document.getElementById('forgot-reset-form').classList.add('d-none');
      document.getElementById('login-form').classList.remove('d-none');
      
      // Clear inputs
      document.getElementById('forgot-email').value = '';
      document.getElementById('forgot-otp').value = '';
      document.getElementById('forgot-new-password').value = '';
      form.classList.remove('was-validated');
      document.getElementById('forgot-send-otp-form').classList.remove('was-validated');
    }
  } catch (error) {
    const btn = document.getElementById('btn-forgot-verify');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i><span data-translate="btn_reset_password">Update Password</span>';
    }
    console.error('Forgot password reset error:', error);
  }
}

/**
 * Show system notifications based on URL state (e.g. after logout or session expiry)
 */
function checkUrlParameters() {
  if (getUrlParam('expired')) {
    showToast('Your session has expired. Please log in again.', 'warning');
  }
  if (getUrlParam('loggedout')) {
    showToast('You have successfully logged out.', 'success');
  }
}

/**
 * If user is already logged in, redirect them to their dashboard
 */
function redirectIfAuthenticated() {
  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');
  
  if (user && token) {
    const currentPath = window.location.pathname;
    if (currentPath.includes('login.html') || currentPath.includes('register.html')) {
      redirectToDashboard(user.role);
    }
  }
}

/**
 * Route user based on their role
 */
function redirectToDashboard(role) {
  if (role === 'admin') {
    window.location.href = 'admin.html';
  } else if (role === 'authority') {
    window.location.href = 'authority.html';
  } else {
    window.location.href = 'citizen.html';
  }
}

/**
 * Handle Login Submission
 */
async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  
  // Validate Form
  if (!form.checkValidity()) {
    e.stopPropagation();
    form.classList.add('was-validated');
    return;
  }

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (res.success) {
      // Store auth information
      localStorage.setItem('token', res.data.token);
      
      // Delete token from user detail storage for safety
      const userDetails = { ...res.data };
      delete userDetails.token;
      localStorage.setItem('user', JSON.stringify(userDetails));

      showToast('Welcome back, ' + userDetails.name + '!', 'success');
      
      // Redirect after a brief delay for toast visualization
      setTimeout(() => {
        redirectToDashboard(userDetails.role);
      }, 1000);
    }
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      showToast('Account not found. Redirecting to registration page...', 'warning');
      setTimeout(() => {
        window.location.href = `register.html?prefill=${encodeURIComponent(email)}`;
      }, 2000);
    } else {
      console.error('Login submit error:', error);
    }
  }
}

/**
 * Handle Registration Step 1: Send Verification OTP(s)
 */
async function handleRegisterSendOtp(e) {
  e.preventDefault();
  const form = e.target;

  // Validate Form
  if (!form.checkValidity()) {
    e.stopPropagation();
    form.classList.add('was-validated');
    return;
  }

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;

  if (!name) {
    showToast('Please enter your full name.', 'warning');
    return;
  }

  if (!email && !phone) {
    showToast('Please provide at least one contact method (Email or Phone Number).', 'warning');
    return;
  }

  if (password.length < 6) {
    showToast('Password must be at least 6 characters.', 'warning');
    return;
  }

  try {
    const res = await apiRequest('/auth/register/send-otp', {
      method: 'POST',
      body: JSON.stringify({ name, email, phone })
    });

    if (res.success) {
      showToast('Verification codes sent successfully!', 'success');

      // Hide registration form, show OTP verify form
      document.getElementById('register-form').classList.add('d-none');
      document.getElementById('otp-form').classList.remove('d-none');

      // Render OTP groups depending on what was sent
      if (res.emailSent) {
        document.getElementById('email-otp-group').classList.remove('d-none');
        document.getElementById('email-otp').required = true;
        if (res.demoEmailOtp) {
          document.getElementById('email-otp-demo-hint').textContent = `[Demo OTP: ${res.demoEmailOtp}]`;
        } else {
          document.getElementById('email-otp-demo-hint').textContent = '';
        }
      } else {
        document.getElementById('email-otp-group').classList.add('d-none');
        document.getElementById('email-otp').required = false;
        document.getElementById('email-otp').value = '';
      }

      if (res.phoneSent) {
        document.getElementById('phone-otp-group').classList.remove('d-none');
        document.getElementById('phone-otp').required = true;
        if (res.demoPhoneOtp) {
          document.getElementById('phone-otp-demo-hint').textContent = `[Demo OTP: ${res.demoPhoneOtp}]`;
        } else {
          document.getElementById('phone-otp-demo-hint').textContent = '';
        }
      } else {
        document.getElementById('phone-otp-group').classList.add('d-none');
        document.getElementById('phone-otp').required = false;
        document.getElementById('phone-otp').value = '';
      }
    }
  } catch (error) {
    console.error('Registration send OTP error:', error);
  }
}

/**
 * Handle Registration Step 2: Verify OTPs & Complete Sign Up
 */
async function handleRegisterVerify(e) {
  e.preventDefault();
  const form = e.target;

  // Validate form
  if (!form.checkValidity()) {
    e.stopPropagation();
    form.classList.add('was-validated');
    return;
  }

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  const address = document.getElementById('address').value.trim();

  const emailOtp = document.getElementById('email-otp').value.trim();
  const phoneOtp = document.getElementById('phone-otp').value.trim();

  try {
    const res = await apiRequest('/auth/register/verify', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email: email || undefined,
        phone: phone || undefined,
        password,
        address,
        emailOtp: email ? emailOtp : undefined,
        phoneOtp: phone ? phoneOtp : undefined
      })
    });

    if (res.success) {
      // Store token and details
      localStorage.setItem('token', res.data.token);
      
      const userDetails = { ...res.data };
      delete userDetails.token;
      localStorage.setItem('user', JSON.stringify(userDetails));

      showToast('Registration and verification successful! Welcome to CivicPulse.', 'success');
      
      setTimeout(() => {
        window.location.href = 'citizen.html';
      }, 1000);
    }
  } catch (error) {
    console.error('Registration verification error:', error);
  }
}

/**
 * Toggle password field visibility (show/hide password text)
 * Called by the eye-icon button in auth forms.
 * @param {string} inputId - The id of the password input field
 * @param {HTMLElement} btn - The toggle button element clicked
 */
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) {
      icon.classList.remove('bi-eye');
      icon.classList.add('bi-eye-slash');
    }
    btn.title = 'Hide Password';
  } else {
    input.type = 'password';
    if (icon) {
      icon.classList.remove('bi-eye-slash');
      icon.classList.add('bi-eye');
    }
    btn.title = 'Show Password';
  }
}
