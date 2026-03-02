const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema(
  {
    emoji: {
      type: String,
      required: true,
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    text: {
      type: String,
      trim: true,
      default: "",
    },

    attachments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "File",
      },
    ],

    parentMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    replyCount: {
      type: Number,
      default: 0,
    },

    convertedToTask: {
      type: Boolean,
      default: false,
    },

    linkedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },

    pinned: {
      type: Boolean,
      default: false,
    },

    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    reactions: [reactionSchema],

    isDeleted: {
      type: Boolean,
      default: false,
    },
    threadReadBy: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        }
      ]
  },
  { timestamps: true }
);

/* ===============================
   🔥 PERFORMANCE INDEXES
=============================== */

// Channel pagination
messageSchema.index({ channel: 1, createdAt: -1 });

// Thread loading
messageSchema.index({ parentMessage: 1 });

// Channel + pinned
messageSchema.index({ channel: 1, pinned: 1 });

// Mentions lookup
messageSchema.index({ mentions: 1 });

// Soft delete filter
messageSchema.index({ isDeleted: 1 });

// Text search
messageSchema.index({ channel: 1, text: "text" });

module.exports = mongoose.model("Message", messageSchema);
