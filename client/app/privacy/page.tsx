import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Privacy policy · SFCode" };

// Keep in step with what the code stores: if a new feature keeps personal data, it belongs here.
const SOURCE = `
SFCode is an open-source practice site for Salesforce developers and admins. This page says what we collect, why, and what you can do about it. The code that does all of this is public on [GitHub](https://github.com/bighnesh0007/SFCode).

## What we collect

**Your account.** Sign-in is handled by [Clerk](https://clerk.com). When you sign up, Clerk stores your email address and, if you sign in with a social account such as Google, your name and profile picture from that account. SFCode keeps a public profile with a handle, a display name and a picture. Your email address is never shown on the site.

**Your Salesforce org connection.** If you connect an org, we store its org id, your Salesforce username, the org's address, and the OAuth tokens that let SFCode deploy and run tests in it. Tokens are encrypted (AES-256-GCM) and never sent to your browser. If you use your own Connected App, its consumer secret is encrypted the same way. Grading is a check-only deploy: Salesforce runs the tests and rolls everything back, so nothing stays in your org.

**What you do on SFCode.** Code you submit and its results, certification and quiz answers, roadmap progress, contest entries, coins and store purchases, blog posts, comments and votes, follows, teams, mentor and job posts, and problems you contribute.

**Emails.** Only if you turn on the weekly digest in your profile. It's sent through [EmailJS](https://www.emailjs.com) to the email address on your account. You can turn it off at any time.

**Error reports.** When the site crashes in your browser or on our server, we record the error message, a stack trace, the page path and your browser name. Before storing, we remove email addresses, URL query strings and anything that looks like a token. If you're signed in, your user id is attached so we can tell how many people are affected.

**Page counts.** We count how many times each page is viewed per day. There are no cookies and nothing that identifies you or follows you between visits.

## What we don't do

We don't sell or rent your data, show ads, or use advertising or third-party analytics trackers.

## Who processes data for us

- **Clerk** for sign-in and accounts.
- **Google** (or another social sign-in), only if you choose to sign in with it.
- **Salesforce**, for the org you connect.
- **EmailJS**, only for the weekly digest if you turn it on.
- **Cloudflare**, which carries traffic to the site.

## Keeping and deleting your data

We keep your data while your account exists. To disconnect your org, use **Settings → Salesforce org → Disconnect**: the stored tokens are deleted immediately. To delete your account and everything linked to it, [open an issue on GitHub](https://github.com/bighnesh0007/SFCode/issues/new/choose) asking for deletion (don't post personal details there; we'll follow up). Error reports and page counts don't identify you and are kept to keep the site working.

## Changes

If this policy changes, the date at the top changes, and significant changes are announced on the site.
`;

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" updated="13 November 2026" source={SOURCE} />;
}
