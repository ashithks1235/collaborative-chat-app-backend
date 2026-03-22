const fs = require("fs");
const User = require("../models/userModel");
const Channel = require("../models/channelModel");
const Project = require("../models/projectModel");
const Task = require("../models/taskModel");
const Message = require("../models/messageModel");
const Notification = require("../models/notificationModel");
const Note = require("../models/noteModel");
const Reminder = require("../models/reminderModel");
const Activity = require("../models/activityModel");
const TaskComment = require("../models/taskCommentModel");
const File = require("../models/fileModel");
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
    const mimeType = file.mimetype || "image/png";
    const fileBuffer = file.buffer || fs.readFileSync(file.path);

    updateData.avatar = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;

    if (file.path) {
      fs.promises.unlink(file.path).catch(() => {});
    }
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
  user.deleteOtpVerifiedAt = undefined;

  await user.save();

  try {
    await sendEmail(
      user.email,
      "Confirm Account Deletion",
      `Your OTP is ${rawOtp}. It expires in 10 minutes.`
    );
  } catch (error) {
    user.deleteOtp = undefined;
    user.deleteOtpExpires = undefined;
    user.deleteOtpVerifiedAt = undefined;
    await user.save();
    throw new AppError(
      error.message || "Failed to send OTP email. Check the email configuration and try again.",
      500
    );
  }

  return true;
};

exports.verifyDeleteOtp = async (userId, otp) => {
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
    !user.deleteOtpExpires ||
    user.deleteOtpExpires < Date.now()
  ) {
    throw new AppError("Invalid or expired OTP", 400);
  }

  user.deleteOtpVerifiedAt = new Date();
  await user.save();

  return true;
};

exports.confirmDeleteAccount = async (userId) => {
  const user = await User.findById(userId);

  if (!user) throw new AppError("User not found", 404);

  if (user.role === "Admin") {
    throw new AppError("Super Admin account cannot be deleted", 403);
  }

  if (
    !user.deleteOtpVerifiedAt ||
    Date.now() - new Date(user.deleteOtpVerifiedAt).getTime() > 10 * 60 * 1000
  ) {
    throw new AppError("Verify your OTP before deleting the account", 400);
  }

  await Promise.all([
    Channel.updateMany({}, { $pull: { members: { user: user._id } } }),
    Project.updateMany({}, { $pull: { members: user._id } }),
    Task.updateMany({}, { $pull: { assignees: user._id } }),
    Message.updateMany(
      {},
      {
        $pull: {
          seenBy: user._id,
          mentions: user._id,
          threadReadBy: user._id
        }
      }
    ),
    Message.updateMany(
      { "reactions.users": user._id },
      { $pull: { "reactions.$[].users": user._id } }
    ),
    File.updateMany({}, { $pull: { hiddenFor: user._id } }),
    Note.deleteMany({ user: user._id }),
    Reminder.deleteMany({ user: user._id }),
    Activity.deleteMany({ user: user._id }),
    Notification.deleteMany({ user: user._id }),
    TaskComment.deleteMany({ user: user._id })
  ]);

  user.deleteOtp = undefined;
  user.deleteOtpExpires = undefined;
  user.deleteOtpVerifiedAt = undefined;

  await user.deleteOne();

  return true;
};
