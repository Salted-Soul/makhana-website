const express = require("express");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Razorpay = require("razorpay");
const crypto = require("crypto");

// ✅ FIXED IMPORT (VERY IMPORTANT)
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();


// =======================
// 🔥 DEBUG FLAG (NEW)
// =======================
const DEBUG = process.env.DEBUG === "true";


// =======================
// 🧠 NEW HELPERS (NON-BREAKING)
// =======================

// Centralized userId getter
const getUserId = (req) => req.user?._id || req.userId;

// Safe number validator
const isValidNumber = (val) => typeof val === "number" && !isNaN(val);

// Calculate total safely
const calculateCartTotal = (items = []) => {
    return items.reduce((acc, item) => {
        if (!item.price || !item.quantity) return acc;
        return acc + item.price * item.quantity;
    }, 0);
};


// =======================
// 🔥 SAFE ASYNC WRAPPER (NEW)
// =======================
const safeAsync = (fn) => async (req, res, next = () => {}) => {
    try {

        await fn(req, res, next);

    } catch (err) {

        console.error("🔥 ORDER ROUTE ERROR:", err);

        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: err.message
        });
    }
};


// =======================
// 🔥 SANITIZER (NEW)
// =======================
const sanitizeString = (str) =>
    String(str || "").replace(/[<>]/g, "").trim();


// =======================
// 🔒 ENV WARNING (NEW)
// =======================
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_SECRET) {
    console.warn("⚠️ Razorpay ENV missing — fallback being used");
}


// =======================
// 🆕 DEBUG ROUTE (NEW)
// =======================
router.get("/debug", protect, (req, res) => {
    res.json({
        success: true,
        user: req.user,
        message: "Order debug working"
    });
});


// =======================
// 🆕 COD ORDER (NEW FEATURE)
// =======================
router.post("/place", protect, safeAsync(async (req, res) => {
    const { name, phone, address } = req.body;
    const userId = getUserId(req);

    if (!name || !phone || !address) {
        return res.status(400).json({
            success: false,
            message: "All fields required"
        });
    }

    if (phone.length < 10) {
        return res.status(400).json({
            success: false,
            message: "Invalid phone"
        });
    }

    const cart = await Cart.findOne({
        $or: [{ user: userId }, { userId }]
    });

    if (!cart || cart.items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Cart empty"
        });
    }

    const total = calculateCartTotal(cart.items);

    const order = new Order({
        user: userId,
        userId,
        items: cart.items,
        totalAmount: total,
        name: sanitizeString(name),
        phone: sanitizeString(phone),
        address: sanitizeString(address),
        payment: "COD",
        status: "Pending"
    });

    await order.save();

    // 🔥 SAFE CART CLEAR (NEW)
    cart.items = [];
    await cart.save();

    if (DEBUG) console.log("📦 COD ORDER CREATED:", order._id);

    res.json({
        success: true,
        message: "COD order placed",
        orderId: order._id
    });
}));


// =======================
// ✅ RAZORPAY INSTANCE
// =======================
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

console.log("KEY:", process.env.RAZORPAY_KEY_ID);
console.log("SECRET:", process.env.RAZORPAY_KEY_SECRET);

// =======================
// ✅ TEST ROUTE (PROTECTED)
// =======================
router.get("/test", protect, (req, res) => {
    res.send("Order route working ✅");
});


// =======================
// 🔥 ENSURE CART (NEW SAFETY)
// =======================
const ensureCart = async (userId) => {
    let cart = await Cart.findOne({
        $or: [{ user: userId }, { userId }]
    });

    if (!cart) {
        cart = new Cart({
            user: userId,
            userId,
            items: []
        });
        await cart.save();
    }

    return cart;
};


// =======================
// ✅ CREATE RAZORPAY ORDER (UPGRADED)
// =======================
router.post("/create-order", protect, safeAsync(async (req, res) => {
    const userId = getUserId(req);

    const cart = await ensureCart(userId);

    if (!cart || cart.items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Cart is empty"
        });
    }

    let total = calculateCartTotal(cart.items);

    if (!isValidNumber(total) || total <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid cart total"
        });
    }
    console.log("TOTAL:", total);
console.log("USER ID:", userId);
console.log("CART:", cart);

    const options = {
        amount: total * 100,
        currency: "INR",
        receipt: "receipt_" + Date.now()
    };

    let order;

try {

    console.log("RAZORPAY OPTIONS:", options);
    console.log("KEY:", process.env.RAZORPAY_KEY_ID);
    console.log("SECRET EXISTS:", !!process.env.RAZORPAY_KEY_SECRET);

    order = await razorpay.orders.create(options);

    console.log("RAZORPAY ORDER CREATED:", order);

} catch (err) {

    console.log("RAZORPAY CREATE ERROR:", err);

    return res.status(500).json({
        success: false,
        error: err.message,
        details: err
    });
}

res.json({
    success: true,
    orderId: order.id,
    amount: total,
    key: process.env.RAZORPAY_KEY_ID
});
}));


// =======================
// ✅ VERIFY PAYMENT + SAVE ORDER (UPGRADED)
// =======================
router.post("/verify", protect, safeAsync(async (req, res) => {

    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        name,
        phone,
        address,
        city,
        pincode
    } = req.body;

    const userId = getUserId(req);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
            success: false,
            message: "Invalid payment data"
        });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
    .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
    )
    .update(body.toString())
    .digest("hex");

    if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({
            success: false,
            message: "Payment verification failed"
        });
    }

    // 🔥 PREVENT DUPLICATE ORDER
    const existingOrder = await Order.findOne({
        razorpay_payment_id
    });

    if (existingOrder) {
        return res.json({
            success: true,
            message: "Order already processed",
            orderId: existingOrder._id      
        });
    }

    const cart = await ensureCart(userId);

    if (!cart || cart.items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Cart not found"
        });
    }

    let total = calculateCartTotal(cart.items);

    if (!isValidNumber(total) || total <= 0) {
        return res.status(400).json({
            success: false,
            message: "Invalid total amount"
        });
    }

    const order = new Order({
        user: userId,
        userId,
        name: sanitizeString(name),
        phone: sanitizeString(phone),
        address: sanitizeString(address),
        city: sanitizeString(city),
        pincode: sanitizeString(pincode),
        payment: "Razorpay",
        razorpay_payment_id,
        razorpay_order_id,
        items: cart.items,
        total,
        totalAmount: total
    });

    await order.save();

    // 🔥 SAFE CART CLEAR
    cart.items = [];
    await cart.save();

    if (DEBUG) console.log("💳 ONLINE ORDER CREATED:", order._id);

    res.json({
        success: true,
        message: "Payment successful & order placed",
        orderId: order._id
    });
}));


// =======================
// 🆕 GET USER ORDERS (NEW ADDITION)
// =======================
router.get("/", protect, safeAsync(async (req, res) => {
    const userId = getUserId(req);

    const orders = await Order.find({
        $or: [{ user: userId }, { userId }]
    }).sort({ createdAt: -1 });

    res.json({
        success: true,
        orders
    });
}));


// =======================
// 🔥 GLOBAL ERROR HANDLER (NEW)
// =======================
router.use((err, req, res, next) => {
    console.error("🚨 ORDER ROUTE UNHANDLED ERROR:", err);

    res.status(500).json({
        success: false,
        message: "Unhandled order error",
        error: err.message
    });
});


module.exports = router;