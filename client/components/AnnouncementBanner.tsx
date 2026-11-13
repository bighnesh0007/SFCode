"use client";

import { useEffect, useState } from "react";
import { BannerView } from "@/components/admin/AdminTools";
import { getAnnouncement, type Announcement } from "@/lib/adminApi";

const DISMISSED_KEY = "sfcode.announcement.dismissed";

/** The admin-posted site-wide message. A dismissal is remembered per announcement id. */
export function AnnouncementBanner() {
  const [a, setA] = useState<Announcement | null>(null);
  useEffect(() => {
    let cancelled = false;
    getAnnouncement()
      .then((x) => {
        if (cancelled || !x) return;
        let dismissed: string | null = null;
        try {
          dismissed = localStorage.getItem(DISMISSED_KEY);
        } catch {
          /* storage unavailable: show it every time */
        }
        if (dismissed !== x.id) setA(x);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (!a) return null;
  return (
    <BannerView
      a={a}
      onDismiss={() => {
        try {
          localStorage.setItem(DISMISSED_KEY, a.id);
        } catch {
          /* ignore */
        }
        setA(null);
      }}
    />
  );
}
