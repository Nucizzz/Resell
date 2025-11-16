export type Symbology = "EAN_13" | "UPC_A" | "UPC_E" | "EAN_8" | "CODE_128";

export type NormalizedGTIN = { primary: string; aliases: string[] };

export interface DetectedPayload {
  raw: string;
  symbology: Symbology;
  normalized: NormalizedGTIN;
  imageData?: ImageData | string;
}

export const ACCEPTED_LENGTHS = new Set([8, 12, 13]);

export function calcEAN13Checksum(digits12: string): number {
  const sum = digits12.split("").reduce((acc, d, idx) => acc + Number(d) * (idx % 2 === 0 ? 1 : 3), 0);
  const mod = sum % 10;
  return mod === 0 ? 0 : 10 - mod;
}

export function checksumEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const calc = calcEAN13Checksum(code.slice(0, 12));
  return calc === Number(code[12]);
}

export function checksumEAN8(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop() ?? 0;
  const sum = digits.reduce((acc, digit, idx) => acc + digit * (idx % 2 === 0 ? 3 : 1), 0);
  const calc = (10 - (sum % 10)) % 10;
  return calc === check;
}

export function checksumUPCA(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop() ?? 0;
  const oddSum = digits.reduce((acc, digit, idx) => acc + (idx % 2 === 0 ? digit : 0), 0);
  const evenSum = digits.reduce((acc, digit, idx) => acc + (idx % 2 === 1 ? digit : 0), 0);
  const total = oddSum * 3 + evenSum;
  const calc = (10 - (total % 10)) % 10;
  return calc === check;
}

export function sanitizeCode(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/[^0-9]/g, "");
}

export function isValidBarcode(code: string): boolean {
  if (!code || !ACCEPTED_LENGTHS.has(code.length)) return false;
  if (!/^\d+$/.test(code)) return false;
  if (code.length === 13) return checksumEAN13(code);
  if (code.length === 12) return checksumUPCA(code);
  return checksumEAN8(code);
}

export function toUPCAfromEAN13(ean13: string): string | null {
  if (!/^0\d{12}$/.test(ean13)) return null;
  return ean13.slice(1);
}

export function upcAToEAN13(upcA: string): string | null {
  if (!/^\d{12}$/.test(upcA)) return null;
  const withPrefix = `0${upcA}`;
  const ck = calcEAN13Checksum(withPrefix.slice(0, 12));
  return `${withPrefix.slice(0, 12)}${ck}`;
}

export function expandUPCE(upce: string): string | null {
  if (!/^\d{8}$/.test(upce)) return null;
  const numberSystem = upce[0];
  const manufacturer = upce.slice(1, 6);
  const selector = upce[6];

  let expanded = "";
  if ("012".includes(selector)) {
    expanded = `${manufacturer.slice(0, 2)}${selector}0000${manufacturer.slice(2, 5)}`;
  } else if (selector === "3") {
    expanded = `${manufacturer.slice(0, 3)}00000${manufacturer.slice(3, 5)}`;
  } else if (selector === "4") {
    expanded = `${manufacturer.slice(0, 4)}00000${manufacturer.slice(4, 5)}`;
  } else {
    expanded = `${manufacturer.slice(0, 5)}0000${selector}`;
  }

  const withoutCheck = `${numberSystem}${expanded}`.slice(0, 11);
  const check = checksumUPCA(`${withoutCheck}0`)
    ? 0
    : calcEAN13Checksum(`0${withoutCheck}`);
  return `${withoutCheck}${check}`;
}

export function normalizeGTIN(symbology: Symbology, code: string): NormalizedGTIN {
  if (!code) return { primary: "", aliases: [] };
  if (symbology === "EAN_13") {
    const alias = toUPCAfromEAN13(code);
    return { primary: code, aliases: alias ? [alias] : [] };
  }
  if (symbology === "UPC_A") {
    const ean = upcAToEAN13(code);
    return { primary: ean ?? code, aliases: [code] };
  }
  if (symbology === "UPC_E") {
    const expanded = expandUPCE(code);
    if (!expanded) return { primary: code, aliases: [] };
    const ean = upcAToEAN13(expanded);
    const aliases = [expanded];
    if (code !== expanded) aliases.push(code);
    return { primary: ean ?? expanded, aliases };
  }
  return { primary: code, aliases: [] };
}

export function symbologyFromResult(format: string | undefined, code: string): Symbology {
  const fmt = (format || "").toLowerCase();
  if (fmt.includes("ean_8")) return "EAN_8";
  if (fmt.includes("ean")) return "EAN_13";
  if (fmt.includes("upc_e")) return "UPC_E";
  if (fmt.includes("upc")) return "UPC_A";
  if (fmt.includes("code_128")) return "CODE_128";
  if (code.length === 8) return "EAN_8";
  if (code.length === 12) return "UPC_A";
  if (code.length === 13) return "EAN_13";
  return "CODE_128";
}
