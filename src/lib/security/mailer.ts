import "server-only";
import nodemailer from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export function escapeEmailHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
  );
}

export function isCustomMailerConfigured(): boolean {
  const hasSmtp = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  const hasResend = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
  return hasSmtp || hasResend;
}

export async function sendPortalEmail(
  msg: EmailMessage
): Promise<{ sent: boolean; provider: "smtp" | "resend" | "none" }> {
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();

  if (smtpUser && smtpPass) {
    const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT || 465);
    const from = process.env.SMTP_FROM?.trim() || `NEXUS OBE <${smtpUser}>`;
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      });
      return { sent: true, provider: "smtp" };
    } catch (e) {
      console.error("Google/SMTP send failed:", e instanceof Error ? e.message : e);
    }
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim();
  if (resendKey && resendFrom) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [msg.to],
          subject: msg.subject,
          text: msg.text,
          ...(msg.html ? { html: msg.html } : {}),
        }),
      });
      if (res.ok) return { sent: true, provider: "resend" };
    } catch (e) {
      console.error("Resend send failed:", e instanceof Error ? e.message : e);
    }
  }

  return { sent: false, provider: "none" };
}
