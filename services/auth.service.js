const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/userModel");
const AppError = require("../utils/AppError");

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

/* ================= REGISTER ================= */
exports.registerUser = async ({ username, email, password }) => {
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new AppError("User already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name: username,
    email,
    password: hashedPassword,
    role: "Member",
    isActive: true,
  });

  const token = generateToken(user);

  return { user, token };
};

/* ================= LOGIN ================= */
exports.loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email }).select("+password");

  if (!user) {
    throw new AppError("Invalid credentials", 401);
  }

  if (!user.isActive) {
    throw new AppError(
      "Account is deactivated. Contact administrator.",
      403
    );
  }

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    throw new AppError("Invalid credentials", 401);
  }

  const token = generateToken(user);

  return { user, token };
};

/* ================= FORGOT PASSWORD ================= */
exports.forgotPassword = async ({ email }) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (!user.isActive) {
    throw new AppError("Account is deactivated.", 403);
  }

  const resetToken = crypto.randomBytes(20).toString("hex");

  // 🔐 HASH TOKEN (SECURITY FIX)
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.resetToken = hashedToken;
  user.resetTokenExpiry = Date.now() + 15 * 60 * 1000;

  await user.save();

  return { resetToken };
};