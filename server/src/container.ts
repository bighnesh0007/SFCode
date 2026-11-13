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
import { compileLwc } from "./services/lwc/compiler.ts";
import { LwcSandbox } from "./services/lwc/lwcSandbox.ts";
import { PgHubRepository } from "./repositories/hub.repository.ts";
import { HubService } from "./services/hub/hub.service.ts";
import { PgEmailRepository } from "./repositories/email.repository.ts";
import { DigestService } from "./services/email/digest.service.ts";
import { emailJsSender } from "./services/email/emailjs.ts";
import { PgSocialRepository } from "./repositories/social.repository.ts";
import { SocialService } from "./services/social/social.service.ts";
import { PgProblemDraftRepository } from "./repositories/problemDraft.repository.ts";
import { makeOrgChecker } from "./services/problems/orgChecker.ts";
import { ProblemDraftService } from "./services/problems/problemDraft.service.ts";
import { PgBuddyRepository } from "./repositories/buddy.repository.ts";
import { PgSettingsRepository } from "./repositories/settings.repository.ts";
import { PgTelemetryRepository } from "./repositories/telemetry.repository.ts";
import { PgDiscussionRepository } from "./repositories/discussion.repository.ts";
import { DiscussionService } from "./services/discussion/discussion.service.ts";
import { TelemetryService } from "./services/telemetry/telemetry.service.ts";
import { setErrorSink } from "./middleware/errorHandler.ts";
import { BuddyService } from "./services/buddy/buddy.service.ts";
import { PointsService } from "./services/points/points.service.ts";
import { PgDailyRepository } from "./repositories/daily.repository.ts";
import { DailyService } from "./services/daily/daily.service.ts";
import { PgAboutRepository } from "./repositories/about.repository.ts";
import { loadRoadmaps } from "./domain/roadmap.ts";
import { PgOnboardingRepository } from "./repositories/onboarding.repository.ts";
import { RoadmapService } from "./services/roadmap/roadmap.service.ts";
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
  roadmaps?: RoadmapService;
  daily?: DailyService;
  points?: PointsService;
  buddies?: BuddyService;
  drafts?: ProblemDraftService;
  social?: SocialService;
  digest?: DigestService;
  telemetry?: TelemetryService;
  discussion?: DiscussionService;
  hub?: HubService;
}

/** server/certification (question banks), resolved like PROBLEMS_DIR. */
export const CERTIFICATION_DIR = new URL("../certification", import.meta.url).pathname;

