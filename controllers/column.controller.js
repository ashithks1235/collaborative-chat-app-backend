const Column = require("../models/columnModel");
const Task = require("../models/taskModel");
const Project = require("../models/projectModel");
const validateObjectId = require("../utils/validateObjectId");
const AppError = require("../utils/AppError");

/* =====================================================
   CREATE COLUMN
===================================================== */
exports.createColumn = async (req, res, next) => {
  try {
    const { projectId, name } = req.body;

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
      createdBy: req.user.id
    });

    res.status(201).json(column);

  } catch (err) {
    next(err);
  }
};

/* =====================================================
   GET COLUMNS WITH TASKS
===================================================== */
exports.getColumns = async (req, res, next) => {
  try {
    const { projectId } = req.params;

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

    const grouped = columns.map(column => ({
      ...column,
      tasks: tasks.filter(
        task => task.column.toString() === column._id.toString()
      )
    }));

    res.status(200).json(grouped);

  } catch (err) {
    next(err);
  }
};

/* =====================================================
   MOVE TASK BETWEEN COLUMNS
===================================================== */
exports.moveTask = async (req, res, next) => {
  try {
    const { taskId, targetColumnId, newOrder } = req.body;

    validateObjectId(taskId, "Task ID");
    validateObjectId(targetColumnId, "Column ID");

    const task = await Task.findById(taskId);
    if (!task) throw new AppError("Task not found", 404);

    task.column = targetColumnId;
    task.order = newOrder;

    await task.save();

    res.status(200).json(task);

  } catch (err) {
    next(err);
  }
};

/* =====================================================
   REORDER COLUMNS
===================================================== */
exports.reorderColumns = async (req, res, next) => {
  try {
    const { columns } = req.body; 
    // columns: [{ id, order }]

    for (const col of columns) {
      validateObjectId(col.id, "Column ID");

      await Column.findByIdAndUpdate(col.id, {
        order: col.order
      });
    }

    res.status(200).json({ success: true });

  } catch (err) {
    next(err);
  }
};
