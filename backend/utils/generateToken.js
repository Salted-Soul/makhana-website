const jwt = require("jsonwebtoken");

/**
 * Generate JWT Token
 * @param {string} userId - MongoDB user ID
 * @returns {string} JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId }, // Payload (what we store inside token)
    process.env.JWT_SECRET, // Secret key from .env
    {
      expiresIn: process.env.JWT_EXPIRES_IN, // Expiry (7 days)
    }
  );
};

module.exports = generateToken;