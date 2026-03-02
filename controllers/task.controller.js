const Task = require("../models/taskModel");
const Board = require("../models/boardModel");
const Column = require("../models/columnModel");
const Message = require("../models/messageModel");
const Project = require("../models/projectModel");
const validateObjectId = require("../utils/validateObjectId");
const AppError = require("../utils/AppError");
const sanitizeHtml = require("sanitize-html");

/* =====================================================
   GET TASKS (KANBAN)
===================================================== */
exports.getTasks = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    validateObjectId(projectId, "Project ID");

    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);

    const isMember = project.members.some(
      m => m.toString() === req.user.id
    );

    if (!isMember && req.user.role !== "Admin") {
      throw new AppError("Access denied", 403);
    }

    const board = await Board.findOne({ project: projectId });
    if (!board) throw new AppError("Board not found", 404);

    const columns = await Column.find({ board: board._id })
      .sort({ order: 1 })
      .lean();

    const tasks = await Task.find({
      board: board._id,
      isDeleted: false
    })
      .populate("assignees", "name avatar role")
      .populate("createdBy", "name avatar role")
      .sort({ order: 1 })
      .lean();

    const grouped = columns.map(col => ({
      ...col,
      tasks: tasks.filter(
        t => t.column.toString() === col._id.toString()
      )
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
    const { projectId } = req.params;
    const { title, description, dueDate, priority, assignees } = req.body;

    validateObjectId(projectId, "Project ID");

    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);

    const isMember = project.members.some(
      m => m.toString() === req.user.id
    );

    if (!isMember && req.user.role !== "Admin") {
      throw new AppError("Access denied", 403);
    }

    const board = await Board.findOne({ project: projectId });
    const backlog = await Column.findOne({
      board: board._id,
      title: "ToDo"
    });

    const order = await Task.countDocuments({
      column: backlog._id,
      isDeleted: false
    });

    const task = await Task.create({
      board: board._id,
      column: backlog._id,
      project: projectId,
      channel: project.channel,
      title: sanitizeHtml(title.trim(), { allowedTags: [] }),
      description: sanitizeHtml(description || "", { allowedTags: [] }),
      dueDate,
      priority,
      assignees,
      createdBy: req.user.id,
      order
    });

    const io = req.app.get("io");
    io.to(`project:${projectId}`).emit("task:created", task);

    res.status(201).json({
      success: true,
      data: task
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
    const { taskId } = req.params;
    const { targetColumnId, newOrder } = req.body;

    validateObjectId(taskId, "Task ID");
    validateObjectId(targetColumnId, "Column ID");

    const task = await Task.findById(taskId);
    if (!task) throw new AppError("Task not found", 404);

    const userId = req.user.id;

    // ✅ Only assigned user can move
    const isAssigned = task.assignees.some(
      a => a.toString() === userId
    );

    if (!isAssigned) {
      throw new AppError("Only assigned user can move this task", 403);
    }

    // 🔥 WORKFLOW VALIDATION
    const columns = await Column.find({ board: task.board })
      .sort({ order: 1 });

    const sourceIndex = columns.findIndex(c =>
      c._id.toString() === task.column.toString()
    );

    const targetIndex = columns.findIndex(c =>
      c._id.toString() === targetColumnId.toString()
    );

    if (sourceIndex === -1 || targetIndex === -1) {
      throw new AppError("Invalid column transition", 400);
    }

    // ❌ Prevent skipping forward (ToDo → Completed)
    if (targetIndex - sourceIndex > 1) {
      throw new AppError(
        "You cannot skip workflow steps",
        400
      );
    }

    // ✅ Allow backward freely
    task.column = targetColumnId;
    task.order = newOrder;
    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate("assignees", "name avatar role")
      .populate("createdBy", "name avatar role");

    const io = req.app.get("io");
    io.to(`project:${task.project}`)
      .emit("task:moved", populatedTask);

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
    let { projectId, assignees = [], dueDate, priority } = req.body;

    validateObjectId(messageId, "Message ID");

    const message = await Message.findById(messageId);
    if (!message) {
      throw new AppError("Message not found", 404);
    }

    if (message.convertedToTask) {
      throw new AppError("Message already converted", 400);
    }

    /* =====================================================
       🔥 AUTO DETECT PROJECT IF NOT PROVIDED
    ===================================================== */
    if (!projectId) {
      console.log("Channel:", message.channel);
      const autoProject = await Project.findOne({
        channel: message.channel
      });
      console.log("Channel:", message.channel);

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

    const isMember = project.members.some(
      m => m.toString() === req.user.id
    );

    if (!isMember && req.user.role !== "Admin") {
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
       UPDATE MESSAGE (works for thread replies too)
    ===================================================== */
    message.convertedToTask = true;
    message.linkedTask = task._id;
    await message.save();

    /* =====================================================
       SOCKET EMIT
    ===================================================== */
    const io = req.app.get("io");

    io.to(`project:${projectId}`).emit("task:created", task);

    io.to(`channel:${message.channel}`)
      .emit("message:updated", message);

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
