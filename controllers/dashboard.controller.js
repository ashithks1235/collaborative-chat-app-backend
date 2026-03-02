const Channel = require("../models/channelModel");
const Task = require("../models/taskModel");
const Project = require("../models/projectModel");

exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date();

    /* ===========================
       1️⃣ RECENT CHANNELS
    =========================== */
    const channels = await Channel.find({ "members.users": userId })
      .sort({ updatedAt: -1 })
      .limit(4)
      .select("name")
      .lean();

    /* ===========================
       2️⃣ RECENT TASKS
    =========================== */
    const tasks = await Task.find({ createdBy: userId })
      .sort({ updatedAt: -1 })
      .limit(4)
      .select("title status project dueDate assignedTo")
      .lean();

    /* ===========================
       3️⃣ RECENT PROJECTS
    =========================== */
    const projects = await Project.find({ createdBy: userId })
      .sort({ updatedAt: -1 })
      .limit(4)
      .select("name")
      .lean();

    /* ===========================
       4️⃣ DASHBOARD STATS
    =========================== */

    // Total Tasks Assigned to Me
    const totalTasks = await Task.countDocuments({
      assignedTo: userId,
    });

    // Completed Tasks
    const completedTasks = await Task.countDocuments({
      assignedTo: userId,
      status: "done",
    });

    // Overdue Tasks
    const overdueTasks = await Task.countDocuments({
      assignedTo: userId,
      status: { $ne: "done" },
      dueDate: { $lt: today },
    });

    res.json({
      channels,
      tasks,
      projects,
      stats: {
        totalTasks,
        completedTasks,
        overdueTasks,
      },
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
