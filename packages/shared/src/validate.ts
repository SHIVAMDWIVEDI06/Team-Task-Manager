// A tiny, dependency-free schema validator with TypeScript inference (zod-like subset).

export interface Issue {
  path: string;
  message: string;
}
export type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

export interface Schema<T> {
  readonly _type: T;
  parse(input: unknown, path?: string): Result<T>;
  optional(): Schema<T | undefined>;
  nullable(): Schema<T | null>;
  default(value: T): Schema<T>;
}

export type Infer<S> = S extends Schema<infer T> ? T : never;

function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}
function fail<T>(path: string, message: string): Result<T> {
  return { ok: false, issues: [{ path, message }] };
}

function make<T>(parse: (input: unknown, path: string) => Result<T>): Schema<T> {
  const schema: Schema<T> = {
    _type: undefined as unknown as T,
    parse: (input, path = '') => parse(input, path),
    optional: () => make<T | undefined>((i, p) => (i === undefined ? ok(undefined) : parse(i, p))),
    nullable: () => make<T | null>((i, p) => (i === null ? ok(null) : parse(i, p))),
    default: (d) => make<T>((i, p) => (i === undefined || i === null ? ok(d) : parse(i, p))),
  };
  return schema;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const v = {
  string(opts: { min?: number; max?: number; pattern?: RegExp; email?: boolean; trim?: boolean; date?: boolean } = {}) {
    return make<string>((input, path) => {
      if (typeof input !== 'string') return fail(path, 'Expected a string');
      const s = opts.trim === false ? input : input.trim();
      if (opts.min !== undefined && s.length < opts.min)
        return fail(path, opts.min === 1 ? 'Required' : `Must be at least ${opts.min} characters`);
      if (opts.max !== undefined && s.length > opts.max) return fail(path, `Must be at most ${opts.max} characters`);
      if (opts.email && !EMAIL_RE.test(s)) return fail(path, 'Invalid email address');
      if (opts.date && (!DATE_RE.test(s) || Number.isNaN(Date.parse(s)))) return fail(path, 'Invalid date (YYYY-MM-DD)');
      if (opts.pattern && !opts.pattern.test(s)) return fail(path, 'Invalid format');
      return ok(s);
    });
  },
  number(opts: { min?: number; max?: number; int?: boolean } = {}) {
    return make<number>((input, path) => {
      const n = typeof input === 'string' && input !== '' ? Number(input) : input;
      if (typeof n !== 'number' || Number.isNaN(n)) return fail(path, 'Expected a number');
      if (opts.int && !Number.isInteger(n)) return fail(path, 'Expected an integer');
      if (opts.min !== undefined && n < opts.min) return fail(path, `Must be ≥ ${opts.min}`);
      if (opts.max !== undefined && n > opts.max) return fail(path, `Must be ≤ ${opts.max}`);
      return ok(n);
    });
  },
  boolean() {
    return make<boolean>((input, path) => {
      if (typeof input === 'boolean') return ok(input);
      if (input === 'true' || input === 1) return ok(true);
      if (input === 'false' || input === 0) return ok(false);
      return fail(path, 'Expected a boolean');
    });
  },
  literal<const L extends string | number | boolean>(value: L) {
    return make<L>((input, path) => (input === value ? ok(value) : fail(path, `Expected ${String(value)}`)));
  },
  enum<const U extends readonly (string | number)[]>(values: U) {
    return make<U[number]>((input, path) =>
      (values as readonly unknown[]).includes(input) ? ok(input as U[number]) : fail(path, `Must be one of: ${values.join(', ')}`),
    );
  },
  array<T>(item: Schema<T>, opts: { max?: number } = {}) {
    return make<T[]>((input, path) => {
      if (!Array.isArray(input)) return fail(path, 'Expected an array');
      if (opts.max !== undefined && input.length > opts.max) return fail(path, `At most ${opts.max} items`);
      const out: T[] = [];
      const issues: Issue[] = [];
      input.forEach((el, i) => {
        const r = item.parse(el, `${path}[${i}]`);
        if (r.ok) out.push(r.value);
        else issues.push(...r.issues);
      });
      return issues.length ? { ok: false, issues } : ok(out);
    });
  },
  object<Shape extends Record<string, Schema<unknown>>>(shape: Shape) {
    type Out = { [K in keyof Shape]: Infer<Shape[K]> };
    return make<Out>((input, path) => {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) return fail(path, 'Expected an object');
      const out: Record<string, unknown> = {};
      const issues: Issue[] = [];
      for (const key of Object.keys(shape)) {
        const r = shape[key].parse((input as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
        if (r.ok) {
          if (r.value !== undefined) out[key] = r.value;
        } else issues.push(...r.issues);
      }
      return issues.length ? { ok: false, issues } : ok(out as Out);
    });
  },
  record<T>(item: Schema<T>) {
    return make<Record<string, T>>((input, path) => {
      if (typeof input !== 'object' || input === null || Array.isArray(input)) return fail(path, 'Expected an object');
      const out: Record<string, T> = {};
      const issues: Issue[] = [];
      for (const [k, val] of Object.entries(input as Record<string, unknown>)) {
        const r = item.parse(val, `${path}.${k}`);
        if (r.ok) out[k] = r.value;
        else issues.push(...r.issues);
      }
      return issues.length ? { ok: false, issues } : ok(out);
    });
  },
  any() {
    return make<unknown>((input) => ok(input));
  },
  union<A, B>(a: Schema<A>, b: Schema<B>) {
    return make<A | B>((input, path) => {
      const r1 = a.parse(input, path);
      if (r1.ok) return r1;
      const r2 = b.parse(input, path);
      if (r2.ok) return r2;
      return r1;
    });
  },
};
