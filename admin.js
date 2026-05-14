const statsBox = document.getElementById("stats");
const usersBox = document.getElementById("users");
const ordersBox = document.getElementById("orders");
const errorBox = document.getElementById("error");

const userSearch = document.getElementById("userSearch");
const orderSearch = document.getElementById("orderSearch");
const statusFilter = document.getElementById("statusFilter");

let allUsers = [];
let allOrders = [];


// ===============================
// 🔧 HELPER (SAFE FETCH)
// ===============================
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

        if (!res.ok) {
            const text = await res.text();
            console.error("❌ Response Error:", text);
            throw new Error(`HTTP ${res.status}`);
        }

        return await res.json();

    } catch (err) {
        console.error("❌ Fetch Error:", err.message);
        errorBox.innerText = "Server error occurred";
        throw err;
    }
}


// ===============================
// 🧠 LOADING
// ===============================
function showLoading(target) {
    if (!target) return;
    target.innerHTML = `<p>Loading...</p>`;
}


// ===============================
// LOAD STATS
// ===============================
async function loadStats() {
    try {
        showLoading(statsBox);

        const data = await safeFetch("http://https://makhana-website.onrender.com/api/admin/stats");

        if (!data.success) {
            errorBox.innerText = data.message;
            return;
        }

        const { totalUsers, totalOrders, totalRevenue } = data.stats;

        statsBox.innerHTML = `
            <div class="card">
                <p>Total Users: ${totalUsers}</p>
                <p>Total Orders: ${totalOrders}</p>
                <p>Total Revenue: ₹${totalRevenue}</p>
            </div>
        `;

    } catch {
        errorBox.innerText = "Failed to load stats";
    }
}


// ===============================
// LOAD USERS
// ===============================
async function loadUsers() {
    try {
        showLoading(usersBox);

        const data = await safeFetch("http://https://makhana-website.onrender.com/api/admin/users");

        if (!data.success) return;

        allUsers = data.users;
        renderUsers();

    } catch {}
}


// ===============================
// RENDER USERS (SEARCH ADDED)
// ===============================
function renderUsers() {
    const search = userSearch.value.toLowerCase();

    const filtered = allUsers.filter(u =>
        u.name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
    );

    usersBox.innerHTML = filtered.map(u => `
        <div class="card">
            ${u.name} (${u.email})
            ${u.role === "admin" ? "👑" : ""}
        </div>
    `).join("");
}


// ===============================
// LOAD ORDERS
// ===============================
async function loadOrders() {
    try {
        showLoading(ordersBox);

        const data = await safeFetch("http://https://makhana-website.onrender.com/api/admin/orders");

        if (!data.success) return;

        allOrders = data.orders;
        renderOrders();

    } catch {}
}


// ===============================
// RENDER ORDERS (FILTER + SEARCH)
// ===============================
function renderOrders() {
    const search = orderSearch.value.toLowerCase();
    const filter = statusFilter.value;

    const filtered = allOrders.filter(order => {
        const userName = order.user?.name?.toLowerCase() || "";

        const matchesSearch = userName.includes(search);
        const matchesFilter = filter ? order.status === filter : true;

        return matchesSearch && matchesFilter;
    });

    ordersBox.innerHTML = filtered.map(order => {
        const status = order.status || "Pending";

        return `
        <div class="card">
            <p><b>${order.user?.name || "User"}</b></p>
            <p>₹${order.total || order.totalAmount || 0}</p>
            <p>${new Date(order.createdAt).toLocaleString()}</p>

            <p>Status: <span class="status ${status}">${status}</span></p>

            <select onchange="updateStatus('${order._id}', this.value)">
                <option ${status==="Pending"?"selected":""}>Pending</option>
                <option ${status==="Processing"?"selected":""}>Processing</option>
                <option ${status==="Shipped"?"selected":""}>Shipped</option>
                <option ${status==="Delivered"?"selected":""}>Delivered</option>
            </select>
        </div>
        `;
    }).join("");
}


// ===============================
// UPDATE STATUS (IMPROVED UX)
// ===============================
async function updateStatus(orderId, status) {
    try {
        await safeFetch(
            `http://https://makhana-website.onrender.com/api/admin/order/${orderId}/status`,
            {
                method: "PUT",
                body: JSON.stringify({ status })
            }
        );

        loadOrders();

    } catch {
        errorBox.innerText = "Failed to update status";
    }
}


// ===============================
// EVENTS
// ===============================
userSearch.addEventListener("input", renderUsers);
orderSearch.addEventListener("input", renderOrders);
statusFilter.addEventListener("change", renderOrders);


// ===============================
// AUTO REFRESH
// ===============================
function autoRefresh() {
    setInterval(() => {
        loadStats();
        loadUsers();
        loadOrders();
    }, 30000);
}


// ===============================
// INIT
// ===============================
document.addEventListener("DOMContentLoaded", () => {
    loadStats();
    loadUsers();
    loadOrders();
    autoRefresh();
});