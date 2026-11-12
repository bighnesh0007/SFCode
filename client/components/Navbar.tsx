"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Cloud, Menu, X } from "lucide-react";
import { LocalModeBadge, SignInButton, SignUpButton, UserButton, useAuthState } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/mode-toggle";
import { OrgBadge } from "@/components/OrgBadge";
import { FEATURES } from "@/lib/features";
import { cn } from "@/lib/utils";

const PRIMARY = FEATURES.filter((f) => f.primary);
const MORE = FEATURES.filter((f) => !f.primary);

export default function Navbar() {
  const pathname = usePathname();
  const { isSignedIn } = useAuthState();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container flex h-14 items-center max-w-screen-2xl mx-auto px-3 sm:px-4">
        <div className="mr-2 flex min-w-0 items-center md:mr-4">
          <Link href="/" className="mr-2 flex items-center space-x-2 md:mr-5">
            <Cloud className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight text-primary sm:text-xl">SFCode</span>
          </Link>
          <nav className="hidden items-center space-x-0.5 text-sm font-medium md:flex">
            {PRIMARY.map(({ href, nav, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center px-2.5 py-1.5 rounded-md transition-colors hover:text-foreground hover:bg-accent text-[13px]",
                  pathname.startsWith(href) ? "text-foreground font-semibold bg-accent/60" : "text-foreground/60",
                )}
              >
                <Icon className="w-3.5 h-3.5 mr-1" />
                {nav}
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center px-2.5 py-1.5 rounded-md text-[13px] text-foreground/60 transition-colors hover:bg-accent hover:text-foreground">
                More
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {MORE.map(({ href, title, icon: Icon }) => (
                  <DropdownMenuItem key={href} render={<Link href={href} />}>
                    <Icon className="w-3.5 h-3.5" />
                    {title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        <div className="hidden flex-1 items-center justify-end space-x-2 md:flex">
          <nav className="flex items-center gap-1">
            <LocalModeBadge />
            <ModeToggle />
            {!isSignedIn ? (
              <>
                <SignInButton>
                  <Button variant="ghost" size="sm" className="text-[13px] font-medium text-foreground/60 hover:text-foreground">
                    Sign In
                  </Button>
                </SignInButton>
                <SignUpButton>
                  <Button size="sm" className="text-[13px] font-medium">
                    Sign Up
                  </Button>
                </SignUpButton>
              </>
            ) : (
              <>
                <OrgBadge />
                <UserButton />
              </>
            )}
          </nav>
        </div>

        <div className="ml-auto flex items-center gap-1 md:hidden">
          <ModeToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t bg-background/98 px-3 py-3 shadow-lg md:hidden">
          <nav className="grid grid-cols-2 gap-1">
            {[...FEATURES, { href: "/settings/org", nav: "Salesforce Org" }].map(({ href, nav }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname.startsWith(href) ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {nav}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            {!isSignedIn ? (
              <>
                <SignInButton>
                  <Button variant="outline" className="flex-1">Sign In</Button>
                </SignInButton>
                <SignUpButton>
                  <Button className="flex-1">Sign Up</Button>
                </SignUpButton>
              </>
            ) : (
              <UserButton />
            )}
          </div>
        </div>
      )}
    </header>
  );
}
