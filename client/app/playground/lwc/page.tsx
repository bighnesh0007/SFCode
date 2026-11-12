import { redirect } from "next/navigation";

// The LWC playground became the LWC track of the Problems hub.
export default function Page() {
  redirect("/problems?track=lwc");
}
