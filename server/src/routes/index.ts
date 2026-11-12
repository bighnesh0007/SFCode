import express, { Router, type Application, type RequestHandler } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { hasCapability } from "../config/index.ts";
import type { Container } from "../container.ts";
import { salesforceController } from "../controllers/salesforce.controller.ts";
import { NotConfiguredError, RateLimitError } from "../errors/AppError.ts";
import { optionalAuth, requireAuth } from "../middleware/auth.ts";
import { notFound } from "../middleware/notFound.ts";
import { v1Cors } from "../middleware/security.ts";
import { validate } from "../middleware/validate.ts";
import { ok } from "../utils/respond.ts";
import { callbackQuery, connectBody, executeBody } from "../validation/salesforce.schema.ts";
import { challengeController } from "../controllers/challenge.controller.ts";
import { certificationController } from "../controllers/certification.controller.ts";
import { answerBody, examParams, practiceQuery } from "../validation/certification.schema.ts";
import { lwcCompileBody, type LwcCompileBody } from "../validation/lwc.schema.ts";
import { compileLwc } from "../services/lwc/compiler.ts";
import { communityController } from "../controllers/community.controller.ts";
import { adminController } from "../controllers/admin.controller.ts";
import { blogController } from "../controllers/blog.controller.ts";
import { contestController, storeController } from "../controllers/contest.controller.ts";
import { contestSlugParams, createContestBody, equipBody, storeItemBody } from "../validation/contest.schema.ts";
import { blogListQuery, blogSlugParams, commentBody, commentParams, hideBody, postBody, postPatchBody, voteBody } from "../validation/blog.schema.ts";
import { adminUsersQuery, roleBody } from "../validation/admin.schema.ts";
import { handleParams, leaderboardQuery, profileUpdateBody } from "../validation/community.schema.ts";
import { validatedBody } from "../middleware/validate.ts";
import { listQuery, slugParams, submissionParams, submitBody } from "../validation/challenge.schema.ts";

function disabled(what: string): RequestHandler {
  return (_req, _res, next) => next(new NotConfiguredError(what));
}

/** Per-user (falling back to per-IP) limit; in-memory, so correct for one instance only. */
function limiter(perMinute: number): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: perMinute,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Signed-in users by id; anonymous ones by IP, with IPv6 grouped to its /56
    // (ipKeyGenerator) — keying on the raw address let a client rotate through
    // its own IPv6 block to bypass the limit.
    keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? "unknown"),
    handler: (_req, _res, next) => next(new RateLimitError("Too many requests.", 60)),
  });
}

const lwcCompile: RequestHandler = async (req, res) => {
  ok(res, { code: await compileLwc(validatedBody<LwcCompileBody>(req)) });
};

