import test from "ava";
import {
  BadRequestError,
  deserializeApiError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  SerializableError,
  serializeApiError,
} from "../src/api-errors.js";
import {
  BadRequestTranslatedError,
  ForbiddenTranslatedError,
  generateTranslatedErrors,
  InternalServerTranslatedError,
  isTranslatedError,
  NotFoundTranslatedError,
} from "../src/intl/translated-errors.js";

// Use strings as translation keys for testing (GlobalTranslationKey is string-based)
const KEYS = {
  notFound: "errors.notFound" as any,
  badRequest: "errors.badRequest" as any,
  forbidden: "errors.forbidden" as any,
  internalServer: "errors.internalServer" as any,
};

// --- NotFoundTranslatedError ---

test("NotFoundTranslatedError: extends NotFoundError and has correct properties", (t) => {
  const err = new NotFoundTranslatedError("User", KEYS.notFound, { id: 123 });
  t.assert(err instanceof NotFoundTranslatedError);
  t.assert(err instanceof NotFoundError);
  t.assert(err instanceof SerializableError);
  t.assert(err instanceof Error);
  t.is(err.resource, "User");
  t.is(err.message, "User not found");
  t.is(err.status, 404);
  t.is(err.translationKey, KEYS.notFound);
  t.deepEqual(err.params, { id: 123 });
  t.is(err.name, "NotFoundTranslatedError");
  t.is(NotFoundTranslatedError.ErrorName(), "NotFoundTranslatedError");
});

test("NotFoundTranslatedError: works without params", (t) => {
  const err = new NotFoundTranslatedError("Post", KEYS.notFound);
  t.is(err.resource, "Post");
  t.is(err.translationKey, KEYS.notFound);
  t.is(err.params, undefined);
});

// --- BadRequestTranslatedError ---

test("BadRequestTranslatedError: extends BadRequestError and has correct properties", (t) => {
  const details = [{ path: ["email"], message: "invalid" }];
  const err = new BadRequestTranslatedError(KEYS.badRequest, details, { field: "email" });
  t.assert(err instanceof BadRequestTranslatedError);
  t.assert(err instanceof BadRequestError);
  t.assert(err instanceof SerializableError);
  t.is(err.message, "Bad request");
  t.is(err.status, 400);
  t.is(err.translationKey, KEYS.badRequest);
  t.deepEqual(err.details, details);
  t.deepEqual(err.params, { field: "email" });
  t.is(err.name, "BadRequestTranslatedError");
  t.is(BadRequestTranslatedError.ErrorName(), "BadRequestTranslatedError");
});

test("BadRequestTranslatedError: works without details and params", (t) => {
  const err = new BadRequestTranslatedError(KEYS.badRequest);
  t.is(err.translationKey, KEYS.badRequest);
  t.is(err.details, undefined);
  t.is(err.params, undefined);
});

// --- ForbiddenTranslatedError ---

test("ForbiddenTranslatedError: extends ForbiddenError and has correct properties", (t) => {
  const err = new ForbiddenTranslatedError(KEYS.forbidden, { role: "admin" });
  t.assert(err instanceof ForbiddenTranslatedError);
  t.assert(err instanceof ForbiddenError);
  t.assert(err instanceof SerializableError);
  t.is(err.message, "Forbidden");
  t.is(err.status, 403);
  t.is(err.translationKey, KEYS.forbidden);
  t.deepEqual(err.params, { role: "admin" });
  t.is(err.name, "ForbiddenTranslatedError");
  t.is(ForbiddenTranslatedError.ErrorName(), "ForbiddenTranslatedError");
});

test("ForbiddenTranslatedError: works without params", (t) => {
  const err = new ForbiddenTranslatedError(KEYS.forbidden);
  t.is(err.translationKey, KEYS.forbidden);
  t.is(err.params, undefined);
});

// --- InternalServerTranslatedError ---

test("InternalServerTranslatedError: extends InternalServerError and has correct properties", (t) => {
  const err = new InternalServerTranslatedError(KEYS.internalServer, { code: "DB_FAIL" });
  t.assert(err instanceof InternalServerTranslatedError);
  t.assert(err instanceof InternalServerError);
  t.assert(err instanceof SerializableError);
  t.is(err.message, "An error occurred");
  t.is(err.status, 500);
  t.is(err.translationKey, KEYS.internalServer);
  t.deepEqual(err.params, { code: "DB_FAIL" });
  t.is(err.name, "InternalServerTranslatedError");
  t.is(InternalServerTranslatedError.ErrorName(), "InternalServerTranslatedError");
});

test("InternalServerTranslatedError: works without params", (t) => {
  const err = new InternalServerTranslatedError(KEYS.internalServer);
  t.is(err.translationKey, KEYS.internalServer);
  t.is(err.params, undefined);
});

// --- isTranslatedError ---

test("isTranslatedError: returns true for translated errors", (t) => {
  t.true(isTranslatedError(new NotFoundTranslatedError("X", KEYS.notFound)));
  t.true(isTranslatedError(new BadRequestTranslatedError(KEYS.badRequest)));
  t.true(isTranslatedError(new ForbiddenTranslatedError(KEYS.forbidden)));
  t.true(isTranslatedError(new InternalServerTranslatedError(KEYS.internalServer)));
});

