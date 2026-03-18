const Notification = require("../models/notificationModel");
const validateObjectId = require("../utils/validateObjectId");
const AppError = require("../utils/AppError");

/* ================= GET NOTIFICATIONS ================= */

exports.getNotifications = async (userId, query) => {
  let { page = 1, limit = 20, unread } = query;

  page = Math.max(parseInt(page), 1);
  limit = Math.min(Math.max(parseInt(limit), 1), 50);

  const skip = (page - 1) * limit;

  const filter = { user: userId };

  if (unread === "true") {
    filter.read = false;
  }

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Notification.countDocuments(filter);

  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + notifications.length < total
    }
  };
};

/* ================= UNREAD COUNT ================= */

exports.getUnreadCount = async (userId) => {
  return await Notification.countDocuments({
    user: userId,
    read: false
  });
};

/* ================= MARK ONE ================= */

exports.markAsRead = async (notificationId, userId) => {
  validateObjectId(notificationId, "Notification ID");

  const notification = await Notification.findById(notificationId);

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  if (notification.user.toString() !== userId) {
    throw new AppError("Access denied", 403);
  }

  notification.read = true;
  await notification.save();

  return notificationId;
};

/* ================= MARK ALL ================= */

exports.markAllAsRead = async (userId) => {
  await Notification.updateMany(
    { user: userId, read: false },
    { $set: { read: true } }
  );

  return true;
};

/* ================= DELETE ================= */

exports.deleteNotification = async (notificationId, userId) => {
  validateObjectId(notificationId, "Notification ID");

  const notification = await Notification.findById(notificationId);

  if (!notification) {
    throw new AppError("Notification not found", 404);
  }

  if (notification.user.toString() !== userId) {
    throw new AppError("Access denied", 403);
  }

  await notification.deleteOne();

  return true;
};