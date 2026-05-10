const mongoose = require("mongoose");

const orderTimelineSchema = new mongoose.Schema({
    status: {
        type: String,
        required: true
    },
    message: {
        type: String,
        default: ""
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });


// ===============================
// MAIN ORDER SCHEMA
// ===============================
const orderSchema = new mongoose.Schema({

    // ===========================
    // USER
    // ===========================
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    // backward compatibility
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true
    },


    // ===========================
    // ORDER ITEMS
    // ===========================
    items: [
        {
            name: {
                type: String,
                required: true
            },

            price: {
                type: Number,
                required: true,
                min: 0
            },

            quantity: {
                type: Number,
                required: true,
                min: 1
            },

            image: {
                type: String,
                default: ""
            }
        }
    ],


    // ===========================
    // TOTALS
    // ===========================
    totalAmount: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },

    // backward compatibility
    total: {
        type: Number,
        default: 0
    },


    // ===========================
    // CUSTOMER DETAILS
    // ===========================
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

    pincode: {
        type: String,
        trim: true,
        default: ""
    },


    // ===========================
    // PAYMENT
    // ===========================
    payment: {
        type: String,
        enum: ["COD", "Razorpay", "WhatsApp"],
        default: "Razorpay",
        index: true
    },

    paymentMethod: {
        type: String,
        enum: ["COD", "ONLINE", "UPI", "RAZORPAY", "WHATSAPP"],
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

    transactionId: {
        type: String,
        index: true,
        sparse: true
    },


    // ===========================
    // RAZORPAY
    // ===========================
    paymentId: String,
    orderId: String,
    signature: String,

    razorpay_payment_id: {
        type: String,
        index: true,
        sparse: true
    },

    razorpay_order_id: {
        type: String,
        index: true,
        sparse: true
    },


    // ===========================
    // WHATSAPP
    // ===========================
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
        index: true,
        sparse: true
    },


    // ===========================
    // ORDER STATUS
    // ===========================
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
            "Cancelled"
        ],
        default: "Pending",
        index: true
    },


    // ===========================
    // OTP SYSTEM
    // ===========================
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


    // ===========================
    // INVOICE
    // ===========================
    invoiceUrl: {
        type: String,
        default: ""
    },


    // ===========================
    // TIMELINE
    // ===========================
    timeline: {
        type: [orderTimelineSchema],
        default: []
    },


    // ===========================
    // FLAGS
    // ===========================
    isWhatsAppOrder: {
        type: Boolean,
        default: false,
        index: true
    },

    isArchived: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});


// ===============================
// SAFE MODERN PRE SAVE HOOK
// ===============================
orderSchema.pre("save", async function () {

    try {

        // =========================
        // BACKWARD COMPATIBILITY
        // =========================
        if (!this.totalAmount && this.total) {
            this.totalAmount = this.total;
        }

        if (!this.total && this.totalAmount) {
            this.total = this.totalAmount;
        }

        if (!this.userId && this.user) {
            this.userId = this.user;
        }

        // =========================
        // SAFE TIMELINE INIT
        // =========================
        if (!Array.isArray(this.timeline)) {
            this.timeline = [];
        }

        // =========================
        // SAFE STATUS TRACKING
        // =========================
        const exists = this.timeline.some(
            item => item.status === this.status
        );

        if (!exists) {

            this.timeline.push({
                status: this.status || "Pending",
                message: `Order status updated to ${this.status || "Pending"}`
            });
        }

    } catch (err) {

        console.error(
            "ORDER PRE SAVE ERROR:",
            err
        );

        throw err;
    }
});

// ===============================
// SAFE JSON OUTPUT
// ===============================
orderSchema.methods.toJSON = function () {

    const obj = this.toObject();

    obj.totalAmount = obj.totalAmount || obj.total || 0;

    obj.status = obj.status || "Pending";

    obj.paymentStatus = obj.paymentStatus || "PENDING";

    obj.paymentMethod = obj.paymentMethod || "COD";

    return obj;
};


// ===============================
// INDEXES
// ===============================
orderSchema.index({ createdAt: -1 });

orderSchema.index({ status: 1 });

orderSchema.index({ paymentStatus: 1 });

orderSchema.index({ phone: 1 });

orderSchema.index({ user: 1, createdAt: -1 });

orderSchema.index({
    whatsappStatus: 1,
    createdAt: -1
});


// ===============================
// EXPORT
// ===============================
module.exports = mongoose.model("Order", orderSchema);  