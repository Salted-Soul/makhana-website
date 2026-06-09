const mongoose = require("mongoose");


// ======================================
// ORDER TIMELINE SCHEMA
// ======================================
const orderTimelineSchema =
    new mongoose.Schema(

        {

            status: {

                type: String,

                required: true,

                trim: true
            },

            message: {

                type: String,

                default: "",

                trim: true
            },

            createdAt: {

                type: Date,

                default: Date.now
            }

        },

        {

            _id: false
        }
    );


// ======================================
// ORDER ITEM SCHEMA
// ======================================
const orderItemSchema =
    new mongoose.Schema(

        {

            productId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref: "Product",

                default: null
            },

            name: {

                type: String,

                required: true,

                trim: true
            },

            price: {

                type: Number,

                required: true,

                min: 0
            },

            quantity: {

                type: Number,

                required: true,

                min: 1,

                validate: {

                    validator: Number.isInteger,

                    message:
                        "Quantity must be an integer"
                }
            },

            image: {

                type: String,

                default: ""
            }

        },

        {

            _id: false
        }
    );


// ======================================
// MAIN ORDER SCHEMA
// ======================================
const orderSchema =
    new mongoose.Schema(

        {

            // ======================================
            // USER
            // ======================================
            user: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref: "User",

                required: true,

                index: true
            },

            // ======================================
            // ORDER NUMBER
            // ======================================
            orderNumber: {

                type: String,

                unique: true,

                index: true
            },


            // BACKWARD COMPATIBILITY
            userId: {

                type:
                    mongoose.Schema.Types.ObjectId,

                ref: "User",

                index: true
            },


            // ======================================
            // ITEMS
            // ======================================
            items: {

                type: [orderItemSchema],

                validate: {

                    validator: function (
                        items
                    ) {

                        return (
                            Array.isArray(items) &&
                            items.length > 0
                        );
                    },

                    message:
                        "Order must contain at least one item"
                }
            },


            // ======================================
            // TOTALS
            // ======================================
            totalAmount: {

                type: Number,

                required: true,

                min: 0,

                default: 0
            },


            // BACKWARD COMPATIBILITY
            total: {

                type: Number,

                default: 0
            },


            shippingCharge: {

                type: Number,

                default: 0,

                min: 0
            },


            taxAmount: {

                type: Number,

                default: 0,

                min: 0
            },


            discountAmount: {

                type: Number,

                default: 0,

                min: 0
            },


            finalAmount: {

                type: Number,

                default: 0,

                min: 0
            },


            // ======================================
            // CUSTOMER DETAILS
            // ======================================
            name: {

                type: String,

                trim: true,

                default: ""
            },


            phone: {

                type: String,

                trim: true,

                index: true,

                default: ""
            },


            email: {

                type: String,

                trim: true,

                lowercase: true,

                default: ""
            },


            address: {

                type: String,

                trim: true,

                default: ""
            },


            city: {

                type: String,

                trim: true,

                default: ""
            },


            state: {

                type: String,

                trim: true,

                default: ""
            },


            country: {

                type: String,

                trim: true,

                default: "India"
            },


            pincode: {

                type: String,

                trim: true,

                default: ""
            },


            // ======================================
            // PAYMENT
            // ======================================
            payment: {

                type: String,

                enum: [
                    "COD",
                    "Razorpay",
                    "WhatsApp"
                ],

                default: "Razorpay",

                index: true
            },


            paymentMethod: {

                type: String,

                enum: [
                    "COD",
                    "ONLINE",
                    "UPI",
                    "RAZORPAY",
                    "WHATSAPP"
                ],

                default: "COD",

                index: true
            },


            paymentStatus: {

                type: String,

                enum: [
                    "PENDING",
                    "PAID",
                    "FAILED",
                    "REFUNDED"
                ],

                default: "PENDING",

                index: true
            },

            // ======================================
            // PAYMENT VERIFICATION
            // ======================================
            isPaymentVerified: {

                type: Boolean,

                default: false,

                index: true
            },


            transactionId: {

                type: String,

                sparse: true,

                index: true
            },


            // ======================================
            // RAZORPAY
            // ======================================
            paymentId: String,

            orderId: String,

            signature: String,


            razorpay_payment_id: {

                type: String,

                sparse: true,

                index: true
            },


            razorpay_order_id: {

                type: String,

                sparse: true,

                index: true
            },


            razorpay_signature: {

                type: String,

                default: ""
            },


            // ======================================
            // REFUNDS
            // ======================================
            refundId: {

                type: String,

                default: ""
            },


            refundedAt: {

                type: Date,

                default: null
            },


            refundReason: {

                type: String,

                default: ""
            },


            // ======================================
            // SHIPPING
            // ======================================
            trackingId: {

                type: String,

                default: "",

                sparse: true
            },


            courierPartner: {

                type: String,

                default: ""
            },


            estimatedDelivery: {

                type: Date,

                default: null
            },


            deliveredAt: {

                type: Date,

                default: null
            },


            // ======================================
            // WHATSAPP
            // ======================================
            whatsappMessageId: {

                type: String,

                default: "",

                sparse: true
            },


            whatsappStatus: {

                type: String,

                enum: [
                    "NOT_SENT",
                    "SENT",
                    "DELIVERED",
                    "READ",
                    "FAILED"
                ],

                default: "NOT_SENT",

                index: true
            },


            botSessionId: {

                type: String,

                default: "",

                sparse: true,

                index: true
            },


            // ======================================
            // ORDER STATUS
            // ======================================
            status: {

                type: String,

                enum: [
                    "Pending",
                    "Confirmed",
                    "Processing",
                    "Packed",
                    "Shipped",
                    "Out For Delivery",
                    "Delivered",
                    "Cancelled",
                    "Refunded"
                ],

                default: "Pending",

                index: true
            },


            // ======================================
            // OTP DELIVERY
            // ======================================
            otp: {

                type: String,

                default: ""
            },


            otpExpiry: {

                type: Date,

                default: null
            },


            otpVerified: {

                type: Boolean,

                default: false
            },


            // ======================================
            // INVOICE
            // ======================================
            invoiceUrl: {

                type: String,

                default: ""
            },


            invoiceNumber: {

                type: String,

                default: ""
            },


            // ======================================
            // TIMELINE
            // ======================================
            timeline: {

                type: [
                    orderTimelineSchema
                ],

                default: []
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
            // FLAGS
            // ======================================
            isWhatsAppOrder: {

                type: Boolean,

                default: false,

                index: true
            },


            isArchived: {

                type: Boolean,

                default: false
            }

        },

        {

            timestamps: true,

            versionKey: false
        }
    );


