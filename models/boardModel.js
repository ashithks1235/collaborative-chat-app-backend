const mongoose = require("mongoose");

const boardSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      unique: true, // one board per project
    },

    name: {
      type: String,
      default: "Kanban Board",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Board", boardSchema);
