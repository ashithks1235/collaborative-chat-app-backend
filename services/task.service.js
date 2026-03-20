const Task = require("../models/taskModel");
const Board = require("../models/boardModel");
const Column = require("../models/columnModel");
const Message = require("../models/messageModel");
const Project = require("../models/projectModel");
const TaskComment = require("../models/taskCommentModel");
const Notification = require("../models/notificationModel");
const User = require("../models/userModel");
const AppError = require("../utils/AppError");
const validateObjectId = require("../utils/validateObjectId");
const sanitizeHtml = require("sanitize-html");
const useAccessProject = require("../utils/canAccessProject");

/* ================= GET TASKS ================= */

exports.getTasks = async (projectId, user) => {
  validateObjectId(projectId, "Project ID");

  const project = await Project.findById(projectId);
  if (!project) throw new AppError("Project not found", 404);

  if (!(await useAccessProject(project, user))) {
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

  return { board, columns, tasks };
};

/* ================= CREATE TASK ================= */

exports.createTask = async (projectId, data, user) => {
  validateObjectId(projectId, "Project ID");

  const project = await Project.findById(projectId);
  if (!project) throw new AppError("Project not found", 404);

  if (!(await useAccessProject(project, user))) {
    throw new AppError("Access denied", 403);
  }

  const board = await Board.findOne({ project: projectId });
  if (!board) throw new AppError("Board not found", 404);

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
    title: sanitizeHtml(data.title.trim(), { allowedTags: [] }),
    description: sanitizeHtml(data.description || "", { allowedTags: [] }),
    dueDate: data.dueDate,
    priority: data.priority,
    assignees: data.assignees,
    createdBy: user.id,
    order,
    status: "todo"
  });

  return task;
};

/* ================= MOVE TASK ================= */

exports.moveTask = async (taskId, targetColumnId, newOrder, userId) => {
  const task = await Task.findById(taskId);
  if (!task) throw new AppError("Task not found", 404);
  const previousStatus = task.status;

  const isAssigned = task.assignees.some(
    a => a.toString() === userId
  );

  if (!isAssigned) {
    throw new AppError("Only assigned user can move this task", 403);
  }

  const columns = await Column.find({ board: task.board })
    .sort({ order: 1 });

  const sourceIndex = columns.findIndex(c =>
    c._id.toString() === task.column.toString()
  );

  const targetIndex = columns.findIndex(c =>
    c._id.toString() === targetColumnId.toString()
  );

  if (targetIndex - sourceIndex > 1) {
    throw new AppError("You cannot skip workflow steps", 400);
  }

  task.column = targetColumnId;
  task.order = newOrder;

  const targetColumn = columns[targetIndex];

  if (targetColumn) {
    const title = targetColumn.title.toLowerCase();

    if (title.includes("todo")) task.status = "todo";
    else if (title.includes("progress")) task.status = "inprogress";
    else if (title.includes("complete")) task.status = "completed";
  }

  await task.save();

  return {
    task,
    previousStatus,
    completedNow: previousStatus !== "completed" && task.status === "completed"
  };
};

/* ================= DELETE ================= */

exports.deleteTask = async (taskId) => {
  const task = await Task.findById(taskId);
  if (!task) throw new AppError("Task not found", 404);

  task.isDeleted = true;
  task.deletedAt = new Date();

  await task.save();

  return task;
};
