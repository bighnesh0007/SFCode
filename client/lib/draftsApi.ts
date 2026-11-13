/** Community problem drafts and review. Shapes mirror server/src/services/problems. */
import { apiRequest } from "./apiClient";

type Token = string | null;

export type DraftStatus = "draft" | "submitted" | "changes_requested" | "approved" | "rejected";
export type DraftTrack = "apex" | "debug" | "soql";

export interface ProblemContent {
  title: string;
  track: DraftTrack;
  difficulty: "Easy" | "Medium" | "Hard";
  category: string;
  tags: string[];
  statement: string;
  files: { name: string; type: "class" | "trigger" | "soql" }[];
  starter: Record<string, string>;
  reference: Record<string, string>;
  testClass: string;
  testSource: string;
}

export interface DraftCheck {
  status: "running" | "passed" | "failed" | "error";
  by: string;
  at: string;
  reference?: { verdict: string; passed: number; run: number; message: string | null };
  starter?: { verdict: string };
  message?: string;
  current: boolean;
}

export interface DraftView {
  canEdit: boolean;
  canReview: boolean;
  id: string;
  status: DraftStatus;
  slug: string;
  content: ProblemContent;
  check: DraftCheck | null;
  reviewNote: string | null;
  publishedSlug: string | null;
  updatedAt: string;
  author: string | null;
  problems: string[];
}

export interface DraftRow {
  id: string;
  title: string;
  track: DraftTrack;
  difficulty: string;
  status: DraftStatus;
  publishedSlug?: string | null;
  author?: string | null;
  updatedAt: string;
}

export const myDrafts = (t: Token) => apiRequest<DraftRow[]>("/api/v1/contribute/drafts", { token: t });
export const createDraft = (t: Token, content: ProblemContent) => apiRequest<DraftView>("/api/v1/contribute/drafts", { method: "POST", token: t, body: { content } });
export const getDraft = (t: Token, id: string) => apiRequest<DraftView>(`/api/v1/contribute/drafts/${id}`, { token: t });
export const saveDraft = (t: Token, id: string, content: ProblemContent) => apiRequest<DraftView>(`/api/v1/contribute/drafts/${id}`, { method: "PUT", token: t, body: { content } });
export const checkDraft = (t: Token, id: string) => apiRequest<DraftView>(`/api/v1/contribute/drafts/${id}/check`, { method: "POST", token: t });
export const submitDraft = (t: Token, id: string) => apiRequest<DraftView>(`/api/v1/contribute/drafts/${id}/submit`, { method: "POST", token: t });
export const reviewQueue = (t: Token) => apiRequest<DraftRow[]>("/api/v1/admin/review", { token: t });
export const reviewDraft = (t: Token, id: string, action: "approve" | "changes" | "reject", note: string) =>
  apiRequest<DraftView>(`/api/v1/admin/review/${id}`, { method: "POST", token: t, body: { action, note } });
export interface CommunityProblemRow {
  slug: string;
  title: string;
  track: DraftTrack;
  difficulty: string;
  author: string | null;
  active: boolean;
  publishedAt: string;
}
export const communityProblems = (t: Token) => apiRequest<CommunityProblemRow[]>("/api/v1/admin/community-problems", { token: t });
export const setProblemActive = (t: Token, slug: string, active: boolean) =>
  apiRequest<{ ok: true }>(`/api/v1/admin/community-problems/${encodeURIComponent(slug)}`, { method: "POST", token: t, body: { active } });

export const STATUS_TEXT: Record<DraftStatus, string> = {
  draft: "Draft",
  submitted: "In review",
  changes_requested: "Changes requested",
  approved: "Published",
  rejected: "Rejected",
};

/** A starting point that already passes the structural checks, so authors edit rather than start blank. */
export function blankContent(track: DraftTrack): ProblemContent {
  if (track === "soql") {
    return {
      title: "",
      track,
      difficulty: "Easy",
      category: "Filtering",
      tags: [],
      statement: "",
      files: [{ name: "query", type: "soql" }],
      starter: { query: "SELECT Id FROM Account" },
      reference: { query: "SELECT Id, Name FROM Account WHERE Industry = 'Technology'" },
      testClass: "SfcSoqlMyProblemTest",
      testSource:
        "@isTest\nprivate class SfcSoqlMyProblemTest {\n    @isTest\n    static void matchesReference() {\n        insert new List<Account>{ new Account(Name = 'A', Industry = 'Technology'), new Account(Name = 'B', Industry = 'Banking') };\n        Test.startTest();\n        List<SObject> actual = sfcRunSubmission();\n        Test.stopTest();\n        List<SObject> expected = Database.query({{REFERENCE_QUERY}});\n        System.assert(!expected.isEmpty(), 'Fixture sanity: the reference query must return rows');\n        sfcAssertSameRows(expected, actual, false);\n    }\n\n{{SOQL_COMPARE}}\n}\n",
    };
  }
  return {
    title: "",
    track,
    difficulty: "Easy",
    category: track === "debug" ? "Null Safety" : "Classes",
    tags: [],
    statement: "",
    files: [{ name: "SfcMyClass", type: "class" }],
    starter: { SfcMyClass: "public with sharing class SfcMyClass {\n    // Your code here\n}\n" },
    reference: { SfcMyClass: "public with sharing class SfcMyClass {\n}\n" },
    testClass: "SfcMyClassTest",
    testSource: "@isTest\nprivate class SfcMyClassTest {\n    @isTest\n    static void works() {\n        System.assert(true);\n    }\n}\n",
  };
}
