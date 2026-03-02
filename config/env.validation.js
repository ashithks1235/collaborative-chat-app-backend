const Joi = require("joi")
require("dotenv").config();

const schema = Joi.object({
  NODE_ENV: Joi.string().required(),
  PORT: Joi.number().required(),
  MONGODB_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  CLIENT_URL: Joi.string().required()
}).unknown()

const { error, value } = schema.validate(process.env)

if (error) {
  throw new Error(`ENV validation error: ${error.message}`)
}

module.exports = value
