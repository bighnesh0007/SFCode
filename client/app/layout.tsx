import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { OnboardingGate } from "@/components/OnboardingGate";
import { ContestBanner } from "@/components/ContestBanner";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { Telemetry } from "@/components/Telemetry";
import { ServiceWorker } from "@/components/ServiceWorker";
import { RankWatcher } from "@/components/RankWatcher";
import { Footer } from "@/components/Footer";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/AuthProvider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: "SFCode",
  description:
    "LeetCode for Salesforce developers. Practice Apex, SOQL, LWC, triggers and asynchronous Apex against your own org, and prepare for Platform Developer certifications.",
  applicationName: "SFCode",
  appleWebApp: { capable: true, title: "SFCode", statusBarStyle: "default" },
  keywords: ["sfcode", "apex practice", "soql practice", "salesforce coding challenges", "apex playground", "lwc playground", "platform developer 1"],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
        <body className="min-h-full flex flex-col bg-background text-foreground">
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <a href="#main" className="sr-only rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100]">
              Skip to content
            </a>
            <Navbar />
            <AnnouncementBanner />
            <ContestBanner />
            <OnboardingGate />
            <RankWatcher />
            <Telemetry />
            <ServiceWorker />
            <main id="main" tabIndex={-1} className="flex-1 flex flex-col outline-none">{children}</main>
            <Footer />
          </ThemeProvider>
        </body>
      </html>
    </AuthProvider>
  );
}
