// ======================================
// IMPORTS
// ======================================
const express = require("express");

const crypto = require("crypto");

const Razorpay = require("razorpay");

const Product = require("../models/Product");

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

        console.error(
            `❌ Missing ENV: ${key}`
        );

        process.exit(1);
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
// DEBUG LOGS
// ======================================
if (DEBUG) {

    console.log(
        "🔑 Razorpay Loaded:",
        !!process.env.RAZORPAY_KEY_ID
    );
}


// ======================================
// HELPERS
// ======================================
const sanitizeString = (
    str
) => {

    return String(str || "")
        .replace(/[<>]/g, "")
        .trim();
};


const calculateTotal = (
    items = []
) => {

    return items.reduce(

        (sum, item) => {

            const price =
                Number(item.price) || 0;

            const qty =
                Number(item.quantity) || 0;

            return sum + (
                price * qty
            );

        },

        0
    );
};


const getUserId = (
    req
) => {

    if (
        req.user &&
        req.user._id
    ) {

        return req.user._id;
    }

    if (
        req.userId
    ) {

        return req.userId;
    }

    return null;
};


const verifySignature = (
    orderId,
    paymentId,
    signature
) => {

    const generated =

        crypto
            .createHmac(

                "sha256",

                process.env
                    .RAZORPAY_KEY_SECRET
            )

            .update(
                `${orderId}|${paymentId}`
            )

            .digest("hex");


    return generated === signature;
};


// ======================================
// SAFE FIND CART
// ======================================
const findCart = async (
    userId
) => {

    return await Cart.findOne({

        $or: [
            { user: userId },
            { userId }
        ]
    });
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
                "❌ PAYMENT ROUTE ERROR:",
                err
            );

            next(err);
        }
    };
};


// ======================================
// CREATE PAYMENT ORDER
// ======================================
router.post(

    "/create-order",

    protect,

    safeAsync(async (
        req,
        res
    ) => {

        const userId =
            getUserId(req);


        const cart =
            await findCart(userId);


        if (
            !cart ||
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
            calculateTotal(
                cart.items
            );


        if (
            !Number.isFinite(total) ||
            total <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid cart total"
            });
        }


        const receiptId =

            `receipt_${Date.now()}`;


        const razorpayOrder =
            await razorpay.orders.create({

                amount:
                    Math.round(
                        total * 100
                    ),

                currency:
                    "INR",

                receipt:
                    receiptId,

                notes: {

                    userId:
                        String(userId)
                }
            });


        if (DEBUG) {

            console.log(
                "✅ Razorpay Order:",
                razorpayOrder.id
            );
        }


        return res.json({

            success: true,

            order:
                razorpayOrder,

            total,

            currency:
                "INR",

            key:
                process.env
                    .RAZORPAY_KEY_ID
        });
    })
);


// ======================================
// VERIFY PAYMENT
// ======================================
router.post(

    "/verify",

    protect,

    

    safeAsync(async (
        req,
        res
    ) => {

        const {

            razorpay_order_id,

            razorpay_payment_id,

            razorpay_signature,

            name,

            phone,

            address,

            city,

            state,

            pincode

        } = req.body;


        // ======================================
        // VALIDATION
        // ======================================
        if (

            !razorpay_order_id ||

            !razorpay_payment_id ||

            !razorpay_signature

        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid payment payload"
            });
        }


        // ======================================
        // VERIFY SIGNATURE
        // ======================================
        const validSignature =

            verifySignature(

                razorpay_order_id,

                razorpay_payment_id,

                razorpay_signature
            );


        if (!validSignature) {

            console.error(
                "❌ Signature mismatch"
            );

            return res.status(400).json({

                success: false,

                message:
                    "Payment verification failed"
            });
        }


        // ======================================
        // DUPLICATE CHECK
        // ======================================
        // ======================================
// DUPLICATE PAYMENT PROTECTION
// ======================================
const existingOrder =

    await Order.findOne({

        $or: [

            {
                razorpay_payment_id
            },

            {
                razorpay_order_id
            }
        ]
    });


if (existingOrder) {

    console.warn(
        "⚠ Duplicate payment blocked"
    );

    return res.status(409).json({

        success: false,

        message:
            "Payment already processed"
    });
}

        // ======================================
        // USER + CART
        // ======================================
        const userId =
            getUserId(req);


        const cart =
            await findCart(userId);


        if (
            !cart ||
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
    calculateTotal(
        cart.items
    );


// ======================================
// VALIDATE PRODUCT STOCK
// ======================================
for (const item of cart.items) {

    if (!item.product) {

        return res.status(400).json({

            success: false,

            message:
                "Invalid product in cart"
        });
    }

    const product =
        await Product.findById(
            item.product
        );

    if (!product) {

        return res.status(404).json({

            success: false,

            message:
                "Product not found"
        });
    }

    const requestedQty =
        Number(item.quantity || 0);

    const availableStock =
        Number(product.stock || 0);

    if (availableStock < requestedQty) {

        return res.status(400).json({

            success: false,

            message:
                `${product.name} is out of stock`
        });
    }
}

        // ======================================
        // CREATE ORDER
        // ======================================
        const newOrder =
            new Order({

                user:
                    userId,

                userId,

                items:
                    cart.items,

                totalAmount:
                    total,

                finalAmount:
                    total,

                payment:
                    "Razorpay",

                paymentMethod:
                    "RAZORPAY",

                paymentStatus:
                    "SUCCESS",

                paymentId:
                    razorpay_payment_id,

                orderId:
                    razorpay_order_id,

                signature:
                    razorpay_signature,

                razorpay_payment_id,

                razorpay_order_id,

                razorpay_signature,

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

                status:
                    "Pending",

                timeline: [

                    {

                        status:
                            "Pending",

                        message:
                            "Payment verified and order created"
                    }
                ]
            });

await newOrder.save();


// ======================================
// REDUCE PRODUCT STOCK
// ======================================
for (const item of cart.items) {

    if (!item.product) {
        continue;
    }

    await Product.findByIdAndUpdate(

        item.product,

        {
            $inc: {
                stock: -Number(item.quantity || 0)
            }
        }
    );
}


if (DEBUG) {

    console.log(
        "📦 Order Created:",
        newOrder._id
    );
}

        // ======================================
        // CLEAR CART
        // ======================================
        cart.items = [];

        await cart.save();


        return res.json({

            success: true,

            message:
                "Payment successful",

            order:
                newOrder
        });
    })
);

