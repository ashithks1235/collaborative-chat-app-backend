const User = require("../models/userModel");
const Channel = require("../models/channelModel");
const Task = require("../models/taskModel");
const Message = require("../models/messageModel");
const { getOnlineUsers } = require("../socket");

// Get all users
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select("name email role")
      .lean();

    res.json(users);
  } catch (err) {
    next(err);
  }
};

// Deactivate user
exports.deactivateUser = async (req, res) => {
  const { id } = req.params;

  const user = await User.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.status(200).json({
    message: "User deactivated successfully",
    user
  });
};

exports.changeUserRole = async (req, res) => {
  const { role } = req.body;

  if (!["Admin", "Moderator", "Member"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true }
  ).select("-password");

  res.json(user);
};

exports.getAdminOverview = async (req, res) => {
  try {

    if (req.user.role !== "Admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    const [
      totalUsers,
      totalChannels,
      totalTasks,
      totalMessages,
      messagesToday,
      tasksToday
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: "Admin" } }),
      Channel.countDocuments(),
      Task.countDocuments(),
      Message.countDocuments(),

      Message.countDocuments({ createdAt: { $gte: today } }),
      Task.countDocuments({ createdAt: { $gte: today } })
    ]);

    /* ===============================
        WEEKLY ANALYTICS
      =============================== */

      const last7Days = new Date();
      last7Days.setDate(last7Days.getDate() - 6);
      last7Days.setHours(0,0,0,0);

      const messagesWeekly = await Message.aggregate([
        {
          $match: { createdAt: { $gte: last7Days } }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      const tasksWeekly = await Task.aggregate([
        {
          $match: { createdAt: { $gte: last7Days } }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);

    res.json({
      totalUsers,
      totalChannels,
      totalTasks,
      totalMessages,

      liveUsers: getOnlineUsers(),
      messagesToday,
      tasksToday,
      systemStatus: "Healthy",

      weeklyAnalytics: {
        messages: messagesWeekly,
        tasks: tasksWeekly
      }

    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllChannelsAdmin = async (req, res) => {
  try {
    const channels = await Channel.find()
      .populate("createdBy", "name email")
      .populate("members.user", "name email role")
      .lean();

    res.json(channels);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch channels" });
  }
};
