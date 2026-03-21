const nodemailer = require("nodemailer");

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn("Email configuration is missing. OTP emails cannot be sent.");
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

const sendEmail = async (to, subject, text) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email credentials are not configured");
  }

  try {
    await transporter.sendMail({
      from: `"Chat App" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });

    console.log("Email sent successfully");
  } catch (error) {
    console.error("Email sending failed:", error);
    throw error;
  }
};

module.exports = { sendEmail };
