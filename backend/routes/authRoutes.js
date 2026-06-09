const express = require("express");

const bcrypt = require("bcryptjs");

const jwt = require("jsonwebtoken");

const User = require("../models/User");

const passport = require("passport");

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
// ENV VALIDATION
// ======================================
if (!process.env.JWT_SECRET) {

    console.error(
        "❌ JWT_SECRET missing"
    );
}


// ======================================
// LOGIN ATTEMPT TRACKER
// ======================================
const loginAttempts =
    new Map();


// ======================================
// CLEANUP OLD ATTEMPTS
// ======================================
setInterval(() => {

    const now = Date.now();

    for (
        const [ip, data]
        of loginAttempts.entries()
    ) {

        if (
            now - data.lastAttempt >
            15 * 60 * 1000
        ) {

            loginAttempts.delete(ip);
        }
    }

}, 15 * 60 * 1000);


// ======================================
// RATE LIMIT HELPERS
// ======================================
const isBlocked = (ip) => {

    const data =
        loginAttempts.get(ip);

    if (!data) {
        return false;
    }

    const {
        count,
        lastAttempt
    } = data;


    return (
        count >= 5 &&
        Date.now() - lastAttempt <
        5 * 60 * 1000
    );
};


const recordAttempt = (ip) => {

    const data =
        loginAttempts.get(ip) ||

        {
            count: 0,
            lastAttempt: Date.now()
        };

    data.count += 1;

    data.lastAttempt =
        Date.now();

    loginAttempts.set(ip, data);
};


const resetAttempts = (ip) => {

    loginAttempts.delete(ip);
};


// ======================================
// VALIDATORS
// ======================================
// ======================================
// EMAIL VALIDATION
// ======================================
const isValidEmail = (email) => {

    if (
        typeof email !== "string"
    ) {
        return false;
    }

    const normalizedEmail =
        email.trim().toLowerCase();

    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    return emailRegex.test(
        normalizedEmail
    );
};


// ======================================
// PASSWORD VALIDATION
// ======================================
const isStrongPassword = (
    password
) => {

    if (
        typeof password !== "string"
    ) {
        return false;
    }

    const passwordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    return passwordRegex.test(
        password
    );
};


const sanitizeString = (
    str
) => {

    return String(str || "")
        .replace(/[<>]/g, "")
        .trim();
};


// ======================================
// GENERATE JWT TOKEN
// ======================================
const generateToken = (
    user
) => {

    return jwt.sign(

        {

            id: user._id,

            role:
                user.role || "user"
        },

        process.env.JWT_SECRET,

        {

            expiresIn:

                process.env
                    .JWT_EXPIRES_IN ||

                "7d"
        }
    );
};


// ======================================
// COOKIE CONFIG
// ======================================
const cookieOptions = {

    httpOnly: true,

    secure:
        process.env.NODE_ENV === "production",

    sameSite:
        process.env.NODE_ENV === "production"
            ? "None"
            : "Lax",

    maxAge:
        7 * 24 * 60 * 60 * 1000,

    path: "/"
};
// ======================================
// SAFE USER RESPONSE
// ======================================
const safeUser = (
    user
) => ({

    id:
        user._id,

    name:
        user.name,

    email:
        user.email,

    role:
        user.role,

    avatar:
        user.avatar || "",

    isVerified:
        user.isVerified || false
});


// ======================================
// AUTH CHECK
// ======================================
router.get(
    "/check",
    protect,
    (req, res) => {

        console.log("🔥 AUTH CHECK USER:", req.user);

        return res.json({
            success: true,
            authenticated: true,
            user: req.user
        });
    }
);


