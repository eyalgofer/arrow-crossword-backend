/** Keep enumeration only for multi-word answers so the client does not render "clue ()". */
export function publicEnumeration(enumeration?: number[] | null): number[] | undefined {
  if (!enumeration || enumeration.length < 2) return undefined;
  return enumeration;
}

export function withoutSingleWordEnumeration<T>(item: T): T {
  const copy = { ...(item as Record<string, unknown>) };
  const enumeration = publicEnumeration(copy.enumeration as number[] | undefined);
  if (enumeration) copy.enumeration = enumeration;
  else delete copy.enumeration;
  return copy as T;
}