test("isTranslatedError: returns false for base errors without translationKey", (t) => {
  t.false(isTranslatedError(new NotFoundError("X")));
  t.false(isTranslatedError(new BadRequestError("x")));
  t.false(isTranslatedError(new ForbiddenError()));
  t.false(isTranslatedError(new InternalServerError()));
});

test("isTranslatedError: returns false for non-errors", (t) => {
  t.false(isTranslatedError(null));
  t.false(isTranslatedError(undefined));
  t.false(isTranslatedError("string"));
  t.false(isTranslatedError({ translationKey: "key" }));
  t.false(isTranslatedError(new Error("plain error")));
});

// --- generateTranslatedErrors ---

test("generateTranslatedErrors: returns factory functions for all error types", (t) => {
  const errors = generateTranslatedErrors({
    notFound: KEYS.notFound,
    badRequest: KEYS.badRequest,
    forbidden: KEYS.forbidden,
    internalServer: KEYS.internalServer,
  });

  t.is(typeof errors.notFound, "function");
  t.is(typeof errors.badRequest, "function");
  t.is(typeof errors.forbidden, "function");
  t.is(typeof errors.internalServer, "function");
});

test("generateTranslatedErrors: notFound factory creates NotFoundTranslatedError", (t) => {
  const errors = generateTranslatedErrors({
    notFound: KEYS.notFound,
    badRequest: KEYS.badRequest,
    forbidden: KEYS.forbidden,
    internalServer: KEYS.internalServer,
  });

  const err = errors.notFound("User", { id: 42 });
  t.assert(err instanceof NotFoundTranslatedError);
  t.is(err.resource, "User");
  t.is(err.translationKey, KEYS.notFound);
  t.deepEqual(err.params, { id: 42 });
});

test("generateTranslatedErrors: badRequest factory creates BadRequestTranslatedError", (t) => {
  const errors = generateTranslatedErrors({
    notFound: KEYS.notFound,
    badRequest: KEYS.badRequest,
    forbidden: KEYS.forbidden,
    internalServer: KEYS.internalServer,
  });

  const details = { field: "email" };
  const err = errors.badRequest(details, { extra: "info" });
  t.assert(err instanceof BadRequestTranslatedError);
  t.is(err.translationKey, KEYS.badRequest);
  t.deepEqual(err.details, details);
  t.deepEqual(err.params, { extra: "info" });
});

test("generateTranslatedErrors: forbidden factory creates ForbiddenTranslatedError", (t) => {
  const errors = generateTranslatedErrors({
    notFound: KEYS.notFound,
    badRequest: KEYS.badRequest,
    forbidden: KEYS.forbidden,
    internalServer: KEYS.internalServer,
  });

  const err = errors.forbidden({ reason: "no access" });
  t.assert(err instanceof ForbiddenTranslatedError);
  t.is(err.translationKey, KEYS.forbidden);
  t.deepEqual(err.params, { reason: "no access" });
});

test("generateTranslatedErrors: internalServer factory creates InternalServerTranslatedError", (t) => {
  const errors = generateTranslatedErrors({
    notFound: KEYS.notFound,
    badRequest: KEYS.badRequest,
    forbidden: KEYS.forbidden,
    internalServer: KEYS.internalServer,
  });

  const err = errors.internalServer({ trace: "abc123" });
  t.assert(err instanceof InternalServerTranslatedError);
  t.is(err.translationKey, KEYS.internalServer);
  t.deepEqual(err.params, { trace: "abc123" });
});

test("generateTranslatedErrors: factories work without optional params", (t) => {
  const errors = generateTranslatedErrors({
    notFound: KEYS.notFound,
    badRequest: KEYS.badRequest,
    forbidden: KEYS.forbidden,
    internalServer: KEYS.internalServer,
  });

  const notFound = errors.notFound("Item");
  t.is(notFound.params, undefined);

  const badRequest = errors.badRequest();
  t.is(badRequest.details, undefined);
  t.is(badRequest.params, undefined);

  const forbidden = errors.forbidden();
  t.is(forbidden.params, undefined);

  const internalServer = errors.internalServer();
  t.is(internalServer.params, undefined);
});

test("translated errors serialize and deserialize back to translated classes", (t) => {
  const original = new NotFoundTranslatedError("User", KEYS.notFound, { locale: "en" });
  const payload = serializeApiError(original);
  const restored = deserializeApiError(payload) as NotFoundTranslatedError;
  t.assert(restored instanceof NotFoundTranslatedError);
  t.is(restored.resource, "User");
  t.is(restored.translationKey, KEYS.notFound);
  t.deepEqual(restored.params, { locale: "en" });
});

test("generated translated badRequest round-trips through factory registry", (t) => {
  const errors = generateTranslatedErrors({
    notFound: KEYS.notFound,
    badRequest: KEYS.badRequest,
    forbidden: KEYS.forbidden,
    internalServer: KEYS.internalServer,
  });
  const payload = serializeApiError(errors.badRequest({ field: "email" }, { locale: "fr" }));
  const restored = deserializeApiError(payload) as BadRequestTranslatedError;
  t.assert(restored instanceof BadRequestTranslatedError);
  t.is(restored.translationKey, KEYS.badRequest);
  t.deepEqual(restored.details, { field: "email" });
  t.deepEqual(restored.params, { locale: "fr" });
});
