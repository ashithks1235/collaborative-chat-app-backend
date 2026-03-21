const apiKey = (
  process.env.BREVO_API_KEY ||
  process.env.BREVO_KEY ||
  process.env.BREVO_SECRET_KEY ||
  ""
).trim();
const fromEmail = (
  process.env.BREVO_SENDER_EMAIL ||
  process.env.BREVO_FROM_EMAIL ||
  process.env.EMAIL_USER ||
  ""
).trim();
const fromName = (process.env.BREVO_SENDER_NAME || "Chat App").trim();

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

  let response;

  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        Accept: "application/json"
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
  } catch (error) {
    console.error("Email sending failed:", error);
    throw new Error(`Brevo request failed: ${error.message}`);
  }

  if (!response.ok) {
    let details;

    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }

    console.error("Email sending failed:", details);

    const providerMessage =
      details?.message ||
      details?.code ||
      (typeof details === "string" ? details : "Brevo email request failed");

    throw new Error(providerMessage);
  }

  console.log("Email sent successfully with Brevo");
};

module.exports = { sendEmail };
