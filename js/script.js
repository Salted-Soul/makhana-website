// ======================================
// CONFIG
// ======================================
const DEBUG =
    window.location.hostname ===
    "localhost";


// ======================================
// LOGGER
// ======================================
function log(...args) {

    if (DEBUG) {

        console.log(...args);
    }
}


// ======================================
// SAFE EVENT LISTENER
// ======================================
function safeAddListener(
    id,
    event,
    handler
) {

    const el =
        document.getElementById(id);

    if (!el) {

        console.warn(
            `⚠ ${id} not found`
        );

        return;
    }

    el.addEventListener(
        event,
        handler
    );
}


// ======================================
// SAFE QUERY
// ======================================
function safeQuery(
    parent,
    selector
) {

    if (!parent) return null;

    return parent.querySelector(
        selector
    );
}


// ======================================
// SAFE PRICE PARSER
// ======================================
function normalizePrice(price) {

    if (
        typeof price === "number"
    ) {

        return price;
    }

    return Number(

        String(price)
            .replace(/[^\d.]/g, "")

    ) || 0;
}


// ======================================
// SAFE IMAGE
// ======================================
function safeImage(card) {

    const img =
        safeQuery(card, "img");

    return img?.src || "";
}


// ======================================
// HTML ESCAPE
// ======================================
function escapeHTML(str) {

    return String(str || "")
        .replace(/[&<>"']/g, (m) => ({

            "&": "&amp;",

            "<": "&lt;",

            ">": "&gt;",

            '"': "&quot;",

            "'": "&#039;"

        })[m]);
}


// ======================================
// BUTTON LOCK
// ======================================
function lockButton(btn) {

    if (!btn) return;

    btn.disabled = true;

    btn.style.opacity = "0.7";

    setTimeout(() => {

        btn.disabled = false;

        btn.style.opacity = "1";

    }, 800);
}


// ======================================
// TOAST SYSTEM
// ======================================
function showToast(
    message,
    type = "info"
) {

    let toast =
        document.getElementById(
            "globalToast"
        );

    if (!toast) {

        toast =
            document.createElement("div");

        toast.id = "globalToast";

        toast.style.position =
            "fixed";

        toast.style.bottom =
            "20px";

        toast.style.right =
            "20px";

        toast.style.padding =
            "12px 18px";

        toast.style.borderRadius =
            "10px";

        toast.style.zIndex =
            "9999";

        toast.style.transition =
            "0.3s";

        toast.style.opacity =
            "0";

        toast.style.color =
            "#fff";

        toast.style.background =
            "#222";

        document.body.appendChild(
            toast
        );
    }

    toast.innerText =
        message;

    toast.style.opacity =
        "1";

    clearTimeout(
        toast.hideTimeout
    );

    toast.hideTimeout =
        setTimeout(() => {

            toast.style.opacity =
                "0";

        }, 2500);
}


// ======================================
// USER CACHE
// ======================================
let __cachedUser = null;


// ======================================
// GET CURRENT USER
// ======================================
async function getCurrentUser() {

    try {

        const response =

            await API.auth.check();


        if (
            response.success &&
            response.user
        ) {

            return response.user;
        }

        return null;

    } catch (err) {

        console.error(
            "❌ Auth check failed:",
            err
        );

        return null;
    }
}


// ======================================
// GET CACHED USER
// ======================================
async function getCachedUser() {

    if (__cachedUser) {

        return __cachedUser;
    }

    __cachedUser =
        await getCurrentUser();

    return __cachedUser;
}


// ======================================
// USER DISPLAY
// ======================================
const userSection =
    document.getElementById(
        "userSection"
    );


(async () => {

    const user =
        await getCachedUser();

    if (
        user &&
        userSection
    ) {

        userSection.innerHTML = `
            Hello, ${escapeHTML(user.name)} 👋
            <button onclick="logout()" style="margin-left:10px;">
                Logout
            </button>
        `;
    }

})();


// ======================================
// LOGOUT
// ======================================
async function logout() {

    try {

        await API.auth.logout();

        localStorage.removeItem(
            "user"
        );

        sessionStorage.clear();

        showToast(
            "Logged out successfully"
        );

        setTimeout(() => {

            window.location.href =
                "login.html";

        }, 500);

    } catch (err) {

        console.error(
            "❌ Logout failed:",
            err
        );

        showToast(
            "Logout failed"
        );
    }
}


