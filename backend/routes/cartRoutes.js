const express = require("express");

const mongoose = require("mongoose");

const Cart = require("../models/Cart");

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
// CONSTANTS
// ======================================
const MAX_CART_QTY = 20;


// ======================================
// HELPERS
// ======================================
const getUserId = (
    req
) => {

    return (

        req.user?._id ||

        req.userId ||

        req.body.userId ||

        req.params.userId
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


const sanitizeItem = (
    data
) => ({

    productId:
        sanitizeString(
            data.productId ||
            data.name
        ),

    name:
        sanitizeString(data.name),

    image:
        sanitizeString(data.image),

    price:
        Number(data.price || 0),

    quantity:
        Math.min(

            MAX_CART_QTY,

            Math.max(
                1,
                Number(data.quantity || 1)
            )
        )
});


const calculateTotal = (
    items = []
) => {

    return items.reduce(

        (acc, item) => {

            const qty =
                Number(item.quantity) || 0;

            const price =
                Number(item.price) || 0;

            return acc + (
                qty * price
            );

        },

        0
    );
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
                "❌ CART ROUTE ERROR:",
                err
            );

            next(err);
        }
    };
};


// ======================================
// FIND CART
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
// ENSURE CART
// ======================================
const ensureCart = async (
    userId
) => {

    let cart =
        await findCart(userId);


    if (!cart) {

        cart = new Cart({

            user: userId,

            userId,

            items: []
        });

        await cart.save();

        console.log(
            "🆕 Cart created"
        );
    }

    return cart;
};


// ======================================
// VALIDATE USER
// ======================================
const validateUser = (
    userId,
    res
) => {

    if (!userId) {

        res.status(401).json({

            success: false,

            message:
                "Authentication required"
        });

        return false;
    }

    return true;
};


// ======================================
// FORMAT RESPONSE
// ======================================
const formatCart = (
    cart
) => {

    return {

        ...cart.toObject({
            virtuals: true
        }),

        total:
            calculateTotal(
                cart.items
            ),

        itemCount:
            cart.items.reduce(

                (acc, item) =>

                    acc +
                    item.quantity,

                0
            )
    };
};


// ======================================
// LOGGER
// ======================================
router.use(
    (req, res, next) => {

        if (DEBUG) {

            console.log(

                "🛰 CART:",

                req.method,

                req.originalUrl
            );
        }

        next();
    }
);


// ======================================
// HEALTH CHECK
// ======================================
router.get(
    "/health/check",
    (req, res) => {

        return res.json({

            success: true,

            service:
                "cart-service"
        });
    }
);


// ======================================
// GET CART COUNT
// ======================================
router.get(

    "/count/:userId",

    protect,

    safeAsync(async (
        req,
        res
    ) => {

        const userId =
            getUserId(req);


        if (
            !validateUser(
                userId,
                res
            )
        ) return;


        const cart =
            await ensureCart(userId);


        const count = cart.items.length;


        return res.json({

            success: true,

            count
        });
    })
);


// ======================================
// GET USER CART
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


        if (
            !validateUser(
                userId,
                res
            )
        ) return;


        const cart =
            await ensureCart(userId);


        return res.json({

            success: true,

            cart:
                formatCart(cart),

            items:
                cart.items,

            total:
                calculateTotal(
                    cart.items
                )
        });
    })
);


// ======================================
// ADD TO CART
// ======================================
router.post(

    "/add",

    protect,

    safeAsync(async (
        req,
        res
    ) => {

        const userId =
            getUserId(req);


        if (
            !validateUser(
                userId,
                res
            )
        ) return;


        const item =
            sanitizeItem(
                req.body
            );


        if (
            !item.name ||
            item.price < 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid product"
            });
        }


        const cart =
            await ensureCart(userId);


        const existingItem =
            cart.items.find(

                i =>

                    String(i.productId) ===

                    String(item.productId)
            );


        if (existingItem) {

            existingItem.quantity =
                Math.min(

                    MAX_CART_QTY,

                    existingItem.quantity +
                    item.quantity
                );

        } else {

            cart.items.push(item);
        }


        cart.markModified(
            "items"
        );

        await cart.save();


        return res.json({

            success: true,

            message:
                "Item added",

            cart:
                formatCart(cart)
        });
    })
);


// ======================================
// UPDATE CART
// ======================================
router.post(

    "/update",

    protect,

    safeAsync(async (
        req,
        res
    ) => {

        const userId =
            getUserId(req);


        if (
            !validateUser(
                userId,
                res
            )
        ) return;


        const {

            productId,

            action,

            quantity,

            forceRemove

        } = req.body;


        const cart =
            await ensureCart(userId);


        const item =
            cart.items.find(

                i =>

                    String(i.productId) ===

                    String(productId)
            );


        if (!item) {

            return res.status(404).json({

                success: false,

                message:
                    "Item not found"
            });
        }


        // FORCE REMOVE
        if (forceRemove) {

            cart.items =
                cart.items.filter(

                    i =>

                        String(i.productId) !==

                        String(productId)
                );
        }


        // DIRECT QUANTITY
        else if (
            quantity !== undefined
        ) {

            item.quantity =
                Math.min(

                    MAX_CART_QTY,

                    Math.max(
                        1,
                        Number(quantity)
                    )
                );
        }


        // INCREASE
        else if (
            action === "increase"
        ) {

            item.quantity =
                Math.min(

                    MAX_CART_QTY,

                    item.quantity + 1
                );
        }


        // DECREASE
        else if (
            action === "decrease"
        ) {

            item.quantity -= 1;

            if (
                item.quantity <= 0
            ) {

                cart.items =
                    cart.items.filter(

                        i =>

                            String(i.productId) !==

                            String(productId)
                    );
            }
        }


        cart.markModified(
            "items"
        );

        await cart.save();


        return res.json({

            success: true,

            message:
                "Cart updated",

            cart:
                formatCart(cart)
        });
    })
);


// ======================================
// REMOVE ITEM
// ======================================
router.post(

    "/remove",

    protect,

    safeAsync(async (
        req,
        res
    ) => {

        const userId =
            getUserId(req);


        if (
            !validateUser(
                userId,
                res
            )
        ) return;


        const {
            productId
        } = req.body;


        const cart =
            await ensureCart(userId);


        cart.items =
            cart.items.filter(

                item =>

                    String(item.productId) !==

                    String(productId)
            );


        cart.markModified(
            "items"
        );

        await cart.save();


        return res.json({

            success: true,

            message:
                "Item removed",

            cart:
                formatCart(cart)
        });
    })
);


// ======================================
// CLEAR CART
// ======================================
router.post(

    "/clear",

    protect,

    safeAsync(async (
        req,
        res
    ) => {

        const userId =
            getUserId(req);


        if (
            !validateUser(
                userId,
                res
            )
        ) return;


        const cart =
            await ensureCart(userId);


        cart.items = [];

        cart.markModified(
            "items"
        );

        await cart.save();


        return res.json({

            success: true,

            message:
                "Cart cleared",

            cart:
                formatCart(cart)
        });
    })
);


// ======================================
// ERROR HANDLER
// ======================================
router.use(

    (err, req, res, next) => {

        console.error(
            "🚨 CART ERROR:",
            err
        );

        return res.status(500).json({

            success: false,

            message:
                process.env.NODE_ENV ===
                "production"
                    ? "Cart operation failed"
                    : err.message
        });
    }
);


// ======================================
// EXPORT
// ======================================
module.exports = router;