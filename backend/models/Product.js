const mongoose = require("mongoose");


// ======================================
// REVIEW SCHEMA
// ======================================
const reviewSchema = new mongoose.Schema(

    {

        user: {

            type: mongoose.Schema.Types.ObjectId,

            ref: "User",

            required: true
        },

        name: {

            type: String,

            required: true,

            trim: true
        },

        rating: {

            type: Number,

            required: true,

            min: 1,

            max: 5
        },

        comment: {

            type: String,

            trim: true,

            maxlength: 1000
        }

    },

    {

        timestamps: true,

        _id: true
    }
);


// ======================================
// PRODUCT SCHEMA
// ======================================
const productSchema = new mongoose.Schema(

    {

        // ======================================
        // BASIC INFO
        // ======================================
        name: {

            type: String,

            required: [
                true,
                "Product name is required"
            ],

            trim: true,

            maxlength: 200
        },


        slug: {

            type: String,

            unique: true,

            lowercase: true,

            trim: true
        },


        description: {

            type: String,

            required: true,

            trim: true,

            maxlength: 5000
        },


        shortDescription: {

            type: String,

            trim: true,

            maxlength: 300,

            default: ""
        },


        // ======================================
        // CATEGORY
        // ======================================
        category: {

            type: String,

            required: true,

            trim: true,

            lowercase: true
        },


        tags: [

            {
                type: String,
                trim: true,
                lowercase: true
            }
        ],


        // ======================================
        // PRICING
        // ======================================
        price: {

    type: Number,

    required: true,

    min: 0,

    set: (value) =>

        Number(
            Number(value).toFixed(2)
        )
},


        originalPrice: {

    type: Number,

    min: 0,

    default: 0,

    set: (value) =>

        Number(
            Number(value).toFixed(2)
        )
},


        discountPercentage: {

            type: Number,

            default: 0,

            min: 0,

            max: 100
        },


        // ======================================
        // INVENTORY
        // ======================================
        stock: {

    type: Number,

    required: true,

    default: 0,

    min: 0,

    validate: {

        validator: Number.isInteger,

        message:
            "Stock must be an integer"
    }
},


        sku: {

            type: String,

            trim: true,

            uppercase: true,

            unique: true,

            sparse: true
        },


        // ======================================
        // PRODUCT IMAGES
        // ======================================
        images: [

            {
                type: String
            }
        ],


        thumbnail: {

            type: String,

            default: ""
        },


        // ======================================
        // RATINGS
        // ======================================
        rating: {

            type: Number,

            default: 0,

            min: 0,

            max: 5
        },


        numReviews: {

            type: Number,

            default: 0
        },


        reviews: [reviewSchema],


        // ======================================
        // SALES ANALYTICS
        // ======================================
        // ======================================
// LOW STOCK ALERT
// ======================================
lowStockThreshold: {

    type: Number,

    default: 5,

    min: 0
},


        viewCount: {

            type: Number,

            default: 0
        },


        // ======================================
        // PRODUCT STATUS
        // ======================================
        isFeatured: {

            type: Boolean,

            default: false
        },


        isTrending: {

            type: Boolean,

            default: false
        },


        isActive: {

            type: Boolean,

            default: true
        },


        // ======================================
        // SEO
        // ======================================
        metaTitle: {

            type: String,

            trim: true,

            maxlength: 100
        },


        metaDescription: {

            type: String,

            trim: true,

            maxlength: 300
        }

    },

    {

        timestamps: true,

        versionKey: false
    }
);


// ======================================
// INDEXES
// ======================================
productSchema.index({

    name: "text",

    description: "text",

    tags: "text"
});

productSchema.index({
    category: 1
});

productSchema.index({
    price: 1
});

productSchema.index({
    rating: -1
});

productSchema.index({
    soldCount: -1
});

productSchema.index({
    createdAt: -1
});


// ======================================
// AUTO GENERATE SLUG
// ======================================
productSchema.pre(
    "save",
    function (next) {

        if (
            this.isModified("name")
        ) {

            const baseSlug = this.name

    .toLowerCase()

    .trim()

    .replace(/[^a-z0-9]+/g, "-")

    .replace(/(^-|-$)/g, "");


this.slug = `${baseSlug}-${Date.now()}`;
        }

        next();
    }
);


// ======================================
// SAFE JSON RESPONSE
// ======================================


// ======================================
// PREVENT DUPLICATE REVIEWS
// ======================================
productSchema.methods.hasUserReviewed =
    function (userId) {

        return this.reviews.some(

            (review) =>

                String(review.user) ===
                String(userId)
        );
    };


productSchema.methods.toJSON =
    function () {

        const obj =
            this.toObject();

        return obj;
    };


// ======================================
// MODEL EXPORT
// ======================================
module.exports = mongoose.model(
    "Product",
    productSchema
);