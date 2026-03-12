import test from "ava";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  BadRequestError,
  deserializeApiError,
  ForbiddenError,
  getRequest,
  NotFoundError,
  payload,
  UnauthorizedError,
  withApiHandler,
} from "../src/index.js";

function jsonRequest(url: string, body: unknown, method = "POST"): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

test("withApiHandler: successful handler returns its response", async (t) => {
  const wrapped = withApiHandler(async () => NextResponse.json({ ok: true }));
  const req = new NextRequest("http://localhost/api/foo");
  const res = await wrapped(req);
  t.is(res.status, 200);
  const data = await res.json();
  t.deepEqual(data, { ok: true });
});

test("withApiHandler: handler that throws EndpointError returns serialized error and status", async (t) => {
  const wrapped = withApiHandler(async () => {
    throw new BadRequestError("Invalid input", [{ path: ["x"], message: "required" }]);
  });
  const req = new NextRequest("http://localhost/api/foo");
  const res = await wrapped(req);
  t.is(res.status, 400);
  const data = await res.json();
  t.is(data.name, "BadRequestError");
  t.is(data.message, "Invalid input");
  t.true(data.isSerializableError);
  t.deepEqual(data.details, [{ path: ["x"], message: "required" }]);
  const restored = deserializeApiError(data);
  t.assert(restored !== null);
  t.assert(restored instanceof BadRequestError);
});

test("withApiHandler: handler that throws NotFoundError returns 404 and serialized error", async (t) => {
  const wrapped = withApiHandler(async () => {
    throw new NotFoundError("User");
  });
  const req = new NextRequest("http://localhost/api/foo");
  const res = await wrapped(req);
  t.is(res.status, 404);
  const data = await res.json();
  t.is(data.name, "NotFoundError");
  t.is(data.message, "User not found");
  t.is((data.details as { resource: string })?.resource, "User");
  const restored = deserializeApiError(data) as NotFoundError;
  t.assert(restored !== null);
  t.assert(restored instanceof NotFoundError);
  t.is(restored!.resource, "User");
});

test("withApiHandler: handler that throws non-EndpointError returns 500 and generic message", async (t) => {
  const consoleError = console.error;
  let logged: unknown;
  console.error = (arg: unknown) => {
    logged = arg;
  };
  const wrapped = withApiHandler(async () => {
    throw new Error("Something broke");
  });
  const req = new NextRequest("http://localhost/api/foo");
  const res = await wrapped(req);
  console.error = consoleError;
  t.is(res.status, 500);
  const data = await res.json();
  t.deepEqual(data, { error: "An error occurred" });
  t.assert(logged !== undefined);
});

test("withApiHandler: getRequest() inside handler returns the same request", async (t) => {
  const req = new NextRequest("http://localhost/api/bar");
  const wrapped = withApiHandler(async () => {
    const r = getRequest();
    t.is(r, req);
    t.is(r.url, "http://localhost/api/bar");
    return NextResponse.json({ url: r.url });
  });
  const res = await wrapped(req);
  t.is(res.status, 200);
  const data = await res.json();
  t.is(data.url, "http://localhost/api/bar");
});

test("withApiHandler: payload() with valid body returns parsed data", async (t) => {
  const schema = z.object({ name: z.string(), count: z.number() });
  const req = jsonRequest("http://localhost/api/foo", { name: "alice", count: 42 });
  const wrapped = withApiHandler(async () => {
    const body = await payload(schema);
    t.is(body.name, "alice");
    t.is(body.count, 42);
    return NextResponse.json(body);
  });
  const res = await wrapped(req);
  t.is(res.status, 200);
  const data = await res.json();
  t.deepEqual(data, { name: "alice", count: 42 });
});

test("withApiHandler: payload() with invalid body throws BadRequestError and returns 400", async (t) => {
  const schema = z.object({ name: z.string(), count: z.number() });
  const req = jsonRequest("http://localhost/api/foo", { name: "alice" }); // missing count
  const wrapped = withApiHandler(async () => {
    await payload(schema);
    return NextResponse.json({});
  });
  const res = await wrapped(req);
  t.is(res.status, 400);
  const data = await res.json();
  t.is(data.name, "BadRequestError");
  t.is(data.message, "Invalid input");
  t.true(Array.isArray(data.details));
  const restored = deserializeApiError(data);
  t.assert(restored !== null);
  t.assert(restored instanceof BadRequestError);
});

