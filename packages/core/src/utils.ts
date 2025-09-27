import type { StandardSchemaV1 } from "@standard-schema/spec";
import type {
  Envelope,
  LoggerLike,
  Middleware,
  RuntimeOptions,
} from "./types.ts";

/**
 * Generates a random identifier using the host crypto implementation.
 * @returns {string} RFC 4122 v4 identifier string.
 */
export function defaultGenerateId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Reads the current Unix timestamp in milliseconds.
 * @returns {number} Milliseconds since the Unix epoch.
 */
export function nowMs(): number {
  return Date.now();
}

/**
 * Builds a minimal envelope with a timestamp for the provided message kind.
 * @param {Envelope["kind"]} kind Kind of envelope being emitted.
 * @param {number} version Protocol version to tag on the envelope.
 * @returns {Envelope} Envelope populated with version, timestamp, and kind.
 */
export function makeBaseEnvelope(
  kind: Envelope["kind"],
  version: number,
): Envelope {
  return { v: version, ts: nowMs(), kind };
}

/**
 * Runs middleware hooks sequentially, allowing them to mutate the envelope.
 * @param {Middleware[] | undefined} middlewares Middlewares to execute.
 * @param {Envelope} env Envelope passed through the middleware chain.
 * @param {"out" | "in"} direction Direction the envelope is traveling.
 * @returns {Promise<void>} Resolves once all middleware hooks complete.
 */
export async function runMiddlewares(
  middlewares: Middleware[] | undefined,
  env: Envelope,
  direction: "out" | "in",
): Promise<void> {
  if (!middlewares?.length) return;
  for (const mw of middlewares) {
    const ctx = {
      direction,
      envelope: env,
      mutate(fn: (e: Envelope) => void) {
        fn(env);
      },
    };
    await mw(ctx);
  }
}

/**
 * Parses JSON input when a string is provided, falling back to the original value.
 * @param {unknown} raw Input value that may contain JSON content.
 * @returns {unknown} Parsed JSON value, the original non-string input, or `undefined` when parsing fails.
 */
export function parseJson(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }
  return raw;
}

/**
 * Creates a logger implementation, returning the custom logger when provided.
 * @param {RuntimeOptions["logger"]} [custom] Logger supplied via runtime options.
 * @returns {RuntimeOptions["logger"]} Logger implementation with standard methods; never `undefined` on return.
 */
export function createLogger(custom?: RuntimeOptions["logger"]): LoggerLike {
  if (custom) return custom;
  return {
    debug: (..._a: unknown[]) => {},
    info: (...a: unknown[]) => console.log("[info]", ...a),
    warn: (...a: unknown[]) => console.warn("[warn]", ...a),
    error: (...a: unknown[]) => console.error("[error]", ...a),
  };
}

/**
 * Error thrown when a Standard Schema validator reports issues.
 */
export class StandardSchemaValidationError extends Error {
  /** Validation issues reported by the schema. */
  public readonly issues: ReadonlyArray<StandardSchemaV1.Issue>;
  /** Vendor string advertised by the schema implementation. */
  public readonly vendor: string;

  constructor(params: {
    /** Vendor string exposed by the Standard Schema implementation. */
    vendor: string;
    /** Issues returned from the Standard Schema validate function. */
    issues: ReadonlyArray<StandardSchemaV1.Issue>;
  }) {
    const summary = formatStandardSchemaIssues(params.issues);
    super(
      params.issues.length
        ? `Standard schema validation failed (${params.vendor}): ${summary}`
        : `Standard schema validation failed (${params.vendor}).`,
    );
    this.name = "StandardSchemaValidationError";
    this.vendor = params.vendor;
    this.issues = params.issues;
  }
}

/**
 * Validates an input value using a Standard Schema compliant validator.
 * @param {StandardSchemaV1<unknown, Output>} schema Schema providing the `~standard` contract.
 * @param {unknown} value Input value passed to the schema.
 * @returns {Promise<Output>} Resolves with the schema output value or throws on validation errors.
 */
export async function validateWithStandardSchema<
  Output,
  Schema extends StandardSchemaV1<unknown, Output>,
>(schema: Schema, value: unknown): Promise<Output> {
  const { vendor, validate } = schema["~standard"];
  const validationResult = validate(value);
  const resolved =
    validationResult instanceof Promise
      ? await validationResult
      : validationResult;
  if (resolved.issues) {
    throw new StandardSchemaValidationError({
      vendor,
      issues: resolved.issues,
    });
  }
  return resolved.value;
}

function formatStandardSchemaIssues(
  issues: ReadonlyArray<StandardSchemaV1.Issue>,
): string {
  return issues
    .map((issue) => {
      const path = formatStandardSchemaIssuePath(issue.path);
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

function formatStandardSchemaIssuePath(
  path: ReadonlyArray<PropertyKey | StandardSchemaV1.PathSegment> | undefined,
): string {
  if (!path || path.length === 0) return "";
  return path
    .map((segment) => {
      if (
        typeof segment === "object" &&
        segment !== null &&
        Object.hasOwn(segment, "key")
      ) {
        const key = (segment as StandardSchemaV1.PathSegment).key;
        return String(key);
      }
      return String(segment);
    })
    .join(".");
}
