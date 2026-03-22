const User = require("../models/userModel");
const Channel = require("../models/channelModel");
const Task = require("../models/taskModel");
const Message = require("../models/messageModel");
const AppError = require("../utils/AppError");
const { getOnlineUsers } = require("../socket");

/* ================= AUTH CHECK ================= */

const ensureAdmin = (user) => {
  if (user.role !== "Admin") {
    throw new AppError("Not authorized", 403);
  }
};

/* ================= USERS ================= */

exports.getUsers = async () => {
  return await User.find()
    .select("name email role")
    .lean();
};

exports.activateUser = async (currentUser, userId) => {
  ensureAdmin(currentUser);

  const user = await User.findByIdAndUpdate(
    userId,
    { isActive: true },
    { new: true }
  );

  if (!user) throw new AppError("User not found", 404);

  return user;
};

exports.deactivateUser = async (currentUser, userId) => {
  ensureAdmin(currentUser);

  const user = await User.findByIdAndUpdate(
    userId,
    { isActive: false },
    { new: true }
  );

  if (!user) throw new AppError("User not found", 404);

  return user;
};

exports.deleteUser = async (currentUser, userId) => {
  ensureAdmin(currentUser);

  const user = await User.findById(userId);

  if (!user) throw new AppError("User not found", 404);

  if (user.role === "Admin") {
    throw new AppError("Cannot delete Admin user", 403);
  }

  await user.deleteOne();

  return true;
};

exports.changeUserRole = async (currentUser, userId, role) => {
  ensureAdmin(currentUser);

  if (!["Admin", "Moderator", "Member"].includes(role)) {
    throw new AppError("Invalid role", 400);
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true }
  ).select("-password");

  if (!user) throw new AppError("User not found", 404);

  return user;
};

/* ================= DASHBOARD ================= */

exports.getAdminOverview = async (currentUser) => {
  ensureAdmin(currentUser);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalChannels,
    totalTasks,
    completedTasks,
    totalMessages,
    messagesToday,
    tasksToday
  ] = await Promise.all([
    User.countDocuments({ role: { $ne: "Admin" } }),
    Channel.countDocuments(),
    Task.countDocuments({ isDeleted: false }),
    Task.countDocuments({ status: "completed", isDeleted: false }),
    Message.countDocuments(),
    Message.countDocuments({ createdAt: { $gte: today } }),
    Task.countDocuments({ createdAt: { $gte: today } })
  ]);

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 6);
  last7Days.setHours(0, 0, 0, 0);

  const messagesWeekly = await Message.aggregate([
    { $match: { createdAt: { $gte: last7Days } } },
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
    { $match: { createdAt: { $gte: last7Days } } },
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

  return {
    totalUsers,
    totalChannels,
    totalTasks,
    completedTasks,
    totalMessages,
    liveUsers: getOnlineUsers(),
    messagesToday,
    tasksToday,
    systemStatus: "Healthy",
    weeklyAnalytics: {
      messages: messagesWeekly,
      tasks: tasksWeekly
    }
  };
};

/* ================= CHANNELS ================= */

exports.getAllChannelsAdmin = async () => {
  return await Channel.find()
    .populate("createdBy", "name email")
    .populate("members.user", "name email role")
    .lean();
};