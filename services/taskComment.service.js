const TaskComment = require("../models/taskCommentModel");

exports.getTaskComments = async (taskId) => {
  return await TaskComment.find({ task: taskId })
    .populate("user", "name avatar role")
    .sort({ createdAt: 1 });
};

exports.createComment = async (taskId, userId, text) => {
  return await TaskComment.create({
    task: taskId,
    user: userId,
    text
  });
};