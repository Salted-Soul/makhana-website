const path = require("path");
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");

const authRoutes = require("./routes/authRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../")));
app.use(express.urlencoded({ extended: true }));


// ===============================
// 🧠 ENV VALIDATION
// ===============================
["MONGO_URI", "JWT_SECRET"].forEach((key) => {
    if (!process.env[key]) {
        console.error(`❌ Missing ENV: ${key}`);
        process.exit(1);
    }
});


// ===============================
// 🔥 DEBUG MODE
// ===============================
const DEBUG = process.env.DEBUG === "true";


// ===============================
// 🔒 SECURITY
// ===============================
app.use(helmet());

app.use((req, res, next) => {
    res.setHeader("X-Powered-By", "SecureServer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    next();
});


// ===============================
// 🔥 BODY PARSER (CRITICAL FIX)
// ===============================
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));


// ===============================
// 🔥 COOKIE
// ===============================
app.use(cookieParser());


// ===============================
// 🔥 SANITIZE
// ===============================
try {
    app.use((req, res, next) => {
        try {
            mongoSanitize()(req, res, next);
        } catch (err) {
            next();
        }
    });
} catch (err) {}

app.use((req, res, next) => {
    try {
        const sanitize = (obj) => {
            if (!obj || typeof obj !== "object") return obj;
            for (let key in obj) {
                if (typeof obj[key] === "string") {
                    obj[key] = obj[key].replace(/</g, "&lt;").replace(/>/g, "&gt;");
                } else if (typeof obj[key] === "object") {
                    sanitize(obj[key]);
                }
            }
        };
        sanitize(req.body);
        sanitize(req.query);
        sanitize(req.params);
    } catch {}
    next();
});


// ===============================
// 🔥 TRUST PROXY
// ===============================
app.set("trust proxy", 1);


// ===============================
// ✅ CORS
// ===============================
app.use(cors({
    origin: "*",
    credentials: true
}));

app.use((req, res, next) => {
   res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

    if (req.method === "OPTIONS") return res.sendStatus(200);

    next();
});


// ===============================
// 🧠 REQUEST ID
// ===============================
app.use((req, res, next) => {
    req.requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    res.setHeader("X-Request-Id", req.requestId);
    next();
});


// ===============================
// 📊 LOGGER
// ===============================
app.use((req, res, next) => {
    const start = Date.now();

    if (DEBUG) {
        console.log("📥 BODY:", req.body);
    }

    res.on("finish", () => {
        console.log(
            `[${req.requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`
        );
    });

    next();
});


// ===============================
// 🚀 RATE LIMIT
// ===============================
app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200
}));


// ===============================
// 🔧 SAFE ROUTE WRAPPER
// ===============================
const safeRoute = (router) => {
    return (req, res, next) => {
        try {
            router(req, res, next);
        } catch (err) {
            next(err);
        }
    };
};


// ===============================
// ROUTES
// ===============================
app.use("/api/auth", safeRoute(authRoutes));
app.use("/api/cart", safeRoute(cartRoutes));
app.use("/api/order", safeRoute(orderRoutes));
app.use("/api/payment", safeRoute(paymentRoutes));
app.use("/api/admin", safeRoute(adminRoutes));


// ===============================
app.get("/health", (req, res) => {
    res.json({ success: true });
});

app.get("/", (req, res) => {
    res.send("Backend running 🚀");
});


// ===============================
// ❌ 404
// ===============================
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});


// ===============================
// ❌ GLOBAL ERROR
// ===============================
app.use((err, req, res, next) => {
    console.error("GLOBAL ERROR:", err.message);
    res.status(500).json({
        success: false,
        message: err.message || "Server error"
    });
});


// ===============================
// 🧠 DB CONNECT
// ===============================
let server;

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB Connected");

        server = app.listen(process.env.PORT || 5000, "0.0.0.0", () => {
    console.log(`Server running on PORT ${process.env.PORT || 5000}`);
});

    } catch (err) {
        console.error("Mongo Error:", err.message);
        setTimeout(connectDB, 5000);
    }
};

connectDB();


// ===============================
// 🛑 SHUTDOWN
// ===============================
process.on("SIGINT", async () => {
    if (server) server.close();
    await mongoose.connection.close();
    process.exit(0);
});

process.on("unhandledRejection", (err) => {
    console.error("UNHANDLED REJECTION:", err);
});

process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT EXCEPTION:", err);
});