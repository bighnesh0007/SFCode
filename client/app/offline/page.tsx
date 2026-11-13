import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline · SFCode" };

/** Shown by the service worker when a page can't be reached. Static: no data, no auth. */
export default function OfflinePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <WifiOff className="h-7 w-7 text-primary" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-xl font-semibold">You&apos;re offline</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">SFCode needs a connection to load problems and grade code. Your editor drafts are saved on this device.</p>
    </div>
  );
}
