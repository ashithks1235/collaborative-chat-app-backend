const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    }
  },
  { timestamps: true }
);

/* ========= INDEXES FOR PERFORMANCE ========= */
projectSchema.index({ channel: 1, isArchived: 1 });
projectSchema.index({ members: 1 });

module.exports = mongoose.model("Project", projectSchema);