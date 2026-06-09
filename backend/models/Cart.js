const mongoose = require("mongoose");


// ======================================
// SAFE NEXT WRAPPER
// ======================================
function safeNext(next) {

    try {

        if (
            typeof next === "function"
        ) {

            return next();
        }

        console.warn(
            "⚠ next is not a function"
        );

    } catch (err) {

        console.error(
            "❌ safeNext error:",
            err.message
        );
    }
}


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
// CART ITEM SCHEMA
// ======================================
const cartItemSchema =
    new mongoose.Schema(

        {

            productId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref: "Product",

                default: null
            },


            sku: {

                type: String,

                trim: true,

                uppercase: true,

                default: ""
            },


            name: {

                type: String,

                required: true,

                trim: true,

                maxlength: 200
            },


            slug: {

                type: String,

                trim: true,

                lowercase: true,

                default: ""
            },


            price: {

                type: Number,

                required: true,

                min: 0
            },


            originalPrice: {

                type: Number,

                default: 0,

                min: 0
            },


            image: {

                type: String,

                default: ""
            },


            quantity: {

                type: Number,

                default: 1,

                min: 1,

                max: MAX_CART_QTY
            },


            category: {

                type: String,

                trim: true,

                lowercase: true,

                default: ""
            },


            isAvailable: {

                type: Boolean,

                default: true
            }

        },

        {

            _id: false
        }
    );


// ======================================
// MAIN CART SCHEMA
// ======================================
const cartSchema =
    new mongoose.Schema(

        {

            // ======================================
            // USER
            // ======================================
            user: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref: "User"
            },


            userId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref: "User",

                required: true,

                index: true
            },


            // ======================================
            // ITEMS
            // ======================================
            items: {

                type: [
                    cartItemSchema
                ],

                default: []
            },


            // ======================================
            // COUPON SUPPORT
            // ======================================
            couponCode: {

                type: String,

                trim: true,

                uppercase: true,

                default: ""
            },


            discountAmount: {

                type: Number,

                default: 0,

                min: 0
            },


            // ======================================
            // ANALYTICS
            // ======================================
            source: {

                type: String,

                default: "website"
            },


            deviceType: {

                type: String,

                default: "web"
            },


            // ======================================
            // RECOVERY AUTOMATION
            // ======================================
            abandonedCartEmailSent: {

                type: Boolean,

                default: false
            },


            abandonedCartWhatsappSent: {

                type: Boolean,

                default: false
            },


            lastActivityAt: {

                type: Date,

                default: Date.now
            }

        },

        {

            timestamps: true,

            versionKey: false
        }
    );


// ======================================
// SAFE JSON OUTPUT
// ======================================
cartSchema.set(

    "toJSON",

    {

        virtuals: true,

        transform: function (
            doc,
            ret
        ) {

            try {

                delete ret.__v;

            } catch (e) {}

            return ret;
        }
    }
);


// ======================================
// PRE VALIDATE
// ======================================
cartSchema.pre(

    "validate",

    function (next) {

        try {

            if (
                this.items &&
                Array.isArray(
                    this.items
                )
            ) {

                this.items =
                    this.items.map(
                        item => ({

                            ...item,

                            name:
                                typeof item.name ===
                                "string"
                                    ? item.name.trim()
                                    : "Unknown Product",

                            price:
                                typeof item.price ===
                                    "number" &&
                                item.price >= 0
                                    ? item.price
                                    : 0,

                            quantity:
                                typeof item.quantity ===
                                    "number" &&
                                item.quantity > 0
                                    ? Math.min(
                                        item.quantity,
                                        MAX_CART_QTY
                                    )
                                    : 1
                        })
                    );
            }

        } catch (err) {

            console.error(
                "❌ PRE VALIDATE ERROR:",
                err.message
            );
        }

        safeNext(next);
    }
);


