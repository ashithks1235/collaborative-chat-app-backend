const sgMail = require("@sendgrid/mail");

const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER;

if (!apiKey || !fromEmail) {
  console.warn("SendGrid configuration is missing. Email delivery is disabled.");
}

if (apiKey) {
  sgMail.setApiKey(apiKey);
}

const sendEmail = async (to, subject, text) => {
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY is not configured");
  }

  if (!fromEmail) {
    throw new Error("SENDGRID_FROM_EMAIL is not configured");
  }

  try {
    await sgMail.send({
      to,
      from: fromEmail,
      subject,
      text
    });

    console.log("Email sent successfully with SendGrid");
  } catch (error) {
    const details = error.response?.body || error.message;
    console.error("Email sending failed:", details);
    throw error;
  }
};

module.exports = { sendEmail };
