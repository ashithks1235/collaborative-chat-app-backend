const adminService = require("../services/admin.service");

/* ================= USERS ================= */

exports.getUsers = async (req, res, next) => {
  try {
    const users = await adminService.getUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
};

exports.activateUser = async (req, res, next) => {
  try {
    const user = await adminService.activateUser(
      req.user,
      req.params.id
    );

    res.status(200).json({
      message: "User activated successfully",
      user
    });
  } catch (err) {
    next(err);
  }
};

exports.deactivateUser = async (req, res, next) => {
  try {
    const user = await adminService.deactivateUser(
      req.user,
      req.params.id
    );

    res.status(200).json({
      message: "User deactivated successfully",
      user
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    await adminService.deleteUser(req.user, req.params.id);

    res.status(200).json({
      message: "User deleted successfully"
    });
  } catch (err) {
    next(err);
  }
};

exports.changeUserRole = async (req, res, next) => {
  try {
    const user = await adminService.changeUserRole(
      req.user,
      req.params.id,
      req.body.role
    );

    res.json(user);
  } catch (err) {
    next(err);
  }
};

/* ================= DASHBOARD ================= */

exports.getAdminOverview = async (req, res, next) => {
  try {
    const data = await adminService.getAdminOverview(req.user);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

/* ================= CHANNELS ================= */

exports.getAllChannelsAdmin = async (req, res, next) => {
  try {
    const channels = await adminService.getAllChannelsAdmin();
    res.json(channels);
  } catch (err) {
    next(err);
  }
};