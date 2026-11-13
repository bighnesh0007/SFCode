"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HeartHandshake, Send } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { RankBadge } from "@/components/RankBadge";
import { useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/apiClient";
import { askMentor, listMentors, MENTOR_TOPICS, myMentor, saveMentor, type Mentor, type MyMentor } from "@/lib/hubApi";
import { cn } from "@/lib/utils";

export default function MentorsPage() {
  const { isSignedIn, getToken } = useAuthState();
  const [mentors, setMentors] = useState<Mentor[] | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [me, setMe] = useState<MyMentor | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    listMentors().then(setMentors).catch(() => setMentors([]));
  }, []);
  useEffect(() => {
    if (!isSignedIn) return;
    getToken().then(myMentor).then(setMe).catch(() => {});
  }, [isSignedIn, getToken]);

  async function send(handle: string) {
    setNote(null);
    try {
      await askMentor(await getToken(), handle, message);
      setNote(`Sent to @${handle}. They'll see it in their notifications.`);
      setAsking(null);
      setMessage("");
    } catch (err) {
      setNote(err instanceof ApiError ? err.message : "Could not send.");
    }
  }

  const shown = (mentors ?? []).filter((m) => !topic || m.topics.includes(topic));
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><HeartHandshake className="h-6 w-6 text-emerald-700 dark:text-emerald-400" /> Mentors</h1>
      <p className="mt-1 text-sm text-muted-foreground">Learners at Ranger rank and above who offer to help. Ask a short question; it arrives in their notifications.</p>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {[null, ...MENTOR_TOPICS].map((t) => (
          <button key={t ?? "all"} type="button" onClick={() => setTopic(t)} className={cn("rounded-full border px-3 py-1 text-xs", topic === t ? "border-sky-500 bg-sky-500/10 font-medium" : "text-muted-foreground")}>{t ?? "All"}</button>
        ))}
      </div>
      {note && <p className="mt-3 text-sm text-muted-foreground">{note}</p>}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {mentors === null && [0, 1].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl border bg-muted/40" />)}
        {mentors !== null && shown.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No mentors {topic ? `for ${topic} ` : ""}yet. Reach Ranger and be the first!</p>}
        {shown.map((m) => (
          <div key={m.handle} className="rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <Avatar src={m.imageUrl} name={m.displayName} size={36} />
              <div className="min-w-0 flex-1">
                <Link href={`/u/${m.handle}`} className="block truncate font-medium hover:text-primary">{m.displayName}</Link>
                <RankBadge id={m.tier.id} title={m.tier.title} size="sm" />
              </div>
            </div>
            {m.note && <p className="mt-2 text-sm">{m.note}</p>}
            <div className="mt-2 flex flex-wrap gap-1">{m.topics.map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{t}</span>)}</div>
            {isSignedIn && (asking === m.handle ? (
              <div className="mt-3 space-y-2">
                <textarea aria-label="Your question" value={message} maxLength={500} onChange={(e) => setMessage(e.target.value)} placeholder="What are you stuck on?" className="min-h-20 w-full rounded-md border bg-background p-2 text-sm" />
                <div className="flex gap-2"><Button size="sm" disabled={message.trim().length < 10} onClick={() => void send(m.handle)}><Send className="mr-1 h-3.5 w-3.5" /> Send</Button><Button size="sm" variant="ghost" onClick={() => setAsking(null)}>Cancel</Button></div>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setAsking(m.handle)}>Ask for help</Button>
            ))}
          </div>
        ))}
      </div>

      {me && <BecomeMentor me={me} onSaved={(m) => { setMe(m); listMentors().then(setMentors).catch(() => {}); }} />}
    </div>
  );
}

function BecomeMentor({ me, onSaved }: { me: MyMentor; onSaved: (m: MyMentor) => void }) {
  const { getToken } = useAuthState();
  const [topics, setTopics] = useState<string[]>(me.topics);
  const [note, setNote] = useState(me.note);
  const [error, setError] = useState<string | null>(null);
  async function save(active: boolean) {
    setError(null);
    try {
      onSaved(await saveMentor(await getToken(), { topics, note, active }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    }
  }
  return (
    <section className="mt-10 rounded-xl border p-5">
      <h2 className="font-semibold">{me.active ? "You're listed as a mentor" : "Become a mentor"}</h2>
      {!me.eligible ? (
        <p className="mt-1 text-sm text-muted-foreground">Reach Ranger rank (30 points) to mentor others. You&apos;re a {me.rank} now.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {MENTOR_TOPICS.map((t) => {
              const on = topics.includes(t);
              return <button key={t} type="button" aria-pressed={on} onClick={() => setTopics(on ? topics.filter((x) => x !== t) : [...topics, t])} className={cn("rounded-full border px-2.5 py-1 text-xs", on && "border-emerald-500 bg-emerald-500/10")}>{t}</button>;
            })}
          </div>
          <input aria-label="A line about how you can help" placeholder="A line about how you can help" value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} className="mt-3 h-9 w-full rounded-md border bg-background px-2 text-sm" />
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void save(true)}>{me.active ? "Update" : "List me as a mentor"}</Button>
            {me.active && <Button size="sm" variant="ghost" onClick={() => void save(false)}>Stop mentoring</Button>}
          </div>
        </>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}
