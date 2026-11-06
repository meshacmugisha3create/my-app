type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, ...message }),
    });
    if (!response.ok) console.error("Email delivery failed with status:", response.status);
    return response.ok;
  } catch (error) {
    console.error("Unable to reach the email provider:", error);
    return false;
  }
}

export async function notifyStaff(subject: string, text: string): Promise<void> {
  const recipients = [...new Set(
    (process.env.MESH_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )];
  await Promise.all(recipients.map((to) => sendEmail({ to, subject, text })));
}