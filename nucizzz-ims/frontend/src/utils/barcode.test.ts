import { describe, expect, it } from "vitest";
import {
  calcEAN13Checksum,
  checksumEAN13,
  checksumEAN8,
  checksumUPCA,
  expandUPCE,
  normalizeGTIN,
  symbologyFromResult,
} from "./barcode";
import { shouldAccept } from "../components/Scanner";

describe("barcode checksums", () => {
  it("validates EAN-13 and UPC-A checksums", () => {
    expect(checksumEAN13("4006381333931")).toBe(true);
    expect(checksumEAN13("4006381333932")).toBe(false);
    expect(calcEAN13Checksum("012345678901")).toBe(2);
    expect(checksumUPCA("036000291452")).toBe(true);
  });

  it("validates EAN-8", () => {
    expect(checksumEAN8("55123457")).toBe(true);
    expect(checksumEAN8("55123458")).toBe(false);
  });
});

describe("normalization", () => {
  it("maps EAN13 leading zero to UPC-A alias", () => {
    const normalized = normalizeGTIN("EAN_13", "0123456789012");
    expect(normalized.primary).toBe("0123456789012");
    expect(normalized.aliases).toContain("123456789012");
  });

  it("maps UPC-A to EAN13 primary", () => {
    const normalized = normalizeGTIN("UPC_A", "123456789012");
    expect(normalized.primary.startsWith("0")).toBe(true);
    expect(normalized.aliases).toContain("123456789012");
  });

  it("expands UPC-E correctly", () => {
    const expanded = expandUPCE("04210005");
    expect(expanded).toBe("042100000050");
    const normalized = normalizeGTIN("UPC_E", "04210005");
    expect(normalized.aliases).toContain("042100000050");
  });

  it("detects symbology fallback", () => {
    expect(symbologyFromResult("upc_a", "123456789012")).toBe("UPC_A");
    expect(symbologyFromResult("ean", "0001234567890")).toBe("EAN_13");
    expect(symbologyFromResult("", "55123457")).toBe("EAN_8");
  });
});

describe("candidate dominance", () => {
  it("prefers dominant hit counts or confidence", () => {
    const main = { code: "a", symbology: "EAN_13", hits: 7, meanConfidence: 0.7 } as any;
    const runner = { code: "b", symbology: "EAN_13", hits: 3, meanConfidence: 0.55 } as any;
    expect(shouldAccept(main, runner, 0)).toBe(true);
    const weakMain = { ...main, hits: 5, meanConfidence: 0.6 };
    expect(shouldAccept(weakMain, runner, 3)).toBe(true);
    expect(shouldAccept({ ...main, hits: 2 }, runner, 0)).toBe(false);
  });
});
