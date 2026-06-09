const express = require("express");

const crypto = require("crypto");

const mongoose = require("mongoose");

const Razorpay = require("razorpay");

const Cart = require("../models/Cart");

const Order = require("../models/Order");

const {
    protect
} = require("../middleware/authMiddleware");


const router = express.Router();


// ======================================
// DEBUG FLAG
// ======================================
const DEBUG =
    process.env.DEBUG === "true";


// ======================================
// ENV VALIDATION
// ======================================
[
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET"
].forEach((key) => {

    if (!process.env[key]) {

        console.warn(
            `⚠ Missing ENV: ${key}`
        );
    }
});


// ======================================
// RAZORPAY INSTANCE
// ======================================
const razorpay =
    new Razorpay({

        key_id:
            process.env.RAZORPAY_KEY_ID,

        key_secret:
            process.env.RAZORPAY_KEY_SECRET
    });


// ======================================
// HELPERS
// ======================================
const getUserId = (req) => {

    return (
        req.user?._id ||
        req.userId
    );
};


const isValidObjectId = (
    id
) => {

    return mongoose.Types.ObjectId.isValid(id);
};


const sanitizeString = (
    str
) => {

    return String(str || "")
        .replace(/[<>]/g, "")
        .trim();
};


const calculateCartTotal = (
    items = []
) => {

    return items.reduce(

        (acc, item) => {

            const price =
                Number(item.price) || 0;

            const qty =
                Number(item.quantity) || 0;

            return acc + (
                price * qty
            );

        },

        0
    );
};


const createTimelineEvent = (
    status,
    message
) => {

    return {

        status,

        message,

        createdAt:
            new Date()
    };
};


// ======================================
// SAFE ASYNC WRAPPER
// ======================================
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
                "❌ ORDER ROUTE ERROR:",
                err
            );

            next(err);
        }
    };
};


// ======================================
// FIND OR CREATE CART
// ======================================
const ensureCart = async (
    userId
) => {

    let cart =
        await Cart.findOne({

            $or: [
                { user: userId },
                { userId }
            ]
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


// ======================================
// SAFE ORDER RESPONSE
// ======================================
const formatOrder = (
    order
) => {

    try {

        return order.toJSON
            ? order.toJSON()
            : order;

    } catch {

        return order;
    }
};


// ======================================
// HEALTH CHECK
// ======================================
router.get(
    "/health",
    (req, res) => {

        return res.json({

            success: true,

            service:
                "order-service"
        });
    }
);


// ======================================
// CREATE COD ORDER
// ======================================
router.post(

    "/place",

    protect,

    safeAsync(async (
        req,
        res
    ) => {

        const {
            name,
            phone,
            address,
            city,
            state,
            pincode
        } = req.body;


        const userId =
            getUserId(req);


        // VALIDATION
        if (
            !name ||
            !phone ||
            !address
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "All fields required"
            });
        }


        if (
            !/^[0-9]{10}$/.test(
                String(phone)
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid phone number"
            });
        }


        const cart =
            await ensureCart(userId);


        if (
            !cart.items ||
            cart.items.length === 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Cart is empty"
            });
        }


        const total =
            calculateCartTotal(
                cart.items
            );


        const order =
            new Order({

                user:
                    userId,

                userId,

                items:
                    cart.items,

                total,

                totalAmount:
                    total,

                finalAmount:
                    total,

                name:
                    sanitizeString(name),

                phone:
                    sanitizeString(phone),

                address:
                    sanitizeString(address),

                city:
                    sanitizeString(city),

                state:
                    sanitizeString(state),

                pincode:
                    sanitizeString(pincode),

                payment:
                    "COD",

                paymentMethod:
                    "COD",

                paymentStatus:
                    "PENDING",

                status:
                    "Pending",

                timeline: [

                    createTimelineEvent(

                        "Pending",

                        "COD order created"
                    )
                ]
            });


        await order.save();


        // CLEAR CART
        cart.items = [];

        await cart.save();


        if (DEBUG) {

            console.log(
                "📦 COD ORDER:",
                order._id
            );
        }


        return res.json({

            success: true,

            message:
                "Order placed successfully",

            order:
                formatOrder(order)
        });
    })
);



// ======================================
// GET USER ORDERS
// ======================================
router.get(

    "/",

    protect,

    safeAsync(async (
        req,
        res
    ) => {

        const userId =
            getUserId(req);


        const page =
            Number(req.query.page) || 1;

        const limit =
            Number(req.query.limit) || 10;

        const skip =
            (page - 1) * limit;


        const orders =
            await Order.find({

                $or: [
                    { user: userId },
                    { userId }
                ]
            })

                .sort({
                    createdAt: -1
                })

                .skip(skip)

                .limit(limit);


        const totalOrders =
            await Order.countDocuments({

                $or: [
                    { user: userId },
                    { userId }
                ]
            });


        return res.json({

            success: true,

            page,

            limit,

            totalOrders,

            totalPages:
                Math.ceil(
                    totalOrders / limit
                ),

            orders:
                orders.map(
                    formatOrder
                )
        });
    })
);


// ======================================
// GET SINGLE ORDER
// ======================================
router.get(

    "/:id",

    protect,

    safeAsync(async (
        req,
        res
    ) => {

        const userId =
            getUserId(req);

        const orderId =
            req.params.id;


        if (
            !isValidObjectId(
                orderId
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid order ID"
            });
        }


        const order =
            await Order.findOne({

                _id:
                    orderId,

                $or: [
                    { user: userId },
                    { userId }
                ]
            });


        if (!order) {

            return res.status(404).json({

                success: false,

                message:
                    "Order not found"
            });
        }


        return res.json({

            success: true,

            order:
                formatOrder(order)
        });
    })
);


// ======================================
// ERROR HANDLER
// ======================================
router.use(

    (err, req, res, next) => {

        console.error(
            "🚨 ORDER ERROR:",
            err
        );

        return res.status(500).json({

            success: false,

            message:
                process.env.NODE_ENV ===
                "production"
                    ? "Order operation failed"
                    : err.message
        });
    }
);


// ======================================
// EXPORT
// ======================================
module.exports = router;