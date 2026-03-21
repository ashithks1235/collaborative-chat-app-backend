const Task = require("../models/taskModel");
const Board = require("../models/boardModel");
const Column = require("../models/columnModel");
const Message = require("../models/messageModel");
const Project = require("../models/projectModel");
const validateObjectId = require("../utils/validateObjectId");
const AppError = require("../utils/AppError");
const sanitizeHtml = require("sanitize-html");
const TaskComment = require("../models/taskCommentModel");
const Notification = require("../models/notificationModel");
const User = require("../models/userModel");
const Channel = require("../models/channelModel");
const useAccessProject = require("../utils/canAccessProject");
const taskService = require("../services/task.service");

/* =====================================================
   GET TASKS (KANBAN)
===================================================== */
exports.getTasks = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    validateObjectId(projectId, "Project ID");

    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);

    if (!(await useAccessProject(project, req.user))) {
      throw new AppError("Access denied", 403);
    }

    const board = await Board.findOne({ project: projectId });
    if (!board) throw new AppError("Board not found", 404);

    const columns = await Column.find({ board: board._id })
      .sort({ order: 1 })
      .lean();

    const tasks = await Task.find({
      board: board._id,
      isDeleted: false,
      parentTask: null
    })
      .populate("assignees", "name avatar role")
      .populate("createdBy", "name avatar role")
      .sort({ order: 1 })
      .lean();

      // Fetch subtasks
    const subtasks = await Task.find({
      parentTask: { $ne: null },
      isDeleted: false
    })
    .select("_id title status parentTask")
    .lean();

    // Map subtasks to parent tasks
    const subtaskListMap = {};

    subtasks.forEach((st) => {
      const parentId = st.parentTask.toString();

      if (!subtaskListMap[parentId]) {
        subtaskListMap[parentId] = [];
      }

      subtaskListMap[parentId].push(st);
    });

    const commentStats = await TaskComment.aggregate([
      {
        $group: {
          _id: "$task",
          count: { $sum: 1 },
          users: { $addToSet: "$user" }
        }
      }
    ]);

    /* ================= SUBTASK STATS ================= */

      const subtaskStats = await Task.aggregate([
        {
          $match: {
            parentTask: { $ne: null },
            isDeleted: false
          }
        },
        {
          $group: {
            _id: "$parentTask",
            total: { $sum: 1 },
            completed: {
              $sum: {
                $cond: [{ $eq: ["$status", "completed"] }, 1, 0]
              }
            }
          }
        }
      ]);

      const subtaskMap = {};

      subtaskStats.forEach(s => {
        subtaskMap[s._id.toString()] = {
          total: s.total,
          completed: s.completed
        };
      });

    const statsMap = {};

    commentStats.forEach(c => {
      statsMap[c._id.toString()] = {
        count: c.count,
        users: c.users
      };
    });

    const grouped = columns.map(col => ({
      ...col,
      tasks: tasks
        .filter(t => t.column.toString() === col._id.toString())
        .map(t => {

          const sub = subtaskMap[t._id.toString()] || {
            total: 0,
            completed: 0
          };

          const progress =
            sub.total > 0
              ? Math.round((sub.completed / sub.total) * 100)
              : 0;

          return {
            ...t,

            commentsCount: statsMap[t._id.toString()]?.count || 0,
            commentUsers: statsMap[t._id.toString()]?.users || [],

            subtaskCount: sub.total,
            completedSubtasks: sub.completed,
            progress,

            // 🔥 ADD THIS
            subtasks: subtaskListMap[t._id.toString()] || []
          };
        })
    }));

    res.status(200).json({ success: true, data: grouped });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   CREATE TASK (KANBAN)
