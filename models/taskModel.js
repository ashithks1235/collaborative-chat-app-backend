const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    /* ========= RELATIONS ========= */

    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true
    },

    column: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Column",
      required: true,
      index: true
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true
    },

    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
      index: true
    },

    /* ========= CONTENT ========= */

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    description: {
      type: String,
      default: ""
    },

    order: {
      type: Number,
      required: true,
      index: true
    },

    /* ========= ASSIGNMENT ========= */

    assignees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    /* ========= PLANNING ========= */

    dueDate: Date,

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium"
    },

    /* ========= META ========= */

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    linkedMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      index: true
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },

    deletedAt: Date
  },
  { timestamps: true }
);

/* ========= INDEXES ========= */

taskSchema.index({ board: 1, column: 1, order: 1 });
taskSchema.index({ project: 1 });
taskSchema.index({ assignees: 1 });

module.exports = mongoose.model("Task", taskSchema);