const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
      index: true
    },

    type: {
      type: String,
      required: true,
      index: true
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId
    },

    meta: {
      type: Object,
      default: {}
    }
  },
  { timestamps: true }
);

/* ===== PERFORMANCE INDEXES ===== */

activitySchema.index({ channel: 1, createdAt: -1 });
activitySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Activity", activitySchema);