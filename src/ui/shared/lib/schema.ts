/** Small decoders for the JSON-only preload boundary. Invalid data never reaches views. */
export interface Schema<T> { parse(value: unknown): T }
export type Decoded<S> = S extends Schema<infer T> ? T : never;
function invalid(): never { throw new Error("The desktop app returned invalid data. Please restart the app."); }
export const text: Schema<string> = { parse: value => typeof value === "string" ? value : invalid() };
export const number: Schema<number> = { parse: value => typeof value === "number" && Number.isFinite(value) ? value : invalid() };
export const boolean: Schema<boolean> = { parse: value => typeof value === "boolean" ? value : invalid() };
export const ignored: Schema<void> = { parse: () => undefined };
export function optional<T>(schema: Schema<T>): Schema<T | undefined> { return { parse: value => value === undefined ? undefined : schema.parse(value) }; }
export function nullable<T>(schema: Schema<T>): Schema<T | null> { return { parse: value => value === null ? null : schema.parse(value) }; }
export function array<T>(schema: Schema<T>): Schema<T[]> { return { parse: value => Array.isArray(value) ? value.map(item => schema.parse(item)) : invalid() }; }
export function oneOf<const T extends readonly string[]>(...values: T): Schema<T[number]> {
  return { parse: value => typeof value === "string" && values.includes(value) ? value : invalid() };
}
export function object<S extends Record<string, Schema<unknown>>>(shape: S): Schema<{ [K in keyof S]: Decoded<S[K]> }> {
  return { parse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
    const input = value as Record<string, unknown>, output: Record<string, unknown> = {};
    for (const [key, schema] of Object.entries(shape)) {
      const parsed = schema.parse(input[key]);
      if (parsed !== undefined) output[key] = parsed;
    }
    // Every known property has passed its decoder; unknown properties are discarded.
    return output as { [K in keyof S]: Decoded<S[K]> };
  } };
}
