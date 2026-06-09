const express = require("express");

const User = require("../models/User");

const Order = require("../models/Order");

const Product = require("../models/Product");

const {
    protect,
    adminOnly
} = require("../middleware/authMiddleware");


const router = express.Router();


// ======================================
// DEBUG FLAG
// ======================================
const DEBUG =
    process.env.DEBUG === "true";


// ======================================
// HELPERS
// ======================================
const safeNumber = (val) => {

    return Number(val || 0);
};


const sanitizeString = (str) => {

    return String(str || "")
        .replace(/[<>]/g, "")
        .trim();
};


const safeAsync = (fn) => {

    return async (
        req,
        res,
        next
    ) => {

        try {

            await fn(
                req,
                res,
                next
            );

        } catch (err) {

            console.error(
                "❌ ADMIN ROUTE ERROR:",
                err
            );

            next(err);
        }
    };
};


// ======================================
// ADMIN ACCESS CHECK
// ======================================
router.get(

    "/check-admin",

    protect,

    adminOnly,

    (req, res) => {

        return res.json({

            success: true,

            message:
                "Admin access granted",

            user: req.user
        });
    }
);


// ======================================
// HEALTH CHECK
// ======================================
router.get(
    "/health",
    (req, res) => {

        return res.json({

            success: true,

            service:
                "admin-service"
        });
    }
);


// ======================================
// DASHBOARD STATS
// ======================================
router.get(

    "/stats",

    protect,

    adminOnly,

    safeAsync(async (
        req,
        res
    ) => {

        const [

            totalUsers,

            totalOrders,

            totalProducts,

            revenueAgg,

            pendingOrders,

            deliveredOrders

        ] = await Promise.all([

            User.countDocuments(),

            Order.countDocuments(),

            Product.countDocuments(),

            Order.aggregate([

                {
                    $match: {
                        paymentStatus: "PAID"
                    }
                },

                {
                    $group: {

                        _id: null,

                        totalRevenue: {
                            $sum: "$finalAmount"
                        }
                    }
                }
            ]),

            Order.countDocuments({
                status: "Pending"
            }),

            Order.countDocuments({
                status: "Delivered"
            })
        ]);


        const totalRevenue =

            revenueAgg[0]
                ?.totalRevenue || 0;


        return res.json({

            success: true,

            stats: {

                totalUsers,

                totalOrders,

                totalProducts,

                totalRevenue,

                pendingOrders,

                deliveredOrders
            }
        });
    })
);


// ======================================
// SALES ANALYTICS
// ======================================
router.get(

    "/analytics/sales",

    protect,

    adminOnly,

    safeAsync(async (
        req,
        res
    ) => {

        const days =
            Math.min(
                365,
                safeNumber(req.query.days || 30)
            );


        const startDate =
            new Date();

        startDate.setDate(
            startDate.getDate() - days
        );


        const sales =
            await Order.aggregate([

                {
                    $match: {

                        createdAt: {
                            $gte: startDate
                        },

                        paymentStatus: "PAID"
                    }
                },

                {
                    $group: {

                        _id: {

                            $dateToString: {

                                format:
                                    "%Y-%m-%d",

                                date:
                                    "$createdAt"
                            }
                        },

                        revenue: {
                            $sum:
                                "$finalAmount"
                        },

                        orders: {
                            $sum: 1
                        }
                    }
                },

                {
                    $sort: {
                        _id: 1
                    }
                }
            ]);


        return res.json({

            success: true,

            sales
        });
    })
);


// ======================================
// GET USERS
// ======================================
router.get(

    "/users",

    protect,

    adminOnly,

    safeAsync(async (
        req,
        res
    ) => {

        const page =
            Math.max(
                1,
                safeNumber(req.query.page || 1)
            );

        const limit =
            Math.min(
                100,
                safeNumber(req.query.limit || 20)
            );

        const skip =
            (page - 1) * limit;


        const users =
            await User.find()

                .select("-password")

                .sort({
                    createdAt: -1
                })

                .skip(skip)

                .limit(limit)

                .lean();


        const total =
            await User.countDocuments();


        return res.json({

            success: true,

            page,

            totalPages:
                Math.ceil(total / limit),

            total,

            users
        });
    })
);


// ======================================
// GET ORDERS
// ======================================
router.get(

    "/orders",

    protect,

    adminOnly,

    safeAsync(async (
        req,
        res
    ) => {

        const page =
            Math.max(
                1,
                safeNumber(req.query.page || 1)
            );

        const limit =
            Math.min(
                100,
                safeNumber(req.query.limit || 20)
            );

        const skip =
            (page - 1) * limit;


        const status =
            sanitizeString(
                req.query.status
            );


        const filter = {};

        if (status) {

            filter.status = status;
        }


        const orders =
            await Order.find(filter)

                .populate(
                    "user",
                    "name email"
                )

                .sort({
                    createdAt: -1
                })

                .skip(skip)

                .limit(limit)

                .lean();


        const total =
            await Order.countDocuments(
                filter
            );


        return res.json({

            success: true,

            page,

            totalPages:
                Math.ceil(total / limit),

            total,

            orders
        });
    })
);


