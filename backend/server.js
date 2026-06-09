const path = require("path");

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const session = require("express-session");
const passport = require("./config/passport");


// ======================================
// DATABASE
// ======================================
const connectDB = require("./config/db");


// ======================================
// ROUTES
// ======================================
const authRoutes = require("./routes/authRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const productRoutes = require("./routes/productRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
// ======================================
// EXPRESS APP
// ======================================
const app = express();


// ======================================
// ENVIRONMENT
// ======================================
const PORT = process.env.PORT || 5000;

const NODE_ENV =
    process.env.NODE_ENV || "development";

const DEBUG =
    process.env.DEBUG === "true";


// ======================================
// REQUIRED ENV VALIDATION
// ======================================
[
    "MONGO_URI",
    "JWT_SECRET"
].forEach((key) => {

    if (!process.env[key]) {

        console.error(
            `❌ Missing required ENV variable: ${key}`
        );

        process.exit(1);
    }
});


// ======================================
// TRUST PROXY
// ======================================
app.set("trust proxy", 1);


// ======================================
// SECURITY HEADERS
// ======================================
app.use(

    helmet({

        crossOriginResourcePolicy: {
            policy: "cross-origin"
        },

        contentSecurityPolicy: {

            useDefaults: true,

            directives: {

                defaultSrc: [
                    "'self'"
                ],

                scriptSrc: [

    "'self'",

    "'unsafe-inline'",

    "'unsafe-eval'",

    "https://checkout.razorpay.com",

    "https://cdn.razorpay.com"
],

scriptSrcAttr: [

    "'unsafe-inline'"
],

                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https:"
                ],

                imgSrc: [
                    "'self'",
                    "data:",
                    "blob:",
                    "https:"
                ],

                connectSrc: [

    "'self'",

    "https://api.razorpay.com",

    "https://checkout.razorpay.com",

    "https://cdn.razorpay.com",

    "https://consoling-backspace-elongated.ngrok-free.dev",

    "http://127.0.0.1:5000",

    "http://localhost:5000",

    process.env.CLIENT_URL,

    process.env.FRONTEND_URL,

    process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : null

].filter(Boolean),

                frameSrc: [
                    "'self'",
                    "https://api.razorpay.com",
                    "https://checkout.razorpay.com"
                ],

                fontSrc: [

    "'self'",

    "https:",

    "data:"
],

                objectSrc: [
                    "'none'"
                ],

                upgradeInsecureRequests:
                    NODE_ENV === "production"
                        ? []
                        : null
            }
        }
    })
);


// ======================================
// CUSTOM SECURITY HEADERS
// ======================================
app.use((req, res, next) => {

    res.removeHeader("X-Powered-By");

    res.setHeader(
        "X-Content-Type-Options",
        "nosniff"
    );

    res.setHeader(
    "X-Frame-Options",
    "SAMEORIGIN"
);

    res.setHeader(
        "Referrer-Policy",
        "strict-origin-when-cross-origin"
    );

    next();
});


