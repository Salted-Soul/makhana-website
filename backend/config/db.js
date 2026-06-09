const mongoose = require("mongoose");


// ======================================
// ENVIRONMENT
// ======================================
const NODE_ENV =
    process.env.NODE_ENV || "development";

const DEBUG =
    process.env.DEBUG === "true";


// ======================================
// MONGOOSE SETTINGS
// ======================================
mongoose.set(
    "strictQuery",
    true
);


// ======================================
// SAFE DEBUG LOGGER
// ======================================
if (

    DEBUG &&

    NODE_ENV !== "production"

) {

    mongoose.set(

        "debug",

        (

            collectionName,
            method,
            query
        ) => {

            console.log(

                `🟢 Mongoose: ${collectionName}.${method}`,

                JSON.stringify(query)
            );
        }
    );
}


// ======================================
// CONNECTION STATE
// ======================================
let isConnected = false;

let reconnectAttempts = 0;

const MAX_RECONNECT_ATTEMPTS = 5;

const RECONNECT_INTERVAL = 5000;


// ======================================
// CONNECTION OPTIONS
// ======================================
const mongoOptions = {

    // SAFE INDEXING
    autoIndex:
        NODE_ENV !== "production",

    // TIMEOUTS
    serverSelectionTimeoutMS:
        10000,

    socketTimeoutMS:
        45000,

    connectTimeoutMS:
        10000,

    // FORCE IPV4
    family: 4,

    // POOL SETTINGS
    maxPoolSize: 20,

    minPoolSize: 5,

    // RETRY
    retryWrites: true,

    retryReads: true
};


// ======================================
// DATABASE CONNECTION
// ======================================
const connectDB = async () => {

    try {

        // ======================================
        // VALIDATE ENV
        // ======================================
        if (!process.env.MONGO_URI) {

            throw new Error(

                "❌ MONGO_URI missing in .env"
            );
        }


        // ======================================
        // PREVENT DUPLICATE CONNECTION
        // ======================================
        if (

            isConnected ||

            mongoose.connection.readyState === 1

        ) {

            console.log(
                "🟢 MongoDB already connected"
            );

            return mongoose.connection;
        }


        console.log(
            "🟡 Connecting to MongoDB..."
        );


        // ======================================
        // CONNECT DATABASE
        // ======================================
        const conn = await mongoose.connect(

            process.env.MONGO_URI,

            mongoOptions
        );


        // ======================================
        // SUCCESS
        // ======================================
        isConnected = true;

        reconnectAttempts = 0;


        console.log(

            `✅ MongoDB Connected: ${conn.connection.host}`
        );

        console.log(

            `📦 Database: ${conn.connection.name}`
        );


        return conn;

    } catch (error) {

        isConnected = false;

        reconnectAttempts++;


        console.error(
            "❌ DATABASE CONNECTION FAILED:"
        );

        console.error(
            error.message
        );


        // ======================================
        // RETRY LOGIC
        // ======================================
        if (

            reconnectAttempts <=
            MAX_RECONNECT_ATTEMPTS

        ) {

            console.log(

                `🔄 Retrying database connection (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in 5 seconds...`
            );

            setTimeout(

                connectDB,

                RECONNECT_INTERVAL
            );

        } else {

            console.error(

                "❌ Maximum MongoDB reconnect attempts reached"
            );

            process.exit(1);
        }
    }
};


// ======================================
// CONNECTION EVENTS
// ======================================
mongoose.connection.on(

    "connected",

    () => {

        isConnected = true;

        console.log(
            "🟢 MongoDB connection established"
        );
    }
);


mongoose.connection.on(

    "error",

    (error) => {

        console.error(

            "🔴 MongoDB connection error:",

            error.message
        );
    }
);


mongoose.connection.on(

    "disconnected",

    () => {

        isConnected = false;

        console.warn(
            "🟠 MongoDB disconnected"
        );
    }
);


mongoose.connection.on(

    "reconnected",

    () => {

        isConnected = true;

        console.log(
            "🟢 MongoDB reconnected"
        );
    }
);


// ======================================
// GRACEFUL SHUTDOWN
// ======================================
const gracefulShutdown = async () => {

    try {

        await mongoose.connection.close();

        console.log(
            "🛑 MongoDB connection closed"
        );

        process.exit(0);

    } catch (error) {

        console.error(

            "❌ MongoDB shutdown error:",

            error.message
        );

        process.exit(1);
    }
};


process.once(

    "SIGINT",

    gracefulShutdown
);

process.once(

    "SIGTERM",

    gracefulShutdown
);


// ======================================
// EXPORT
// ======================================
module.exports = connectDB;