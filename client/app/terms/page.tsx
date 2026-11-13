import { pageMeta } from "@/lib/seo";
import { LegalPage } from "@/components/LegalPage";

export const metadata = pageMeta({ title: "Terms of use", description: "The terms for using SFCode, the open-source Salesforce practice site.", path: "/terms" });

const SOURCE = `
By using SFCode you agree to these terms. They're short on purpose.

## The service

SFCode is a free, open-source practice site for Salesforce skills. It's provided **as is**, without warranties, and may change or be unavailable at times. SFCode is **not affiliated with or endorsed by Salesforce, Inc.** Salesforce, Apex, Lightning and related names are trademarks of Salesforce, Inc.

## Your Salesforce org

Connect a **Developer Edition, scratch or sandbox org**, never a production org with data you care about. Grading uses check-only deploys that roll back, and the Apex Playground runs the code you write in your org. You're responsible for what you run there.

## Your account and conduct

Keep your account to yourself, and don't:

- attack, overload or try to break into the site, or other people's orgs or accounts;
- post anything unlawful, hateful, harassing or that you don't have the right to share;
- game the leaderboard, contests or coins, for example with multiple accounts or shared answers during a contest.

We may remove content or suspend accounts that break these rules.

## What you post

You keep the rights to what you write. By posting a blog post, comment or community problem, you let SFCode show it on the site. Problems you contribute and that are published become part of the open-source project under its [MIT licence](https://github.com/bighnesh0007/SFCode/blob/main/LICENSE).

## Certification content

Certification questions are original practice material written from Salesforce's public exam guides. They aren't real exam questions and don't guarantee a result.

## Liability

To the extent the law allows, SFCode and its contributors aren't liable for losses from using the site, including anything that happens in an org you connect.

## Contact and changes

Questions, or something wrong? [Open an issue on GitHub](https://github.com/bighnesh0007/SFCode/issues/new/choose). If these terms change, the date at the top changes.

See also the [privacy policy](/privacy).
`;

export default function TermsPage() {
  return <LegalPage title="Terms of use" updated="13 November 2026" source={SOURCE} />;
}