// ======================================
// GET PRODUCTS
// ======================================
router.get(

    "/products",

    protect,

    adminOnly,

    safeAsync(async (
        req,
        res
    ) => {

        const products =
            await Product.find()

                .sort({
                    createdAt: -1
                })

                .lean();


        return res.json({

            success: true,

            products
        });
    })
);


// ======================================
// UPDATE ORDER STATUS
// ======================================
router.put(

    "/order/:id/status",

    protect,

    adminOnly,

    safeAsync(async (
        req,
        res
    ) => {

        const {
            status
        } = req.body;


        const validStatuses = [

            "Pending",

            "Confirmed",

            "Processing",

            "Packed",

            "Shipped",

            "Out For Delivery",

            "Delivered",

            "Cancelled",

            "Refunded"
        ];


        if (
            !status ||
            !validStatuses.includes(
                status
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid status"
            });
        }


        const order =
            await Order.findById(
                req.params.id
            );


        if (!order) {

            return res.status(404).json({

                success: false,

                message:
                    "Order not found"
            });
        }


        order.status = status;


        order.timeline.push({

            status,

            message:
                `Admin updated order to ${status}`
        });


        if (
            status === "Delivered"
        ) {

            order.paymentStatus =
                "PAID";
        }


        await order.save();


        return res.json({

            success: true,

            message:
                "Order status updated",

            order
        });
    })
);


// ======================================
// BLOCK / UNBLOCK USER
// ======================================
router.put(

    "/user/:id/block",

    protect,

    adminOnly,

    safeAsync(async (
        req,
        res
    ) => {

        const user =
            await User.findById(
                req.params.id
            );


        if (!user) {

            return res.status(404).json({

                success: false,

                message:
                    "User not found"
            });
        }


        user.isBlocked =
            !user.isBlocked;

        await user.save();


        return res.json({

            success: true,

            message:
                user.isBlocked
                    ? "User blocked"
                    : "User unblocked",

            user
        });
    })
);


// ======================================
// FIX OLD ORDERS
// ======================================
router.get(

    "/fix-orders",

    protect,

    adminOnly,

    safeAsync(async (
        req,
        res
    ) => {

        const result =
            await Order.updateMany(

                {
                    status: {
                        $exists: false
                    }
                },

                {
                    $set: {
                        status:
                            "Pending"
                    }
                }
            );


        return res.json({

            success: true,

            modified:
                result.modifiedCount
        });
    })
);


// ======================================
// FIX MISSING USERS
// ======================================
router.get(

    "/fix-missing-users",

    protect,

    adminOnly,

    safeAsync(async (
        req,
        res
    ) => {

        const adminUser =
            await User.findOne({

                role: "admin"
            });


        if (!adminUser) {

            return res.status(400).json({

                success: false,

                message:
                    "Admin not found"
            });
        }


        const result =
            await Order.updateMany(

                {
                    user: {
                        $exists: false
                    }
                },

                {
                    $set: {
                        user:
                            adminUser._id
                    }
                }
            );


        return res.json({

            success: true,

            modified:
                result.modifiedCount
        });
    })
);


// ======================================
// NORMALIZE ORDERS
// ======================================
router.get(

    "/normalize-orders",

    protect,

    adminOnly,

    safeAsync(async (
        req,
        res
    ) => {

        const result =
            await Order.updateMany(

                {},

                [

                    {
                        $set: {

                            totalAmount: {

                                $ifNull: [
                                    "$totalAmount",
                                    "$total"
                                ]
                            },

                            finalAmount: {

                                $ifNull: [
                                    "$finalAmount",
                                    "$totalAmount"
                                ]
                            },

                            status: {

                                $ifNull: [
                                    "$status",
                                    "Pending"
                                ]
                            }
                        }
                    }
                ]
            );


        return res.json({

            success: true,

            modified:
                result.modifiedCount
        });
    })
);


// ======================================
// ERROR HANDLER
// ======================================
router.use(

    (err, req, res, next) => {

        console.error(
            "🚨 ADMIN ERROR:",
            err
        );

        return res.status(500).json({

            success: false,

            message:
                process.env.NODE_ENV ===
                "production"
                    ? "Admin operation failed"
                    : err.message
        });
    }
);


// ======================================
// EXPORT
// ======================================
module.exports = router;