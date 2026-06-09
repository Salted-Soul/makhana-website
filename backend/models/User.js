const mongoose = require("mongoose");


// ======================================
// ADDRESS SUBSCHEMA
// ======================================
const addressSchema = new mongoose.Schema(

    {

        fullName: {
            type: String,
            trim: true,
            maxlength: 100
        },

        phone: {
            type: String,
            trim: true,
            maxlength: 20
        },

        addressLine1: {
            type: String,
            trim: true,
            maxlength: 200
        },

        addressLine2: {
            type: String,
            trim: true,
            maxlength: 200
        },

        city: {
            type: String,
            trim: true,
            maxlength: 100
        },

        state: {
            type: String,
            trim: true,
            maxlength: 100
        },

        postalCode: {
            type: String,
            trim: true,
            maxlength: 20
        },

        country: {
            type: String,
            trim: true,
            default: "India"
        },

        isDefault: {
            type: Boolean,
            default: false
        }

    },

    {

        _id: false
    }
);


// ======================================
// USER SCHEMA
// ======================================
const userSchema = new mongoose.Schema(

    {

        // ======================================
        // BASIC INFO
        // ======================================
        name: {

            type: String,

            required: [
                true,
                "Name is required"
            ],

            trim: true,

            minlength: 2,

            maxlength: 50
        },


        email: {

            type: String,

            required: [
                true,
                "Email is required"
            ],

            unique: true,

            lowercase: true,

            trim: true,

            index: true,

            match: [

                /^\S+@\S+\.\S+$/,

                "Please use a valid email address"
            ]
        },


        password: {

            type: String,

            required: function () {

                return !this.googleId;
            },

            minlength: 8,

            select: false
        },


        // ======================================
        // ROLE SYSTEM
        // ======================================
        role: {

            type: String,

            enum: [
                "user",
                "admin"
            ],

            default: "user",

            index: true
        },


        // ======================================
        // ACCOUNT STATUS
        // ======================================
        accountStatus: {

            type: String,

            enum: [
                "active",
                "blocked",
                "suspended"
            ],

            default: "active",

            index: true
        },


        // ======================================
        // PROFILE IMAGE
        // ======================================
        avatar: {

            type: String,

            default: ""
        },


        // ======================================
        // PHONE
        // ======================================
        phone: {

            type: String,

            trim: true,

            default: "",

            maxlength: 20
        },


        // ======================================
        // GOOGLE LOGIN
        // ======================================
        googleId: {

            type: String,

            default: null,

            index: true
        },


        // ======================================
        // EMAIL VERIFICATION
        // ======================================
        isVerified: {

            type: Boolean,

            default: false
        },


        // ======================================
        // PASSWORD RESET
        // ======================================
        passwordResetToken: {

            type: String,

            default: null
        },


        passwordResetExpires: {

            type: Date,

            default: null
        },


        // ======================================
        // OTP SYSTEM
        // ======================================
        otp: {

            type: String,

            default: null
        },


        otpExpires: {

            type: Date,

            default: null
        },


        // ======================================
        // USER BLOCK STATUS
        // ======================================
        isBlocked: {

            type: Boolean,

            default: false,

            index: true
        },


        // ======================================
        // ADDRESS SYSTEM
        // ======================================
        addresses: [

            addressSchema
        ],


        // ======================================
        // LAST LOGIN
        // ======================================
        lastLogin: {

            type: Date,

            default: null
        }

    },

    {

        timestamps: true,

        versionKey: false,

        toJSON: {

            virtuals: true,

            transform: function (
                doc,
                ret
            ) {

                delete ret.password;

                delete ret.passwordResetToken;

                delete ret.passwordResetExpires;

                delete ret.otp;

                delete ret.otpExpires;

                return ret;
            }
        }
    }
);


// ======================================
// INDEXES
// ======================================
userSchema.index({
    createdAt: -1
});


// ======================================
// PRE SAVE NORMALIZATION
// ======================================
userSchema.pre(

    "save",

    function (next) {

        // EMAIL
        if (this.email) {

            this.email =

                this.email
                    .trim()
                    .toLowerCase();
        }


        // NAME
        if (this.name) {

            this.name =
                this.name.trim();
        }


        // PHONE
        if (this.phone) {

            this.phone =

                String(this.phone)

                    .replace(/\s+/g, "")

                    .trim();
        }


        next();
    }
);


// ======================================
// SAFE USER SERIALIZATION
// ======================================
userSchema.methods.safeUser = function () {

    return {

        id: this._id,

        name: this.name,

        email: this.email,

        role: this.role,

        avatar: this.avatar,

        isVerified: this.isVerified,

        accountStatus: this.accountStatus,

        createdAt: this.createdAt
    };
};


// ======================================
// STATIC HELPERS
// ======================================
userSchema.statics.findActiveUser =
    function (userId) {

        return this.findOne({

            _id: userId,

            isBlocked: false,

            accountStatus: "active"
        });
    };


// ======================================
// MODEL EXPORT
// ======================================
module.exports = mongoose.model(
    "User",
    userSchema
);