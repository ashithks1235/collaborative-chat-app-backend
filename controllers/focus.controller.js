const Task = require("../models/taskModel");
const Message = require("../models/messageModel");
const Reminder = require("../models/reminderModel");

exports.getTodayFocus = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);

    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    // ✅ Tasks due today
    const tasks = await Task.find({
      assignees: req.user.id,
      dueDate: { $gte: todayStart, $lte: todayEnd },
      status: { $ne: "done" }
    }).select("title dueDate status").lean();

    // ✅ Mentions today
    const mentions = await Message.find({
      mentions: req.user.id,
      createdAt: { $gte: todayStart, $lte: todayEnd }
    }).populate("channel", "name").lean();

    // ✅ Reminders today
    const reminders = await Reminder.find({
      user: req.user.id,
      date: { $gte: todayStart, $lte: todayEnd }
    }).lean();

    res.json({ tasks, mentions, reminders });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