// ======================================
// ADD TO CART
// ======================================
async function addToCart(

    btn,

    productId,

    name,

    price,

    image

){

    try {

        lockButton(btn);

        const user =
            await getCachedUser();

        if (!user) {

            showToast(
                "Please login first"
            );

            return setTimeout(() => {

                window.location.href =
                    "login.html";

            }, 1000);
        }


        const fixedPrice =
            normalizePrice(price);


        if (
            !name ||
            fixedPrice <= 0
        ) {

            console.warn(
                "⚠ Invalid product"
            );

            return;
        }


        const response =

            await API.post(

    "/cart/add",

    {

        productId,

        name:
            escapeHTML(name),

        price:
            fixedPrice,

        image
    }
);


        if (
            response.success
        ) {

            showToast(
                "Added to cart ✅"
            );

            loadCartCount();

            loadCartPage();

        } else {

            showToast(

                response.message ||

                "Failed to add"
            );
        }

    } catch (err) {

        console.error(
            "❌ Add cart error:",
            err
        );

        showToast(
            "Cart operation failed"
        );
    }
}


// ======================================
// QUANTITY CONTROLS
// ======================================
function increaseQty(btn) {

    const card =
        btn.closest(".card");

    if (!card) return;


    const name =
        safeQuery(card, "h3")
            ?.innerText;


    const price =
        normalizePrice(

            safeQuery(
                card,
                ".price"
            )?.innerText
        );


    const image =
        safeImage(card);


    addToCart(
        btn,
        name,
        price,
        image
    );
}


function decreaseQty() {

    showToast(
        "Use cart page to decrease quantity"
    );
}


// ======================================
// LOAD CART PAGE
// ======================================
async function loadCartPage() {

    try {

        const container =
            document.getElementById(
                "cart-container"
            );

        if (!container) return;


        const user =
            await getCachedUser();

        if (!user) {

            container.innerHTML =
                "Please login";

            return;
        }


        const response =
            await API.get(

                `/cart/${user._id}`
            );


        if (
            !response.success
        ) {

            container.innerHTML =
                "Failed to load cart";

            return;
        }


        const items =
            response.items || [];


        if (
            items.length === 0
        ) {

            container.innerHTML = `
                <h3>Your cart is empty 😢</h3>
            `;

            return;
        }


        let html = "";

        let total = 0;


        items.forEach(item => {

            total +=
                normalizePrice(
                    item.price
                ) *
                (item.quantity || 1);


            html += `
                <div class="cart-item">

                    <img 
                        src="${escapeHTML(item.image)}" 
                        width="80"
                        loading="lazy"
                    />

                    <div>

                        <h3>
                            ${escapeHTML(item.name)}
                        </h3>

                        <p>
                            ₹${item.price}
                        </p>

                        <button onclick="updateCart('${escapeHTML(item.name)}','decrease')">
                            -
                        </button>

                        ${item.quantity}

                        <button onclick="updateCart('${escapeHTML(item.name)}','increase')">
                            +
                        </button>

                    </div>

                </div>
            `;
        });


        html += `
            <h2 style="margin-top:20px;">
                Total: ₹${total}
            </h2>
        `;


        container.innerHTML =
            html;

    } catch (err) {

        console.error(
            "❌ Cart load failed:",
            err
        );
    }
}


// ======================================
// UPDATE CART
// ======================================
async function updateCart(
    name,
    action
) {

    try {

        const response =
            await API.post(

                "/cart/update",

                {
                    name,
                    action
                }
            );


        if (
            response.success
        ) {

            loadCartPage();

            loadCartCount();

        } else {

            showToast(
                "Cart update failed"
            );
        }

    } catch (err) {

        console.error(
            "❌ Cart update error:",
            err
        );
    }
}


// ======================================
// CART COUNT
// ======================================
async function loadCartCount() {

    try {

        const user =
            await getCachedUser();

        if (!user) return;


        const response =
            await API.get(

                `/cart/count/${user._id}`
            );


        if (
            response.success
        ) {

            const cartIcon =
                document.getElementById(
                    "cartCount"
                );

            if (cartIcon) {

                cartIcon.innerText =
                    response.count || 0;
            }
        }

    } catch (err) {

        console.error(
            "❌ Cart count failed:",
            err
        );
    }
}

// ======================================
// AUTO LOAD
// ======================================
window.addEventListener(

    "DOMContentLoaded",

    async () => {

        try {

            // LOAD CART PAGE SAFELY
            if (
                typeof loadCartPage ===
                "function"
            ) {

                await loadCartPage();
            }

            // LOAD CART COUNT SAFELY
            if (
                typeof loadCartCount ===
                "function"
            ) {

                await loadCartCount();
            }

            // ======================================
            // LOAD WISHLIST UI
            // ======================================
            if (
                typeof syncWishlistUI ===
                "function"
            ) {

                await syncWishlistUI();
            }

        } catch (error) {

            console.error(
                "❌ Auto load failed:",
                error
            );
        }
    }
);


// ======================================
// GLOBAL EXPORTS
// ======================================
if (typeof addToCart === "function") {

    window.addToCart =
        addToCart;
}

if (typeof logout === "function") {

    window.logout =
        logout;
}

