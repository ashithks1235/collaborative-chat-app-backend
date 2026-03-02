const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    // 👤 Who did the action
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // 📍 Which channel this belongs to
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
      index: true,
    },

    // 🧠 Activity type
    type: {
      type: String,
      enum: [
        "task_created",
        "task_completed",
        "task_updated",
        "task_assigned",
        "message_converted",
        "message_sent",
        "thread_reply"
      ],
      required: true,
    },

    // 🔗 Generic entity reference (task/message/thread)
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    // 🏷 Optional structured references (better for populate)
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },

    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    // 🧾 Extra info (status change, assignee, etc.)
    meta: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Activity", activitySchema);