// ======================================
// SIGNUP
// ======================================
router.post(

    "/signup",

    async (req, res) => {

        try {

            let {
                name,
                email,
                password
            } = req.body;


            // SANITIZE
            name =
                sanitizeString(name);

            email =
                sanitizeString(email)
                    .toLowerCase();


            // VALIDATION
            if (
                !name ||
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "All fields are required"
                });
            }


            if (
                !isValidEmail(email)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid email format"
                });
            }


            if (
                !isStrongPassword(
                    password
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Password must contain uppercase, lowercase, number and minimum 8 characters"
                });
            }


            // DUPLICATE CHECK
            const existingUser =

                await User.findOne({
                    email
                });


            if (existingUser) {

                return res.status(409).json({

                    success: false,

                    message:
                        "User already exists"
                });
            }


            // HASH PASSWORD
            const hashedPassword =

                await bcrypt.hash(
                    password,
                    12
                );


            // CREATE USER
            const user =

                new User({

                    name,

                    email,

                    password:
                        hashedPassword
                });


            await user.save();


            // GENERATE TOKEN
            const token =
                generateToken(user);


            // SET COOKIE
            res.cookie(
                "token",
                token,
                cookieOptions
            );


            if (DEBUG) {

                console.log(
                    "✅ USER REGISTERED:",
                    user.email
                );
            }


            return res.status(201).json({

                success: true,

                message:
                    "Account created successfully",

                token,

                user:
                    safeUser(user)
            });

        } catch (err) {

            console.error(
                "❌ SIGNUP ERROR:",
                err
            );

            return res.status(500).json({

                success: false,

                message:
                    process.env.NODE_ENV ===
                    "production"
                        ? "Signup failed"
                        : err.message
            });
        }
    }
);


// ======================================
// LOGIN
// ======================================
router.post(

    "/login",

    async (req, res) => {

        try {

            const ip =
                req.ip;


            // RATE LIMIT
            if (
                isBlocked(ip)
            ) {

                return res.status(429).json({

                    success: false,

                    message:
                        "Too many login attempts. Please try again later."
                });
            }


            let {
                email,
                password
            } = req.body;


            email =
                sanitizeString(email)
                    .toLowerCase();


            // VALIDATION
            if (
                !email ||
                !password ||
                !isValidEmail(email)
            ) {

                recordAttempt(ip);

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid credentials"
                });
            }


            // FIND USER
            const user =

                await User.findOne({
                    email
                }).select("+password");


            // ANTI USER ENUMERATION
            if (!user) {

                recordAttempt(ip);

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid credentials"
                });
            }


            // BLOCK CHECK
            if (
                user.isBlocked
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Account blocked"
                });
            }


            // PASSWORD CHECK
            const isMatch =

                await bcrypt.compare(
                    password,
                    user.password
                );


            if (!isMatch) {

                recordAttempt(ip);

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid credentials"
                });
            }


            // RESET RATE LIMIT
            resetAttempts(ip);


            // TRACK LOGIN
            user.lastLogin =
                new Date();

            await user.save();


            // GENERATE TOKEN
            const token =
                generateToken(user);


            // SET COOKIE
            res.cookie(
                "token",
                token,
                cookieOptions
            );


            if (DEBUG) {

                console.log(
                    "✅ USER LOGIN:",
                    user.email
                );
            }


            return res.json({

                success: true,

                message:
                    "Login successful",

                token,

                user:
                    safeUser(user)
            });

        } catch (err) {

            console.error(
                "❌ LOGIN ERROR:",
                err
            );

            return res.status(500).json({

                success: false,

                message:
                    process.env.NODE_ENV ===
                    "production"
                        ? "Login failed"
                        : err.message
            });
        }
    }
);


// ======================================
// LOGOUT
// ======================================
router.post(

    "/logout",

    (req, res) => {

        res.clearCookie(

    "token",

    {
    httpOnly: true,
    secure:
        process.env.NODE_ENV === "production",

    sameSite:
        process.env.NODE_ENV === "production"
            ? "None"
            : "Lax",

    path: "/"
}
);


        return res.json({

            success: true,

            message:
                "Logged out successfully"
        });
    }
);


// ======================================
// HEALTH CHECK
// ======================================
router.get(
    "/health",
    (req, res) => {

        return res.json({

            success: true,

            service:
                "auth-service"
        });
    }
);

router.get(

    "/google",

    passport.authenticate(

        "google",

        {
            scope: [
                "profile",
                "email"
            ]
        }
    )
);


router.get(

    "/google/callback",

    (req, res, next) => {

        console.log("🔥 CALLBACK HIT");

        next();
    },

    passport.authenticate(

        "google",

        {
            session: false,
            failureRedirect: "/login.html"
        }
    ),

    async (req, res) => {

        console.log("✅ GOOGLE SUCCESS");

        const token =
            generateToken(req.user);

        res.cookie(
            "token",
            token,
            cookieOptions
        );

        return res.redirect(
            "/index.html"
        );
    }
);

// ======================================
// EXPORT ROUTERn
// ======================================
module.exports = router;