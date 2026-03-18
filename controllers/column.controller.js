const columnService = require("../services/column.service");

/* ================= CREATE ================= */

exports.createColumn = async (req, res, next) => {
  try {
    const column = await columnService.createColumn(
      req.body,
      req.user
    );

    res.status(201).json(column);
  } catch (err) {
    next(err);
  }
};

/* ================= GET ================= */

exports.getColumns = async (req, res, next) => {
  try {
    const data = await columnService.getColumns(
      req.params.projectId
    );

    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
};

/* ================= MOVE TASK ================= */

exports.moveTask = async (req, res, next) => {
  try {
    const task = await columnService.moveTask(
      req.body.taskId,
      req.body.targetColumnId,
      req.body.newOrder
    );

    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
};

/* ================= REORDER ================= */

exports.reorderColumns = async (req, res, next) => {
  try {
    await columnService.reorderColumns(req.body.columns);

    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};