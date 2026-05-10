const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * 🧠 INTERNAL: Safe token extraction (NEW - NON BREAKING)
 */
const extractToken = (req) => {
  // Header (legacy support)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    return req.headers.authorization.split(" ")[1];
  }

  // Cookie (primary)
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
};

/**
 * 🧠 INTERNAL: Verify JWT safely (NEW)
 */
const verifyToken = (token) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET missing in ENV"); // 🔥 ADDED
      throw new Error("JWT_SECRET not configured");
    }

    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.warn("Token verification failed:", err.message); // 🔥 ADDED
    return null;
  }
};

/**
 * 🧠 INTERNAL: Attach user safely (NEW)
 */
const attachUserToRequest = (req, user) => {
  req.user = user;          // ✅ your existing logic (kept)
  req.userId = user._id;    // ✅ your existing logic (kept)
};

/**
 * @desc    Protect routes (JWT Auth)
 * @access  Private
 */
const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);

    // ===============================
    // NO TOKEN
    // ===============================
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token, authorization denied",
      });
    }

    // ===============================
    // VERIFY TOKEN
    // ===============================
    const decoded = verifyToken(token);
    console.log("DECODED TOKEN:", decoded);

    if (!decoded || (!decoded.id && !decoded._id)) {
  return res.status(401).json({
    success: false,
    message: "Token expired or invalid",
  });
}

    // ===============================
    // FETCH USER FROM DB
    // ===============================
    const userId = decoded.id || decoded._id;

const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // ===============================
    // 🔥 ROLE DEFAULT SAFETY (ADDED)
    // ===============================
    if (!user.role) {
      user.role = "user"; // fallback (non-breaking)
    }

    // ===============================
    // ATTACH USER TO REQUEST
    // ===============================
    attachUserToRequest(req, user);
    console.log("REQ USER:", req.user);

    next();
  } catch (error) {
    console.error("Auth Error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Not authorized, token failed",
    });
  }
};

/**
 * @desc    Admin middleware
 * @access  Private/Admin
 */
const adminOnly = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    // ===============================
    // ROLE HARDENING (UPGRADED)
    // ===============================
    if (!req.user.role || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied - Admin only",
      });
    }

    next();
  } catch (error) {
    console.error("Admin Middleware Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * @desc    Optional middleware (does not block if not logged in)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return next();
    }

    const decoded = verifyToken(token);

    if (!decoded || !decoded.id) {
      return next(); // ❌ do not block
    }

    const user = await User.findById(decoded.id).select("-password");

    if (user) {
      attachUserToRequest(req, user);
    }

    next();
  } catch (error) {
    // ❌ NEVER block request
    next();
  }
};

/**
 * 🧠 OPTIONAL: SELF ACCESS GUARD (NEW - FUTURE SAFE)
 * Example: user can only access their own data
 */
const isSelf = (req, res, next) => {
  try {
    const requestedUserId =
      req.params.userId || req.body.userId || req.query.userId;

    if (!requestedUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID required",
      });
    }

    if (req.userId.toString() !== requestedUserId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    next();
  } catch (error) {
    console.error("SELF CHECK ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/**
 * 🔥 NEW: ROLE CHECK HELPER (ADDED, NON-BREAKING)
 */
const hasRole = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `Access denied - ${role} only`,
      });
    }
    next();
  };
};

module.exports = {
  protect,
  adminOnly,
  optionalAuth,
  isSelf,
  hasRole // 🔥 NEW helper (optional use)
};