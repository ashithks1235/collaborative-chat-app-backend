const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require("../utils/sendEmail");

exports.getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const users = await User.find({
      _id: { $ne: currentUserId },     // ❌ Remove logged-in user
      role: { $ne: "Admin" }           // ❌ Remove Super Admin(s)
    })
      .select("-password")
      .lean();

    res.json(users);

  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
};


exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user" });
  }
};

exports.updateMe = async (req, res) => {
  const updateData = {
    name: req.body.name,
  };

  if (req.file) {
    updateData.avatar = `/uploads/${req.file.filename}`;
  }

  const user = await User.findByIdAndUpdate(
    req.user.id,
    updateData,
    { new: true }
  ).select("-password");

  res.json(user);
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    /* ================= VALIDATION ================= */

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current and new password are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters"
      });
    }

    /* ================= GET USER ================= */

    const user = await User.findById(req.user.id).select("+password");

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    /* ================= CHECK CURRENT PASSWORD ================= */

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect"
      });
    }

    /* ================= PREVENT SAME PASSWORD ================= */

    const isSamePassword = await bcrypt.compare(newPassword, user.password);

    if (isSamePassword) {
      return res.status(400).json({
        message: "New password cannot be the same as the current password"
      });
    }

    /* ================= HASH NEW PASSWORD ================= */

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({
      message: "Password updated successfully"
    });

  } catch (err) {
    console.error("Password change error:", err);

    res.status(500).json({
      message: "Password update failed"
    });
  }
};

exports.deleteMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ❌ Prevent Super Admin deletion
    if (user.role === "Admin") {
      return res.status(403).json({
        message: "Super Admin account cannot be deleted"
      });
    }

    await User.findByIdAndDelete(req.user.id);

    res.json({ message: "Account deleted successfully" });

  } catch (err) {
    res.status(500).json({ message: "Account deletion failed" });
  }
};


exports.requestDeleteOtp = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.deleteOtp = otp;
    user.deleteOtpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    await sendEmail(
      user.email,
      "Confirm Account Deletion",
      `Your OTP to delete your account is: ${otp}. It expires in 10 minutes.`
    );

    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};
exports.deactivateUser = async (req, res) => {
  try {
    // Only Super Admin allowed
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        message: "Only Super Admin can deactivate users"
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ❌ Prevent deactivating Super Admin
    if (user.role === "Admin") {
      return res.status(403).json({
        message: "Cannot deactivate Super Admin"
      });
    }

    user.isActive = false;
    await user.save();

    res.json({ message: "User deactivated successfully" });

  } catch (err) {
    res.status(500).json({ message: "Deactivation failed" });
  }
};

exports.activateUser = async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        message: "Only Super Admin can activate users"
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isActive = true;
    await user.save();

    res.json({ message: "User activated successfully" });

  } catch (err) {
    res.status(500).json({ message: "Activation failed" });
  }
};

exports.changeUserRole = async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        message: "Only Super Admin can change roles"
      });
    }

    const { role } = req.body;

    if (!["Moderator", "Member"].includes(role)) {
      return res.status(400).json({
        message: "Invalid role"
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ❌ Prevent modifying Super Admin
    if (user.role === "Admin") {
      return res.status(403).json({
        message: "Cannot modify Super Admin role"
      });
    }

    user.role = role;
    await user.save();

    res.json({ message: "Role updated successfully" });

  } catch (err) {
    res.status(500).json({ message: "Role update failed" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (req.user.role !== "Admin") {
      return res.status(403).json({
        message: "Only Super Admin can delete users"
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ❌ Block deleting Super Admin
    if (user.role === "Admin") {
      return res.status(403).json({
        message: "Cannot delete Super Admin"
      });
    }

    await user.deleteOne();

    res.json({ message: "User deleted successfully" });

  } catch (err) {
    res.status(500).json({ message: "Deletion failed" });
  }
};


exports.confirmDeleteAccount = async (req, res) => {
  try {
    const { otp } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ❌ Block Super Admin
    if (user.role === "Admin") {
      return res.status(403).json({
        message: "Super Admin account cannot be deleted"
      });
    }

    if (
      user.deleteOtp !== otp ||
      user.deleteOtpExpires < Date.now()
    ) {
      return res.status(400).json({
        message: "Invalid or expired OTP"
      });
    }

    await User.findByIdAndDelete(req.user.id);

    res.json({ message: "Account deleted successfully" });

  } catch (err) {
    res.status(500).json({ message: "Deletion failed" });
  }
};
