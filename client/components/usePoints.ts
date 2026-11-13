"use client";

import { useEffect, useState } from "react";
import { getPoints, type PointsSettings } from "@/lib/adminApi";

/** The live points table (admin-editable), fetched once per page. null while loading or if it fails. */
export function usePoints(): PointsSettings | null {
  const [points, setPoints] = useState<PointsSettings | null>(null);
  useEffect(() => {
    let cancelled = false;
    getPoints()
      .then((p) => !cancelled && setPoints(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return points;
}

/** "Apex 3/6/9 · SOQL 1/2/3 …", for one-line explanations. */
export function pointsSummary(p: PointsSettings): string {
  const rows: [keyof PointsSettings["matrix"], string][] = [["lwc", "LWC"], ["apex", "Apex"], ["debug", "Debugging"], ["flow", "Flow"], ["soql", "SOQL"]];
  return rows.map(([t, label]) => `${label} ${p.matrix[t].Easy}/${p.matrix[t].Medium}/${p.matrix[t].Hard}`).join(" · ");
}