===================================================== */
exports.createTask = async (req, res, next) => {
  try {
    const task = await taskService.createTask(
      req.params.projectId,
      req.body,
      req.user
    );

    const populatedTask = await Task.findById(task._id)
      .populate("assignees", "name avatar role")
      .populate("createdBy", "name avatar role");

    const io = req.app.get("io");

    io.to(`project:${req.params.projectId}`)
      .emit("task:created", populatedTask);

    res.status(201).json({
      success: true,
      data: populatedTask
    });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   MOVE TASK (ASSIGNEE + SEMI STRUCTURED WORKFLOW)
===================================================== */
exports.moveTask = async (req, res, next) => {
  try {
    const { task, completedNow } = await taskService.moveTask(
      req.params.taskId,
      req.body.targetColumnId,
      req.body.newOrder,
      req.user.id
    );

    const populatedTask = await Task.findById(task._id)
      .populate("assignees", "name avatar role")
      .populate("createdBy", "name avatar role");

    const io = req.app.get("io");

    io.to(`project:${task.project}`)
      .emit("task:moved", populatedTask);

    if (completedNow) {
      try {
        const actor = await User.findById(req.user.id).select("name");

        if (actor?.name) {
          const recipientIds = new Set([
            task.createdBy?.toString(),
            ...task.assignees.map((assigneeId) => assigneeId.toString())
          ]);

          recipientIds.delete(req.user.id);

          for (const recipientId of recipientIds) {
            if (!recipientId) continue;

            const notif = await Notification.create({
              user: recipientId,
              text: `${actor.name} completed a task`,
              type: "task_completed",
              link: `/projects/${task.project}`
            });

            io.to(`user:${recipientId}`).emit("notification:new", notif);
          }
        }
      } catch (notificationError) {
        console.error("Task completion notification failed:", notificationError);
      }
    }

    res.status(200).json({
      success: true,
      data: populatedTask
    });

  } catch (err) {
    next(err);
  }
};

/* =====================================================
   CONVERT MESSAGE / THREAD REPLY TO TASK (SMART)
===================================================== */
exports.convertMessageToTask = async (req, res, next) => {
  try {

    const { messageId } = req.params;

    let {
      projectId,
      assignees = [],
      dueDate,
      priority
    } = req.body || {};

    validateObjectId(messageId, "Message ID");

    const message = await Message.findById(messageId);

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    if (message.convertedToTask) {
      throw new AppError("Message already converted", 400);
    }

    /* =====================================================
       AUTO DETECT PROJECT IF NOT PROVIDED
    ===================================================== */

    if (!projectId) {

      const autoProject = await Project.findOne({
        channel: message.channel
      });

      if (!autoProject) {
        throw new AppError(
          "No project found for this channel",
          400
        );
      }

      projectId = autoProject._id;
    }

    validateObjectId(projectId, "Project ID");

    const project = await Project.findById(projectId);

    if (!project) {
      throw new AppError("Project not found", 404);
    }

    if (project.channel.toString() !== message.channel.toString()) {
      throw new AppError(
        "Project does not belong to this channel",
        400
      );
    }

    if (!(await useAccessProject(project, req.user))) {
      throw new AppError("Access denied", 403);
    }

    /* =====================================================
       GET BOARD + BACKLOG
    ===================================================== */

    const board = await Board.findOne({ project: projectId });

    if (!board) {
      throw new AppError("Board not found", 404);
    }

    const backlog = await Column.findOne({
      board: board._id,
      title: "ToDo"
    });

    if (!backlog) {
      throw new AppError("ToDo column missing", 500);
    }

    const order = await Task.countDocuments({
      column: backlog._id,
      isDeleted: false
    });

    /* =====================================================
       CREATE TASK
    ===================================================== */

    const task = await Task.create({
      board: board._id,
      column: backlog._id,
      project: projectId,
      channel: message.channel,
      title: message.text.substring(0, 100),
      description: message.text,
      createdBy: req.user.id,
      assignees,
      dueDate: dueDate || null,
      priority: priority || "medium",
      linkedMessage: message._id,
      order
    });

    /* =====================================================
       SEND ASSIGNMENT NOTIFICATIONS
    ===================================================== */

    const io = req.app.get("io");

    const currentUser = await User.findById(req.user.id).select("name");
    const assigneeList = Array.isArray(assignees) ? assignees : [];
    
    for (const userId of assigneeList) {

      if (userId.toString() === req.user.id) continue;

      try {

        const notif = await Notification.create({
          user: userId,
          text: `${currentUser.name} assigned you a task`,
          type: "task_assigned",
          link: `/projects/${projectId}`
        });

        io.to(`user:${userId}`).emit("notification:new", notif);

      } catch (err) {
        console.error("Assignment notification failed:", err);
      }

    }

    /* =====================================================
       UPDATE MESSAGE
    ===================================================== */

    message.convertedToTask = true;
    message.linkedTask = task._id;

    await message.save();

    /* =====================================================
       POPULATE MESSAGE FOR SOCKET (FIXES UN AVATAR BUG)
    ===================================================== */

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name avatar role")
      .populate("attachments");

    /* =====================================================
       SOCKET EMITS
    ===================================================== */

    const populatedTask = await Task.findById(task._id)
      .populate("assignees", "name avatar role")
      .populate("createdBy", "name avatar role");

    io.to(`project:${projectId}`).emit("task:created", populatedTask);

    if (message.parentMessage) {

      io.to(`channel:${message.channel}`)
        .emit("thread:replyUpdated", populatedMessage);

    } else {

      io.to(`channel:${message.channel}`)
        .emit("message:updated", populatedMessage);

    }

    /* =====================================================
       RESPONSE
    ===================================================== */

    res.status(201).json({
      success: true,
      data: task
    });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   DELETE TASK (SOFT DELETE)
===================================================== */
exports.deleteTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    validateObjectId(taskId, "Task ID");

    const task = await Task.findById(taskId);
    if (!task) throw new AppError("Task not found", 404);

    const channel = await Channel.findById(task.channel).lean();
    if (!channel) throw new AppError("Channel not found", 404);

    const isChannelAdmin = channel.members.some(
      (member) =>
        member.user.toString() === req.user.id &&
        member.role === "admin"
    );

    const canDelete =
      req.user.role === "Admin" ||
      req.user.role === "Moderator" ||
      isChannelAdmin;

    if (!canDelete) {
      throw new AppError("Only channel admins or moderators can delete tasks", 403);
    }

    task.isDeleted = true;
    task.deletedAt = new Date();
    await task.save();

    const io = req.app.get("io");
    io.to(`project:${task.project}`).emit("task:deleted", taskId);

    res.status(200).json({ success: true });

  } catch (err) {
    next(err);
  }
};


/* =====================================================
   GET MY TASKS
===================================================== */
exports.getMyTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find({
      assignees: req.user.id,
      isDeleted: { $ne: true }
    })
      .populate("column", "title")
      .populate("board")
      .lean();

    res.status(200).json(tasks);

  } catch (err) {
    next(err);
  }
};

