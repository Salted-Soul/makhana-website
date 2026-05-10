const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true, // ✅ cleaner data
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true, // ✅ normalize emails
      trim: true,
      match: [
        /^\S+@\S+\.\S+$/,
        "Please use a valid email address",
      ], // ✅ validation
    },

    password: {
      type: String,
      required: true,
      minlength: 6, // ✅ basic security
    },

    // ✅ NEW FIELD (DO NOT REMOVE)
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * ✅ Remove sensitive fields when sending response
 */
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password; // 🔥 never expose password
  return obj;
};

/**
 * ✅ Index for faster queries
 */
userSchema.index({ email: 1 });

module.exports = mongoose.model("User", userSchema);