const mongoose = require("mongoose");


// ===============================
// 🔥 SAFE NEXT WRAPPER (CRITICAL FIX)
// ===============================
function safeNext(next){
  try{
    if(typeof next === "function"){
      return next();
    } else {
      console.warn("⚠️ next is not a function — prevented crash");
    }
  }catch(err){
    console.error("❌ safeNext error:", err.message);
  }
}


const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  items: [
    {
      productId: String,

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

      image: {
        type: String,
        default: ""
      },

      quantity: {
        type: Number,
        default: 1,
        min: 1
      }
    }
  ]

}, { timestamps: true });


// ===============================
const DEBUG = process.env.DEBUG === "true";


// ===============================
cartSchema.set("toJSON", {
  transform: function (doc, ret) {
    try {
      delete ret.__v;
    } catch (e) {}
    return ret;
  }
});


// ===============================
// 🔥 PRE SAVE FIXES
// ===============================
cartSchema.pre("save", function (next) {

  try {
    if (DEBUG) console.log("🧠 PRE SAVE TRIGGERED");

    if (!this.user && this.userId) {
      this.user = this.userId;
    }

    if (this.items && Array.isArray(this.items)) {
      this.items.forEach(item => {

        if (!item.quantity || item.quantity < 1) {
          item.quantity = 1;
        }

        if (!item.price || item.price < 0) {
          item.price = 0;
        }

        if (!item.name) {
          item.name = "Unknown Product";
        }
      });
    }

  } catch (err) {
    console.error("❌ CART PRE-SAVE ERROR:", err.message);
  }

  safeNext(next); // ✅ FIX
});


// ===============================
// 🔥 PRE VALIDATE
// ===============================
cartSchema.pre("validate", function (next) {
  try {
    if (this.items && Array.isArray(this.items)) {
      this.items = this.items.map(item => ({
        ...item,
        name: typeof item.name === "string" ? item.name.trim() : "Unknown Product",
        price: typeof item.price === "number" && item.price >= 0 ? item.price : 0,
        quantity: typeof item.quantity === "number" && item.quantity > 0 ? item.quantity : 1
      }));
    }
  } catch (err) {
    console.error("❌ CART PRE-VALIDATE ERROR:", err.message);
  }
  safeNext(next); // ✅ FIX
});




// ===============================
cartSchema.methods.mergeDuplicateItems = function () {
  try {
    const map = new Map();

    this.items.forEach(item => {
      const key = item.productId || item.name;

      if (map.has(key)) {
        const existing = map.get(key);
        existing.quantity += item.quantity;
      } else {
        map.set(key, { ...item.toObject ? item.toObject() : item });
      }
    });

    this.items = Array.from(map.values());
  } catch (err) {
    console.error("❌ DUPLICATE MERGE ERROR:", err.message);
  }
};


// ===============================
cartSchema.methods.calculateTotal = function () {
  return this.items.reduce((acc, item) => {
    return acc + (item.price * item.quantity);
  }, 0);
};


// ===============================
cartSchema.methods.getSafeTotal = function () {
  try {
    return this.calculateTotal();
  } catch (err) {
    console.error("❌ TOTAL CALC ERROR:", err.message);
    return 0;
  }
};


// ===============================
cartSchema.statics.findOrCreateCart = async function (userId) {

  let cart = await this.findOne({ userId });

  if (!cart) {
    cart = await this.create({
      userId,
      user: userId,
      items: []
    });
  }

  return cart;
};


// ===============================
cartSchema.statics.safeFindByUser = async function (userId) {
  try {
    let cart = await this.findOne({ userId });

    if (!cart) {
      cart = await this.create({
        userId,
        user: userId,
        items: []
      });
    }

    return cart;
  } catch (err) {
    console.error("❌ SAFE FIND CART ERROR:", err.message);
    return null;
  }
};


// ===============================
// 🔥 FIXED ADD ITEM
// ===============================
cartSchema.methods.addItem = function (newItem) {

  try {

    if (!newItem) {
      return;
    }

    const productId =
      String(newItem.productId || newItem.name);

    const existing = this.items.find(
      item => String(item.productId) === productId
    );

    if (existing) {

      existing.quantity += Number(
        newItem.quantity || 1
      );

    } else {

      this.items.push({

        productId,

        name: String(
          newItem.name || "Unknown Product"
        ),

        price: Number(
          newItem.price || 0
        ),

        image: String(
          newItem.image || ""
        ),

        quantity: Number(
          newItem.quantity || 1
        )
      });
    }

    this.markModified("items");

    return this;

  } catch (err) {

    console.error(
      "❌ ADD ITEM ERROR:",
      err
    );

    return this;
  }
};


// ===============================
cartSchema.methods.updateQuantity = function (productId, quantity) {

  try {

    const item = this.items.find(
      i => String(i.productId) === String(productId)
    );

    if (!item) return this;

    item.quantity =
      quantity < 1 ? 1 : Number(quantity);

    this.markModified("items");

    return this;

  } catch (err) {

    console.error(
      "❌ UPDATE QUANTITY ERROR:",
      err
    );

    return this;
  }
};


// ===============================
cartSchema.methods.removeItem = function (productId) {

  try {

    this.items = this.items.filter(
      i => String(i.productId) !== String(productId)
    );

    this.markModified("items");

    return this;

  } catch (err) {

    console.error(
      "❌ REMOVE ITEM ERROR:",
      err
    );

    return this;
  }
};

// ===============================
cartSchema.methods.clearCart = function () {

  try {

    this.items = [];

    this.markModified("items");

    return this;

  } catch (err) {

    console.error(
      "❌ CLEAR CART ERROR:",
      err
    );

    return this;
  }
};

// ===============================
cartSchema.index({ userId: 1 });
cartSchema.index({ "items.productId": 1 });


// ===============================
cartSchema.post("save", function (doc) {
  console.log("🛒 Cart saved:", doc._id);
});

cartSchema.post("findOneAndUpdate", function (doc) {
  console.log("🛠 Cart updated:", doc?._id);
});


// ===============================
cartSchema.methods.ensureValidItems = function () {
  this.items = this.items.filter(item => item.name && item.price >= 0);
};


// ===============================
cartSchema.pre("save", function (next) {
  try {
    this.ensureValidItems();
    this.mergeDuplicateItems();
  } catch (err) {
    console.error("❌ AUTO CLEAN ERROR:", err.message);
  }
  safeNext(next); // ✅ FIX
});


// ===============================
cartSchema.virtual("total").get(function () {
  return this.calculateTotal();
});


// ===============================
cartSchema.methods.toSafeObject = function () {
  try {
    const obj = this.toObject({ virtuals: true });
    delete obj.__v;
    return obj;
  } catch (err) {
    console.error("❌ TO OBJECT ERROR:", err.message);
    return {};
  }
};


// ===============================
cartSchema.methods.safeSave = async function () {
  try {
    return await this.save();
  } catch (err) {
    console.error("❌ SAFE SAVE ERROR:", err.message);
    return null;
  }
};


module.exports = mongoose.model("Cart", cartSchema);