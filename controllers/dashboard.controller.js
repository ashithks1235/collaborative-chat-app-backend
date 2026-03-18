const dashboardService = require("../services/dashboard.service");

exports.getDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getDashboard(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};