// ======================================
// PRE SAVE HOOK
// ======================================
orderSchema.pre(

    "save",

    async function (next){

        try {

            // ======================================
            // BACKWARD COMPATIBILITY
            // ======================================
            if (
                !this.totalAmount &&
                this.total
            ) {

                this.totalAmount =
                    this.total;
            }


            if (
                !this.total &&
                this.totalAmount
            ) {

                this.total =
                    this.totalAmount;
            }


            if (
                !this.userId &&
                this.user
            ) {

                this.userId =
                    this.user;
            }

            // ======================================
            // ORDER NUMBER GENERATION
            // ======================================
            if (!this.orderNumber) {

                this.orderNumber =

                    `ORD-${Date.now()}-${Math.floor(

                        1000 + Math.random() * 9000
                    )}`;
            }


            // ======================================
            // FINAL AMOUNT
            // ======================================
            this.finalAmount = Number(

                (

                    (
                        this.totalAmount || 0
                    ) +

                    (
                        this.shippingCharge || 0
                    ) +

                    (
                        this.taxAmount || 0
                    ) -

                    (
                        this.discountAmount || 0
                    )

                ).toFixed(2)
            );

            // ======================================
            // TIMELINE INIT
            // ======================================
            if (
                !Array.isArray(
                    this.timeline
                )
            ) {

                this.timeline = [];
            }


            // ======================================
            // STATUS TRACKING
            // ======================================
            const latestTimelineEntry =

                this.timeline[
                this.timeline.length - 1
                ];


            const exists =

                latestTimelineEntry &&

                latestTimelineEntry.status ===
                this.status;

            if (!exists) {

                this.timeline.push({

                    status:
                        this.status ||
                        "Pending",

                    message:
                        `Order status updated to ${this.status || "Pending"}`
                });
            }
// ======================================
// PHONE NORMALIZATION
// ======================================
if (this.phone) {

    this.phone =

        String(this.phone)

            .replace(/\s+/g, "")

            .trim();
}

            // ======================================
            // DELIVERY TRACKING
            // ======================================
            if (
                this.status ===
                "Delivered" &&
                !this.deliveredAt
            ) {

                this.deliveredAt =
                    new Date();
            }
next();
        } catch (err) {

            console.error(
                "❌ ORDER PRE SAVE ERROR:",
                err
            );

            next(err);
        }
    }
);


// ======================================
// SAFE JSON OUTPUT
// ======================================
orderSchema.methods.toJSON =
    function () {

        const obj =
            this.toObject();

        obj.totalAmount =
            obj.totalAmount ||
            obj.total ||
            0;

        obj.finalAmount =
            obj.finalAmount ||
            obj.totalAmount;

        obj.status =
            obj.status ||
            "Pending";

        obj.paymentStatus =
            obj.paymentStatus ||
            "PENDING";

        obj.paymentMethod =
            obj.paymentMethod ||
            "COD";

        return obj;
    };


// ======================================
// INDEXES
// ======================================
orderSchema.index({
    createdAt: -1
});

orderSchema.index({
    status: 1
});

orderSchema.index({
    paymentStatus: 1
});

orderSchema.index({
    phone: 1
});

orderSchema.index({
    user: 1,
    createdAt: -1
});

orderSchema.index({
    whatsappStatus: 1,
    createdAt: -1
});

orderSchema.index({
    razorpay_payment_id: 1
});

orderSchema.index({
    trackingId: 1
});

orderSchema.index({
    isArchived: 1
});


// ======================================
// EXPORT
// ======================================
module.exports =
    mongoose.model(
        "Order",
        orderSchema
    );