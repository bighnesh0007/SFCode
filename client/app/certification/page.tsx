import { JsonLd } from "@/components/JsonLd";
import type { ExamSummary } from "@/lib/certificationApi";
import { serverApi } from "@/lib/serverApi";
import { absoluteUrl } from "@/lib/site";
import { CertificationHub } from "./CertificationHub";

/** Exam cards render on the server, so every exam page is linked in the HTML; readiness loads in the browser. */
export default async function Page() {
  const exams = (await serverApi<ExamSummary[]>("/api/v1/certification")) ?? undefined;
  return (
    <>
      {exams && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Salesforce certification practice exams",
            itemListElement: exams.map((e, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(`/certification/${e.exam}`), name: `${e.title} practice questions` })),
          }}
        />
      )}
      <CertificationHub initial={exams} />
    </>
  );
}
