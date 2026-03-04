# @ideative/next-handler

[![Docs](https://img.shields.io/badge/docs-github%20pages-0a66c2)](https://ideativedigital.github.io/next-handler/)
[![Coverage Statements](https://img.shields.io/badge/statements-94.81%25-brightgreen)](#coverage)
[![Coverage Branches](https://img.shields.io/badge/branches-90.51%25-brightgreen)](#coverage)
[![Coverage Functions](https://img.shields.io/badge/functions-96.05%25-brightgreen)](#coverage)
[![Coverage Lines](https://img.shields.io/badge/lines-94.81%25-brightgreen)](#coverage)

Typed helpers for Next.js route handlers with:

- request context access (`getRequest()`),
- Zod payload validation (`payload()`),
- serializable errors that round-trip from backend to frontend.

## Install

```bash
pnpm add @ideative/next-handler
```

Peer dependencies:

- `next` >= 15
- `zod` >= 4.3.6
- `react` >= 19.2.4 (for intl context utilities)
- `next-intl` >= 4.8.2 (for intl utilities)

## Backend usage

### Wrap handlers

```ts
import { NextResponse } from "next/server";
import { withApiHandler, payload, getRequest } from "@ideative/next-handler";
import { z } from "zod";

const schema = z.object({ name: z.string(), email: z.string().email() });

export const POST = withApiHandler(async () => {
  const body = await payload(schema);
  const req = getRequest();
  return NextResponse.json({ from: req.url, ...body });
});
```

### Throw typed API errors

```ts
import {
  withApiHandler,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "@ideative/next-handler";

export const GET = withApiHandler(async (req) => {
  if (!req.headers.get("authorization"))
    throw new UnauthorizedError("Missing token");
  throw new NotFoundError("User");
});
```

Built-ins:

- `BadRequestError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `NotFoundError` (404)
- `ConflictError` (409)
- `InternalServerError` (500)

## Wire format contract

Known API errors are returned as a serialized object:

```ts
type SerializedApiError = {
  name: string;
  uid: string;
  message: string;
  status?: number;
  details?: unknown;
  isSerializableError: true;
  [key: string]: unknown;
};
```

Unhandled non-library errors return:

```json
{ "error": "An error occurred" }
```

## Frontend integration with ky (`afterResponse`)

```ts
import ky from "ky";
import {
  scanResponseAndThrowErrors,
  BadRequestError,
  NotFoundError,
} from "@ideative/next-handler";

const api = ky.create({
  prefixUrl: "/api",
  hooks: {
    afterResponse: [
      async (_req, _opts, response) => {
        await scanResponseAndThrowErrors(response);
        if (!response.ok) throw new Error(response.statusText);
        return response;
      },
    ],
  },
});

try {
  await api.get("users/123").json();
} catch (e) {
  if (e instanceof NotFoundError) console.log(e.resource);
  if (e instanceof BadRequestError) console.log(e.details);
}
```

If you already have a `Response`, you can also call:

```ts
import { scanResponseAndThrowErrors } from "@ideative/next-handler";

await scanResponseAndThrowErrors(response);
```

## Frontend integration with axios (response interceptor)

```ts
import axios from "axios";
import { deserializeApiError } from "@ideative/next-handler";

const api = axios.create({ baseURL: "/api" });

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!axios.isAxiosError(err) || !err.response) return Promise.reject(err);
    const data = err.response.data;
    const candidate =
      typeof data === "object" && data !== null && "error" in data
        ? (data as { error: unknown }).error
        : data;
    const apiError = deserializeApiError(candidate);
    return Promise.reject(apiError ?? err);
  }
);
```

## Custom error types

`EndpointError` is abstract and expects `(name, status, message, details?)`.

```ts
import {
  apiErrorFactory,
  EndpointError,
  type ErrorDeserializer,
} from "@ideative/next-handler";

class PaymentRequiredError extends EndpointError {
  static ErrorName() {
    return "PaymentRequiredError";
  }
  constructor(message = "Payment required") {
    super(PaymentRequiredError.ErrorName(), 402, message);
  }
}

const deserialize: ErrorDeserializer<PaymentRequiredError> = (d) =>
  new PaymentRequiredError(d.message);

apiErrorFactory.register(PaymentRequiredError, deserialize);
```

Register custom errors in both server and client runtime initialization so deserialization works everywhere.

## Intl exports

Import intl helpers from:

- `@ideative/next-handler/intl`
- `@ideative/next-handler/intl/intl-context`

## API summary

| Export                                        | Description                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `withApiHandler(handler)`                     | Wraps route handlers and converts thrown `EndpointError` values to JSON responses.    |
| `payload(schema)`                             | Reads and validates request JSON with Zod, throws `BadRequestError` on invalid input. |
| `getRequest()`                                | Gets current `NextRequest` from AsyncLocalStorage context.                            |
| `serializeApiError(error)`                    | Converts `SerializableError` to transport-safe payload.                               |
| `deserializeApiError(data)`                   | Converts payload back to typed error, or `null` if payload is not recognized.         |
| `isSerializedApiError(data)`                  | Runtime type-guard for serialized payload shape.                                      |
| `scanResponseAndThrowErrors(response)`        | Scans non-OK responses and rethrows serialized API errors if present.                 |
| `apiErrorFactory.register(ctor, deserialize)` | Register custom error classes for round-trip behavior.                                |

## Coverage

- Latest measured coverage: statements `94.81%`, branches `90.51%`, functions `96.05%`, lines `94.81%`.
- Generate coverage locally with:

```bash
pnpm dlx c8 --reporter=text-summary --reporter=text ava --node-arguments='--import=tsx'
```

- Live docs: https://acominotto.github.io/next-handler/
- Repository: https://github.com/acominotto/next-handler

## v0.1.0 release checklist

- `pnpm run build` emits all exported entry points.
- `pnpm test` passes.
- Coverage is checked (`c8`) and badges are up to date.
- README examples match current runtime contracts.
- `package.json` exports resolve to emitted `dist/` files.