// ======================================
// CORS CONFIGURATION
// ======================================
const allowedOrigins = [

    "http://127.0.0.1:5500",

    "http://localhost:5500",

    "http://127.0.0.1:5000",

    "http://localhost:5000",

    "https://consoling-backspace-elongated.ngrok-free.dev",

    process.env.CLIENT_URL,

    process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {

    origin: (origin, callback) => {

        // ALLOW POSTMAN / MOBILE APPS
        if (!origin) {

            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {

            return callback(null, true);
        }

        console.warn(
            `❌ BLOCKED CORS: ${origin}`
        );

        console.error(
    `Blocked Origin: ${origin}`
);

return callback(null, false);
    },

    credentials: true,

    methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS"
    ],

    allowedHeaders: [

    "Content-Type",

    "Authorization",

    "X-Requested-With"
]
};

app.use(cors(corsOptions));

app.options("/", cors(corsOptions));


// ======================================
// RAZORPAY WEBHOOK RAW BODY SUPPORT
// ======================================
app.use(

    "/api/payment/webhook",

    express.raw({
        type: "application/json"
    })
);


// ======================================
// BODY PARSERS
// ======================================
app.use(

    express.json({

        limit: "10kb"
    })
);

app.use(

    express.urlencoded({

        extended: true,

        limit: "10kb"
    })
);


// ======================================
// COOKIE PARSER
// ======================================
app.use(cookieParser());




app.use(
    session({
        secret:
            process.env.JWT_SECRET,
        resave: false,
        saveUninitialized: false
    })
);

app.use(
    passport.initialize()
);

app.use(
    passport.session()
);


// ======================================
// COMPRESSION
// ======================================
app.use(compression());


// ======================================
// SANITIZATION
// ======================================
app.use((req, res, next) => {

    try {

        // SANITIZE BODY
        if (req.body) {

            mongoSanitize.sanitize(

                req.body,

                {
                    replaceWith: "_"
                }
            );
        }


        // SANITIZE PARAMS
        if (req.params) {

            mongoSanitize.sanitize(

                req.params,

                {
                    replaceWith: "_"
                }
            );
        }

    } catch (error) {

        console.error(
            "❌ Mongo sanitize error:",
            error.message
        );
    }

    next();
});

app.use(hpp());


// ======================================
// BASIC XSS SANITIZATION
// ======================================
app.use((req, res, next) => {

    try {

        const sanitize = (obj) => {

            if (
                !obj ||
                typeof obj !== "object"
            ) {

                return;
            }

            Object.keys(obj).forEach((key) => {

                const value = obj[key];

                if (
                    typeof value === "string"
                ) {

                    obj[key] = value
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .trim();
                }

                else if (
                    typeof value === "object"
                ) {

                    sanitize(value);
                }
            });
        };

        sanitize(req.body);

// EXPRESS 5 SAFE QUERY SANITIZATION
if (req.query && typeof req.query === "object") {

    const safeQuery = {};

    Object.keys(req.query).forEach((key) => {

        const value = req.query[key];

        if (typeof value === "string") {

            safeQuery[key] = value
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .trim();

        } else {

            safeQuery[key] = value;
        }
    });

    req.safeQuery = safeQuery;
}

sanitize(req.params);

    } catch (error) {

        console.error(
            "❌ Sanitization error:",
            error.message
        );
    }

    next();
});


// ======================================
// REQUEST ID MIDDLEWARE
// ======================================
app.use((req, res, next) => {

    req.requestId =

        `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 10)}`;

    res.setHeader(
        "X-Request-Id",
        req.requestId
    );

    next();
});


// ======================================
// LOGGER
// ======================================
app.use((req, res, next) => {

    const start = Date.now();

    if (DEBUG) {

        console.log(
            "📥 REQUEST BODY:",
            req.body
        );
    }

    res.on("finish", () => {

        console.log(

            `[${req.requestId}] ` +

            `${req.method} ` +

            `${req.originalUrl} ` +

            `${res.statusCode} ` +

            `- ${Date.now() - start}ms`
        );
    });

    next();
});

// ======================================
// API DEBUG LOGGER
// ======================================

app.use("/api", (req, res, next) => {

    console.log(
        `🌐 API HIT: ${req.method} ${req.originalUrl}`
    );

    next();
});

// ======================================
// API RATE LIMITER
// ======================================
const apiLimiter = rateLimit({

    windowMs:
        15 * 60 * 1000,

    max:
        NODE_ENV === "production"
            ? 200
            : 1000,

    standardHeaders: true,

    legacyHeaders: false,

    message: {

        success: false,

        message:
            "Too many requests. Please try again later."
    }
});

app.use("/api", apiLimiter);


// ======================================
// STATIC FILES
// ======================================
app.use(

    express.static(

        path.join(__dirname, ".."),

        {

            maxAge:
                NODE_ENV === "production"
                    ? "7d"
                    : 0,

            etag: true,

            lastModified: true
        }
    )
);


// ======================================
// API ROUTES
// ======================================
// ======================================
// API ROUTES
// ======================================

app.use("/api/auth", authRoutes);


// CART ROUTES
app.use("/api/cart", cartRoutes);

// BACKWARD COMPATIBILITY
app.use("/cart", cartRoutes);


// ORDER ROUTES
app.use("/api/order", orderRoutes);

app.use("/api/orders", orderRoutes);

// BACKWARD COMPATIBILITY
app.use("/order", orderRoutes);


// PAYMENT ROUTES
app.use("/api/payment", paymentRoutes);

// BACKWARD COMPATIBILITY
app.use("/payment", paymentRoutes);


// ADMIN ROUTES
app.use("/api/admin", adminRoutes);


// PRODUCT ROUTES
app.use("/api/products", productRoutes);
// WISHLIST ROUTES
app.use("/api/wishlist", wishlistRoutes);


// ======================================
// HEALTH CHECK
// ======================================
app.get("/api/test", (req, res) => {

    res.json({

        success: true,

        message: "API working perfectly"
    });
});


// ======================================
// API HEALTH
// ======================================
app.get("/api/health", (req, res) => {

    res.status(200).json({

        success: true,

        status: "healthy",

        environment: NODE_ENV,

        uptime: process.uptime(),

        timestamp: new Date(),

        memoryUsage: process.memoryUsage(),

        pid: process.pid
    });
});


// ======================================
// ROOT ROUTE
// ======================================
app.get("/", (req, res) => {

    res.send(
        "🚀 Ecommerce Backend Running Securely"
    );
});


// ======================================
// 404 HANDLER
// ======================================
app.use((req, res) => {

    res.status(404).json({

        success: false,

        message: `Route not found: ${req.originalUrl}`
    });
});


// ======================================
// GLOBAL ERROR HANDLER
// ======================================
app.use((err, req, res, next) => {

    console.error(

        "❌ GLOBAL ERROR:",

        {

            message: err.message,

            stack:
                NODE_ENV === "development"
                    ? err.stack
                    : undefined,

            url: req.originalUrl,

            method: req.method,

            ip: req.ip,

            requestId: req.requestId
        }
    );

    const statusCode =
        err.statusCode || 500;

    res.status(statusCode).json({

        success: false,

        message:
            NODE_ENV === "production"
                ? "Something went wrong"
                : err.message
    });
});


// ======================================
// SERVER INSTANCE
// ======================================
let server;


// ======================================
// START SERVER
// ======================================
const startServer = async () => {

    try {

        await connectDB();

        server = app.listen(

            PORT,

            "0.0.0.0",

            () => {

                console.log(

                    `🚀 Server running on PORT ${PORT}`
                );

                console.log(
                    `🌍 Environment: ${NODE_ENV}`
                );
            }
        );

    } catch (error) {

        console.error(

            "❌ SERVER START FAILED:",

            error.message
        );

        process.exit(1);
    }
};


// ======================================
// START APPLICATION
// ======================================
startServer();


// ======================================
// GRACEFUL SHUTDOWN
// ======================================
const gracefulShutdown = async (signal) => {

    console.log(
        `🛑 ${signal} received. Shutting down gracefully...`
    );

    if (server) {

        server.close(() => {

            console.log(
                "✅ HTTP server closed"
            );

            process.exit(0);
        });
    } else {

        process.exit(0);
    }
};

process.on(
    "SIGINT",
    () => gracefulShutdown("SIGINT")
);

process.on(
    "SIGTERM",
    () => gracefulShutdown("SIGTERM")
);


// ======================================
// UNHANDLED REJECTION
// ======================================
process.on(

    "unhandledRejection",

    (reason) => {

        console.error(

            "❌ UNHANDLED REJECTION:",

            reason
        );
    }
);


// ======================================
// UNCAUGHT EXCEPTION
// ======================================
process.on(

    "uncaughtException",

    (error) => {

        console.error(

            "❌ UNCAUGHT EXCEPTION:",

            error
        );
    }
);