const userService = require("../services/user.service");
const adminService = require("../services/admin.service");

/* ================= USERS ================= */

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers(req.user.id);
    res.json(users);
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await userService.getMe(req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

exports.updateMe = async (req, res, next) => {
  try {
    const user = await userService.updateMe(
      req.user.id,
      req.body,
      req.file
    );
    res.json(user);
  } catch (err) {
    next(err);
  }
};

/* ================= PASSWORD ================= */

exports.changePassword = async (req, res, next) => {
  try {
    await userService.changePassword(
      req.user.id,
      req.body.currentPassword,
      req.body.newPassword
    );

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
};

/* ================= DELETE FLOW ================= */

exports.requestDeleteOtp = async (req, res, next) => {
  try {
    await userService.requestDeleteOtp(req.user.id);
    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    next(err);
  }
};

exports.confirmDeleteAccount = async (req, res, next) => {
  try {
    await userService.confirmDeleteAccount(req.user.id);

    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    next(err);
  }
};

exports.verifyDeleteOtp = async (req, res, next) => {
  try {
    await userService.verifyDeleteOtp(
      req.user.id,
      req.body.otp
    );

    res.json({ message: "OTP verified successfully" });
  } catch (err) {
    next(err);
  }
};
