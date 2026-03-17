const mongoose = require("mongoose");

const taskCommentSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task"
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    text: String,

    attachments: [
      {
        name: String,
        url: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      }
    ]
  },
  { timestamps: true }
);

/* ================= INDEXES ================= */

taskCommentSchema.index({ task: 1, createdAt: 1 });
taskCommentSchema.index({ user: 1 });

module.exports = mongoose.model("TaskComment", taskCommentSchema);