export function normalizeNamePart(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

export function cleanNamePart(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isValidNamePart(value: string) {
  const cleaned = cleanNamePart(value);
  return cleaned.length >= 2 && cleaned.length <= 40;
}
