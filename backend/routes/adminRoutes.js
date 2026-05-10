const express = require("express");
const User = require("../models/User");
const Order = require("../models/Order");

const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();


// ===============================
// 📊 ADMIN DASHBOARD STATS
// ===============================
router.get("/stats", protect, adminOnly, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalOrders = await Order.countDocuments();

        const revenueAgg = await Order.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: "$totalAmount" }
                }
            }
        ]);

        const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalOrders,
                totalRevenue
            }
        });

    } catch (err) {
        console.error("ADMIN STATS ERROR:", err);

        res.status(500).json({
            success: false,
            message: "Failed to load stats"
        });
    }
});


// ===============================
// 👥 GET ALL USERS
// ===============================
router.get("/users", protect, adminOnly, async (req, res) => {
    try {
        const users = await User.find().select("-password");

        res.json({
            success: true,
            users
        });

    } catch (err) {
        console.error("GET USERS ERROR:", err);

        res.status(500).json({
            success: false,
            message: "Failed to fetch users"
        });
    }
});


// ===============================
// 📦 GET ALL ORDERS (OPTIMIZED)
// ===============================
router.get("/orders", protect, adminOnly, async (req, res) => {
    try {
        const orders = await Order.find()
            .populate("user", "name email")
            .sort({ createdAt: -1 })
            .lean(); // 🔥 PERFORMANCE BOOST

        res.json({
            success: true,
            orders
        });

    } catch (err) {
        console.error("ADMIN ORDERS ERROR:", err);

        res.status(500).json({
            success: false,
            message: "Failed to fetch orders"
        });
    }
});


// ===============================
// 🔥 UPDATE ORDER STATUS (SAFE)
// ===============================
router.put("/order/:id/status", protect, adminOnly, async (req, res) => {
    try {
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "Status is required"
            });
        }

        const validStatuses = ["Pending", "Processing", "Shipped", "Delivered"];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status"
            });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: false }
        );

        if (!updatedOrder) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.json({
            success: true,
            message: "Order status updated",
            order: updatedOrder
        });

    } catch (err) {
        console.error("❌ UPDATE STATUS ERROR:", err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


// ===============================
// 🧪 DEBUG ROUTE
// ===============================
router.get("/check-admin", protect, adminOnly, (req, res) => {
    res.json({
        success: true,
        message: "Admin access granted",
        user: req.user
    });
});


// ===============================
// 🧹 FIX OLD ORDERS (STATUS)
// ===============================
router.get("/fix-orders", async (req, res) => {
    try {
        await Order.updateMany(
            { status: { $exists: false } },
            { $set: { status: "Pending" } }
        );

        res.json({
            success: true,
            message: "Old orders fixed (status)"
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


// ===============================
// 🧹 FIX MISSING USER FIELD
// ===============================
router.get("/fix-missing-users", async (req, res) => {
    try {
        const adminUser = await User.findOne({ role: "admin" });

        if (!adminUser) {
            return res.status(400).json({
                success: false,
                message: "No admin user found"
            });
        }

        const result = await Order.updateMany(
            { user: { $exists: false } },
            { $set: { user: adminUser._id } }
        );

        res.json({
            success: true,
            message: "Missing user field fixed",
            modified: result.modifiedCount
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


// ===============================
// 🔥 NEW: DATA NORMALIZATION
// ===============================
router.get("/normalize-orders", async (req, res) => {
    try {
        const result = await Order.updateMany(
            {},
            [
                {
                    $set: {
                        totalAmount: { $ifNull: ["$totalAmount", "$total"] },
                        status: { $ifNull: ["$status", "Pending"] }
                    }
                }
            ]
        );

        res.json({
            success: true,
            message: "Orders normalized",
            modified: result.modifiedCount
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


module.exports = router;