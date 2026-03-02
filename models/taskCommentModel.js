const mongoose = require("mongoose");

module.exports = mongoose.model(
  "TaskComment",
  new mongoose.Schema(
    {
      task: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      text: String,
      attachments: [
            {
                name: String,
                url: String,
                uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
            }
            ]
    },
    { timestamps: true }
  )
);
