const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

const router = express.Router();

const { protect } = require("../middleware/authMiddleware");


// =======================
// 🔥 BASIC RATE LIMIT (NEW - SAFE)
// =======================
const loginAttempts = new Map();

const isBlocked = (ip) => {
    const data = loginAttempts.get(ip);
    if (!data) return false;

    const { count, lastAttempt } = data;

    // Block if >5 attempts in 5 minutes
    if (count >= 5 && Date.now() - lastAttempt < 5 * 60 * 1000) {
        return true;
    }

    return false;
};

const recordAttempt = (ip) => {
    const data = loginAttempts.get(ip) || { count: 0, lastAttempt: Date.now() };
    data.count += 1;
    data.lastAttempt = Date.now();
    loginAttempts.set(ip, data);
};

const resetAttempts = (ip) => {
    loginAttempts.delete(ip);
};


// =======================
// ✅ CHECK AUTH (UNCHANGED + SAFE)
// =======================
router.get("/check", protect, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});


// =======================
// ✅ GENERATE TOKEN (UPGRADED SAFE)
// =======================
const generateToken = (user) => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET not configured");
    }

    return jwt.sign(
        { id: user._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" } // 🔥 ENV BASED
    );
};


// =======================
// 🔥 COOKIE OPTIONS (UPGRADED)
// =======================
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
};


// =======================
// 🧠 VALIDATORS (UPGRADED)
// =======================
const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

const isStrongPassword = (password) => {
    return password.length >= 6; // can extend later safely
};


// =======================
// 🧠 SAFE USER RESPONSE (NEW)
// =======================
const safeUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
});


// =======================
// ✅ SIGNUP (UPGRADED)
// =======================
router.post("/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format"
            });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();

        const token = generateToken(user);

        res.cookie("token", token, cookieOptions);

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            token,
            user: safeUser(user) // 🔥 SAFE OUTPUT
        });

    } catch (err) {
        console.error("SIGNUP ERROR:", err);

        res.status(500).json({
            success: false,
            message: "Server error during signup",
            error: err.message
        });
    }
});


// =======================
// ✅ LOGIN (UPGRADED + PROTECTED)
// =======================
router.post("/login", async (req, res) => {
    try {
        const ip = req.ip;

        // 🔥 RATE LIMIT CHECK
        if (isBlocked(ip)) {
            return res.status(429).json({
                success: false,
                message: "Too many login attempts. Try again later."
            });
        }

        const { email, password } = req.body;

        if (!email || !password || !isValidEmail(email)) {
            recordAttempt(ip);
            return res.status(400).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            recordAttempt(ip);
            return res.status(400).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            recordAttempt(ip);
            return res.status(400).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        // 🔥 RESET ATTEMPTS ON SUCCESS
        resetAttempts(ip);

        const token = generateToken(user);

        res.cookie("token", token, cookieOptions);

        res.json({
            success: true,
            message: "Login successful",
            token,
            user: safeUser(user)
        });

    } catch (err) {
        console.error("LOGIN ERROR:", err);

        res.status(500).json({
            success: false,
            message: "Server error during login",
            error: err.message
        });
    }
});


// =======================
// ✅ LOGOUT (UPGRADED SAFE)
// =======================
router.post("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        sameSite: "Lax",
        secure: process.env.NODE_ENV === "production",
        path: "/"
    });

    res.json({
        success: true,
        message: "Logged out successfully"
    });
});


module.exports = router;