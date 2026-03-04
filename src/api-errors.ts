/**
 * Plain-object shape for API errors. Safe to JSON.stringify on the backend
 * and parse on the frontend, then pass to deserializeApiError().
 */
export type SerializedApiError = {
  name: string;
  uid: string;
  message: string;
  status?: number;
  details?: unknown;
  isSerializableError: true;
  [key: string]: unknown;
};

export type ErrorDeserializer<TError extends SerializableError = SerializableError> = (
  data: SerializedApiError
) => TError;

/** Ctor that can be registered: has a static ErrorName(). */
export type SerializableErrorCtor<TError extends SerializableError = SerializableError> = {
  ErrorName(): string;
  new (...args: never[]): TError;
};

const RESERVED_FIELDS = new Set(["name", "uid", "message", "status", "details", "isSerializableError"]);

export function isSerializedApiError(data: unknown): data is SerializedApiError {
  if (typeof data !== "object" || data === null) return false;
  if ((data as Record<string, unknown>).isSerializableError !== true) return false;
  if (typeof (data as Record<string, unknown>).name !== "string") return false;
  if (typeof (data as Record<string, unknown>).message !== "string") return false;
  if (typeof (data as Record<string, unknown>).uid !== "string") return false;
  return true;
}

/**
 * Registry for API error types. Register custom error classes so they
 * serialize/deserialize correctly across backend and frontend.
 */
export const apiErrorFactory = {
  _registry: new Map<string, ErrorDeserializer>(),

  /**
   * Register an error type by its constructor. The deserializer receives
   * the parsed JSON and returns an instance of that error.
   */
  register<TError extends SerializableError>(
    ctor: SerializableErrorCtor<TError>,
    deserialize: ErrorDeserializer<TError>
  ): void {
    this._registry.set(ctor.ErrorName(), deserialize);
  },


  serialize(error: SerializableError): SerializedApiError {
    const ctor = error.constructor as unknown as SerializableErrorCtor;
    const name = ctor.ErrorName();
    const payload: SerializedApiError = {
      name,
      message: error.message,
      uid: error.uid,
      isSerializableError: true,
    };
    if (error instanceof EndpointError) payload.status = error.status;
    if (error.details !== undefined) payload.details = error.details;
    if (name === "NotFoundError" && "resource" in error && error.resource !== undefined)
      payload.details = { ...((payload.details as object) || {}), resource: error.resource };
    Object.entries(error).forEach(([key, value]) => {
      if (!RESERVED_FIELDS.has(key)) {
        payload[key] = value;
      }
    });
    return payload;
  },

  deserialize(data: unknown): SerializableError | null {
    if (!isSerializedApiError(data)) return null;
    const errorSerialized = data;
    const name = errorSerialized.name;
    const fn = this._registry.get(name);
    if (!fn) {
      return null;
    }
    const error = fn(errorSerialized);
    error.uid = errorSerialized.uid;
    Object.entries(errorSerialized).forEach(([key, value]) => {
      if (!RESERVED_FIELDS.has(key)) {
        (error as unknown as Record<string, unknown>)[key] = value;
      }
    });
    return error;
  },
};

export abstract class SerializableError extends Error {
  public uid: string;
  static ErrorName(): string {
    throw new Error("Not implemented");
  }
  constructor(
    name: string,
    message: string,
    public readonly details?: unknown,
    uid = crypto.randomUUID()
  ) {
    super(message);

    this.name = name;
    this.uid = uid;
  }
}

/**
 * Base HTTP error class for API routes.
 * Throw these in route handlers; withApiHandler will convert them to JSON responses.
 */
export abstract class EndpointError extends SerializableError {
  static ErrorName(): string {
    return "EndpointError";
  }
  constructor(
    name: string,
    public readonly status: number,
    message: string,
    details?: unknown
  ) {
    super(name, message, details);
  }
}

export class BadRequestError extends EndpointError {
  static ErrorName(): string {
    return "BadRequestError";
  }
  constructor(message: string, details?: unknown) {
    super(BadRequestError.ErrorName(), 400, message, details);
    this.name = BadRequestError.ErrorName();
  }
}

export class UnauthorizedError extends EndpointError {
  static ErrorName(): string {
    return "UnauthorizedError";
  }
  constructor(message = "Unauthorized") {
    super(UnauthorizedError.ErrorName(), 401, message);
  }
}

export class ForbiddenError extends EndpointError {
  static ErrorName(): string {
    return "ForbiddenError";
  }
  constructor(message = "Forbidden") {
    super(ForbiddenError.ErrorName(), 403, message);
  }
}

export class NotFoundError extends EndpointError {
  static ErrorName(): string {
    return "NotFoundError";
  }

  constructor(readonly resource: string) {
    super(NotFoundError.ErrorName(), 404, `${resource} not found`);

  }
}

export class ConflictError extends EndpointError {
  static ErrorName(): string {
    return "ConflictError";
  }
  constructor(message: string) {
    super(ConflictError.ErrorName(), 409, message);
  }
}

export class InternalServerError extends EndpointError {
  static ErrorName(): string {
    return "InternalServerError";
  }
  constructor(message = "An error occurred") {
    super(InternalServerError.ErrorName(), 500, message);
  }
}

// Register built-in error types
apiErrorFactory.register(BadRequestError, (d) => new BadRequestError(d.message, d.details));
apiErrorFactory.register(UnauthorizedError, (d) => new UnauthorizedError(d.message));
apiErrorFactory.register(ForbiddenError, (d) => new ForbiddenError(d.message));
apiErrorFactory.register(NotFoundError, (d) => {
  const resource =
    typeof d.resource === "string"
      ? d.resource
      :
    d.details && typeof d.details === "object" && "resource" in d.details
      ? String((d.details as { resource: unknown }).resource)
      : d.message.replace(/\s+not found$/, "");
  return new NotFoundError(resource);
});
apiErrorFactory.register(ConflictError, (d) => new ConflictError(d.message));
apiErrorFactory.register(InternalServerError, (d) => new InternalServerError(d.message));

/**
 * Serialize an error to a plain object for JSON response.
 * Use this in the backend before sending the response.
 */
export function serializeApiError(error: SerializableError): SerializedApiError {
  return apiErrorFactory.serialize(error);
}

/**
 * Deserialize a plain object (e.g. from a JSON response) into an error instance.
 * Use this on the frontend after parsing the API error response.
 */
export function deserializeApiError(data: unknown): SerializableError | null {
  return apiErrorFactory.deserialize(data);
}

/**
 * Rethrow a serialized error.
 * Use this on the frontend after parsing the API error response.
 */
export function rethrowSerializedError(data: unknown): void {
  const error = deserializeApiError(data);
  if (error) {
    throw error;
  }
}

/**
 * Scan a response for errors and throw them if found.
 * @param response - The response to scan for errors
 */
export const scanResponseAndThrowErrors = async (response: Response): Promise<void> => {
  if (response.ok) return;

  let data: unknown;
  try {
    // Clone to avoid consuming the original body stream.
    data = await response.clone().json();
  } catch {
    return;
  }
  const candidate =
    typeof data === "object" && data !== null && "error" in data
      ? (data as { error: unknown }).error
      : data;
  rethrowSerializedError(candidate);
};
