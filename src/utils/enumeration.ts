/** Multi-word answers only. `[]` is truthy in the app and renders "תפסנו ()". */
export function publicEnumeration(enumeration?: number[] | null): number[] | null {
  if (!enumeration || enumeration.length < 2) return null;
  return enumeration;
}

export function withoutSingleWordEnumeration<T>(item: T): T {
  const src =
    item && typeof item === 'object' && typeof (item as { toObject?: () => unknown }).toObject === 'function'
      ? (item as { toObject: () => Record<string, unknown> }).toObject()
      : (item as Record<string, unknown>);
  const copy = { ...src };
  copy.enumeration = publicEnumeration(copy.enumeration as number[] | null | undefined);
  return copy as T;
}
