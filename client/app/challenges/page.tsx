import { redirect } from "next/navigation";

// The per-track list moved into the Problems hub; old links keep working.
export default function Page() {
  redirect("/problems?track=apex");
}