/* =====================================================
   TOGGLE SUBTASK STATUS
===================================================== */

exports.toggleSubtask = async (req, res, next) => {
  try {

    const { taskId } = req.params;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        message: "Subtask not found"
      });
    }

    if (!task.parentTask) {
      return res.status(400).json({
        message: "Not a subtask"
      });
    }

    task.status =
      task.status === "completed" ? "todo" : "completed";

    await task.save();

    const io = req.app.get("io");

    io.to(`project:${task.project}`)
      .emit("subtask:updated", {
        _id: task._id,
        parentTask: task.parentTask,
        status: task.status
      });

    res.json({
      success: true,
      data: task
    });

  } catch (err) {
    next(err);
  }
};

/* =====================================================
   GET SUBTASKS
===================================================== */

exports.getSubtasks = async (req, res, next) => {
  try {

    const subtasks = await Task.find({
      parentTask: req.params.taskId,
      isDeleted: false
    }).sort({ createdAt: 1 });

    res.json({
      success: true,
      data: subtasks
    });

  } catch (err) {
    next(err);
  }
};

/* =====================================================
   UPDATE TASK
===================================================== */
exports.updateTask = async (req, res, next) => {
  try {
    const { taskId } = req.params;
    const { title, description, priority, dueDate } = req.body;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority) task.priority = priority;
    if (dueDate !== undefined) {
      task.dueDate = dueDate || null;
    }

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate("assignees", "name avatar role")
      .populate("createdBy", "name avatar role");

    const io = req.app.get("io");
    io.to(`project:${task.project}`).emit("task:updated", updatedTask);

    res.status(200).json({
      success: true,
      data: updatedTask
    });

  } catch (err) {
    next(err);
  }
};
