export function combineGuids(guid1: string, guid2: string): string {
  const hex1 = guid1.replace(/-/g, '');
  const hex2 = guid2.replace(/-/g, '');
  const combined = BigInt('0x' + hex1 + hex2);
  return combined.toString(36);
}

export function splitGuids(encoded: string): [string, string] {
  // Parse base36 string as BigInt
  let combined = 0n;
  for (let i = 0; i < encoded.length; i++) {
    const digit = encoded.charCodeAt(i);
    const value = digit >= 48 && digit <= 57 ? digit - 48 : digit - 87; // 0-9, a-z
    combined = combined * 36n + BigInt(value);
  }

  const hex = combined.toString(16).padStart(64, '0');

  const guid1 = hex.slice(0, 32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  const guid2 = hex.slice(32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');

  return [guid1, guid2];
}