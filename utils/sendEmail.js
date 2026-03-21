const apiKey = process.env.BREVO_API_KEY;
const fromEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER;
const fromName = process.env.BREVO_SENDER_NAME || "Chat App";

if (!apiKey || !fromEmail) {
  console.warn("Brevo configuration is missing. Email delivery is disabled.");
}

const sendEmail = async (to, subject, text) => {
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }

  if (!fromEmail) {
    throw new Error("BREVO_SENDER_EMAIL is not configured");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      accept: "application/json"
    },
    body: JSON.stringify({
      sender: {
        name: fromName,
        email: fromEmail
      },
      to: [{ email: to }],
      subject,
      textContent: text
    })
  });

  if (!response.ok) {
    let details;

    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    console.error("Email sending failed:", details);
    throw new Error("Brevo email request failed");
  }

  console.log("Email sent successfully with Brevo");
};

module.exports = { sendEmail };
