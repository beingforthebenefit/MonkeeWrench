import nodemailer, {type Transporter} from 'nodemailer'

/**
 * Email from the app: sign-up, invites and password resets. Any SMTP
 * service works (the hosted service uses SMTP2GO):
 *
 *   SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS
 *   MAIL_FROM   "Bandstand <hello@bandstand.info>"
 *
 * Without SMTP_HOST the app sends nothing, and the screens that would email
 * someone say so (admins hand out passwords instead, as before). MAIL_LOG=1
 * prints messages to the server log instead of sending them (development).
 */

export type Mail = {to: string; subject: string; text: string}

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST) || process.env.MAIL_LOG === '1'
}

let transport: Transporter | null = null
function smtp() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587)
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // 465 is TLS from the start; 587 and 2525 upgrade with STARTTLS
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? {user: process.env.SMTP_USER, pass: process.env.SMTP_PASS}
        : undefined,
    })
  }
  return transport
}

export async function sendMail(mail: Mail) {
  if (!mailConfigured()) throw new Error('Email is not set up (SMTP_HOST)')
  if (!process.env.SMTP_HOST) {
    // MAIL_LOG=1: development only, so the link can be clicked from the log
    console.info(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`)
    return
  }
  await smtp().sendMail({
    from: process.env.MAIL_FROM || 'Bandstand <hello@bandstand.info>',
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
  })
}
