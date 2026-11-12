import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="text-5xl font-bold text-primary">404</h1>
      <p className="mt-3 text-muted-foreground">That page does not exist.</p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>Home</Link>
    </div>
  );
}
