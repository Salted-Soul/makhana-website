const jwt = require("jsonwebtoken");

const mongoose = require("mongoose");

const User = require("../models/User");


// ======================================
// ENVIRONMENT
// ======================================
const NODE_ENV =
    process.env.NODE_ENV || "development";

const DEBUG =
    process.env.DEBUG === "true";


// ======================================
// ENV VALIDATION
// ======================================
if (!process.env.JWT_SECRET) {

    console.error(
        "❌ JWT_SECRET missing in environment variables"
    );

    process.exit(1);
}


// ======================================
// RESPONSE HELPER
// ======================================
const sendError = (
    res,
    statusCode,
    message
) => {

    return res.status(statusCode).json({

        success: false,

        message
    });
};


// ======================================
// SAFE TOKEN EXTRACTION
// ======================================
const extractToken = (req) => {

    try {

        // ======================================
        // AUTHORIZATION HEADER
        // ======================================
        const authHeader =
            req.headers.authorization;

        if (

            authHeader &&

            typeof authHeader === "string" &&

            authHeader.startsWith("Bearer ")

        ) {

            const token =
                authHeader
                    .split(" ")[1]
                    ?.trim();

            if (token) {

                return token;
            }
        }


        // ======================================
        // COOKIE TOKEN
        // ======================================
        if (

            req.cookies &&

            req.cookies.token

        ) {

            const token =
                String(
                    req.cookies.token
                ).trim();

            if (token) {

                return token;
            }
        }


        return null;

    } catch (error) {

        console.error(
            "❌ TOKEN EXTRACTION ERROR:",
            error.message
        );

        return null;
    }
};


// ======================================
// VERIFY JWT TOKEN
// ======================================
const verifyToken = (token) => {

    try {

        if (!token) {

            return null;
        }


        const decoded = jwt.verify(

            token,

            process.env.JWT_SECRET,

            {

                algorithms: ["HS256"]
            }
        );


        // ======================================
        // SAFE PAYLOAD VALIDATION
        // ======================================
        if (

            !decoded ||

            typeof decoded !== "object"

        ) {

            return null;
        }


        if (

            !decoded.id &&

            !decoded._id

        ) {

            return null;
        }


        return decoded;

    } catch (error) {

        if (DEBUG) {

            console.warn(
                "⚠ JWT VERIFY FAILED:",
                error.message
            );
        }

        return null;
    }
};


// ======================================
// NORMALIZE ROLE
// ======================================
const normalizeRole = (role) => {

    if (!role) {

        return "user";
    }

    return String(role)
        .trim()
        .toLowerCase();
};


// ======================================
// ATTACH USER TO REQUEST
// ======================================
const attachUserToRequest = (
    req,
    user
) => {

    const normalizedRole =
        normalizeRole(user.role);

    req.user = {

        _id: user._id,

        id: user._id,

        name: user.name,

        email: user.email,

        role: normalizedRole,

        isBlocked:
            Boolean(user.isBlocked)
    };

    req.userId =
        String(user._id);

    req.role =
        normalizedRole;
};


// ======================================
// FETCH USER
// ======================================
const fetchUser = async (
    userId
) => {

    try {

        if (

            !userId ||

            !mongoose.Types.ObjectId.isValid(
                userId
            )

        ) {

            return null;
        }


        const user = await User.findById(
            userId
        )

            .select(
                "-password -__v"
            )

            .lean();


        if (!user) {

            return null;
        }


        // ======================================
        // SAFE USER VALIDATION
        // ======================================
        if (

            user.isDeleted ||

            user.accountStatus === "deleted"

        ) {

            return null;
        }


        return user;

    } catch (error) {

        console.error(
            "❌ FETCH USER ERROR:",
            error.message
        );

        return null;
    }
};


