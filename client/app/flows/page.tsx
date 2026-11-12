import { redirect } from "next/navigation";

// Flow problems live in the Problems hub; old links keep working.
export default function Page() {
  redirect("/problems?track=flow");
}
