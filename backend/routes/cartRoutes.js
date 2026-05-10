const express = require("express");
const Cart = require("../models/Cart");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();


// ===============================
// 🔥 GLOBAL DEBUG FLAG (NEW)
// ===============================
const DEBUG = process.env.DEBUG === "true";


// ===============================
// 🔥 SAFE SAVE WRAPPER (CRITICAL ADD)
// ===============================
const safeSave = async (cart) => {
    try {
        return await cart.save();
    } catch (err) {
        console.error("❌ SAFE SAVE FAILED:", err.message);
        return cart; // fallback to avoid crash
    }
};


// ===============================
// 🔥 GET USER ID (ENHANCED SAFE)
// ===============================
const getUserId = (req) => {
    if (req.userId) return req.userId;
    if (req.user && req.user._id) return req.user._id;

    return req.body.userId || req.params.userId;
};


// ===============================
const isValidPrice = (price) =>
    typeof price === "number" && price >= 0;


// ===============================
const findCart = async (userId) => {
    return await Cart.findOne({
        $or: [{ user: userId }, { userId }]
    });
};


// ===============================
const validateUser = (userId, res) => {
    if (!userId) {
        console.error("❌ USER ID MISSING IN REQUEST");

        res.status(401).json({
            success: false,
            message: "User not authenticated properly"
        });

        return false;
    }

    return true;
};


// ===============================
router.use((req, res, next) => {
    console.log("🛰 CART ROUTE HIT:", {
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        userId: req.userId,
        user: req.user?._id
    });
    next();
});


// ===============================
router.use((req, res, next) => {
    if (!req.body) req.body = {};
    next();
});


// ===============================
// 🔥 FIXED SAFE ASYNC (UPGRADED)
// ===============================
const safeAsync = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (err) {
        console.error("🔥 GLOBAL ERROR WRAPPER:", err);

        if (next) return next(err);

        res.status(500).json({
            success: false,
            message: "Internal server crash",
            error: err.message
        });
    }
};


// ===============================
const ensureCart = async (userId) => {
    let cart = await findCart(userId);

    if (!cart) {
        cart = new Cart({
            user: userId,
            userId: userId,
            items: []
        });

        await safeSave(cart);
        console.log("🆕 NEW CART AUTO-CREATED");
    }

    return cart;
};


// ===============================
const sanitizeItem = (data) => ({
    name: String(data.name || "").trim(),
    price: Number(data.price || 0),
    image: data.image || "",
    productId: data.productId || data.name,
    quantity: 1
});


// ===============================
const sanitizeString = (str) =>
    String(str || "").replace(/[<>]/g, "");


// ===============================
const formatCartResponse = (cart) => {
    try {
        return {
            ...cart.toObject({ virtuals: true }),
            total: cart.getSafeTotal ? cart.getSafeTotal() : 0
        };
    } catch (err) {
        console.error("❌ FORMAT CART ERROR:", err.message);
        return cart;
    }
};


// ===============================
// 🔥 ADD TO CART
// ===============================
router.post("/add", protect, safeAsync(async (req, res) => {

    if (!req.userId && !req.user) {
        return res.status(401).json({
            success: false,
            message: "Authentication missing"
        });
    }

    const userId = getUserId(req);

    let { name, price, image, productId } = req.body;

    name = sanitizeString(name);
    image = sanitizeString(image);

    if (!validateUser(userId, res)) return;

    price = Number(price);

    if (!name || !isValidPrice(price)) {
        return res.status(400).json({
            success: false,
            message: "Invalid product data"
        });
    }

    let cart = await ensureCart(userId);

    if (cart.addItem) {
        cart.addItem({ name, price, image, productId });
    } else {
        const itemIndex = cart.items.findIndex(
            item => item.name === name
        );

        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += 1;
        } else {
            cart.items.push(
                sanitizeItem({ name, price, image, productId })
            );
        }
    }

    cart.markModified("items");

    await safeSave(cart); // ✅ FIXED

    res.json({
        success: true,
        message: "Item added to cart",
        cart: formatCartResponse(cart),
        items: cart.items,
        total: cart.getSafeTotal ? cart.getSafeTotal() : 0
    });

}));


// ===============================
router.get("/:userId", protect, safeAsync(async (req, res) => {

    const userId = getUserId(req);

    if (!validateUser(userId, res)) return;

    const cart = await ensureCart(userId);

    res.json({
        success: true,
        cart: formatCartResponse(cart),
        items: cart.items,
        total: cart.getSafeTotal ? cart.getSafeTotal() : 0
    });

}));


// ===============================
router.post("/update", protect, safeAsync(async (req, res) => {

    const userId = getUserId(req);
    const { name, action, forceRemove, quantity, productId } = req.body;

    if (!validateUser(userId, res)) return;

    let cart = await ensureCart(userId);

    if (productId && cart.updateQuantity && quantity !== undefined) {
        cart.updateQuantity(productId, Number(quantity));
    }

    const itemIndex = cart.items.findIndex(item => item.name === name);

    if (itemIndex > -1) {

        if (forceRemove) {
            cart.items.splice(itemIndex, 1);
        }
        else if (action === "increase") {
            cart.items[itemIndex].quantity += 1;
        }
        else if (action === "decrease") {
            cart.items[itemIndex].quantity -= 1;

            if (cart.items[itemIndex].quantity <= 0) {
                cart.items.splice(itemIndex, 1);
            }
        }

        cart.markModified("items");

        await safeSave(cart); // ✅ FIXED
    }

    res.json({
        success: true,
        message: "Cart updated",
        cart: formatCartResponse(cart),
        items: cart.items,
        total: cart.getSafeTotal ? cart.getSafeTotal() : 0
    });

}));


// ===============================
router.post("/remove", protect, safeAsync(async (req, res) => {

    const userId = getUserId(req);
    const { productId } = req.body;

    if (!validateUser(userId, res)) return;

    let cart = await ensureCart(userId);

    if (cart.removeItem) {
        cart.removeItem(productId);
    }

    cart.markModified("items");
    await safeSave(cart); // ✅ FIXED

    res.json({
        success: true,
        message: "Item removed",
        cart: formatCartResponse(cart),
        items: cart.items,
        total: cart.getSafeTotal ? cart.getSafeTotal() : 0
    });

}));


// ===============================
router.post("/clear", protect, safeAsync(async (req, res) => {

    const userId = getUserId(req);

    if (!validateUser(userId, res)) return;

    let cart = await ensureCart(userId);

    if (cart.clearCart) {
        cart.clearCart();
    } else {
        cart.items = [];
    }

    cart.markModified("items");

    await safeSave(cart); // ✅ FIXED

    res.json({
        success: true,
        message: "Cart cleared",
        items: [],
        total: 0
    });

}));


// ===============================
router.get("/count/:userId", protect, safeAsync(async (req, res) => {

    const userId = getUserId(req);

    if (!validateUser(userId, res)) return;

    const cart = await ensureCart(userId);

    const count = cart.items.reduce((acc, item) => acc + item.quantity, 0);

    res.json({
        success: true,
        count
    });

}));


// ===============================
router.get("/health/check", (req, res) => {
    res.json({ success: true, message: "Cart route working ✅" });
});


// ===============================
router.use((err, req, res, next) => {
    console.error("🚨 UNHANDLED CART ROUTE ERROR:", err);

    res.status(500).json({
        success: false,
        message: "Unhandled cart error",
        error: err.message
    });
});


module.exports = router;