const { body, validationResult } = require("express-validator");

exports.validateLogin = [
  body("email").isEmail(),
  body("password").notEmpty(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({
        success: false,
        message: errors.array()[0]?.msg || "Invalid input"
      });
    next();
  }
];
