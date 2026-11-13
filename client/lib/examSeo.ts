import "server-only";
import { cache } from "react";
import { serverApi } from "./serverApi";

export interface ExamInfo {
  exam: string;
  title: string;
  description: string;
  questionCount: number;
  mock?: { questions: number; minutes: number; passPercent: number };
  sections: { id: string; title: string; total: number }[];
}

/** The exam list, fetched once per request for metadata and page alike; null if the API is unreachable. */
export const examList = cache(() => serverApi<ExamInfo[]>("/api/v1/certification"));
export const examInfo = async (exam: string) => (await examList())?.find((e) => e.exam === exam) ?? null;
