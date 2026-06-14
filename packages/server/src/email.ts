import nodemailer from "nodemailer";

const FROM = process.env.EMAIL_FROM || "noreply@truthseekers.ai";

let transporter: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  // Resend (recommended — simple API via SMTP)
  if (process.env.RESEND_API_KEY) {
    transporter = nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 587,
      secure: false,
      auth: { user: "resend", pass: process.env.RESEND_API_KEY },
    });
    return transporter;
  }

  // SMTP
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      },
    });
    return transporter;
  }

  return null;
}

export async function sendMagicLink(email: string, link: string): Promise<void> {
  const transport = getTransport();

  if (!transport) {
    console.log(`[EMAIL] Magic link for ${email}: ${link}`);
    return;
  }

  await transport.sendMail({
    from: FROM,
    to: email,
    subject: "Sign in to Truthseekers",
    html: `<p>Click <a href="${link}">here</a> to sign in to Truthseekers.</p><p>This link expires in 15 minutes.</p>`,
  });
}