/** server/problems, resolved from this file so it works from src/ (tsx) and dist/ (node). */
/** server/roadmaps (learning paths), resolved like PROBLEMS_DIR. */
export const ROADMAPS_DIR = new URL("../roadmaps", import.meta.url).pathname;
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
  // Loaded even without a database so broken roadmap content fails startup and tests.
  const roadmaps = loadRoadmaps(ROADMAPS_DIR, (slug) => catalog.get(slug) !== undefined);
  if (container.db) {
    container.roadmaps = new RoadmapService(roadmaps, catalog, new PgOnboardingRepository(container.db), new PgChallengeSubmissionRepository(container.db));
  }
  const contestRepo = container.db ? new PgContestRepository(container.db) : undefined;
  container.challenges = new ChallengeService(
    catalog,
    container.db ? new PgChallengeSubmissionRepository(container.db) : undefined,
    grading,
    systemClock,
    contestRepo,
  );
  // Built before the services that score or check roles.
  if (container.db) {
    container.admin = new AdminService(
      new PgAdminRepository(container.db),
      config.superAdminUserId,
      systemClock,
      new PgSettingsRepository(container.db),
      config.clerk.secretKey ? new ClerkIdentityLookup(config.clerk.secretKey) : undefined,
    );
    container.admin.setProblemTitles((slug) => catalog.get(slug)?.title);
    container.admin.setProblemList(() => catalog.all().map((c) => ({ slug: c.slug, title: c.title, track: c.track, difficulty: c.difficulty, community: c.authorId !== undefined })));
    const telemetry = new TelemetryService(new PgTelemetryRepository(container.db), container.admin, systemClock);
    container.telemetry = telemetry;
    setErrorSink((e) => void telemetry.report({ source: "server", ...e }));
  }
  container.points = new PointsService(container.db ? new PgSettingsRepository(container.db) : undefined, container.admin);

  // Profiles need the database; the Clerk lookup only seeds names/avatars.
  if (container.db) {
    container.community = new CommunityService(
      catalog,
      new PgChallengeSubmissionRepository(container.db),
      new PgProfileRepository(container.db),
      config.clerk.secretKey ? new ClerkIdentityLookup(config.clerk.secretKey) : undefined,
      systemClock,
      new PgAboutRepository(container.db),
      container.points,
    );
  }

  if (container.db && container.community && container.admin) {
    container.discussion = new DiscussionService(new PgDiscussionRepository(container.db), catalog, new PgProfileRepository(container.db), container.community, container.admin, systemClock);
    container.blog = new BlogService(new PgBlogRepository(container.db), new PgProfileRepository(container.db), container.community, container.admin);
    container.contests = new ContestService(contestRepo ?? new PgContestRepository(container.db), catalog, new PgProfileRepository(container.db), container.community, container.admin, systemClock);
    container.daily = new DailyService(new PgDailyRepository(container.db), catalog, systemClock);
    container.store = new StoreService(new PgStoreRepository(container.db), new PgChallengeSubmissionRepository(container.db), catalog, container.contests, container.daily, container.points);
    container.store.setAdminTools({ admin: container.admin, settings: new PgSettingsRepository(container.db) });
    if (config.lwcRunnerImage) {
      const sandbox = new LwcSandbox(config.lwcRunnerImage);
      container.challenges.setLwcGrader({ run: (code, tests) => sandbox.run(code, tests), compile: compileLwc });
    }
    const profilesForCredit = new PgProfileRepository(container.db);
    container.challenges.setAuthorLookup(async (userId) => {
      const p = await profilesForCredit.findByUser(userId);
      return p ? { handle: p.handle, displayName: p.displayName } : null;
    });
    container.drafts = new ProblemDraftService(
      new PgProblemDraftRepository(container.db),
      catalog,
      container.admin,
      new PgProfileRepository(container.db),
      grading ? makeOrgChecker(grading, catalog.soqlCompare) : undefined,
      systemClock,
    );
    container.social = new SocialService(new PgSocialRepository(container.db), new PgProfileRepository(container.db), container.community, new PgChallengeSubmissionRepository(container.db), catalog, container.points ?? new PointsService(undefined, undefined), systemClock);
    const draftRepoForFeed = new PgProblemDraftRepository(container.db);
    const blog = container.blog;
    container.social.setSources({
      communityProblems: async () => (await draftRepoForFeed.published(true)).map((p) => ({ slug: p.slug, title: p.content.title, track: p.content.track, difficulty: p.content.difficulty, authorId: p.authorId, publishedAt: p.publishedAt })),
      posts: async () => (blog ? (await blog.list("new")).map((p) => ({ slug: p.slug, title: p.title, authorHandle: p.author.handle, createdAt: p.createdAt })) : []),
    });
    const social = container.social;
    container.drafts.setNotifier((userId, kind, data) => social.notify(userId, kind, data));
    container.buddies = new BuddyService(new PgBuddyRepository(container.db), container.admin, container.community, new PgProfileRepository(container.db));
    // Weekly digest (opt-in). Sending needs all four EmailJS settings and Clerk (for addresses).
    const { serviceId, templateId, publicKey, privateKey, monthlyCap, perUserMonthly } = config.email;
    const sender = serviceId && templateId && publicKey && privateKey && config.clerk.secretKey ? emailJsSender({ serviceId, templateId, publicKey, privateKey }) : undefined;
    const clerkForEmail = config.clerk.secretKey ? new ClerkIdentityLookup(config.clerk.secretKey) : undefined;
    const communityForDigest = container.community;
    const dailyForDigest = container.daily;
    const contestsForDigest = container.contests;
    const site = config.http.appUrl;
    container.digest = new DigestService(
      new PgEmailRepository(container.db),
      sender,
      {
        email: (userId) => (clerkForEmail ? clerkForEmail.email(userId) : Promise.resolve(null)),
        content: async (userId) => {
          const me = await communityForDigest.me(userId);
          const daily = await dailyForDigest.view(null);
          const now = Date.now();
          const contests = (await contestsForDigest.list()).filter((c) => Date.parse(c.endsAt) > now && Date.parse(c.startsAt) < now + 7 * 86_400_000);
          return {
            name: me.displayName,
            rank: me.tier.title,
            points: me.tier.points,
            streak: me.stats.streak,
            daily: { title: daily.problem.title, url: `${site}/problems` },
            contests: contests.map((c) => ({ title: c.title, url: `${site}/contests/${c.slug}`, startsAt: c.startsAt })),
          };
        },
      },
      systemClock,
      { total: monthlyCap, perUser: perUserMonthly },
      site,
    );
    container.hub = new HubService(new PgHubRepository(container.db), new PgProfileRepository(container.db), container.community, container.admin, container.social, systemClock);
    container.buddies.setNotifier((userId, kind, data) => social.notify(userId, kind, data));
    container.community.setCosmeticsSource(container.store);
    const communityForFreezes = container.community;
    container.store.setFreezeUsage((userId) => communityForFreezes.freezesUsed(userId));
    const store = container.store;
    const contests = container.contests;
    const roadmapSvc = container.roadmaps;
    container.community.setExtras({
      coins: async (userId) => (await store.wallet(userId)).balance,
      contestHistory: (userId) => contests.history(userId),
      ratingHistory: (userId) => contests.ratingHistory(userId),
      streakFreezes: (userId) => store.freezesOwned(userId),
      // Built further down; looked up at call time.
      certReadiness: (userId) => (container.certification ? container.certification.readiness(userId) : Promise.resolve([])),
      contributions: (userId) => (container.drafts ? container.drafts.countPublishedBy(userId) : Promise.resolve(0)),
      roadmapProgress: async (userId) => {
        const ob = roadmapSvc ? await roadmapSvc.onboarding(userId) : null;
        if (!roadmapSvc || !ob) return null;
        const v = await roadmapSvc.view(ob.roadmapId, userId);
        return { title: v.title, done: v.done, total: v.total };
      },
    });
  }

  // No database needed to practise; attempts are saved only when there is one.
  container.certification = new CertificationService(
    QuestionBank.load(CERTIFICATION_DIR),
    container.db ? new PgCertAttemptRepository(container.db) : undefined,
  );
  return container;
}
