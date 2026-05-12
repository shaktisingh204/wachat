/**
 * Bulletproof MongoDB → client serializer.
 *
 * React Server Components stream every property of a returned value to the
 * client and refuse to walk into BSON-native instances (ObjectId, Date,
 * Decimal128, Binary, Long, Buffer). When any nested value still carries a
 * `toBSON` method or a `_bsontype` marker, Next.js throws:
 *
 *     "Cannot access toBSON on the server. You cannot dot into a temporary
 *      client reference from a server component."
 *
 * This helper recursively converts every BSON / Date / Buffer / Map / Set
 * value to a JSON-safe primitive so the returned object is guaranteed to be
 * RSC-safe. It is the single sanitization entry point — every SabFlow server
 * action that returns Mongo data should pipe through `serializeForClient()`.
 *
 * Performance: O(n) over the value tree. Safe to call on full flow docs and
 * paginated session lists (we already paginate before sanitizing).
 */

const BSON_BUFFER_TYPES = new Set([
  'Buffer',
  'Binary',
]);

/**
 * Sanitize a value tree of Mongo + native types so it can be streamed to a
 * client component.
 */
export function serializeForClient<T>(value: T): T {
  return sanitize(value, new WeakSet()) as T;
}

/**
 * Wrap a Mongo document for the client: strips `_id` to a string and
 * sanitizes everything else.
 */
export function serializeDoc<T extends { _id?: unknown }>(
  doc: T,
): Omit<T, '_id'> & { _id: string } {
  const { _id, ...rest } = doc as { _id?: unknown } & Record<string, unknown>;
  const idStr =
    _id === null || _id === undefined
      ? ''
      : typeof _id === 'string'
        ? _id
        : typeof (_id as { toString?: () => string }).toString === 'function'
          ? (_id as { toString: () => string }).toString()
          : '';
  return { ...(sanitize(rest, new WeakSet()) as Omit<T, '_id'>), _id: idStr };
}

function sanitize(value: unknown, seen: WeakSet<object>): unknown {
  // Primitives — pass through unchanged.
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') {
    // Functions cannot be serialized to the client.
    if (typeof value === 'function') return undefined;
    return value;
  }

  // Cycle guard.
  if (seen.has(value as object)) return null;
  seen.add(value as object);

  // Date → ISO string.
  if (value instanceof Date) return value.toISOString();

  // Buffer / Uint8Array / Binary BSON.
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return (value as Buffer).toString('base64');
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64');
  }

  // BSON-native instances. Covers ObjectId, Decimal128, Long, Int32, Double,
  // Timestamp, Binary, MaxKey, MinKey, Code — they all expose `_bsontype` or
  // a `toBSON()` method.
  const tagged = value as {
    _bsontype?: string;
    toBSON?: unknown;
    toString?: () => string;
    toHexString?: () => string;
    valueOf?: () => unknown;
  };
  if (
    typeof tagged._bsontype === 'string' ||
    typeof tagged.toBSON === 'function'
  ) {
    const bsonType = typeof tagged._bsontype === 'string' ? tagged._bsontype : '';

    // Binary / Buffer-shaped BSON → base64 string for safe transport.
    if (BSON_BUFFER_TYPES.has(bsonType)) {
      const toString = tagged.toString as ((encoding?: string) => string) | undefined;
      if (typeof toString === 'function') {
        try {
          return toString.call(value, 'base64');
        } catch {
          /* fall through */
        }
      }
    }

    // ObjectId prefers hex; the generic `toString()` already returns hex but
    // `toHexString` is the documented API.
    if (typeof tagged.toHexString === 'function') {
      try {
        return tagged.toHexString.call(value);
      } catch {
        /* fall through */
      }
    }

    // Decimal128 / Long / Double / Int32 stringify cleanly.
    if (typeof tagged.toString === 'function') {
      try {
        return tagged.toString.call(value);
      } catch {
        /* fall through */
      }
    }

    if (typeof tagged.valueOf === 'function') {
      try {
        return tagged.valueOf.call(value);
      } catch {
        /* fall through */
      }
    }

    return null;
  }

  // Map → plain object.
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      out[String(k)] = sanitize(v, seen);
    }
    return out;
  }

  // Set → array.
  if (value instanceof Set) {
    return Array.from(value.values()).map((v) => sanitize(v, seen));
  }

  // RegExp → string.
  if (value instanceof RegExp) {
    return value.toString();
  }

  // Error → POJO.
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  // Arrays.
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry, seen));
  }

  // Plain object — recurse over enumerable own keys.
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const child = (value as Record<string, unknown>)[key];
    // Drop functions (RSC-unsafe) and pass everything else through.
    if (typeof child === 'function') continue;
    out[key] = sanitize(child, seen);
  }
  return out;
}