export function mountRoutes(app: Application, container: Container): void {
  app.get("/health", (_req, res) => ok(res, { status: "ok" }));

  const v1 = Router();
  v1.use(v1Cors());
  v1.use(express.json({ limit: "256kb" }));

  const sf = Router();
  const { verifier, salesforce } = container;
  if (!verifier) {
    sf.use(disabled("Sign-in"));
  } else if (!salesforce || !hasCapability("salesforce")) {
    sf.use(disabled("Salesforce org connection"));
  } else {
    const c = salesforceController(salesforce);
    // The callback is a browser navigation from Salesforce; it is authenticated by
    // the signed state + single-use PKCE row, not by a Clerk session.
    sf.get("/oauth/callback", limiter(30), validate({ query: callbackQuery }), c.callback);
    sf.use(requireAuth(verifier));
    sf.post("/connect", limiter(10), validate({ body: connectBody }), c.start);
    sf.get("/connection", c.status);
    sf.delete("/connection", c.disconnect);
    sf.post("/apex/execute", limiter(20), validate({ body: executeBody }), c.execute);
  }
  v1.use("/salesforce", sf);

  const ch = Router();
  const { challenges } = container;
  if (!challenges) {
    ch.use(disabled("The Apex Challenge Arena"));
  } else {
    const c = challengeController(challenges);
    // Browsing never needs an account (contributors run without Clerk);
    // progress markers appear when someone is signed in.
    const identify: RequestHandler = verifier ? optionalAuth(verifier) : (_req, _res, next) => next();
    const signedIn: RequestHandler = verifier ? requireAuth(verifier) : disabled("Sign-in");
    ch.get("/", identify, validate({ query: listQuery }), c.list);
    // Static path before /:slug so "submissions" is never read as a slug.
    ch.get("/submissions/:id", signedIn, validate({ params: submissionParams }), c.submission);
    ch.get("/:slug", validate({ params: slugParams }), c.get);
    ch.get("/:slug/submissions", signedIn, validate({ params: slugParams }), c.history);
    ch.post("/:slug/submissions", signedIn, limiter(6), validate({ params: slugParams, body: submitBody }), c.submit);
  }
  v1.use("/challenges", ch);

  // Certification Prep works signed out; signing in only adds saved progress.
  const cert = Router();
  if (container.certification) {
    const c = certificationController(container.certification);
    const identify: RequestHandler = verifier ? optionalAuth(verifier) : (_req, _res, next) => next();
    cert.get("/", identify, c.list);
    cert.get("/:exam/questions", validate({ params: examParams, query: practiceQuery }), c.practice);
    cert.post("/answers", identify, limiter(60), validate({ body: answerBody }), c.answer);
  } else {
    cert.use(disabled("Certification Prep"));
  }
  v1.use("/certification", cert);

  // Profiles and leaderboard: public reads; your own profile needs sign-in.
  // Mounted on their own paths: a router at "/" with a catch-all "not
  // configured" handler swallowed every unknown /api/v1 path as a 503.
  if (container.community) {
    const c = communityController(container.community);
    const signedIn: RequestHandler = verifier ? requireAuth(verifier) : disabled("Sign-in");
    v1.get("/profile/me", signedIn, c.me);
    v1.patch("/profile/me", signedIn, limiter(20), validate({ body: profileUpdateBody }), c.updateMe);
    v1.get("/profile/:handle", validate({ params: handleParams }), c.byHandle);
    v1.get("/leaderboard", validate({ query: leaderboardQuery }), c.leaderboard);
  } else {
    v1.use(["/profile", "/leaderboard"], disabled("Profiles and the leaderboard"));
  }

  // Admin: every handler re-checks the actor's standing in AdminService.
  if (container.admin && verifier) {
    const a = adminController(container.admin);
    const auth = requireAuth(verifier);
    v1.get("/admin/me", auth, a.me);
    v1.get("/admin/overview", auth, a.overview);
    v1.get("/admin/users", auth, validate({ query: adminUsersQuery }), a.users);
    v1.post("/admin/roles", auth, limiter(30), validate({ body: roleBody }), a.grant);
    v1.delete("/admin/roles", auth, limiter(30), validate({ body: roleBody }), a.revoke);
  } else {
    v1.use("/admin", disabled("Admin"));
  }

  // Blog: public reads (a moderator viewing also sees hidden comments);
  // writes need sign-in and are rate-limited against spam.
  if (container.blog) {
    const b = blogController(container.blog);
    const identify: RequestHandler = verifier ? optionalAuth(verifier) : (_req, _res, next) => next();
    const signedIn: RequestHandler = verifier ? requireAuth(verifier) : disabled("Sign-in");
    const s = validate({ params: blogSlugParams });
    v1.get("/blog", validate({ query: blogListQuery }), b.list);
    v1.post("/blog", signedIn, limiter(5), validate({ body: postBody }), b.create);
    v1.delete("/blog/comments/:id", signedIn, limiter(30), validate({ params: commentParams }), b.removeComment);
    v1.get("/blog/:slug", identify, s, b.get);
    v1.patch("/blog/:slug", signedIn, limiter(20), validate({ params: blogSlugParams, body: postPatchBody }), b.update);
    v1.delete("/blog/:slug", signedIn, limiter(20), s, b.remove);
    v1.post("/blog/:slug/hide", signedIn, limiter(30), validate({ params: blogSlugParams, body: hideBody }), b.hide);
    v1.post("/blog/:slug/vote", signedIn, limiter(60), validate({ params: blogSlugParams, body: voteBody }), b.vote);
    v1.post("/blog/:slug/comments", signedIn, limiter(10), validate({ params: blogSlugParams, body: commentBody }), b.comment);
  } else {
    v1.use("/blog", disabled("The blog"));
  }

  // Contests: public reads; joining needs sign-in; creating/deleting is admin
  // (ContestService re-checks the actor's standing).
  if (container.contests) {
    const c = contestController(container.contests);
    const identify: RequestHandler = verifier ? optionalAuth(verifier) : (_req, _res, next) => next();
    const signedIn: RequestHandler = verifier ? requireAuth(verifier) : disabled("Sign-in");
    v1.get("/contests", c.list);
    v1.post("/contests", signedIn, limiter(10), validate({ body: createContestBody }), c.create);
    v1.get("/contests/:slug", identify, validate({ params: contestSlugParams }), c.get);
    v1.post("/contests/:slug/join", signedIn, limiter(20), validate({ params: contestSlugParams }), c.join);
    v1.delete("/contests/:slug", signedIn, limiter(10), validate({ params: contestSlugParams }), c.remove);
  } else {
    v1.use("/contests", disabled("Contests"));
  }

  // Store: browsing is public; your wallet, buying and equipping need sign-in.
  if (container.store) {
    const st = storeController(container.store);
    const identify: RequestHandler = verifier ? optionalAuth(verifier) : (_req, _res, next) => next();
    const signedIn: RequestHandler = verifier ? requireAuth(verifier) : disabled("Sign-in");
    v1.get("/store", identify, st.view);
    v1.post("/store/buy", signedIn, limiter(20), validate({ body: storeItemBody }), st.buy);
    v1.post("/store/equip", signedIn, limiter(40), validate({ body: equipBody }), st.equip);
  } else {
    v1.use("/store", disabled("The store"));
  }

  // LWC: compile only. The learner's component runs in their own browser
  // (sandboxed iframe), never here. Anonymous, so it is rate-limited.
  const lwcRouter = Router();
  lwcRouter.post("/compile", limiter(20), validate({ body: lwcCompileBody }), lwcCompile);
  v1.use("/lwc", lwcRouter);

  app.use("/api/v1", v1);
  app.use(notFound);
}