test("withApiHandler: getRequest() outside handler throws", (t) => {
  t.throws(() => getRequest(), { message: /Request context not available/ });
});

test("withApiHandler: handler receives context with params (e.g. slug)", async (t) => {
  const context = { params: Promise.resolve({ slug: "my-post" }) };
  const req = new NextRequest("http://localhost/api/posts/my-post");
  const wrapped = withApiHandler<{ slug: string }>(async (_r, ctx) => {
    t.assert(ctx !== undefined);
    const params = await ctx!.params!;
    t.deepEqual(params, { slug: "my-post" });
    t.is(params.slug, "my-post");
    return NextResponse.json({ slug: params.slug });
  });
  const res = await wrapped(req, context);
  t.is(res.status, 200);
  const data = await res.json();
  t.deepEqual(data, { slug: "my-post" });
});

test("withApiHandler: handler with context can use slug and throw NotFoundError", async (t) => {
  const context = { params: Promise.resolve({ slug: "missing" }) };
  const req = new NextRequest("http://localhost/api/posts/missing");
  const wrapped = withApiHandler<{ slug: string }>(async (_r, ctx) => {
    const params = await ctx!.params!;
    if (params.slug === "missing") throw new NotFoundError("Post");
    return NextResponse.json({ slug: params.slug });
  });
  const res = await wrapped(req, context);
  t.is(res.status, 404);
  const data = await res.json();
  t.is(data.name, "NotFoundError");
  t.is(data.message, "Post not found");
  t.is((data.details as { resource: string })?.resource, "Post");
});

test("withApiHandler.filter: false blocks handler with ForbiddenError", async (t) => {
  const filtered = withApiHandler.filter(() => false);
  const wrapped = filtered(async () => NextResponse.json({ ok: true }));
  const req = new NextRequest("http://localhost/api/protected");
  const res = await wrapped(req);
  t.is(res.status, 403);
  const data = await res.json();
  t.is(data.name, "ForbiddenError");
  t.is(data.message, "Request blocked by API filter");
  const restored = deserializeApiError(data);
  t.assert(restored instanceof ForbiddenError);
});

test("withApiHandler.filter: filter can throw typed endpoint errors", async (t) => {
  const authenticated = withApiHandler.filter((req) => {
    if (!req.headers.get("authorization")) {
      throw new UnauthorizedError("Missing token");
    }
  });

  const wrapped = authenticated(async () => NextResponse.json({ ok: true }));
  const req = new NextRequest("http://localhost/api/protected");
  const res = await wrapped(req);
  t.is(res.status, 401);
  const data = await res.json();
  t.is(data.name, "UnauthorizedError");
  t.is(data.message, "Missing token");
  const restored = deserializeApiError(data);
  t.assert(restored instanceof UnauthorizedError);
});

test("withApiHandler.filter: response return short-circuits handler", async (t) => {
  const filtered = withApiHandler.filter(() =>
    NextResponse.json({ skipped: true }, { status: 202 })
  );

  let handlerCalled = false;
  const wrapped = filtered(async () => {
    handlerCalled = true;
    return NextResponse.json({ ok: true });
  });
  const req = new NextRequest("http://localhost/api/protected");
  const res = await wrapped(req);
  t.is(res.status, 202);
  t.false(handlerCalled);
  const data = await res.json();
  t.deepEqual(data, { skipped: true });
});

test("withApiHandler.filter: chained filters run in order", async (t) => {
  const order: string[] = [];
  const chained = withApiHandler
    .filter(() => {
      order.push("first");
      return true;
    })
    .filter(() => {
      order.push("second");
      return true;
    });

  const wrapped = chained(async () => {
    order.push("handler");
    return NextResponse.json({ ok: true });
  });
  const req = new NextRequest("http://localhost/api/protected");
  const res = await wrapped(req);
  t.is(res.status, 200);
  t.deepEqual(order, ["first", "second", "handler"]);
});
