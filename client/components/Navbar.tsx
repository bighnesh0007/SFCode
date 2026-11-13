"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getStanding, isStaff as isStaffStanding } from "@/lib/adminApi";
import { Menu, X } from "lucide-react";
import { LocalModeBadge, SignInButton, SignUpButton, UserButton, useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { LogoMark } from "@/components/Logo";
import { OrgBadge } from "@/components/OrgBadge";
import { SearchPalette } from "@/components/SearchPalette";
import { cn } from "@/lib/utils";

/** Built sections only; unbuilt features stay out of the nav until they exist. */
const NAV = [
  { href: "/problems", label: "Problems", match: ["/problems", "/challenges", "/soql", "/debugging", "/flows", "/lwc"] },
  { href: "/roadmap", label: "Roadmap", match: ["/roadmap", "/welcome"] },
  { href: "/playground/apex", label: "Playground", match: ["/playground"] },
  { href: "/certification", label: "Certification", match: ["/certification"] },
  { href: "/leaderboard", label: "Leaderboard", match: ["/leaderboard", "/u"] },
  { href: "/contests", label: "Contests", match: ["/contests"] },
  { href: "/blog", label: "Blog", match: ["/blog"] },
  { href: "/store", label: "Store", match: ["/store"] },
];

export default function Navbar() {
  const pathname = usePathname();
  const { isSignedIn } = useAuthState();
  const [open, setOpen] = useState(false);
  const { getToken } = useAuthState();
  const [isStaff, setIsStaff] = useState(false);

  // The Admin link is a convenience only; every admin API checks standing itself.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    getToken()
      .then((t) => getStanding(t))
      .then((st) => !cancelled && setIsStaff(isStaffStanding(st)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken]);
  const active = (match: string[]) => match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-12 max-w-screen-2xl items-center gap-4 px-4 xl:gap-6">
        <Link href="/" className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
          <LogoMark size={24} />
          <span>SF<span className="text-sky-500">Code</span></span>
        </Link>

        <nav className="hidden h-full items-center gap-3.5 whitespace-nowrap text-sm lg:flex xl:gap-5">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n.match) ? "page" : undefined}
              className={cn(
                "flex h-full items-center border-b-2 transition-colors",
                active(n.match) ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <SearchPalette shortcut />
          <LocalModeBadge />
          {isSignedIn && <OrgBadge />}
          <ModeToggle />
          {isSignedIn ? (
            <>
              {isStaff && isSignedIn && <Link href="/admin" className={cn("text-sm hover:text-foreground", active(["/admin"]) ? "text-foreground" : "text-muted-foreground")}>Admin</Link>}
              <Link href="/profile" className={cn("text-sm hover:text-foreground", active(["/profile"]) ? "text-foreground" : "text-muted-foreground")}>Profile</Link>
              <UserButton />
            </>
          ) : (
            <>
              <SignInButton>
                <Button variant="ghost" size="sm">Sign in</Button>
              </SignInButton>
              <SignUpButton>
                <Button size="sm">Sign up</Button>
              </SignUpButton>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1 lg:hidden">
          <SearchPalette />
          <ModeToggle />
          <Button type="button" variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t px-4 py-3 lg:hidden">
          <nav className="flex flex-col">
            {[
              ...NAV,
              ...(isSignedIn ? [{ href: "/profile", label: "Profile", match: ["/profile"] }] : []),
              ...(isSignedIn && isStaff ? [{ href: "/admin", label: "Admin", match: ["/admin"] }] : []),
              { href: "/settings/org", label: "Salesforce org", match: ["/settings"] },
            ].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn("rounded-md px-2 py-2 text-sm", active(n.match) ? "bg-accent font-medium" : "text-muted-foreground")}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            <LocalModeBadge />
            {isSignedIn ? (
              <UserButton />
            ) : (
              <SignInButton>
                <Button variant="outline" size="sm" className="w-full">Sign in</Button>
              </SignInButton>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
