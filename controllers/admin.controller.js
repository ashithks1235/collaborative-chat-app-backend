const User = require("../models/userModel");
const Channel = require("../models/channelModel");
const Task = require("../models/taskModel");
const Message = require("../models/messageModel");
const Activity = require("../models/activityModel");

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

    const totalUsers = await User.countDocuments();
    const totalChannels = await Channel.countDocuments();
    const totalTasks = await Task.countDocuments();
    const totalMessages = await Message.countDocuments();

    const recentActivity = await Activity.find()
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      totalUsers,
      totalChannels,
      totalTasks,
      totalMessages,
      recentActivity
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSystemActivity = async (req, res) => {
  const Activity = require("../models/activityModel");

  const activity = await Activity.find()
    .populate("user", "name")
    .sort({ createdAt: -1 })
    .limit(50);

  res.json(activity);
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
