const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // 🔐 don't return password by default
    },

    avatar: {
      type: String, // store image URL
      default: "",
    },

    role: {
      type: String,
      enum: ["Admin", "Moderator", "Member"],
      default: "Member", // safer default
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    resetToken: String,
    resetTokenExpiry: Date,

    deleteOtp: String,
    deleteOtpExpires: Date,
  },
  {
    timestamps: true, // ✅ adds createdAt & updatedAt
  }
);

/* ===============================
   INDEXES (Performance Ready)
=============================== */

userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model("User", userSchema);

module.exports = User;
