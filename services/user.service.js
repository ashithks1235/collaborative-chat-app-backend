const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const AppError = require("../utils/AppError");
const { sendEmail } = require("../utils/sendEmail");

/* ================= USERS ================= */

exports.getAllUsers = async (currentUserId) => {
  return await User.find({
    _id: { $ne: currentUserId },
    role: { $ne: "Admin" },
  })
    .select("-password")
    .lean();
};

exports.getMe = async (userId) => {
  const user = await User.findById(userId)
    .select("-password")
    .lean();

  if (!user) throw new AppError("User not found", 404);

  return user;
};

exports.updateMe = async (userId, data, file) => {
  const updateData = {
    name: data.name,
  };

  if (file) {
    updateData.avatar = `/uploads/${file.filename}`;
  }

  return await User.findByIdAndUpdate(userId, updateData, {
    new: true,
  }).select("-password");
};

/* ================= PASSWORD ================= */

exports.changePassword = async (userId, currentPassword, newPassword) => {
  if (!currentPassword || !newPassword) {
    throw new AppError("Current and new password are required", 400);
  }

  if (newPassword.length < 6) {
    throw new AppError("New password must be at least 6 characters", 400);
  }

  const user = await User.findById(userId).select("+password");

  if (!user) throw new AppError("User not found", 404);

  const isMatch = await bcrypt.compare(currentPassword, user.password);

  if (!isMatch) {
    throw new AppError("Current password is incorrect", 400);
  }

  const isSame = await bcrypt.compare(newPassword, user.password);

  if (isSame) {
    throw new AppError(
      "New password cannot be the same as the current password",
      400
    );
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  return true;
};

/* ================= DELETE OTP ================= */

exports.requestDeleteOtp = async (userId) => {
  const user = await User.findById(userId);

  if (!user) throw new AppError("User not found", 404);

  if (user.role === "Admin") {
    throw new AppError("Admin account cannot be deleted", 403);
  }

  if (
    user.deleteOtpExpires &&
    user.deleteOtpExpires > Date.now() - 60 * 1000
  ) {
    throw new AppError("Please wait before requesting another OTP", 429);
  }

  const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();

  const hashedOtp = crypto
    .createHash("sha256")
    .update(rawOtp)
    .digest("hex");

  user.deleteOtp = hashedOtp;
  user.deleteOtpExpires = Date.now() + 10 * 60 * 1000;

  await user.save();

  await sendEmail(
    user.email,
    "Confirm Account Deletion",
    `Your OTP is ${rawOtp}. It expires in 10 minutes.`
  );

  return true;
};

exports.confirmDeleteAccount = async (userId, otp) => {
  const user = await User.findById(userId);

  if (!user) throw new AppError("User not found", 404);

  if (user.role === "Admin") {
    throw new AppError("Super Admin account cannot be deleted", 403);
  }

  const hashedOtp = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

  if (
    user.deleteOtp !== hashedOtp ||
    user.deleteOtpExpires < Date.now()
  ) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  user.deleteOtp = undefined;
  user.deleteOtpExpires = undefined;

  await user.deleteOne();

  return true;
};