if (typeof increaseQty === "function") {

    window.increaseQty =
        increaseQty;
}

if (typeof decreaseQty === "function") {

    window.decreaseQty =
        decreaseQty;
}

if (typeof updateCart === "function") {

    window.updateCart =
        updateCart;
}

if (typeof addToWishlist === "function") {

    window.addToWishlist =
        addToWishlist;
}

if (typeof syncWishlistUI === "function") {

    window.syncWishlistUI =
        syncWishlistUI;
}

if (typeof updateWishlistCount === "function") {

    window.updateWishlistCount =
        updateWishlistCount;
}


// ======================================
// GLOBAL ERROR HANDLING
// ======================================
window.addEventListener(

    "error",

    (e) => {

        console.error(

            "🔥 Global Error:",

            {

                message: e.message,

                file: e.filename,

                line: e.lineno,

                column: e.colno
            }
        );
    }
);


window.addEventListener(

    "unhandledrejection",

    (e) => {

        console.error(

            "🔥 Promise Error:",

            e.reason
        );
    }
);

// ======================================
// ADD TO WISHLIST
// ======================================

// ======================================
// WISHLIST CACHE
// ======================================

let wishlistProducts = [];


// ======================================
// LOAD USER WISHLIST
// ======================================

async function loadWishlist() {

    try {

        const user =
            await getCachedUser();

        if (!user) return [];

        const response =
            await fetch(
    `${API_BASE}/wishlist`,
                {
                    credentials: "include"
                }
            );

        const data =
            await response.json();

        if (!data.success) {

            return [];
        }

        wishlistProducts =
            data.wishlist.products.map(
                p => p._id
            );

        return wishlistProducts;

    } catch (err) {

        console.error(
            "Wishlist load failed",
            err
        );

        return [];
    }
}

// ======================================
// TOGGLE WISHLIST
// ======================================

async function addToWishlist(
    btn,
    productId
) {

    try {

        const user =
            await getCachedUser();

        if (!user) {

            showToast(
                "Please login first"
            );

            return;
        }

        const icon =
            btn.querySelector("i");

        const isWishlisted =
            wishlistProducts.includes(
                productId
            );

        const url =
    isWishlisted
        ? `${API_BASE}/wishlist/remove/${productId}`
        : `${API_BASE}/wishlist/add/${productId}`;

        const method =
            isWishlisted

                ? "DELETE"

                : "POST";

        const response =
            await fetch(
                url,
                {
                    method,
                    credentials:
                        "include"
                }
            );

        const data =
            await response.json();

        if (!data.success) {

            throw new Error(
                data.message
            );
        }

        if (isWishlisted) {

            wishlistProducts =
                wishlistProducts.filter(
                    id =>
                        id !== productId
                );

            if (icon) {

                icon.classList.remove(
                    "fa-solid"
                );

                icon.classList.add(
                    "fa-regular"
                );

                icon.style.color =
                    "";
            }

            showToast(
                "Removed from wishlist ❌"
            );

        } else {

            wishlistProducts.push(
                productId
            );

            if (icon) {

                icon.classList.remove(
                    "fa-regular"
                );

                icon.classList.add(
                    "fa-solid"
                );

                icon.style.color =
                    "red";
            }

            showToast(
                "Added to wishlist ❤️"
            );
        }

        updateWishlistCount();

    } catch (err) {

        console.error(err);

        showToast(
            "Wishlist operation failed"
        );
    }
}

// ======================================
// WISHLIST COUNT
// ======================================

async function updateWishlistCount() {

    try {

        const countElement =
            document.getElementById(
                "wishlistCount"
            );

        if (!countElement) return;

        const count =
            wishlistProducts.length;

        countElement.innerText =
            count;

        if (count === 0) {

            countElement.style.display =
                "none";

        } else {

            countElement.style.display =
                "flex";
        }

    } catch (err) {

        console.error(err);
    }
}
// ======================================
// HEART SYNC
// ======================================

async function syncWishlistUI() {

    await loadWishlist();

    document
        .querySelectorAll(
            ".wishlist-btn"
        )

        .forEach(btn => {

            const onclick =
                btn.getAttribute(
                    "onclick"
                );

            if (!onclick) return;

            const match =
                onclick.match(
                    /'([^']+)'/
                );

            if (!match) return;

            const productId =
                match[1];

            const icon =
                btn.querySelector(
                    "i"
                );

            if (

                wishlistProducts.includes(
                    productId
                )

            ) {

                icon.classList.remove(
                    "fa-regular"
                );

                icon.classList.add(
                    "fa-solid"
                );

                icon.style.color =
                    "red";
            }
        });

    updateWishlistCount();
}

window.addToWishlist =
    addToWishlist;

window.syncWishlistUI =
    syncWishlistUI;

window.updateWishlistCount =
    updateWishlistCount;