// ======================================
// PRE SAVE
// ======================================
cartSchema.pre(

    "save",

    function (next) {

        try {

            if (DEBUG) {

                console.log(
                    "🧠 CART PRE SAVE"
                );
            }


            // ======================================
            // BACKWARD COMPATIBILITY
            // ======================================
            if (
                !this.user &&
                this.userId
            ) {

                this.user =
                    this.userId;
            }


            // ======================================
            // LAST ACTIVITY
            // ======================================
            this.lastActivityAt =
                new Date();


            // ======================================
            // SAFE ITEM FIXES
            // ======================================
            if (
                this.items &&
                Array.isArray(
                    this.items
                )
            ) {

                this.items.forEach(
                    item => {

                        if (
                            !item.quantity ||
                            item.quantity < 1
                        ) {

                            item.quantity = 1;
                        }


                        if (
                            item.quantity >
                            MAX_CART_QTY
                        ) {

                            item.quantity =
                                MAX_CART_QTY;
                        }


                        if (
                            !item.price ||
                            item.price < 0
                        ) {

                            item.price = 0;
                        }


                        if (
                            !item.name
                        ) {

                            item.name =
                                "Unknown Product";
                        }
                    }
                );
            }


            // ======================================
            // AUTO CLEAN
            // ======================================
            this.ensureValidItems();

            this.mergeDuplicateItems();

        } catch (err) {

            console.error(
                "❌ CART PRE SAVE ERROR:",
                err.message
            );
        }

        safeNext(next);
    }
);


// ======================================
// REMOVE INVALID ITEMS
// ======================================
cartSchema.methods
    .ensureValidItems =
    function () {

        try {

            this.items =
                this.items.filter(

                    item =>

                        item.name &&

                        item.price >= 0 &&

                        item.quantity > 0
                );

        } catch (err) {

            console.error(
                "❌ VALID ITEM FILTER ERROR:",
                err.message
            );
        }
    };


// ======================================
// MERGE DUPLICATES
// ======================================
cartSchema.methods
    .mergeDuplicateItems =
    function () {

        try {

            const map =
                new Map();


            this.items.forEach(
                item => {

                    const key =

                        String(
                            item.productId ||
                            item.name
                        );


                    if (
                        map.has(key)
                    ) {

                        const existing =
                            map.get(key);

                        existing.quantity =
                            Math.min(

                                MAX_CART_QTY,

                                existing.quantity +
                                item.quantity
                            );

                    } else {

                        map.set(

                            key,

                            item.toObject
                                ? item.toObject()
                                : item
                        );
                    }
                }
            );


            this.items =
                Array.from(
                    map.values()
                );

        } catch (err) {

            console.error(
                "❌ DUPLICATE MERGE ERROR:",
                err.message
            );
        }
    };


// ======================================
// CALCULATE TOTAL
// ======================================
cartSchema.methods
    .calculateTotal =
    function () {

        return this.items.reduce(

            (acc, item) => {

                return (
                    acc +

                    (
                        item.price *
                        item.quantity
                    )
                );

            },

            0
        );
    };


// ======================================
// SAFE TOTAL
// ======================================
cartSchema.methods
    .getSafeTotal =
    function () {

        try {

            const subtotal =
                this.calculateTotal();

            return Math.max(

                0,

                subtotal -
                (
                    this.discountAmount ||
                    0
                )
            );

        } catch (err) {

            console.error(
                "❌ TOTAL ERROR:",
                err.message
            );

            return 0;
        }
    };


// ======================================
// ADD ITEM
// ======================================
cartSchema.methods
    .addItem =
    function (newItem) {

        try {

            if (!newItem) {
                return this;
            }


            const productId =

                String(

                    newItem.productId ||
                    newItem.name
                );


            const existing =
                this.items.find(

                    item =>

                        String(
                            item.productId
                        ) === productId
                );


            if (existing) {

                existing.quantity =
                    Math.min(

                        MAX_CART_QTY,

                        existing.quantity +

                        Number(
                            newItem.quantity ||
                            1
                        )
                    );

            } else {

                this.items.push({

                    productId:
                        newItem.productId || null,

                    sku:
                        String(
                            newItem.sku || ""
                        ),

                    name:
                        String(
                            newItem.name ||
                            "Unknown Product"
                        ),

                    slug:
                        String(
                            newItem.slug || ""
                        ),

                    price:
                        Number(
                            newItem.price || 0
                        ),

                    originalPrice:
                        Number(
                            newItem.originalPrice || 0
                        ),

                    image:
                        String(
                            newItem.image || ""
                        ),

                    quantity:
                        Math.min(

                            MAX_CART_QTY,

                            Number(
                                newItem.quantity || 1
                            )
                        ),

                    category:
                        String(
                            newItem.category || ""
                        ),

                    isAvailable:
                        true
                });
            }


            this.markModified(
                "items"
            );

            return this;

        } catch (err) {

            console.error(
                "❌ ADD ITEM ERROR:",
                err
            );

            return this;
        }
    };


