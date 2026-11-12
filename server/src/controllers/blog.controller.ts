import type { RequestHandler } from "express";
import { validatedBody, validatedParams, validatedQuery } from "../middleware/validate.ts";
import type { BlogService } from "../services/blog/blog.service.ts";
import { created, noContent, ok } from "../utils/respond.ts";
import type { BlogListQuery, BlogSlugParams, CommentBody, CommentParams, HideBody, PostBody, PostPatchBody, VoteBody } from "../validation/blog.schema.ts";

export function blogController(service: BlogService) {
  const user = (req: { auth?: { userId: string } }) => req.auth?.userId ?? "";
  const slug = (req: Parameters<RequestHandler>[0]) => validatedParams<BlogSlugParams>(req).slug;
  return {
    list: (async (req, res) => ok(res, await service.list(validatedQuery<BlogListQuery>(req).sort))) as RequestHandler,
    get: (async (req, res) => ok(res, await service.get(slug(req), req.auth?.userId ?? null))) as RequestHandler,
    create: (async (req, res) => {
      const post = await service.create(user(req), validatedBody<PostBody>(req));
      created(res, post, `/api/v1/blog/${post.slug}`);
    }) as RequestHandler,
    update: (async (req, res) => {
      const { title, body } = validatedBody<PostPatchBody>(req);
      ok(res, await service.update(user(req), slug(req), { ...(title !== undefined ? { title } : {}), ...(body !== undefined ? { body } : {}) }));
    }) as RequestHandler,
    remove: (async (req, res) => {
      await service.remove(user(req), slug(req));
      noContent(res);
    }) as RequestHandler,
    hide: (async (req, res) => {
      await service.setHidden(user(req), slug(req), validatedBody<HideBody>(req).hidden);
      noContent(res);
    }) as RequestHandler,
    vote: (async (req, res) => ok(res, await service.vote(user(req), slug(req), validatedBody<VoteBody>(req).value))) as RequestHandler,
    comment: (async (req, res) => ok(res, await service.comment(user(req), slug(req), validatedBody<CommentBody>(req).body))) as RequestHandler,
    removeComment: (async (req, res) => {
      await service.removeComment(user(req), validatedParams<CommentParams>(req).id);
      noContent(res);
    }) as RequestHandler,
  };
}
