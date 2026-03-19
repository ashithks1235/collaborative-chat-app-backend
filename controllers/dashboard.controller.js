const dashboardService = require("../services/dashboard.service");
const { success } = require("../utils/response");

exports.getDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getDashboard(req.user.id);
    return success(res, data);
  } catch (err) {
    next(err);
  }
};
