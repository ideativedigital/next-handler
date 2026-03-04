import {
    apiErrorFactory,
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError,
    SerializableError
} from "../api-errors";
import { GlobalTranslationKey } from "./types";

export interface TranslatedError {
    translationKey: GlobalTranslationKey
    params?: Record<string, unknown>
}

export const isTranslatedError = (error: unknown): error is TranslatedError => {
    return error instanceof SerializableError && "translationKey" in error;
}

export const generateTranslatedErrors = ({ notFound, badRequest, forbidden, internalServer }: {
    notFound: GlobalTranslationKey,
    badRequest: GlobalTranslationKey,
    forbidden: GlobalTranslationKey,
    internalServer: GlobalTranslationKey,
}) => {
    return {
        notFound: (resource: string, params?: Record<string, unknown>) => new NotFoundTranslatedError(resource, notFound, params),
        badRequest: (details?: unknown, params?: Record<string, unknown>) => new BadRequestTranslatedError(badRequest, details, params),
        forbidden: (params?: Record<string, unknown>) => new ForbiddenTranslatedError(forbidden, params),
        internalServer: (params?: Record<string, unknown>) => new InternalServerTranslatedError(internalServer, params),
    }
}

export class NotFoundTranslatedError extends NotFoundError implements TranslatedError {
    constructor(readonly resource: string, readonly translationKey: GlobalTranslationKey, readonly params?: Record<string, unknown>) {
        super(resource);
        this.name = NotFoundTranslatedError.ErrorName();
    }

    static ErrorName(): string {
        return "NotFoundTranslatedError";
    }
}


export class BadRequestTranslatedError extends BadRequestError implements TranslatedError {
    constructor(readonly translationKey: GlobalTranslationKey, readonly details?: unknown, readonly params?: Record<string, unknown>) {
        super('Bad request', details);
        this.name = BadRequestTranslatedError.ErrorName();
    }

    static ErrorName(): string {
        return "BadRequestTranslatedError";
    }
}


export class ForbiddenTranslatedError extends ForbiddenError implements TranslatedError {
    constructor(readonly translationKey: GlobalTranslationKey, readonly params?: Record<string, unknown>) {
        super();
        this.name = ForbiddenTranslatedError.ErrorName();
    }

    static ErrorName(): string {
        return "ForbiddenTranslatedError";
    }
}


export class InternalServerTranslatedError extends InternalServerError implements TranslatedError {
    constructor(readonly translationKey: GlobalTranslationKey, readonly params?: Record<string, unknown>) {
        super('An error occurred');
        this.name = InternalServerTranslatedError.ErrorName();
    }

    static ErrorName(): string {
        return "InternalServerTranslatedError";
    }
}

apiErrorFactory.register(NotFoundTranslatedError, (d) => {
    const resource = typeof d.resource === "string"
        ? d.resource
        : typeof d.details === "object" && d.details !== null && "resource" in d.details
            ? String((d.details as { resource: unknown }).resource)
            : d.message.replace(/\s+not found$/, "");
    return new NotFoundTranslatedError(
        resource,
        String(d.translationKey) as GlobalTranslationKey,
        d.params as Record<string, unknown> | undefined
    );
});
apiErrorFactory.register(BadRequestTranslatedError, (d) => new BadRequestTranslatedError(
    String(d.translationKey) as GlobalTranslationKey,
    d.details,
    d.params as Record<string, unknown> | undefined
));
apiErrorFactory.register(ForbiddenTranslatedError, (d) => new ForbiddenTranslatedError(
    String(d.translationKey) as GlobalTranslationKey,
    d.params as Record<string, unknown> | undefined
));
apiErrorFactory.register(InternalServerTranslatedError, (d) => new InternalServerTranslatedError(
    String(d.translationKey) as GlobalTranslationKey,
    d.params as Record<string, unknown> | undefined
));


