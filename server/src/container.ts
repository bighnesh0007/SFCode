/**
 * Composition root: the one place that decides which concrete implementation
 * backs each port. Anything unconfigured is left undefined and its routes
 * answer 503 NOT_CONFIGURED.
 */
import { config, hasCapability } from "./config/index.ts";
import { createPgDatabase, type PgDatabase } from "./data/postgres/client.ts";
import { PgSalesforceConnectionRepository } from "./repositories/salesforceConnection.repository.ts";
import { ClerkTokenVerifier } from "./services/identity/clerkTokenVerifier.ts";
import { SalesforceConnectionService } from "./services/salesforce/connection.service.ts";
import { SalesforceClient } from "./services/salesforce/salesforceClient.ts";
import { systemClock, type TokenVerifier } from "./types/ports.ts";
import { PgChallengeSubmissionRepository } from "./repositories/challengeSubmission.repository.ts";
import { ChallengeCatalog } from "./services/challenges/catalog.ts";
import { QuestionBank } from "./services/certification/bank.ts";
import { CertificationService } from "./services/certification/certification.service.ts";
import { PgCertAttemptRepository } from "./repositories/certAttempt.repository.ts";
import { PgProfileRepository } from "./repositories/profile.repository.ts";
import { CommunityService } from "./services/community/community.service.ts";
import { AdminService } from "./services/admin/admin.service.ts";
import { PgAdminRepository } from "./repositories/admin.repository.ts";
import { PgBlogRepository } from "./repositories/blog.repository.ts";
import { BlogService } from "./services/blog/blog.service.ts";
import { PgContestRepository } from "./repositories/contest.repository.ts";
import { PgStoreRepository } from "./repositories/store.repository.ts";
import { ContestService } from "./services/contests/contest.service.ts";
import { StoreService } from "./services/store/store.service.ts";
import { ClerkIdentityLookup } from "./services/identity/clerkIdentity.ts";
import { ChallengeService, type GradingDeps } from "./services/challenges/challenge.service.ts";

export interface Container {
  db?: PgDatabase;
  verifier?: TokenVerifier;
  salesforce?: SalesforceConnectionService;
  challenges?: ChallengeService;
  certification?: CertificationService;
  community?: CommunityService;
  admin?: AdminService;
  blog?: BlogService;
  contests?: ContestService;
  store?: StoreService;
}

/** server/certification (question banks), resolved like PROBLEMS_DIR. */
export const CERTIFICATION_DIR = new URL("../certification", import.meta.url).pathname;

/** server/problems, resolved from this file so it works from src/ (tsx) and dist/ (node). */
export const PROBLEMS_DIR = new URL("../problems", import.meta.url).pathname;

export function buildContainer(): Container {
  const container: Container = {};
  if (config.databaseUrl) container.db = createPgDatabase(config.databaseUrl);
  if (config.clerk.secretKey) container.verifier = new ClerkTokenVerifier(config.clerk.secretKey, config.clerk.authorizedParties);

  const { clientId, clientSecret, apiVersion, timeoutMs, redirectUri } = config.salesforce;
  let grading: GradingDeps | undefined;
  const { tokenEncryptionKey, oauthStateSecret } = config.secrets;
  if (hasCapability("salesforce") && container.db && clientId && clientSecret && tokenEncryptionKey && oauthStateSecret) {
    const sf = new SalesforceClient({ clientId, clientSecret, apiVersion, timeoutMs, redirectUri });
    container.salesforce = new SalesforceConnectionService(
      new PgSalesforceConnectionRepository(container.db),
      sf,
      { tokenKey: tokenEncryptionKey, stateSecret: oauthStateSecret },
      systemClock,
    );
    grading = { connections: container.salesforce, sf, apiVersion };
  }
  const catalog = ChallengeCatalog.load(PROBLEMS_DIR);
  // Loading validates every problem; a broken one stops startup on purpose.
  // Browsing needs nothing (contributors run without accounts or a database);
  // submissions need the database, and grading also needs Salesforce.
  const contestRepo = container.db ? new PgContestRepository(container.db) : undefined;
  container.challenges = new ChallengeService(
    catalog,
    container.db ? new PgChallengeSubmissionRepository(container.db) : undefined,
    grading,
    systemClock,
    contestRepo,
  );
  // Profiles need the database; the Clerk lookup only seeds names/avatars.
  if (container.db) {
    container.community = new CommunityService(
      catalog,
      new PgChallengeSubmissionRepository(container.db),
      new PgProfileRepository(container.db),
      config.clerk.secretKey ? new ClerkIdentityLookup(config.clerk.secretKey) : undefined,
      systemClock,
    );
  }

  if (container.db) container.admin = new AdminService(new PgAdminRepository(container.db), config.superAdminUserId, systemClock);
  if (container.db && container.community && container.admin) {
    container.blog = new BlogService(new PgBlogRepository(container.db), new PgProfileRepository(container.db), container.community, container.admin);
    container.contests = new ContestService(contestRepo ?? new PgContestRepository(container.db), catalog, new PgProfileRepository(container.db), container.community, container.admin, systemClock);
    container.store = new StoreService(new PgStoreRepository(container.db), new PgChallengeSubmissionRepository(container.db), catalog, container.contests);
    container.community.setCosmeticsSource(container.store);
  }

  // No database needed to practise; attempts are saved only when there is one.
  container.certification = new CertificationService(
    QuestionBank.load(CERTIFICATION_DIR),
    container.db ? new PgCertAttemptRepository(container.db) : undefined,
  );
  return container;
}
