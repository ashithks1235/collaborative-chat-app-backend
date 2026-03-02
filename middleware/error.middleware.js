const { error } = require("../utils/response");

module.exports = (err, req, res, next) => {
  console.error("🔥 ERROR:", err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Server Error";

  return error(res, message, statusCode);
};