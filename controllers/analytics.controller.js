const Message = require("../models/messageModel");
const Task = require("../models/taskModel");
const Project = require("../models/projectModel");
const User = require("../models/userModel");

exports.getAnalytics = async (req, res, next) => {
  try {

    const userId = req.user.id;
    const role = req.user.role;

    let taskFilter = { isDeleted: false };

    /* ================= ROLE BASED TASK VISIBILITY ================= */

    if (role === "Admin") {

      taskFilter = { isDeleted: false };

    } else if (role === "Moderator") {

      const projects = await Project.find({
        members: userId
      }).select("_id");

      const projectIds = projects.map(p => p._id);

      taskFilter.project = { $in: projectIds };

    } else {

      taskFilter.assignees = userId;

    }

    /* ================= TASK ANALYTICS ================= */

    const totalTasks = await Task.countDocuments(taskFilter);

    const completedTasks = await Task.countDocuments({
      ...taskFilter,
      status: "completed"
    });

    const pendingTasks = await Task.countDocuments({
      ...taskFilter,
      status: "todo"
    });

    const inProgressTasks = await Task.countDocuments({
      ...taskFilter,
      status: "inprogress"
    });

    const completionRate =
      totalTasks === 0
        ? 0
        : Math.round((completedTasks / totalTasks) * 100);

    /* ================= ACTIVE USERS ================= */

    const activeUsers = await User.countDocuments({
      role: { $ne: "Admin" },
      isActive: true
    });

    /* ================= MESSAGES PER DAY ================= */

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 6);
    last7Days.setHours(0,0,0,0);

    const messagesPerDay = await Message.aggregate([
      {
        $match: { createdAt: { $gte: last7Days } }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt"
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    /* ================= ACTIVITY PER DAY ================= */

    const messageActivity = await Message.aggregate([
      {
        $match: { createdAt: { $gte: last7Days } }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt"
            }
          },
          messages: { $sum: 1 }
        }
      }
    ]);

    const taskActivity = await Task.aggregate([
      {
        $match: {
          createdAt: { $gte: last7Days },
          isDeleted: false
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt"
            }
          },
          tasks: { $sum: 1 }
        }
      }
    ]);

    /* ================= MERGE ACTIVITY ================= */

    const activityMap = {};

    messageActivity.forEach(m => {
      activityMap[m._id] = { messages: m.messages, tasks: 0 };
    });

    taskActivity.forEach(t => {
      if (!activityMap[t._id]) {
        activityMap[t._id] = { messages: 0, tasks: t.tasks };
      } else {
        activityMap[t._id].tasks = t.tasks;
      }
    });

    const activityPerDay = Object.keys(activityMap).map(day => ({
      _id: day,
      messages: activityMap[day].messages,
      tasks: activityMap[day].tasks
    }));

    /* ================= RESPONSE ================= */

    res.json({
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedTasks,
      completionRate,
      activeUsers,
      messagesPerDay,
      activityPerDay
    });

  } catch (err) {
    next(err);
  }
};