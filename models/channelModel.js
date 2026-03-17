const mongoose = require("mongoose");

const channelMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["member", "admin"],
      default: "member",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const channelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    members: [channelMemberSchema],

    isPrivate: {
      type: Boolean,
      default: false,
    },

    isArchived: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
    },

    messageCount: {
      type: Number,
      default: 0,
    },
    pinnedMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null
    }
  },
  { timestamps: true }
);

/* ===============================
   🔥 IMPORTANT INDEXES
=============================== */

// Member-based lookup
channelSchema.index({ "members.user": 1 });
channelSchema.index({ "members.user": 1, lastActivityAt: -1 });

// Active channel sorting
channelSchema.index({ lastActivityAt: -1 });

// Creator lookup
channelSchema.index({ createdBy: 1 });

// Privacy filters
channelSchema.index({ isPrivate: 1, isArchived: 1, isDeleted: 1 });

// Text search
channelSchema.index({ name: "text", description: "text" });

module.exports = mongoose.model("Channel", channelSchema);
