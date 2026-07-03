import "server-only";

/**
 * Email transport — Resend behind an env flag, with a log-to-console
 * fallback so every flow verifies WITHOUT credentials and no real email
 * can ever leave a build that hasn't been wired by the founder
 * (RESEND_API_KEY + EMAIL_FROM in GOING-LIVE.md).
 */

interface Mail {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.log(
      `[mail:console-transport] to=${mail.to} subject="${mail.subject}"\n${mail.text}`,
    );
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
      }),
    });
  } catch (err) {
    console.error("[mail] send failed:", err);
  }
}

export function yourMoveEmail(tableName: string, gameUrl: string): Omit<Mail, "to"> {
  return {
    subject: `Your move at ${tableName}`,
    text: `Your move. The table is watching.\n\n${gameUrl}\n\n— the ${tableName} secretary`,
  };
}

export function gameOverEmail(
  tableName: string,
  resultLine: string,
  gameUrl: string,
): Omit<Mail, "to"> {
  return {
    subject: `${tableName} — the game is decided`,
    text: `${resultLine}\n\nThe full record is at the table:\n${gameUrl}`,
  };
}

export function nudgeEmail(
  fromName: string,
  tableName: string,
  gameUrl: string,
): Omit<Mail, "to"> {
  return {
    subject: `${fromName} gave you a poke`,
    text: `${fromName} is waiting on your move at ${tableName}.\n\n${gameUrl}`,
  };
}
