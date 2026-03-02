const Activity = require("../models/activityModel");
const Channel = require("../models/channelModel");
const validateObjectId = require("../utils/validateObjectId");
const AppError = require("../utils/AppError");

/* =====================================================
   GET CHANNEL ACTIVITY (Paginated + Secured)
===================================================== */
exports.getChannelActivity = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    let { page = 1, limit = 30, type, startDate, endDate } = req.query;

    /* ---------- Validate ID ---------- */
    validateObjectId(channelId, "Channel ID");

    /* ---------- Check Channel Exists ---------- */
    const channel = await Channel.findById(channelId).lean();
    if (!channel) {
      throw new AppError("Channel not found", 404);
    }

    /* ---------- Access Control ---------- */
    const isMember = channel.members.some(
      m => m.user.toString() === req.user.id
    );

    if (!isMember && req.user.role !== "Admin") {
      throw new AppError("Access denied", 403);
    }

    /* ---------- Pagination ---------- */
    page = Math.max(parseInt(page), 1);
    limit = Math.min(Math.max(parseInt(limit), 1), 100); // cap at 100

    const skip = (page - 1) * limit;

    /* ---------- Filtering ---------- */
    const filter = { channel: channelId };

    if (type) {
      filter.type = type;
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    /* ---------- Query ---------- */
    const activities = await Activity.find(filter)
      .populate("user", "name email avatar role")
      .populate("task", "title status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Activity.countDocuments(filter);

    res.status(200).json({
      activities,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + activities.length < total
      }
    });

  } catch (err) {
    next(err);
  }
};
