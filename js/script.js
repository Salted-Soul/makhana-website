
// =========================
// 🔥 GLOBAL SAFE EVENT HANDLER (NEW ADDITION)
// =========================
function safeAddListener(id, event, handler) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`❌ ${id} not found (listener skipped)`);
        return;
    }
    el.addEventListener(event, handler);
}


// =========================
// 🔥 SAFE QUERY SELECTOR (NEW ADDITION)
// =========================
function safeQuery(parent, selector) {
    if (!parent) return null;
    return parent.querySelector(selector);
}


// =========================
// 🔥 SAFE PRICE PARSER (NEW ADDITION)
// =========================
function safePrice(text) {
    if (!text) return 0;
    return parseInt(text.replace("₹","")) || 0;
}


// =========================
// 🔥 SAFE IMAGE GETTER (NEW ADDITION)
// =========================
function safeImage(card) {
    const img = card.querySelector("img");
    return img ? img.src : "";
}


// =========================
// 🔥 HARD TYPE FIX (CRITICAL 🔥🔥🔥)
// =========================
function normalizePrice(price){
    return Number(price) || 0;
}


// =========================
// 🔥 BUTTON LOCK (ANTI SPAM 🔥)
// =========================
function lockButton(btn){
    if(!btn) return;
    btn.disabled = true;
    setTimeout(()=> btn.disabled = false, 800);
}


// =========================
// 🔥 SAFE HTML ESCAPE (SECURITY)
// =========================
function escapeHTML(str){
    return String(str || "").replace(/[&<>"']/g, function(m){
        return ({
            "&":"&amp;",
            "<":"&lt;",
            ">":"&gt;",
            '"':"&quot;",
            "'":"&#039;"
        })[m];
    });
}


// =========================
// 🔥 TOAST SYSTEM (NEW UX ADDITION)
// =========================
function showToast(message){
    let toast = document.getElementById("globalToast");

    if(!toast){
        toast = document.createElement("div");
        toast.id = "globalToast";
        toast.style.position = "fixed";
        toast.style.bottom = "20px";
        toast.style.right = "20px";
        toast.style.background = "#333";
        toast.style.color = "#fff";
        toast.style.padding = "12px 18px";
        toast.style.borderRadius = "8px";
        toast.style.zIndex = "9999";
        toast.style.opacity = "0";
        toast.style.transition = "0.3s";
        document.body.appendChild(toast);
    }

    toast.innerText = message;
    toast.style.opacity = "1";

    setTimeout(()=> toast.style.opacity = "0", 2500);
}


// =========================
// 🔥 DEBOUNCE (NEW)
// =========================
function debounce(fn, delay = 300){
    let timer;
    return (...args)=>{
        clearTimeout(timer);
        timer = setTimeout(()=> fn(...args), delay);
    };
}


// =========================
// ✅ SINGLE AUTH SOURCE
// =========================
async function getCurrentUser() {
    try {
        const res = await fetch("http://10.17.110.176:5000/api/auth/check", {
            credentials: "include"
        });

        if (!res.ok) return null;

        const data = await res.json();

        console.log("✅ Current user:", data.user);

        return data.user;

    } catch (err) {
        console.error("Auth error:", err);
        return null;
    }
}


// =========================
// 🔥 USER CACHE
// =========================
let __cachedUser = null;
async function getCachedUser() {
    if (__cachedUser) return __cachedUser;
    __cachedUser = await getCurrentUser();
    return __cachedUser;
}


// =========================
// 🔥 SAFE FETCH WRAPPER
// =========================
// =========================
// 🔥 SAFE FETCH WRAPPER (AUTH FIX)
// =========================
async function safeFetch(url, options = {}) {

    try {

        // =====================
        // TOKEN SUPPORT
        // =====================
        const token =
            localStorage.getItem("token") ||
            sessionStorage.getItem("token") ||
            "";

        const res = await fetch(url, {

            credentials: "include",

            headers: {

                "Content-Type": "application/json",

                // ✅ CRITICAL FIX
                ...(token && {
                    Authorization: `Bearer ${token}`
                }),

                ...(options.headers || {})
            },

            ...options
        });

        const data = await res.json().catch(() => ({}));

        return {
            ok: res.ok,
            status: res.status,
            data
        };

    } catch (err) {

        console.error("Fetch error:", err);

        return {
            ok: false,
            status: 500,
            data: {
                message: "Network error"
            }
        };
    }
}

