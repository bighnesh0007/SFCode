import { Plus } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";

const FAQ = [
  { q: "Is SFCode free?", a: "Yes. Every problem, the roadmap, contests and certification practice are free, and the code is open source on GitHub." },
  { q: "Do I need a Salesforce org?", a: "For Apex, SOQL, Flow and debugging problems, yes: connect a free Developer Edition org. LWC problems are graded in our own locked-down sandbox, so they need no org." },
  { q: "Is it safe to connect my org?", a: "Grading uses a check-only deploy: our hidden tests run in your org and everything is rolled back, so nothing is saved. Your tokens are stored encrypted, and you can disconnect any time. A Developer Edition org is still the best choice." },
  { q: "How do contests work?", a: "Weekly contests run on Sundays and Biweekly contests on alternate Saturdays, 90 minutes each. Only solves made during the contest count. Score decides the order, then time plus a penalty for wrong attempts. The top three win coins and everyone's rating updates." },
  { q: "What's the difference between rank and rating?", a: "Rank (Novice to Legend) comes from points for first solves and never goes down. Rating starts at 1500 and moves up or down after each contest, depending on who you beat." },
  { q: "Can I write problems?", a: "Yes. Apply to be a Buddy, write a problem with hidden tests, and once a reviewer approves it, it goes live for everyone." },
];

const LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

/** Common questions; also published as FAQPage structured data. */
export function Faq() {
  return (
    <div className="mx-auto max-w-3xl divide-y rounded-2xl border bg-card/60">
      <JsonLd data={LD} />
      {FAQ.map((f) => (
        <details key={f.q} className="sfc-faq group px-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium">
            {f.q}
            <Plus className="sfc-faq-icon h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
          </summary>
          <p className="pb-4 text-sm text-muted-foreground">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
