import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { examInfo, examList } from "@/lib/examSeo";
import { pageMeta } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";
import { Session } from "./Session";

type Props = { params: Promise<{ exam: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { exam } = await params;
  const e = await examInfo(exam);
  if (!e) return { title: "Certification practice", robots: { index: false, follow: true } };
  return pageMeta({
    title: `Salesforce ${e.title} Practice Questions (Free)`,
    description: `${e.questionCount} free Salesforce ${e.title} practice questions with explanations, by exam section: ${e.description}`.slice(0, 160),
    path: `/certification/${e.exam}`,
    kicker: "Certification practice",
  });
}

export default async function Page({ params }: Props) {
  const { exam } = await params;
  const list = await examList();
  const e = list?.find((x) => x.exam === exam);
  // Only a list without this exam is a 404; if the API is down, the session still loads in the browser.
  if (list && !e) notFound();
  return (
    <>
      <Session exam={exam} />
      {e && (
        <section className="container mx-auto max-w-3xl px-4 pb-12 text-sm text-muted-foreground">
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Certification", item: absoluteUrl("/certification") },
                { "@type": "ListItem", position: 2, name: e.title, item: absoluteUrl(`/certification/${e.exam}`) },
              ],
            }}
          />
          <h2 className="text-base font-semibold text-foreground">About these {e.title} practice questions</h2>
          <p className="mt-2">
            {e.questionCount} questions written for the Salesforce {e.title} exam, each with an explanation of why the answer is right. {e.description} Questions are
            shuffled every round, and anything you miss comes back for review later.
          </p>
          <h3 className="mt-4 font-medium text-foreground">Exam sections</h3>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {e.sections.map((s) => (
              <li key={s.id}>
                <Link href={`/certification/${e.exam}?section=${s.id}`} className="hover:text-foreground hover:underline">
                  {s.title}
                </Link>{" "}
                ({s.total} questions)
              </li>
            ))}
          </ul>
          {e.mock && (
            <p className="mt-4">
              Ready for the real thing? Take the{" "}
              <Link href={`/certification/${e.exam}/mock`} className="font-medium text-foreground underline">
                {e.title} mock exam
              </Link>
              : {e.mock.questions} questions in {e.mock.minutes} minutes, weighted like the real exam, with a {e.mock.passPercent}% pass mark.
            </p>
          )}
        </section>
      )}
    </>
  );
}
