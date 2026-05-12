/**
 * Client-side defensive sanitizer for values about to be sent to a Server
 * Action. Strips anything that cannot be encoded as JSON:
 *
 *   • functions
 *   • Symbols
 *   • React elements / Fiber refs (any object with a `$$typeof` symbol)
 *   • class instances without a `toJSON()`
 *   • undefined entries inside arrays (replaced with `null`)
 *   • Date / Map / Set (converted to JSON-safe primitives)
 *   • cyclic references (replaced with `null`)
 *
 * The Next.js RSC serializer wraps unserializable client values in a
 * "temporary client reference" Proxy when they cross the client→server
 * action boundary. Any subsequent property access on that Proxy throws
 *
 *   "Cannot access <prop> on the server. You cannot dot into a temporary
 *    client reference from a server component."
 *
 * MongoDB's BSON encoder probes `.toBSON()` on every value it writes, which
 * is what triggers the error during saves. Sanitizing on the client side
 * keeps the payload purely structural-clone-safe so no Proxy is ever
 * created.
 */
export function toJsonSafe<T>(value: T): T {
  return walk(value, new WeakSet()) as T;
}

function walk(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;

  // Primitives — drop functions and symbols (RSC can't encode them).
  const t = typeof value;
  if (t === 'function' || t === 'symbol') return undefined;
  if (t !== 'object') return value;

  // Cycle guard.
  if (seen.has(value as object)) return null;
  seen.add(value as object);

  // Date → ISO string.
  if (value instanceof Date) return value.toISOString();

  // DOM Element / Node — happens when an event handler stores `event.target`
  // or someone passes a SyntheticEvent through `save(event)`. The element
  // carries `__reactFiber$...` which descends into a deep tree and explodes
  // BSON's nested-depth limit.
  if (typeof Node !== 'undefined' && value instanceof Node) return undefined;
  // SyntheticEvent / native Event — same family, distinct prototype chain.
  if (typeof Event !== 'undefined' && value instanceof Event) return undefined;
  // React Fiber nodes (own DOM elements via `__reactFiber$xxx` expandos).
  // Fibers have a distinctive shape: `tag` + `stateNode` + `return`. We catch
  // them explicitly so a stray `event.target` that survived above checks (e.g.
  // detached element from a different realm) still gets stripped.
  const fiberLike = value as {
    stateNode?: unknown;
    return?: unknown;
    tag?: unknown;
    elementType?: unknown;
  };
  if (
    'stateNode' in fiberLike &&
    'return' in fiberLike &&
    'tag' in fiberLike &&
    typeof fiberLike.tag === 'number'
  ) {
    return undefined;
  }

  // Map → POJO.
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      out[String(k)] = walk(v, seen);
    }
    return out;
  }

  // Set → array.
  if (value instanceof Set) {
    return Array.from(value.values()).map((v) => walk(v, seen));
  }

  // RegExp / Error → primitive forms.
  if (value instanceof RegExp) return value.toString();
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  // React elements & Fiber refs all expose a `$$typeof` Symbol — strip them.
  const recordLike = value as Record<string | symbol, unknown>;
  if (recordLike['$$typeof'] !== undefined) return undefined;

  // Arrays.
  if (Array.isArray(value)) {
    return value.map((v) => {
      const w = walk(v, seen);
      // undefined items inside arrays are dropped by JSON.stringify but kept
      // as positional null so the array length stays stable.
      return w === undefined ? null : w;
    });
  }

  // Honour `toJSON()` like JSON.stringify would — but ONLY for our own
  // toJSON; class instances without one fall through to the plain-object
  // branch below.
  if (typeof (value as { toJSON?: () => unknown }).toJSON === 'function') {
    try {
      const json = (value as { toJSON: () => unknown }).toJSON();
      return walk(json, seen);
    } catch {
      /* fall through to plain-object walk */
    }
  }

  // Plain object — recurse over own enumerable keys.
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const child = (value as Record<string, unknown>)[key];
    const w = walk(child, seen);
    if (w !== undefined) out[key] = w;
  }
  return out;
}
