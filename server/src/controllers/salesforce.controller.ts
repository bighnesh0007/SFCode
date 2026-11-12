import type { Request, RequestHandler, Response } from "express";
import { config } from "../config/index.ts";
import { validatedBody, validatedQuery } from "../middleware/validate.ts";
import type { SalesforceConnectionService } from "../services/salesforce/connection.service.ts";
import { noContent, ok } from "../utils/respond.ts";
import type { CallbackQuery, ConnectBody, ExecuteBody } from "../validation/salesforce.schema.ts";

function userId(req: Request): string {
  // requireAuth runs first on every route that calls this.
  return req.auth?.userId ?? "";
}

export function salesforceController(service: SalesforceConnectionService) {
  const start: RequestHandler = async (req, res) => {
    const body = validatedBody<ConnectBody>(req);
    ok(res, await service.start(userId(req), body.loginUrl, body.returnTo));
  };

  const callback: RequestHandler = async (req, res: Response) => {
    const q = validatedQuery<CallbackQuery>(req);
    const path = await service.complete({
      ...(q.code ? { code: q.code } : {}),
      ...(q.state ? { state: q.state } : {}),
      ...(q.error ? { error: q.error } : {}),
    });
    // `path` is always a same-site path (safeReturnTo), so this is not an open redirect.
    res.redirect(303, `${config.http.appUrl}${path}`);
  };

  const status: RequestHandler = async (req, res) => {
    ok(res, { connection: await service.status(userId(req)) });
  };

  const disconnect: RequestHandler = async (req, res) => {
    await service.disconnect(userId(req));
    noContent(res);
  };

  const execute: RequestHandler = async (req, res) => {
    const body = validatedBody<ExecuteBody>(req);
    ok(res, await service.executeAnonymous(userId(req), body.code));
  };

  return { start, callback, status, disconnect, execute };
}
