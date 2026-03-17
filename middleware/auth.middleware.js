const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");

/* ===========================
   AUTHENTICATION MIDDLEWARE
   (Login Required)
=========================== */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // 🔐 Check header existence & format
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new AppError("Authorization token missing", 401));
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return next(new AppError("Authorization token missing", 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!decoded || !decoded.id) {
        return next(new AppError("Invalid token payload", 401));
      }

      req.user = {
        id: decoded.id,
        role: decoded.role,
        name: decoded.name
      };

    next();

  } catch (err) {
    return next(new AppError("Invalid or expired token", 401));
  }
};

module.exports = authMiddleware;