// ======================================
// MAIN AUTH PROTECTION
// ======================================
const protect = async (
    req,
    res,
    next
) => {

    try {

        // ======================================
        // EXTRACT TOKEN
        // ======================================
        const token =
            extractToken(req);


        if (!token) {

            return sendError(

                res,

                401,

                "Authentication required"
            );
        }


        // ======================================
        // VERIFY TOKEN
        // ======================================
        const decoded =
            verifyToken(token);


        if (!decoded) {

            return sendError(

                res,

                401,

                "Invalid or expired token"
            );
        }


        // ======================================
        // FETCH USER
        // ======================================
        const userId =

            decoded.id ||

            decoded._id;


        const user =
            await fetchUser(userId);


        if (!user) {

            return sendError(

                res,

                401,

                "User not found"
            );
        }


        // ======================================
        // BLOCKED USER
        // ======================================
        if (

            user.isBlocked ||

            user.accountStatus === "blocked" ||

            user.accountStatus === "suspended"

        ) {

            return sendError(

                res,

                403,

                "Account blocked"
            );
        }


        // ======================================
        // ATTACH USER
        // ======================================
        attachUserToRequest(
            req,
            user
        );


        if (DEBUG) {

            console.log(
                `🔐 AUTHORIZED: ${user.email}`
            );
        }

    console.log("🔥 TOKEN VERIFIED");
        next();

    } catch (error) {

        console.error(
            "❌ AUTH ERROR:",
            error.message
        );

        return sendError(

            res,

            401,

            NODE_ENV === "production"
                ? "Unauthorized"
                : error.message
        );
    }
};


// ======================================
// OPTIONAL AUTH
// ======================================
const optionalAuth = async (
    req,
    res,
    next
) => {

    try {

        const token =
            extractToken(req);


        if (!token) {

            return next();
        }


        const decoded =
            verifyToken(token);


        if (!decoded) {

            return next();
        }


        const user =
            await fetchUser(

                decoded.id ||

                decoded._id
            );


        if (

            user &&

            !user.isBlocked &&

            user.accountStatus !== "blocked"

        ) {

            attachUserToRequest(
                req,
                user
            );
        }


        next();

    } catch (error) {

        console.warn(
            "⚠ OPTIONAL AUTH FAILED:",
            error.message
        );

        next();
    }
};


// ======================================
// ADMIN ONLY
// ======================================
const adminOnly = (
    req,
    res,
    next
) => {

    try {

        if (!req.user) {

            return sendError(

                res,

                401,

                "Authentication required"
            );
        }


        if (

            normalizeRole(
                req.user.role
            ) !== "admin"

        ) {

            return sendError(

                res,

                403,

                "Admin access required"
            );
        }


        next();

    } catch (error) {

        console.error(
            "❌ ADMIN CHECK ERROR:",
            error.message
        );

        return sendError(

            res,

            500,

            NODE_ENV === "production"
                ? "Server error"
                : error.message
        );
    }
};


// ======================================
// SELF ACCESS CHECK
// ======================================
const isSelf = (
    req,
    res,
    next
) => {

    try {

        if (!req.userId) {

            return sendError(

                res,

                401,

                "Authentication required"
            );
        }


        const requestedUserId =

            req.params.userId ||

            req.body.userId ||

            req.query.userId;


        if (!requestedUserId) {

            return sendError(

                res,

                400,

                "User ID required"
            );
        }


        if (

            String(req.userId) !==
            String(requestedUserId)

        ) {

            return sendError(

                res,

                403,

                "Access denied"
            );
        }


        next();

    } catch (error) {

        console.error(
            "❌ SELF ACCESS ERROR:",
            error.message
        );

        return sendError(

            res,

            500,

            NODE_ENV === "production"
                ? "Server error"
                : error.message
        );
    }
};


// ======================================
// FLEXIBLE ROLE CHECK
// ======================================
const hasRole = (
    ...roles
) => {

    const normalizedRoles =

        roles.map(normalizeRole);

    return (
        req,
        res,
        next
    ) => {

        try {

            if (!req.user) {

                return sendError(

                    res,

                    401,

                    "Authentication required"
                );
            }


            const userRole =

                normalizeRole(
                    req.user.role
                );


            if (

                !normalizedRoles.includes(
                    userRole
                )

            ) {

                return sendError(

                    res,

                    403,

                    "Access denied"
                );
            }


            next();

        } catch (error) {

            console.error(
                "❌ ROLE CHECK ERROR:",
                error.message
            );

            return sendError(

                res,

                500,

                NODE_ENV === "production"
                    ? "Server error"
                    : error.message
            );
        }
    };
};


// ======================================
// EXPORTS
// ======================================
module.exports = {

    protect,

    adminOnly,

    optionalAuth,

    isSelf,

    hasRole
};