const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    name: String,
    url: String,
    type: String, // image, video, document
    size: Number,

    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
      index: true
    },

    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message"
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // 🔥 important for personal delete
    hiddenFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: []
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("File", fileSchema);
