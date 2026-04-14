import { describe, it, expect } from "vitest";
import { compressForm, decompressForm, buildShareUrl, parseShareHash } from "./url-share";
import { DEFAULT_FORM } from "./form-state";
import type { FormState } from "./form-state";

describe("url-share", () => {
  describe("compressForm / decompressForm ラウンドトリップ", () => {
    it("DEFAULT_FORM をラウンドトリップできる", () => {
      const encoded = compressForm(DEFAULT_FORM);
      expect(typeof encoded).toBe("string");
      expect(encoded.length).toBeGreaterThan(0);
      const restored = decompressForm(encoded);
      expect(restored).not.toBeNull();
      expect(restored!.currentAge).toBe(DEFAULT_FORM.currentAge);
      expect(restored!.retirementAge).toBe(DEFAULT_FORM.retirementAge);
      expect(restored!.monthlyExpense).toBe(DEFAULT_FORM.monthlyExpense);
    });

    it("配偶者+ライフイベント付きフルFormをラウンドトリップできる", () => {
      const fullForm: FormState = {
        ...DEFAULT_FORM,
        portfolio: [
          { assetClass: "developed_stock", taxCategory: "nisa", amount: 5_000_000 },
          { assetClass: "domestic_stock", taxCategory: "tokutei", amount: 3_000_000 },
          { assetClass: "gold", taxCategory: "gold_physical", amount: 1_000_000 },
          { assetClass: "cash", taxCategory: "cash", amount: 2_000_000 },
        ],
        lifeEvents: [
          { label: "住宅購入", age: 40, amount: 30_000_000 },
          { label: "教育費", age: 45, amount: 5_000_000 },
          { label: "車替え", age: 55, amount: 3_000_000 },
        ],
        sideIncome: { annualAmount: 1_200_000, untilAge: 70 },
        retirementBonus: { amount: 10_000_000, yearsOfService: 20 },
        spouse: {
          currentAge: 33,
          retirementAge: 45,
          annualSalary: 4_000_000,
          portfolio: [{ assetClass: "developed_stock", taxCategory: "nisa", amount: 2_000_000 }],
          idecoYearsOfService: 10,
          tokuteiGainRatio: 50,
          goldGainRatio: 30,
          pension: { kosei: 80_000, kokumin: 65_000, startAge: 65 },
        },
        spouseEnabled: true,
      };
      const encoded = compressForm(fullForm);
      const restored = decompressForm(encoded);
      expect(restored).not.toBeNull();
      expect(restored!.lifeEvents).toHaveLength(3);
      expect(restored!.spouse?.currentAge).toBe(33);
    });

    it("numTrials は共有時に 1000 に固定される", () => {
      const form: FormState = { ...DEFAULT_FORM, numTrials: 10_000 };
      const encoded = compressForm(form);
      const restored = decompressForm(encoded);
      expect(restored!.numTrials).toBe(1000);
    });
  });

  describe("URL長の安全性", () => {
    it("フルForm でも URL が 2000 文字未満", () => {
      const fullForm: FormState = {
        ...DEFAULT_FORM,
        portfolio: Array.from({ length: 8 }, (_, i) => ({
          assetClass: "developed_stock" as const,
          taxCategory: "nisa" as const,
          amount: (i + 1) * 1_000_000,
        })),
        lifeEvents: Array.from({ length: 5 }, (_, i) => ({
          label: `イベント${i + 1}`,
          age: 40 + i * 5,
          amount: 5_000_000,
        })),
        spouse: {
          currentAge: 33,
          retirementAge: 45,
          annualSalary: 4_000_000,
          portfolio: Array.from({ length: 4 }, () => ({
            assetClass: "developed_stock" as const,
            taxCategory: "nisa" as const,
            amount: 1_000_000,
          })),
          idecoYearsOfService: 10,
          tokuteiGainRatio: 50,
          goldGainRatio: 30,
        },
        spouseEnabled: true,
      };
      const url = buildShareUrl(fullForm, "https://akiyoshi.github.io/fire-sanbo/");
      expect(url.length).toBeLessThan(2000);
    });
  });

  describe("不正入力の安全性", () => {
    it("壊れたBase64url文字列 → null", () => {
      expect(decompressForm("!!!invalid!!!")).toBeNull();
    });

    it("空文字列 → null", () => {
      expect(decompressForm("")).toBeNull();
    });

    it("Base64urlデコード成功だがJSON不正 → null", () => {
      // "not json" をbase64url化
      const encoded = btoa("not json").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      expect(decompressForm(encoded)).toBeNull();
    });

    it("有効なJSONだがFormState構造でない → null", () => {
      const { deflateRaw } = require("pako");
      const json = JSON.stringify({ version: 3, form: { notAForm: true } });
      const compressed = deflateRaw(new TextEncoder().encode(json));
      const encoded = Buffer.from(compressed).toString("base64url");
      expect(decompressForm(encoded)).toBeNull();
    });

    it("version: 99 の未知バージョン → null", () => {
      const { deflateRaw } = require("pako");
      const json = JSON.stringify({ version: 99, form: DEFAULT_FORM });
      const compressed = deflateRaw(new TextEncoder().encode(json));
      const encoded = Buffer.from(compressed).toString("base64url");
      expect(decompressForm(encoded)).toBeNull();
    });

    it("lifeEvents.label が50文字超 → 切り詰めて復元", () => {
      const longLabel = "あ".repeat(100);
      const form: FormState = {
        ...DEFAULT_FORM,
        lifeEvents: [{ label: longLabel, age: 45, amount: 5_000_000 }],
      };
      const encoded = compressForm(form);
      const restored = decompressForm(encoded);
      expect(restored!.lifeEvents![0].label.length).toBeLessThanOrEqual(50);
    });
  });

  describe("parseShareHash", () => {
    it("#s= プレフィックス付きハッシュからFormStateを復元", () => {
      const encoded = compressForm(DEFAULT_FORM);
      const result = parseShareHash("#s=" + encoded);
      expect(result).not.toBeNull();
      expect(result!.currentAge).toBe(DEFAULT_FORM.currentAge);
    });

    it("プレフィックスなし → null", () => {
      expect(parseShareHash("#other=value")).toBeNull();
    });

    it("空ハッシュ → null", () => {
      expect(parseShareHash("")).toBeNull();
    });

    it("#s= のみ（データなし） → null", () => {
      expect(parseShareHash("#s=")).toBeNull();
    });

    it("圧縮データが50KBを超える → null（decompression bomb防御）", () => {
      // 50KB超のBase64url文字列を生成
      const fakeCompressed = new Uint8Array(60_000).fill(0x41);
      const encoded = Buffer.from(fakeCompressed).toString("base64url");
      expect(decompressForm(encoded)).toBeNull();
    });
  });

  describe("buildShareUrl", () => {
    it("ベースURL + #s= + 圧縮データ の形式", () => {
      const url = buildShareUrl(DEFAULT_FORM, "https://example.com/app/");
      expect(url).toMatch(/^https:\/\/example\.com\/app\/#s=.+$/);
    });
  });
});
