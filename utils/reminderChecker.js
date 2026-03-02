const cron = require("node-cron");
const Reminder = require("../models/reminderModel");

module.exports = (io) => {
  cron.schedule("* * * * *", async () => { // every minute
    const now = new Date();

    const dueReminders = await Reminder.find({
      date: { $lte: now },
      notified: false
    }).populate("user");

    for (let r of dueReminders) {
      io.to(r.user._id.toString()).emit("receiveNotification", {
        text: `⏰ Reminder: ${r.text}`,
        link: "/"
      });

      r.notified = true;
      await r.save();
    }
  });
};
