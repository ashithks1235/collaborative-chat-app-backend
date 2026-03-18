const TaskComment = require("../models/taskCommentModel");
const Task = require("../models/taskModel");
const Column = require("../models/columnModel");
const Board = require("../models/boardModel");
const Notification = require("../models/notificationModel");
const service = require("../services/taskComment.service");

/* ===============================
   GET COMMENTS FOR TASK
=============================== */

exports.getTaskComments = async (req, res, next) => {
  try {
    const comments = await service.getTaskComments(req.params.taskId);

    res.json({
      success: true,
      data: comments
    });
  } catch (err) {
    next(err);
  }
};
/* ===============================
   ADD COMMENT
=============================== */

exports.addTaskComment = async (req, res, next) => {
  try {

    const io = req.app.get("io");

    const comment = await TaskComment.create({
      task: req.params.taskId,
      user: req.user.id,
      text: req.body.text
    });

    const populated = await comment.populate(
      "user",
      "name avatar role"
    );

    const parentTask = await Task.findById(comment.task);
    if (parentTask) {
    for (const userId of parentTask.assignees) {
        if (userId.toString() === req.user.id) continue;
        const notif = await Notification.create({
        user: userId,
        text: `${req.user.name} commented on a task`,
        type: "task_comment",
        link: `/projects/${parentTask.project}`
        });
        io.to(`user:${userId}`).emit("notification:new", notif);
    }
    }

    /* ================= SOCKET EMIT ================= */

    io.emit("taskCommentAdded", populated);

    res.status(201).json({
      success: true,
      data: populated
    });

  } catch (err) {
    next(err);
  }
};

exports.convertCommentToTask = async (req, res, next) => {
  try {

    const io = req.app.get("io");

    if (req.user.role !== "Moderator") {
      return res.status(403).json({
        message: "Only moderators can convert comments"
      });
    }

    const comment = await TaskComment.findById(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        message: "Comment not found"
      });
    }

    const parentTask = await Task.findById(comment.task);

    if (!parentTask) {
      return res.status(404).json({
        message: "Parent task not found"
      });
    }

    const board = await Board.findOne({ project: parentTask.project });

    const todo = await Column.findOne({
      board: board._id,
      title: "ToDo"
    });

    const order = await Task.countDocuments({
      column: todo._id,
      isDeleted: false
    });

    const subtask = await Task.create({
      board: board._id,
      column: todo._id,
      project: parentTask.project,
      channel: parentTask.channel,
      title: comment.text.substring(0, 120),
      description: comment.text,
      createdBy: req.user.id,
      order,
      parentTask: parentTask._id
    });

    const notif = await Notification.create({
        user: parentTask.createdBy,
        text: `${req.user.name} created a subtask`,
        type: "subtask_created",
        link: `/projects/${parentTask.project}`
        });

        io.to(`user:${parentTask.createdBy}`)
        .emit("notification:new", notif);

    io.to(`project:${parentTask.project}`)
        .emit("subtask:created", subtask);

    res.status(201).json({
      success: true,
      data: subtask
    });

  } catch (err) {

    next(err);

  }
};