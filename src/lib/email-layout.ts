/**
 * The look of the app's emails: the logo and wordmark, a white card on the
 * app's warm paper colour, one amber button. Email clients ignore most CSS,
 * so it's tables and inline styles; every message also goes as plain text.
 */

export type EmailContent = {
  /** Above the button */
  heading: string
  paragraphs: string[]
  button?: {label: string; url: string}
  /** Small print under the button: how long the link lasts, etc. */
  after?: string[]
  /** Why this arrived, at the very bottom */
  footer: string
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/** The same message as HTML and as plain text. */
export function renderEmail(c: EmailContent, origin: string) {
  const p = (t: string, style = '') =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#3b3833;${style}">${esc(t)}</p>`
  const button = c.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:10px;background:#f2b134">
<a href="${esc(c.button.url)}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:16px;font-weight:700;color:#111315;text-decoration:none;border-radius:10px">${esc(c.button.label)}</a>
</td></tr></table>
<p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#8e8a82">Or paste this into your browser:<br><a href="${esc(c.button.url)}" style="color:#9a6a06;word-break:break-all">${esc(c.button.url)}</a></p>`
    : ''
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.heading)}</title></head>
<body style="margin:0;padding:0;background:#f3f0e8;font-family:${FONT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0e8"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 18px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:12px"><img src="${esc(origin)}/icons/default-192.png" width="40" height="40" alt="" style="display:block;border-radius:10px"></td>
<td style="font-family:${FONT};font-size:14px;font-weight:800;letter-spacing:0.22em;color:#17181a">BANDSTAND</td>
</tr></table>
</td></tr>
<tr><td style="background:#ffffff;border-radius:16px;padding:32px 30px;border:1px solid #e4dfd3">
<h1 style="margin:0 0 18px;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:800;color:#17181a">${esc(c.heading)}</h1>
${c.paragraphs.map((t) => p(t)).join('\n')}
${button}
${(c.after ?? []).map((t) => p(t, 'font-size:14px;color:#6b665d')).join('\n')}
</td></tr>
<tr><td style="padding:18px 6px 0;font-size:12px;line-height:1.5;color:#8e8a82">${esc(c.footer)}<br><a href="https://bandstand.info" style="color:#8e8a82">bandstand.info</a></td></tr>
</table>
</td></tr></table>
</body></html>`
  const text = [
    c.heading,
    '',
    ...c.paragraphs.flatMap((t) => [t, '']),
    ...(c.button ? [`${c.button.label}: ${c.button.url}`, ''] : []),
    ...(c.after ?? []).flatMap((t) => [t, '']),
    '--',
    c.footer,
    'https://bandstand.info',
  ].join('\n')
  return {html, text}
}
