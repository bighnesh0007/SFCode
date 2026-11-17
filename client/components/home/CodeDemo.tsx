"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A submission, acted out: pick a track, the solution types itself, the hidden
 * tests tick off, the verdict lands. Illustrative, not a live run. Starts when
 * scrolled into view, moves to the next track on its own until someone clicks
 * a tab, and shows everything at once under reduced motion.
 */
const SAMPLES = [
  {
    id: "apex",
    label: "Apex",
    file: "ProtectClosedWon.trigger",
    code: `trigger ProtectClosedWon on Opportunity (before update) {
  for (Opportunity opp : Trigger.new) {
    Opportunity old = Trigger.oldMap.get(opp.Id);
    if (old.StageName == 'Closed Won') {
      opp.addError('Closed Won deals are locked.');
    }
  }
}`,
    tests: ["blocksEditsToClosedWonDeals", "allowsEditsToOpenDeals", "handles200RecordsInOneTransaction"],
    verdict: "Accepted · 3/3 hidden tests · +3 points",
  },
  {
    id: "soql",
    label: "SOQL",
    file: "query.soql",
    code: `SELECT Name, AnnualRevenue
FROM Account
WHERE Industry = 'Technology'
  AND AnnualRevenue > 1000000
ORDER BY AnnualRevenue DESC
LIMIT 10`,
    tests: ["returnsOnlyTechAccounts", "ordersByRevenue", "matchesExpectedRows"],
    verdict: "Accepted · rows match · +1 point",
  },
  {
    id: "lwc",
    label: "LWC",
    file: "characterCounter.js",
    code: `import { LightningElement, api } from 'lwc';

export default class CharacterCounter extends LightningElement {
  @api max = 140;
  text = '';
  get remaining() { return this.max - this.text.length; }
  handleInput(e) { this.text = e.target.value; }
}`,
    tests: ["rendersRemainingCount", "updatesOnInput", "respectsMaxProperty"],
    verdict: "Accepted · 3/3 hidden tests · +4 points",
  },
  {
    id: "flow",
    label: "Flow",
    file: "Key_Account_Task.flow",
    code: `Record-Triggered Flow · Account · After Save
  ▸ Decision: Annual Revenue ≥ 5,000,000?
      Yes ▸ Create Records: Task
              Subject  = "Schedule QBR"
              WhatId   = {!$Record.Id}
              OwnerId  = {!$Record.OwnerId}
      No  ▸ (end)`,
    tests: ["createsTaskForKeyAccounts", "skipsSmallAccounts", "bulkSafeFor200Accounts"],
    verdict: "Accepted · 3/3 hidden tests · +4 points",
  },
] as const;

const KEYWORDS = /\b(trigger|on|before|after|update|insert|for|if|else|new|return|get|import|from|export|default|class|extends|SELECT|FROM|WHERE|AND|OR|ORDER|BY|DESC|ASC|LIMIT|Yes|No)\b/;

/** A tiny highlighter: strings, @decorators, keywords. Enough for a demo. */
function Highlight({ text }: { text: string }) {
  const parts = text.split(/('[^']*'?|"[^"]*"?|@\w+|\b\w+\b)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^['"]/.test(p) ? (
          <span key={i} className="text-emerald-400">{p}</span>
        ) : p.startsWith("@") ? (
          <span key={i} className="text-amber-300">{p}</span>
        ) : KEYWORDS.test(p) && /^\w+$/.test(p) ? (
          <span key={i} className="text-violet-400">{p}</span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

type Phase = { typed: number; tests: number; done: boolean };

export function CodeDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState(0);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [phase, setPhase] = useState<Phase>({ typed: 0, tests: 0, done: false });
  const sample = SAMPLES[tab] ?? SAMPLES[0];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = setTimeout(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), 0);
    const io = new IntersectionObserver(([e]) => setVisible(e ? e.isIntersecting : false), { threshold: 0.3 });
    io.observe(el);
    return () => {
      clearTimeout(t);
      io.disconnect();
    };
  }, []);

  // Drive the animation for the current tab.
  useEffect(() => {
    if (!visible) return;
    const total = sample.code.length;
    if (reduced) {
      const t = setTimeout(() => setPhase({ typed: total, tests: sample.tests.length, done: true }), 0);
      return () => clearTimeout(t);
    }
    let typed = 0;
    let tests = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const reset = setTimeout(() => setPhase({ typed: 0, tests: 0, done: false }), 0);
    const type = setInterval(() => {
      typed = Math.min(total, typed + 3);
      setPhase((p) => ({ ...p, typed }));
      if (typed < total) return;
      clearInterval(type);
      const tick = () => {
        tests += 1;
        setPhase((p) => ({ ...p, tests }));
        if (tests < sample.tests.length) timers.push(setTimeout(tick, 450));
        else timers.push(setTimeout(() => setPhase((p) => ({ ...p, done: true })), 350));
      };
      timers.push(setTimeout(tick, 500));
    }, 18);
    return () => {
      clearTimeout(reset);
      clearInterval(type);
      timers.forEach(clearTimeout);
    };
  }, [tab, visible, reduced, sample]);

  // On its own, move to the next track a few seconds after a verdict.
  useEffect(() => {
    if (!auto || !phase.done || reduced) return;
    const t = setTimeout(() => setTab((i) => (i + 1) % SAMPLES.length), 3500);
    return () => clearTimeout(t);
  }, [auto, phase.done, reduced]);

  const shown = sample.code.slice(0, phase.typed);
  const typing = phase.typed < sample.code.length;
  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-200 shadow-2xl shadow-sky-500/10">
      <div className="flex items-center gap-1 border-b border-slate-800 bg-slate-900/80 px-2 py-2" role="tablist" aria-label="Sample submissions">
        <span className="mr-2 hidden gap-1.5 pl-2 sm:flex" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        </span>
        {SAMPLES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === tab}
            onClick={() => {
              setAuto(false);
              setTab(i);
            }}
            className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", i === tab ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200")}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto hidden truncate pr-2 font-mono text-[11px] text-slate-500 sm:block">{sample.file}</span>
      </div>
      <pre className="h-56 overflow-hidden px-4 py-3 font-mono text-[12.5px] leading-relaxed sm:h-60">
        <code>
          <Highlight text={shown} />
          {typing && <span className="sfc-caret ml-px inline-block h-4 w-[7px] translate-y-0.5 bg-sky-400" aria-hidden />}
        </code>
      </pre>
      <div className="border-t border-slate-800 bg-slate-900/60 px-4 py-3">
        <ul className="space-y-1.5 font-mono text-xs">
          {sample.tests.map((t, i) => (
            <li key={t} className={cn("flex items-center gap-2 transition-opacity", i < phase.tests ? "opacity-100" : typing ? "opacity-30" : "opacity-60")}>
              {i < phase.tests ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : !typing && i === phase.tests ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-slate-600" />
              )}
              {t}
            </li>
          ))}
        </ul>
        <p
          className={cn(
            "mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-500",
            phase.done ? "translate-y-0 bg-emerald-500/15 text-emerald-300 opacity-100" : "translate-y-1 opacity-0",
          )}
          aria-live="polite"
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> {phase.done ? sample.verdict : "…"}
        </p>
      </div>
    </div>
  );
}
