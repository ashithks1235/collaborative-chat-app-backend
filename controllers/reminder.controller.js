const Reminder = require("../models/reminderModel");

exports.getReminders = async (req, res) => {
  try {
    const reminders = await Reminder.find({ user: req.user.id }).sort({ date: 1 });
    res.json(reminders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createReminder = async (req, res) => {
  try {
    const reminder = await Reminder.create({
      user: req.user.id,
      text: req.body.text,
      date: req.body.date,
    });

    res.status(201).json(reminder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};