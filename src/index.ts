
import { AsyncLocalStorage } from "async_hooks";
import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";
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
    rethrowSerializedError,
    scanResponseAndThrowErrors,
    SerializableError,
    serializeApiError,
    UnauthorizedError,
    type ErrorDeserializer,
    type SerializableErrorCtor,
    type SerializedApiError,
} from "./api-errors";

export {
    apiErrorFactory,
    BadRequestError,
    ConflictError,
    deserializeApiError,
    EndpointError,
    ForbiddenError,
    InternalServerError,
    isSerializedApiError,
    NotFoundError,
    rethrowSerializedError,
    scanResponseAndThrowErrors,
    SerializableError,
    serializeApiError,
    UnauthorizedError
};
export type { ErrorDeserializer, SerializableErrorCtor, SerializedApiError };

type RequestStore = {
    request: NextRequest;
    body?: unknown;
};

const requestStorage = new AsyncLocalStorage<RequestStore>();

export function getRequest(): NextRequest {
    const store = requestStorage.getStore();
    if (!store) {
        throw new Error("Request context not available. Use payload() or getRequest() only inside a route handler wrapped with withApiHandler.");
    }
    return store.request;
}

/**
 * Parse and validate the request body with a Zod schema.
 * Reads the body once and caches it for subsequent calls.
 * Throws BadRequestError if validation fails.
 */
export async function payload<T>(schema: ZodType<T>): Promise<T> {
    const store = requestStorage.getStore();
    if (!store) {
        throw new Error("Request context not available. Use payload() only inside a route handler wrapped with withApiHandler.");
    }
    if (store.body === undefined) {
        store.body = await store.request.json();
    }
    const result = schema.safeParse(store.body);
    if (!result.success) {
        throw new BadRequestError("Invalid input", result.error.issues);
    }
    return result.data;
}

export type RouteContext<Ctx extends Record<string, string> = {}> = { params?: Promise<Ctx> };
export type RouteHandler<Ctx extends Record<string, string> = {}> = (
    req: NextRequest,
    context?: RouteContext<Ctx>,
) => Promise<NextResponse>;

export function withApiHandler<Ctx extends Record<string, string> = {}>(handler: RouteHandler<Ctx>) {
    return async (
        req: NextRequest,
        context?: RouteContext<Ctx>
    ): Promise<Response> => {
        return requestStorage.run({ request: req }, async () => {
            try {
                return await handler(req, context);
            } catch (error) {
                if (error instanceof EndpointError) {
                    return NextResponse.json(serializeApiError(error), { status: error.status });
                }
                if (error instanceof SerializableError) {
                    const body = serializeApiError(error);
                    return NextResponse.json(body);
                }
                console.error("Unhandled API error:", error);
                return NextResponse.json({ error: "An error occurred" }, { status: 500 });
            }
        });
    };
}

export const buildApiHandler = () => (handler: RouteHandler) => withApiHandler(handler);
