import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Opt-in sender. Disabled unless SMTP_* env vars are configured.
// You (a human) trigger each send from the UI; nothing is sent automatically.
export async function POST(req: NextRequest) {
  try {
    const { to, subject, html } = await req.json();
    if (!to || !subject || !html) {
      return NextResponse.json({ ok: false, error: "to, subject and html are required" }, { status: 400 });
    }

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.MAIL_FROM || user;
    if (!host || !user || !pass || !from) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM in the dashboard environment to enable sending.",
        },
        { status: 400 }
      );
    }

    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
      auth: { user, pass },
    });

    const info = await transport.sendMail({ from, to, subject, html });
    return NextResponse.json({ ok: true, data: { messageId: info.messageId, accepted: info.accepted } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "send failed" }, { status: 500 });
  }
}
