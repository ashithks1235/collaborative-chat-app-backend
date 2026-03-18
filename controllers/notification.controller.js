const notificationService = require("../services/notification.service");

/* ================= GET ================= */

exports.getNotifications = async (req, res, next) => {
  try {
    const data = await notificationService.getNotifications(
      req.user.id,
      req.query
    );

    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

/* ================= UNREAD COUNT ================= */

exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(
      req.user.id
    );

    res.status(200).json({ unreadCount: count });
  } catch (err) {
    next(err);
  }
};

/* ================= MARK ONE ================= */

exports.markAsRead = async (req, res, next) => {
  try {
    const notificationId = await notificationService.markAsRead(
      req.params.id,
      req.user.id
    );

    const io = req.app.get("io");

    // 🔥 KEEP SOCKET HERE
    io.to(`user:${req.user.id}`)
      .emit("notification:read", notificationId);

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

/* ================= MARK ALL ================= */

exports.markAllAsRead = async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user.id);

    const io = req.app.get("io");

    io.to(`user:${req.user.id}`)
      .emit("notification:allRead");

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

/* ================= DELETE ================= */

exports.deleteNotification = async (req, res, next) => {
  try {
    await notificationService.deleteNotification(
      req.params.id,
      req.user.id
    );

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};