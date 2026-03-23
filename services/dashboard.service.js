const Channel = require("../models/channelModel");
const Task = require("../models/taskModel");
const Project = require("../models/projectModel");

/* ================= DASHBOARD ================= */

exports.getDashboard = async (userId) => {
  const today = new Date();

  /* ---------- CHANNELS ---------- */
  const channels = await Channel.find({
    "members.user": userId
  })
    .sort({ updatedAt: -1 })
    .limit(4)
    .select("name")
    .lean();

  /* ---------- TASKS ---------- */
  const tasks = await Task.find({
    assignees: userId,
    isDeleted: false
  })
    .sort({ updatedAt: -1 })
    .limit(4)
    .select("title status project")
    .lean();

  /* ---------- PROJECTS ---------- */
  const projects = await Project.find({
    $or: [
      { createdBy: userId },
      { members: userId }
    ]
  })
    .sort({ updatedAt: -1 })
    .limit(4)
    .select("name")
    .lean();

  /* ---------- STATS ---------- */
  const totalTasks = await Task.countDocuments({
    assignees: userId,
    isDeleted: false
  });

  const completedTasks = await Task.countDocuments({
    assignees: userId,
    status: "completed",
    isDeleted: false
  });

  const overdueTasks = await Task.countDocuments({
    assignees: userId,
    status: { $ne: "completed" },
    dueDate: { $lt: today },
    isDeleted: false
  });

  return {
    channels,
    tasks,
    projects,
    stats: {
      totalTasks,
      completedTasks,
      overdueTasks,
    },
  };
};
