import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { OnboardingGate } from "@/components/OnboardingGate";
import { ContestBanner } from "@/components/ContestBanner";
import { RankWatcher } from "@/components/RankWatcher";
import { Footer } from "@/components/Footer";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/AuthProvider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SFCode",
  description:
    "LeetCode for Salesforce developers. Practice Apex, SOQL, LWC, triggers and asynchronous Apex against your own org, and prepare for Platform Developer certifications.",
  keywords: ["sfcode", "apex practice", "soql practice", "salesforce coding challenges", "apex playground", "lwc playground", "platform developer 1"],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthProvider>
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
        <body className="min-h-full flex flex-col bg-background text-foreground">
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <Navbar />
            <ContestBanner />
            <OnboardingGate />
            <RankWatcher />
            <main className="flex-1 flex flex-col">{children}</main>
            <Footer />
          </ThemeProvider>
        </body>
      </html>
    </AuthProvider>
  );
}
