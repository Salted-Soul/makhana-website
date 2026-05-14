console.log("LOGIN FUNCTION TRIGGERED");

document.addEventListener("DOMContentLoaded", () => {

// =======================
// GLOBAL CONFIG
// =======================
const API_BASE = "http://https://makhana-website.onrender.com/api/auth";


// =======================
// SAFE DOM HELPERS (NEW 🔥)
// =======================
function getEl(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`${id} not found in DOM`);
  return el;
}


// =======================
// 🆕 SAFE EVENT ATTACHER (NEW 🔥🔥🔥)
// =======================
function safeAddEvent(el, event, handler) {
  if (!el) {
    console.warn("⚠ Tried to attach event on missing element");
    return;
  }
  el.addEventListener(event, handler);
}


// =======================
// 🆕 GLOBAL ERROR HANDLER (NEW 🔥)
// =======================
window.addEventListener("error", (e) => {
  console.error("🔥 Global JS Error:", e.message);
});


// =======================
// 🆕 FETCH WRAPPER (NEW 🔥)
// =======================
async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("❌ API Error:", data);
      throw new Error(data.message || "API Error");
    }

    return data;

  } catch (err) {
    console.error("❌ Fetch Failed:", err.message);
    throw err;
  }
}


// =======================
// HELPER FUNCTIONS
// =======================
function showMessage(msg, type = "error") {
  const box = getEl("messageBox");

  if (!box) return;

  box.innerText = msg;
  box.className = "message-box " + type;
}

function toggleLoading(btn, isLoading) {
  if (!btn) return;

  if (isLoading) {
    btn.disabled = true;
    btn.innerText = "Please wait...";
  } else {
    btn.disabled = false;
    btn.innerText = btn.dataset.original || "Submit";
  }
}


// =======================
// 🆕 EMAIL VALIDATION (NEW)
// =======================
function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}


// =======================
// 🆕 PASSWORD STRENGTH (NEW)
// =======================
function isStrongPassword(password) {
  return password.length >= 6;
}


// =======================
// ✅ SESSION CHECK (FIXED 🔥)
// =======================
async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/check`, {
      method: "GET",
      credentials: "include"
    });

    if (!res.ok) return null;

    const data = await res.json();

    console.log("✅ Auth user:", data.user);

    return data.user;

  } catch (err) {
    console.error("Auth check failed:", err);
    return null;
  }
}


// =======================
// SIGNUP
// =======================
async function signup(e) {
  e.preventDefault();

  const btn = getEl("signupBtn");
  if (btn) btn.dataset.original = "Create Account";

  const name = getEl("name")?.value.trim();
  const email = getEl("email")?.value.trim();
  const password = getEl("password")?.value.trim();

  if (!name || !email || !password) {
    return showMessage("All fields are required");
  }

  // 🆕 EXTRA VALIDATION
  if (!isValidEmail(email)) {
    return showMessage("Invalid email format");
  }

  if (!isStrongPassword(password)) {
    return showMessage("Password must be at least 6 characters");
  }

  try {
    toggleLoading(btn, true);

    const data = await safeFetch(`${API_BASE}/signup`, {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    });

    console.log("Signup response:", data);

    showMessage("Account created successfully!", "success");

    setTimeout(() => {
      window.location.replace("index.html");
    }, 1500);

  } catch (err) {
    showMessage(err.message || "Signup failed");
  } finally {
    toggleLoading(btn, false);
  }
}


// =======================
// LOGIN
// =======================
async function login(e) {
  e.preventDefault();

  console.log("🚀 LOGIN CLICKED");

  const btn = getEl("loginBtn");
  if (btn) btn.dataset.original = "Login";

  const email = getEl("email")?.value.trim();
  const password = getEl("password")?.value.trim();

  if (!email || !password) {
    return showMessage("All fields are required");
  }

  try {
    toggleLoading(btn, true);

    const data = await safeFetch(`${API_BASE}/login`, {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    console.log("🔥 LOGIN RESPONSE:", data);

// =======================
// SAVE TOKEN 🔥🔥🔥
// =======================
if (data.token) {
  localStorage.setItem("token", data.token);
}

if (data.user) {
  localStorage.setItem(
    "user",
    JSON.stringify(data.user)
  );
}

console.log(
  "✅ TOKEN SAVED:",
  localStorage.getItem("token")
);

showMessage("Login successful!", "success");

setTimeout(() => {
  window.location.replace("index.html");
}, 1000);

  } catch (err) {
    showMessage(err.message || "Login failed");
  } finally {
    toggleLoading(btn, false);
  }
}


// =======================
// LOGOUT (NEW 🔥)
// =======================
async function logout() {
  try {
    await fetch(`${API_BASE}/logout`, {
      method: "POST",
      credentials: "include"
    });

    window.location.replace("login.html");

  } catch (err) {
    console.error("Logout failed:", err);
  }
}


// =======================
// ATTACH EVENTS (CRITICAL FIX 🔥)
// =======================
const loginForm = getEl("loginForm");
safeAddEvent(loginForm, "submit", login);

const signupForm = getEl("signupForm");
safeAddEvent(signupForm, "submit", signup);


// =======================
// 🆕 ENTER KEY FIX (NEW)
// =======================
document.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const loginForm = getEl("loginForm");
    const signupForm = getEl("signupForm");

    if (loginForm) loginForm.dispatchEvent(new Event("submit"));
    if (signupForm) signupForm.dispatchEvent(new Event("submit"));
  }
});


// =======================
// ✅ AUTO AUTH GUARD (NEW 🔥🔥🔥)
// =======================
(async () => {
  const user = await checkAuth();

  const isAuthPage =
    window.location.pathname.includes("login") ||
    window.location.pathname.includes("signup");

  console.log("🔐 Auth Guard:", { user, isAuthPage });

  if (!user && !isAuthPage) {
    console.warn("⛔ Not logged in → redirecting to login");
    window.location.replace("login.html");
  }

  if (user && isAuthPage) {
    console.warn("⚠ Already logged in → redirecting to index");
    window.location.replace("index.html");
  }
})();

});


// =======================
// 🔥 MAKE FUNCTIONS GLOBAL (CRITICAL FIX)
// =======================
window.signup = signup;
window.login = login;
window.logout = logout;


// =======================
// 🆕 DEBUG MODE (NEW)
// =======================
console.log("✅ AUTH SCRIPT FULLY LOADED & ENHANCED");