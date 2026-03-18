const Column = require("../models/columnModel");
const Task = require("../models/taskModel");
const Project = require("../models/projectModel");
const validateObjectId = require("../utils/validateObjectId");
const AppError = require("../utils/AppError");

/* ================= CREATE COLUMN ================= */

exports.createColumn = async (data, user) => {
  const { projectId, name } = data;

  validateObjectId(projectId, "Project ID");

  if (!name || name.trim().length < 2) {
    throw new AppError("Column name required", 400);
  }

  const project = await Project.findById(projectId);
  if (!project) throw new AppError("Project not found", 404);

  const count = await Column.countDocuments({ project: projectId });

  const column = await Column.create({
    name: name.trim(),
    project: projectId,
    order: count,
    createdBy: user.id
  });

  return column;
};

/* ================= GET COLUMNS ================= */

exports.getColumns = async (projectId) => {
  validateObjectId(projectId, "Project ID");

  const columns = await Column.find({
    project: projectId,
    isArchived: { $ne: true }
  })
    .sort({ order: 1 })
    .lean();

  const columnIds = columns.map(c => c._id);

  const tasks = await Task.find({
    column: { $in: columnIds },
    isDeleted: { $ne: true }
  })
    .sort({ order: 1 })
    .lean();

  return columns.map(column => ({
    ...column,
    tasks: tasks.filter(
      task => task.column.toString() === column._id.toString()
    )
  }));
};

/* ================= MOVE TASK ================= */

exports.moveTask = async (taskId, targetColumnId, newOrder) => {
  validateObjectId(taskId, "Task ID");
  validateObjectId(targetColumnId, "Column ID");

  const task = await Task.findById(taskId);
  if (!task) throw new AppError("Task not found", 404);

  task.column = targetColumnId;
  task.order = newOrder;

  await task.save();

  return task;
};

/* ================= REORDER ================= */

exports.reorderColumns = async (columns) => {
  for (const col of columns) {
    validateObjectId(col.id, "Column ID");

    await Column.findByIdAndUpdate(col.id, {
      order: col.order
    });
  }

  return true;
};