// ======================================
// PAYMENT FAILED
// ======================================
router.post(

    "/failed",

    protect,

    safeAsync(async (
        req,
        res
    ) => {

        const {

            razorpay_order_id,

            reason

        } = req.body;


        console.error(

            "❌ PAYMENT FAILED:",

            {

                razorpay_order_id,

                reason
            }
        );


        return res.status(400).json({

            success: false,

            message:
                "Payment failed",

            reason:
                reason || "Unknown error"
        });
    })
);


// ======================================
// RAZORPAY WEBHOOK
// ======================================
router.post(

    "/webhook",

    express.raw({
        type: "application/json"
    }),

    async (req, res) => {

        try {

            const signature =
                req.headers["x-razorpay-signature"];

            const expectedSignature = crypto
                .createHmac(
                    "sha256",
                    process.env.RAZORPAY_WEBHOOK_SECRET
                )
                .update(req.body)
                .digest("hex");

            if (signature !== expectedSignature) {

                console.error(
                    "❌ Invalid webhook signature"
                );

                return res.status(400).json({
                    success: false
                });
            }

            const event =
                JSON.parse(req.body.toString());

            console.log(
                "📩 Razorpay Webhook:",
                event.event
            );

            if (
    event.event ===
    "payment.captured"
) {

    const paymentEntity =
        event.payload.payment.entity;

    console.log(
        "✅ Payment Captured:",
        paymentEntity.id
    );

    // ======================================
    // FIND EXISTING ORDER
    // ======================================
    const existingOrder =
        await Order.findOne({

            razorpay_payment_id:
                paymentEntity.id
        });

    // ======================================
    // AUTO UPDATE PAYMENT STATUS
    // ======================================
    if (existingOrder) {

        existingOrder.paymentStatus =
            "SUCCESS";

        existingOrder.status =
            "Confirmed";

        existingOrder.timeline.push({

            status:
                "Confirmed",

            message:
                "Payment captured by Razorpay webhook",

            time:
                new Date()
        });

        await existingOrder.save();

        console.log(
            "✅ Order Updated via Webhook"
        );
    }
}

            return res.status(200).json({
                success: true
            });

        } catch (error) {

            console.error(
                "❌ WEBHOOK ERROR:",
                error
            );

            return res.status(500).json({
                success: false
            });
        }
    }
);

// ======================================
// PAYMENT HEALTH CHECK
// ======================================
router.get(
    "/health",
    (req, res) => {

        return res.json({

            success: true,

            service:
                "payment-service"
        });
    }
);


// ======================================
// ERROR HANDLER
// ======================================
router.use(

    (err, req, res, next) => {

        console.error(
            "🚨 PAYMENT ROUTE ERROR:",
            err
        );

        return res.status(500).json({

            success: false,

            message:
                process.env.NODE_ENV ===
                "production"
                    ? "Payment operation failed"
                    : err.message
        });
    }
);


// ======================================
// EXPORT
// ======================================
module.exports = router;