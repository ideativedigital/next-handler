import test from "ava";
import {
  apiErrorFactory,
  BadRequestError,
  ConflictError,
  deserializeApiError,
  EndpointError,
  ForbiddenError,
  InternalServerError,
  isSerializedApiError,
  NotFoundError,
  scanResponseAndThrowErrors,
  serializeApiError,
  UnauthorizedError,
} from "../src/api-errors.js";

test("serialize then deserialize BadRequestError round-trips", (t) => {
  const err = new BadRequestError("Invalid input", { field: "email" });
  const data = serializeApiError(err);
  t.is(data.name, "BadRequestError");
  t.is(data.message, "Invalid input");
  t.is(data.status, 400);
  t.true(typeof data.uid === "string" && data.uid.length > 0);
  t.deepEqual(data.details, { field: "email" });
  t.true(data.isSerializableError);

  const restored = deserializeApiError(data) as BadRequestError;
  t.assert(restored !== null);
  t.assert(restored instanceof BadRequestError);
  t.is(restored!.message, "Invalid input");
  t.is(restored!.status, 400);
  t.is(restored!.uid, data.uid);
  t.deepEqual(restored!.details, { field: "email" });
});

test("serialize then deserialize UnauthorizedError round-trips", (t) => {
  const err = new UnauthorizedError("Please log in");
  const data = serializeApiError(err);
  t.is(data.name, "UnauthorizedError");
  t.is(data.message, "Please log in");
  t.is(data.status, 401);

  const restored = deserializeApiError(data) as UnauthorizedError;
  t.assert(restored !== null);
  t.assert(restored instanceof UnauthorizedError);
  t.is(restored!.message, "Please log in");
  t.is(restored!.status, 401);
});

test("serialize then deserialize ForbiddenError round-trips", (t) => {
  const err = new ForbiddenError("Access denied");
  const data = serializeApiError(err);
  t.is(data.name, "ForbiddenError");
  t.is(data.status, 403);

  const restored = deserializeApiError(data) as ForbiddenError;
  t.assert(restored !== null);
  t.assert(restored instanceof ForbiddenError);
  t.is(restored!.status, 403);
});

test("serialize then deserialize NotFoundError round-trips with resource", (t) => {
  const err = new NotFoundError("User");
  const data = serializeApiError(err);
  t.is(data.name, "NotFoundError");
  t.is(data.message, "User not found");
  t.is(data.status, 404);
  t.truthy(data.details && typeof data.details === "object" && "resource" in data.details);
  t.is((data.details as { resource: string }).resource, "User");

  const restored = deserializeApiError(data) as NotFoundError;
  t.assert(restored !== null);
  t.assert(restored instanceof NotFoundError);
  t.is(restored!.message, "User not found");
  t.is(restored!.resource, "User");
});

test("serialize then deserialize ConflictError round-trips", (t) => {
  const err = new ConflictError("Email already taken");
  const data = serializeApiError(err);
  t.is(data.name, "ConflictError");
  t.is(data.status, 409);

  const restored = deserializeApiError(data);
  t.assert(restored !== null);
  t.assert(restored instanceof ConflictError);
  t.is(restored!.message, "Email already taken");
});

test("serialize then deserialize InternalServerError round-trips", (t) => {
  const err = new InternalServerError("Database down");
  const data = serializeApiError(err);
  t.is(data.name, "InternalServerError");
  t.is(data.status, 500);

  const restored = deserializeApiError(data);
  t.assert(restored !== null);
  t.assert(restored instanceof InternalServerError);
  t.is(restored!.message, "Database down");
});

test("serialize then deserialize custom EndpointError subclass round-trips", (t) => {
  // EndpointError is abstract, so test with a concrete subclass
  class TeapotError extends EndpointError {
    static ErrorName() {
      return "TeapotError";
    }
    constructor(message: string, details?: unknown) {
      super(TeapotError.ErrorName(), 418, message, details);
    }
  }
  apiErrorFactory.register(TeapotError, (d) => new TeapotError(d.message, d.details));

  const err = new TeapotError("I'm a teapot", { hint: "use coffee" });
  const data = serializeApiError(err);
  t.is(data.name, "TeapotError");
  t.is(data.status, 418);
  t.deepEqual(data.details, { hint: "use coffee" });

  const restored = deserializeApiError(data) as TeapotError;
  t.assert(restored !== null);
  t.assert(restored instanceof TeapotError);
  t.is(restored!.status, 418);
  t.is(restored!.message, "I'm a teapot");
});

test("deserialize returns null for non-object", (t) => {
  t.is(deserializeApiError(null), null);
  t.is(deserializeApiError(42), null);
  t.is(deserializeApiError("string"), null);
});

test("deserialize returns null for object without name", (t) => {
  t.is(deserializeApiError({ message: "oops" }), null);
});

test("deserialize returns null for object without isSerializableError", (t) => {
  t.is(deserializeApiError({ name: "BadRequestError", message: "x" }), null);
});

test("deserialize returns null for unknown registered name", (t) => {
  const data = {
    name: "UnknownError",
    message: "nope",
    isSerializableError: true as const,
  };
  t.is(deserializeApiError(data), null);
});

test("isSerializedApiError validates canonical payload", (t) => {
  const data = serializeApiError(new BadRequestError("Bad", { field: "name" }));
  t.true(isSerializedApiError(data));
  t.false(isSerializedApiError({ name: "BadRequestError", message: "Bad", isSerializableError: true }));
  t.false(isSerializedApiError({}));
});

test("scanResponseAndThrowErrors throws for direct serialized error payload", async (t) => {
  const body = serializeApiError(new BadRequestError("Invalid payload"));
  const response = new Response(JSON.stringify(body), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
  await t.throwsAsync(async () => scanResponseAndThrowErrors(response), {
    instanceOf: BadRequestError,
    message: "Invalid payload",
  });
});

test("scanResponseAndThrowErrors throws for wrapped error payload", async (t) => {
  const body = { error: serializeApiError(new UnauthorizedError("No token")) };
  const response = new Response(JSON.stringify(body), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
  await t.throwsAsync(async () => scanResponseAndThrowErrors(response), {
    instanceOf: UnauthorizedError,
    message: "No token",
  });
});

test("scanResponseAndThrowErrors is no-op on ok response", async (t) => {
  const response = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  await t.notThrowsAsync(async () => scanResponseAndThrowErrors(response));
});
