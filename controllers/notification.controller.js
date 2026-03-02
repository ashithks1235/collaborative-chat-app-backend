const Notification = require("../models/notificationModel");
const validateObjectId = require("../utils/validateObjectId");
const AppError = require("../utils/AppError");

/* =====================================================
   GET NOTIFICATIONS (Paginated + Filter)
===================================================== */
exports.getNotifications = async (req, res, next) => {
  try {
    let { page = 1, limit = 20, unread } = req.query;

    page = Math.max(parseInt(page), 1);
    limit = Math.min(Math.max(parseInt(limit), 1), 50);

    const skip = (page - 1) * limit;

    const filter = { user: req.user.id };

    if (unread === "true") {
      filter.read = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments(filter);

    res.status(200).json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + notifications.length < total
      }
    });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   GET UNREAD COUNT
===================================================== */
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user.id,
      read: false
    });

    res.status(200).json({ unreadCount: count });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   MARK SINGLE AS READ
===================================================== */
exports.markAsRead = async (req, res, next) => {
  try {
    const notificationId = req.params.id;

    validateObjectId(notificationId, "Notification ID");

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw new AppError("Notification not found", 404);
    }

    if (notification.user.toString() !== req.user.id) {
      throw new AppError("Access denied", 403);
    }

    notification.read = true;
    await notification.save();

    const io = req.app.get("io");
    io.to(req.user.id).emit("notification:read", notificationId);

    res.status(200).json({ success: true });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   MARK ALL AS READ
===================================================== */
exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { $set: { read: true } }
    );

    const io = req.app.get("io");
    io.to(req.user.id).emit("notification:allRead");

    res.status(200).json({ success: true });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   DELETE NOTIFICATION (Optional)
===================================================== */
exports.deleteNotification = async (req, res, next) => {
  try {
    const notificationId = req.params.id;

    validateObjectId(notificationId, "Notification ID");

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throw new AppError("Notification not found", 404);
    }

    if (notification.user.toString() !== req.user.id) {
      throw new AppError("Access denied", 403);
    }

    await notification.deleteOne();

    res.status(200).json({ success: true });

  } catch (err) {
    next(err);
  }
};
