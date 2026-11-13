/** Sends one email through EmailJS's REST API, server-side (private key; never in the browser). */
export interface EmailSender {
  send(to: string, subject: string, html: string): Promise<void>;
}

export function emailJsSender(cfg: { serviceId: string; templateId: string; publicKey: string; privateKey: string }, fetchImpl: typeof fetch = fetch): EmailSender {
  return {
    async send(to, subject, html) {
      const res = await fetchImpl("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000),
        body: JSON.stringify({
          service_id: cfg.serviceId,
          template_id: cfg.templateId,
          user_id: cfg.publicKey,
          accessToken: cfg.privateKey,
          // The template uses {{to_email}}, {{subject}} and {{{message_html}}}.
          template_params: { to_email: to, subject, message_html: html, from_name: "SFCode" },
        }),
      });
      if (!res.ok) throw new Error(`EmailJS refused the email (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
    },
  };
}
