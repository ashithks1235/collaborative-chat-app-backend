const cron = require("node-cron");
const Task = require("../models/taskModel");
const Notification = require("../models/notificationModel");

module.exports = (io) => {
  cron.schedule("*/10 * * * *", async () => {  // every 10 mins
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const tasks = await Task.find({
      dueDate: { $lte: tomorrow },
      reminderSent: false
    });

    for (const task of tasks) {
      await Notification.create({
        user: task.createdBy,
        text: `⏰ Task "${task.title}" is due soon`,
        link: `/projects/${task.project}`
      });

      io.to(task.createdBy.toString()).emit("receiveNotification", {
        text: `⏰ Task "${task.title}" is due soon`,
        link: `/projects/${task.project}`
      });

      task.reminderSent = true;
      await task.save();
    }
  });
};
