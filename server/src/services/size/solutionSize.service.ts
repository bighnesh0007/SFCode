import { NotFoundError } from "../../errors/AppError.ts";
import { codeSize, sizeStats, type SizeStats } from "../../domain/codeSize.ts";
import type { ChallengeSubmissionRepository } from "../../repositories/challengeSubmission.repository.ts";

/** How a learner's accepted solution compares in size with everyone else's. */
export class SolutionSizeService {
  constructor(
    private readonly submissions: ChallengeSubmissionRepository,
    private readonly exists: (slug: string) => boolean,
  ) {}

  /** Null until the learner has solved it, so nothing about others' code leaks before then. */
  async stats(userId: string, slug: string): Promise<SizeStats | null> {
    if (!this.exists(slug)) throw new NotFoundError("Problem not found.");
    const best = new Map<string, number>();
    for (const { userId: u, files } of await this.submissions.acceptedFiles(slug)) {
      const size = codeSize(files);
      // Flow problems are built in the org and submit no files.
      if (size === 0) continue;
      best.set(u, Math.min(size, best.get(u) ?? Infinity));
    }
    return sizeStats(best, userId);
  }
}