// =========================
// USER LOGIN DISPLAY
// =========================
const userSection = document.getElementById("userSection");

(async () => {
    const user_main = await getCachedUser();

    if (user_main && userSection) {
        userSection.innerHTML = `
            Hello, ${escapeHTML(user_main.name)} 👋 
            <button onclick="logout()" style="margin-left:10px;">Logout</button>
        `;
    }
})();


// =========================
// LOGOUT
// =========================
async function logout() {
    await fetch("http://10.17.110.176:5000/api/auth/logout", {
        method: "POST",
        credentials: "include"
    });

    window.location.href = "login.html";
}


// =========================
// 🔥 ADD TO CART (FINAL FIX 🔥🔥🔥)
// =========================
async function addToCart(btn, name, price, image) {

    lockButton(btn);

    const user = await getCachedUser();

    if (!user) {
        showToast("Please login first");
        window.location.href = "login.html";
        return;
    }

    const fixedPrice = normalizePrice(price);

    if (!name || !fixedPrice) {
        console.warn("Invalid cart data");
        return;
    }

    const { ok, data } = await safeFetch("http://10.17.110.176:5000/api/cart/add", {
        method: "POST",
        body: JSON.stringify({
            name: escapeHTML(name),
            price: fixedPrice,
            image,
            productId: name
        })
    });

    if (ok) {
        showToast("Added to cart ✅");
        loadCartCount();
        loadCartPage();
    } else {
        console.error("Cart API failed", data);
        showToast(data.message || "Failed to add to cart");
    }
}


// =========================
// QTY CONTROL
// =========================
function increaseQty(btn){
    let card = btn.closest(".card");
    if(!card) return;

    let name = safeQuery(card, "h3")?.innerText;
    let price = safePrice(safeQuery(card, ".price")?.innerText);
    let img = safeImage(card);

    addToCart(btn,name,price,img);
}

function decreaseQty(btn){
    showToast("Use cart page to decrease quantity ❗");
}


// =========================
// 🔥 LOAD CART PAGE
// =========================
async function loadCartPage() {

    const container = document.getElementById("cart-container");
    if (!container) return;

    const user = await getCachedUser();
    if (!user) {
        container.innerHTML = "Please login";
        return;
    }

    const { ok, data } = await safeFetch(`http://10.17.110.176:5000/api/cart/${user._id}`);

    if (!ok) {
        container.innerHTML = "Failed to load cart ❌";
        return;
    }

    const items = data.items || [];

    if (items.length === 0) {
        container.innerHTML = "<h3>Your cart is empty 😢</h3>";
        return;
    }

    let html = "";

    items.forEach(item => {
        html += `
        <div class="cart-item">
            <img src="${item.image}" width="80"/>
            <div>
                <h3>${escapeHTML(item.name)}</h3>
                <p>₹${item.price}</p>

                <button onclick="updateCart('${item.name}','decrease')">-</button>
                ${item.quantity}
                <button onclick="updateCart('${item.name}','increase')">+</button>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
}


// =========================
// 🔥 UPDATE CART
// =========================
async function updateCart(name, action) {

    const user = await getCachedUser();
    if (!user) return;

    await safeFetch("http://10.17.110.176:5000/api/cart/update", {
        method: "POST",
        body: JSON.stringify({ name, action })
    });

    loadCartPage();
    loadCartCount();
}


// =========================
// 🔥 LOAD CART COUNT
// =========================
async function loadCartCount() {
    const user = await getCachedUser();
    if (!user) return;

    const { ok, data } = await safeFetch(`http://10.17.110.176:5000/api/cart/count/${user._id}`);

    if (ok) {
        const cartIcon = document.getElementById("cartCount");
        if (cartIcon) {
            cartIcon.innerText = data.count || 0;
        }
    }
}


// =========================
// AUTO LOAD
// =========================
window.addEventListener("DOMContentLoaded", () => {
    loadCartPage();
    loadCartCount();
});


// =========================
// GLOBAL EXPORTS
// =========================
window.addToCart = addToCart;
window.logout = logout;
window.increaseQty = increaseQty;
window.decreaseQty = decreaseQty;


// =========================
// ERROR HANDLING
// =========================
window.addEventListener("error", (e) => {
    console.error("Global Error:", e.message);
});

window.addEventListener("unhandledrejection", (e) => {
    console.error("Unhandled Promise Error:", e.reason);
});