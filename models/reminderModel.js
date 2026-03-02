const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: String,
  date: Date,
  notified: { type: Boolean, default: false } // prevents repeat alerts
});

module.exports = mongoose.model("Reminder", reminderSchema);