// ======================================
// UPDATE QUANTITY
// ======================================
cartSchema.methods
    .updateQuantity =
    function (
        productId,
        quantity
    ) {

        try {

            const item =
                this.items.find(

                    i =>

                        String(
                            i.productId
                        ) ===
                        String(productId)
                );


            if (!item) {
                return this;
            }


            item.quantity =
                Math.min(

                    MAX_CART_QTY,

                    quantity < 1
                        ? 1
                        : Number(quantity)
                );


            this.markModified(
                "items"
            );

            return this;

        } catch (err) {

            console.error(
                "❌ UPDATE QUANTITY ERROR:",
                err
            );

            return this;
        }
    };


// ======================================
// REMOVE ITEM
// ======================================
cartSchema.methods
    .removeItem =
    function (productId) {

        try {

            this.items =
                this.items.filter(

                    i =>

                        String(
                            i.productId
                        ) !==
                        String(productId)
                );


            this.markModified(
                "items"
            );

            return this;

        } catch (err) {

            console.error(
                "❌ REMOVE ITEM ERROR:",
                err
            );

            return this;
        }
    };


// ======================================
// CLEAR CART
// ======================================
cartSchema.methods
    .clearCart =
    function () {

        try {

            this.items = [];

            this.discountAmount = 0;

            this.couponCode = "";

            this.markModified(
                "items"
            );

            return this;

        } catch (err) {

            console.error(
                "❌ CLEAR CART ERROR:",
                err
            );

            return this;
        }
    };


// ======================================
// FIND OR CREATE
// ======================================
cartSchema.statics
    .findOrCreateCart =
    async function (userId) {

        let cart =
            await this.findOne({
                userId
            });


        if (!cart) {

            cart =
                await this.create({

                    userId,

                    user: userId,

                    items: []
                });
        }

        return cart;
    };


// ======================================
// SAFE FIND
// ======================================
cartSchema.statics
    .safeFindByUser =
    async function (userId) {

        try {

            return await this
                .findOrCreateCart(
                    userId
                );

        } catch (err) {

            console.error(
                "❌ SAFE FIND ERROR:",
                err.message
            );

            return null;
        }
    };


// ======================================
// SAFE OBJECT
// ======================================
cartSchema.methods
    .toSafeObject =
    function () {

        try {

            return this.toObject({

                virtuals: true
            });

        } catch (err) {

            console.error(
                "❌ TO OBJECT ERROR:",
                err.message
            );

            return {};
        }
    };


// ======================================
// SAFE SAVE
// ======================================
cartSchema.methods
    .safeSave =
    async function () {

        try {

            return await this.save();

        } catch (err) {

            console.error(
                "❌ SAFE SAVE ERROR:",
                err.message
            );

            return null;
        }
    };


// ======================================
// VIRTUAL TOTAL
// ======================================
cartSchema.virtual(
    "total"
).get(function () {

    return this.getSafeTotal();
});


// ======================================
// INDEXES
// ======================================
cartSchema.index({
    userId: 1
});

cartSchema.index({
    user: 1
});

cartSchema.index({
    "items.productId": 1
});

cartSchema.index({
    updatedAt: -1
});

cartSchema.index({
    abandonedCartEmailSent: 1
});

cartSchema.index({
    abandonedCartWhatsappSent: 1
});


// ======================================
// POST SAVE LOG
// ======================================
cartSchema.post(
    "save",
    function (doc) {

        console.log(
            "🛒 Cart saved:",
            doc._id
        );
    }
);


// ======================================
// POST UPDATE LOG
// ======================================
cartSchema.post(
    "findOneAndUpdate",
    function (doc) {

        console.log(
            "🛠 Cart updated:",
            doc?._id
        );
    }
);


// ======================================
// EXPORT
// ======================================
module.exports =
    mongoose.model(
        "Cart",
        cartSchema
    );

