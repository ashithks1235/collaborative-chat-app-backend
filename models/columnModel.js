const mongoose = require("mongoose");

const columnSchema = new mongoose.Schema(
  {
    board: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    order: {
      type: Number,
      required: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    isArchived: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

/* ===== Indexes for performance ===== */
columnSchema.index({ board: 1, order: 1 });
columnSchema.index({ board: 1, title: 1 });

module.exports = mongoose.model("Column", columnSchema);
