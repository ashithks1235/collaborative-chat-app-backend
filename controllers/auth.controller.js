const authService = require("../services/auth.service");
const { emitAdminUpdate } = require("../socket");

/* ================= REGISTER ================= */
exports.register = async (req, res, next) => {
  try {
    const { user, token } = await authService.registerUser(req.body);

    // 🔥 keep existing socket behavior
    emitAdminUpdate("user_created", {
      userId: user._id,
    });

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    next(err);
  }
};

/* ================= LOGIN ================= */
exports.login = async (req, res, next) => {
  try {
    const { user, token } = await authService.loginUser(req.body);

    res.json({
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    next(err);
  }
};

/* ================= FORGOT PASSWORD ================= */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { resetToken } = await authService.forgotPassword(req.body);

    console.log("RESET TOKEN:", resetToken);

    res.json({
      message: "Password reset link sent to email",
      resetToken,
    });
  } catch (err) {
    next(err);
  }
};
