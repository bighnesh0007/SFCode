import { redirect } from "next/navigation";

// LWC problems live in the Problems hub.
export default function Page() {
  redirect("/problems?track=lwc");
}
