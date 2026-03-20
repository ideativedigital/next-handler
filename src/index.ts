
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
    enhancedContext?: unknown;
    hasEnhancedContext: boolean;
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

export type CtxParamValue = string | string[] | undefined;
export type CtxParams = Record<string, CtxParamValue>;

export type RouteContext<Ctx extends CtxParams = {}> = { params?: Promise<Ctx> };
export type RouteHandler<Ctx extends CtxParams = {}> = (
    req: NextRequest,
    context?: RouteContext<Ctx>,
) => Promise<NextResponse>;

type FilterResult = boolean | void | Response | Promise<boolean | void | Response>;

export type RouteFilter<Ctx extends CtxParams = {}> = (
    req: NextRequest,
    context?: RouteContext<Ctx>,
) => FilterResult;

type MaybePromise<T> = T | Promise<T>;

export type EnhancedRouteContext<
    Ctx extends CtxParams = {},
    ExtraContext extends Record<string, unknown> = {}
> = RouteContext<Ctx> & ExtraContext;

export type EnhancedRouteHandler<
    ExtraContext extends Record<string, unknown>,
    Ctx extends CtxParams = {}
> = (
    req: NextRequest,
    context?: EnhancedRouteContext<Ctx, ExtraContext>,
) => Promise<NextResponse>;

export type EnhancedRouteFilter<
    ExtraContext extends Record<string, unknown>,
    Ctx extends CtxParams = {}
> = (
    req: NextRequest,
    context?: EnhancedRouteContext<Ctx, ExtraContext>,
) => FilterResult;

export type AsyncContextEnhancer<ExtraContext extends Record<string, unknown>> = (
    req: NextRequest,
    context?: RouteContext<CtxParams>,
) => MaybePromise<ExtraContext>;

export type EnhancedWithApiHandlerFn<ExtraContext extends Record<string, unknown>> = {
    <Ctx extends CtxParams = {}>(handler: EnhancedRouteHandler<ExtraContext, Ctx>): (
        req: NextRequest,
        context?: RouteContext<Ctx>
    ) => Promise<Response>;
    filter(filter: EnhancedRouteFilter<ExtraContext>): EnhancedWithApiHandlerFn<ExtraContext>;
    context(): ExtraContext;
};

export type WithApiHandlerFn = {
    <Ctx extends CtxParams = {}>(handler: RouteHandler<Ctx>): (
        req: NextRequest,
        context?: RouteContext<Ctx>
    ) => Promise<Response>;
    filter(filter: RouteFilter): WithApiHandlerFn;
    enhance<ExtraContext extends Record<string, unknown>>(
        enhancer: AsyncContextEnhancer<ExtraContext>
    ): EnhancedWithApiHandlerFn<ExtraContext>;
};

const serializeHandlerError = (error: unknown): NextResponse => {
    if (error instanceof EndpointError) {
        return NextResponse.json(serializeApiError(error), { status: error.status });
    }
    if (error instanceof SerializableError) {
        const body = serializeApiError(error);
        return NextResponse.json(body);
    }
    console.error("Unhandled API error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
};

const createEnhancedWithApiHandler = <ExtraContext extends Record<string, unknown>>(
    enhancer: AsyncContextEnhancer<ExtraContext>,
    filters: EnhancedRouteFilter<ExtraContext>[] = [],
): EnhancedWithApiHandlerFn<ExtraContext> => {
    const wrap = <Ctx extends CtxParams = {}>(handler: EnhancedRouteHandler<ExtraContext, Ctx>) => {
        return async (
            req: NextRequest,
            context?: RouteContext<Ctx>
        ): Promise<Response> => {
            return requestStorage.run({ request: req, hasEnhancedContext: false }, async () => {
                try {
                    const enhancedContext = await enhancer(
                        req,
                        context as RouteContext<CtxParams> | undefined
                    );
                    const store = requestStorage.getStore();
                    if (store) {
                        store.enhancedContext = enhancedContext;
                        store.hasEnhancedContext = true;
                    }
                    const enhancedRouteContext = {
                        ...(enhancedContext ?? {}),
                        ...(context ?? {}),
                    } as EnhancedRouteContext<Ctx, ExtraContext>;

                    for (const filter of filters) {
                        const result = await filter(req, enhancedRouteContext);
                        if (result instanceof Response) return result;
                        if (result === false) throw new ForbiddenError("Request blocked by API filter");
                    }
                    return await handler(req, enhancedRouteContext);
                } catch (error) {
                    return serializeHandlerError(error);
                }
            });
        };
    };

    wrap.filter = (filter: EnhancedRouteFilter<ExtraContext>): EnhancedWithApiHandlerFn<ExtraContext> =>
        createEnhancedWithApiHandler(enhancer, [...filters, filter]);
    wrap.context = (): ExtraContext => {
        const store = requestStorage.getStore();
        if (!store || !store.hasEnhancedContext) {
            throw new Error(
                "Enhanced async context not available. Use context() only inside a route handler wrapped with withApiHandler.enhance(...)."
            );
        }
        return store.enhancedContext as ExtraContext;
    };

    return wrap;
};

const createWithApiHandler = (filters: RouteFilter[] = []): WithApiHandlerFn => {
    const wrap = <Ctx extends CtxParams = {}>(handler: RouteHandler<Ctx>) => {
        return async (
            req: NextRequest,
            context?: RouteContext<Ctx>
        ): Promise<Response> => {
            return requestStorage.run({ request: req, hasEnhancedContext: false }, async () => {
                try {
                    for (const filter of filters) {
                        const result = await filter(req, context);
                        if (result instanceof Response) return result;
                        if (result === false) throw new ForbiddenError("Request blocked by API filter");
                    }
                    return await handler(req, context);
                } catch (error) {
                    return serializeHandlerError(error);
                }
            });
        };
    };

    wrap.filter = (filter: RouteFilter): WithApiHandlerFn =>
        createWithApiHandler([...filters, filter]);

    wrap.enhance = <ExtraContext extends Record<string, unknown>>(
        enhancer: AsyncContextEnhancer<ExtraContext>
    ): EnhancedWithApiHandlerFn<ExtraContext> =>
        createEnhancedWithApiHandler(enhancer, filters);

    return wrap;
};

export const withApiHandler: WithApiHandlerFn = createWithApiHandler();

export const buildApiHandler = () => (handler: RouteHandler) => withApiHandler(handler);
