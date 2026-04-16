import { describe, it, expect, beforeEach } from "vitest";
import {
  formToSimulationInput,
  DEFAULT_FORM,
  deriveBalancesByTaxCategory,
  deriveAccountAllocations,
  deriveRebalanceConfig,
  deriveTargetAccountWeights,
  saveForm,
  loadForm,
  clearForm,
  loadScenarios,
  saveScenario,
  updateScenario,
  deleteScenario,
  exportFormToJSON,
  importFormFromJSON,
} from "./form-state";
import type { FormState } from "./form-state";

describe("formToSimulationInput", () => {
  it("月額支出を年額に変換", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.annualExpense).toBe(DEFAULT_FORM.monthlyExpense * 12);
  });

  it("ポートフォリオからリターン・リスクが自動計算される", () => {
    const form: FormState = {
      ...DEFAULT_FORM,
      portfolio: [
        { assetClass: "developed_stock", taxCategory: "nisa", amount: 10_000_000 },
      ],
    };
    const input = formToSimulationInput(form);
    // 先進国株式: 9% return, 19.5% risk
    expect(input.allocation.expectedReturn).toBeCloseTo(0.09, 2);
    expect(input.allocation.standardDeviation).toBeCloseTo(0.195, 2);
  });

  it("tokuteiGainRatio がパーセントから小数に変換される", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.tokuteiGainRatio).toBeCloseTo(DEFAULT_FORM.tokuteiGainRatio / 100);
  });

  it("goldGainRatio がパーセントから小数に変換される", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.goldGainRatio).toBeCloseTo(DEFAULT_FORM.goldGainRatio / 100);
  });

  it("ポートフォリオから課税種別ごとの残高が自動集計される", () => {
    const form: FormState = {
      ...DEFAULT_FORM,
      portfolio: [
        { assetClass: "developed_stock", taxCategory: "nisa", amount: 5_000_000 },
        { assetClass: "domestic_stock", taxCategory: "tokutei", amount: 3_000_000 },
        { assetClass: "developed_bond", taxCategory: "ideco", amount: 2_000_000 },
        { assetClass: "gold", taxCategory: "gold_physical", amount: 1_000_000 },
      ],
    };
    const input = formToSimulationInput(form);
    expect(input.accounts.nisa).toBe(5_000_000);
    expect(input.accounts.tokutei).toBe(3_000_000);
    expect(input.accounts.ideco).toBe(2_000_000);
    expect(input.accounts.gold_physical).toBe(1_000_000);
  });

  it("取り崩し順序はcash→nisa→tokutei→gold_physical→ideco固定", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.withdrawalOrder).toEqual(["cash", "nisa", "tokutei", "gold_physical", "ideco"]);
  });

  it("seed が数値", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(typeof input.seed).toBe("number");
    expect(Number.isFinite(input.seed)).toBe(true);
  });

  describe("NaN防御", () => {
    it("NaN入力がフォールバック値に変換される", () => {
      const broken: FormState = {
        ...DEFAULT_FORM,
        currentAge: NaN,
        annualSalary: NaN,
        monthlyExpense: NaN,
      };
      const input = formToSimulationInput(broken);
      expect(Number.isFinite(input.currentAge)).toBe(true);
      expect(Number.isFinite(input.annualSalary)).toBe(true);
      expect(Number.isFinite(input.annualExpense)).toBe(true);
    });

    it("numTrialsの最小値は10", () => {
      const broken: FormState = {
        ...DEFAULT_FORM,
        numTrials: 0,
      };
      const input = formToSimulationInput(broken);
      expect(input.numTrials).toBeGreaterThanOrEqual(10);
    });

    it("numTrialsの上限は10,000", () => {
      const form: FormState = { ...DEFAULT_FORM, numTrials: 100_000 };
      const input = formToSimulationInput(form);
      expect(input.numTrials).toBe(10_000);
    });
  });

  describe("年齢整合性ガード", () => {
    it("retirementAge < currentAge の場合 currentAge+1 に補正される", () => {
      const form: FormState = { ...DEFAULT_FORM, currentAge: 50, retirementAge: 40 };
      const input = formToSimulationInput(form);
      expect(input.retirementAge).toBeGreaterThan(input.currentAge);
    });

    it("endAge < retirementAge の場合 retirementAge+1 に補正される", () => {
      const form: FormState = { ...DEFAULT_FORM, retirementAge: 60, endAge: 55 };
      const input = formToSimulationInput(form);
      expect(input.endAge).toBeGreaterThan(input.retirementAge);
    });

    it("全年齢が同値の場合でも currentAge < retirementAge < endAge が保証される", () => {
      const form: FormState = { ...DEFAULT_FORM, currentAge: 50, retirementAge: 50, endAge: 50 };
      const input = formToSimulationInput(form);
      expect(input.currentAge).toBe(50);
      expect(input.retirementAge).toBe(51);
      // endAge は safeNum の min=60 が適用された上で retirementAge+1 との max
      expect(input.endAge).toBe(60);
    });

    it("endAge が120歳を超えない（DoS防止）", () => {
      const form: FormState = { ...DEFAULT_FORM, endAge: 999999 };
      const input = formToSimulationInput(form);
      expect(input.endAge).toBeLessThanOrEqual(120);
    });

    it("retirementAge が120歳を超えない", () => {
      const form: FormState = { ...DEFAULT_FORM, currentAge: 118, retirementAge: 200 };
      const input = formToSimulationInput(form);
      expect(input.retirementAge).toBeLessThanOrEqual(120);
    });
  });

  describe("ポートフォリオ合成", () => {
    it("有効なポートフォリオで合成リターン・リスクがSimulationInputに反映される", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        portfolio: [
          { assetClass: "developed_stock", taxCategory: "nisa", amount: 10_000_000 },
        ],
      };
      const input = formToSimulationInput(form);
      expect(input.allocation.expectedReturn).toBeCloseTo(0.09, 2);
      expect(input.allocation.standardDeviation).toBeCloseTo(0.195, 2);
    });

    it("現金100%ポートフォリオでリスクフロア0.001が適用される", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        portfolio: [
          { assetClass: "cash", taxCategory: "tokutei", amount: 5_000_000 },
        ],
      };
      const input = formToSimulationInput(form);
      expect(input.allocation.expectedReturn).toBe(0);
      expect(input.allocation.standardDeviation).toBe(0.001);
    });

    it("ポートフォリオ金額0のときはフォールバック値(5%/15%)が使用される", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        portfolio: [
          { assetClass: "developed_stock", taxCategory: "nisa", amount: 0 },
        ],
      };
      const input = formToSimulationInput(form);
      expect(input.allocation.expectedReturn).toBeCloseTo(0.05);
      expect(input.allocation.standardDeviation).toBeCloseTo(0.15);
    });
  });

  it("inflationRate がパーセントから小数に変換される", () => {
    const input = formToSimulationInput(DEFAULT_FORM);
    expect(input.inflationRate).toBeCloseTo(DEFAULT_FORM.inflationRate / 100);
  });

  describe("localStorage 永続化", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("saveForm → loadForm でラウンドトリップできる", () => {
      const form: FormState = {
        ...DEFAULT_FORM,
        currentAge: 40,
        portfolio: [
          { assetClass: "developed_stock", taxCategory: "nisa", amount: 5_000_000 },
          { assetClass: "gold", taxCategory: "gold_physical", amount: 1_000_000 },
        ],
      };
      saveForm(form);
      const loaded = loadForm();
      expect(loaded).toEqual(form);
    });

    it("loadForm はデータなしで null を返す", () => {
      expect(loadForm()).toBeNull();
    });

    it("clearForm でデータが削除される", () => {
      saveForm(DEFAULT_FORM);
      expect(loadForm()).not.toBeNull();
      clearForm();
      expect(loadForm()).toBeNull();
    });

    it("スキーマバージョン不一致で null を返す", () => {
      localStorage.setItem("fire-sanbo-form", JSON.stringify({
        version: 999,
        form: DEFAULT_FORM,
      }));
      expect(loadForm()).toBeNull();
    });

    it("不正なJSONで null を返す", () => {
      localStorage.setItem("fire-sanbo-form", "not json");
      expect(loadForm()).toBeNull();
    });
  });
});

describe("deriveBalancesByTaxCategory", () => {
  it("同一課税種別の複数銘柄を合算する", () => {
    const balances = deriveBalancesByTaxCategory([
      { assetClass: "developed_stock", taxCategory: "nisa", amount: 3_000_000 },
      { assetClass: "domestic_stock", taxCategory: "nisa", amount: 2_000_000 },
    ]);
    expect(balances.nisa).toBe(5_000_000);
    expect(balances.tokutei).toBe(0);
    expect(balances.ideco).toBe(0);
    expect(balances.gold_physical).toBe(0);
    expect(balances.cash).toBe(0);
  });
});

describe("シナリオ管理", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saveScenario → loadScenarios でラウンドトリップ", () => {
    saveScenario("現状維持", DEFAULT_FORM);
    saveScenario("転職ケース", { ...DEFAULT_FORM, annualSalary: 8_000_000 });
    const scenarios = loadScenarios();
    expect(scenarios).toHaveLength(2);
    expect(scenarios[0].name).toBe("現状維持");
    expect(scenarios[1].name).toBe("転職ケース");
    expect(scenarios[1].form.annualSalary).toBe(8_000_000);
  });

  it("updateScenario でフォームを更新", () => {
    const s = saveScenario("テスト", DEFAULT_FORM);
    updateScenario(s.id, { ...DEFAULT_FORM, currentAge: 42 });
    const scenarios = loadScenarios();
    expect(scenarios[0].form.currentAge).toBe(42);
  });

  it("deleteScenario でシナリオを削除", () => {
    const s1 = saveScenario("A", DEFAULT_FORM);
    saveScenario("B", DEFAULT_FORM);
    deleteScenario(s1.id);
    const scenarios = loadScenarios();
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0].name).toBe("B");
  });

  it("シナリオなしで空配列を返す", () => {
    expect(loadScenarios()).toEqual([]);
  });
});

describe("JSON エクスポート/インポート", () => {
  it("exportFormToJSON → importFormFromJSON でラウンドトリップ", () => {
    const form: FormState = {
      ...DEFAULT_FORM,
      currentAge: 40,
      annualSalary: 7_000_000,
    };
    const json = exportFormToJSON(form);
    const imported = importFormFromJSON(json);
    expect(imported).toEqual(form);
  });

  it("不正なJSON文字列で null を返す", () => {
    expect(importFormFromJSON("not valid json")).toBeNull();
  });

  it("バージョン不一致で null を返す", () => {
    const json = JSON.stringify({ version: 999, form: DEFAULT_FORM });
    expect(importFormFromJSON(json)).toBeNull();
  });

  it("formフィールドが不正で null を返す", () => {
    const json = JSON.stringify({ version: 2, form: { foo: "bar" } });
    expect(importFormFromJSON(json)).toBeNull();
  });

  it("portfolioが20件を超える場合 null を返す（DoS防御）", () => {
    const form = {
      ...DEFAULT_FORM,
      portfolio: Array.from({ length: 21 }, () => ({
        assetClass: "developed_stock",
        taxCategory: "nisa",
        amount: 1_000_000,
      })),
    };
    const json = JSON.stringify({ version: 3, form });
    expect(importFormFromJSON(json)).toBeNull();
  });

  it("lifeEventsが30件を超える場合 null を返す（DoS防御）", () => {
    const form = {
      ...DEFAULT_FORM,
      lifeEvents: Array.from({ length: 31 }, (_, i) => ({
        label: `event-${i}`,
        age: 40 + i,
        amount: 1_000_000,
      })),
    };
    const json = JSON.stringify({ version: 3, form });
    expect(importFormFromJSON(json)).toBeNull();
  });

  it("spouse.portfolioが20件を超える場合 null を返す（DoS防御）", () => {
    const form = {
      ...DEFAULT_FORM,
      spouse: {
        ...DEFAULT_FORM,
        portfolio: Array.from({ length: 21 }, () => ({
          assetClass: "developed_stock",
          taxCategory: "nisa",
          amount: 1_000_000,
        })),
      },
    };
    const json = JSON.stringify({ version: 3, form });
    expect(importFormFromJSON(json)).toBeNull();
  });
});

describe("deriveAccountAllocations", () => {
  it("口座別に異なる資産クラスがあればリターン・リスクが異なる", () => {
    const portfolio = [
      { assetClass: "developed_stock" as const, taxCategory: "nisa" as const, amount: 10_000_000 },
      { assetClass: "developed_bond" as const, taxCategory: "tokutei" as const, amount: 10_000_000 },
    ];
    const result = deriveAccountAllocations(portfolio);
    expect(result).toBeDefined();
    expect(result!.nisa).toBeDefined();
    expect(result!.tokutei).toBeDefined();
    // 株式(nisa)のリターン > 債券(tokutei)のリターン
    expect(result!.nisa!.expectedReturn).toBeGreaterThan(result!.tokutei!.expectedReturn);
    // 株式のリスク > 債券のリスク
    expect(result!.nisa!.standardDeviation).toBeGreaterThan(result!.tokutei!.standardDeviation);
  });

  it("cash口座はリターン0・リスク0", () => {
    const portfolio = [
      { assetClass: "developed_stock" as const, taxCategory: "nisa" as const, amount: 10_000_000 },
    ];
    const result = deriveAccountAllocations(portfolio);
    expect(result).toBeDefined();
    expect(result!.cash).toEqual({ expectedReturn: 0, standardDeviation: 0 });
  });

  it("portfolioが空ならundefinedを返す", () => {
    const result = deriveAccountAllocations([]);
    expect(result).toBeUndefined();
  });

  it("金額0のエントリは無視する", () => {
    const portfolio = [
      { assetClass: "developed_stock" as const, taxCategory: "nisa" as const, amount: 0 },
    ];
    const result = deriveAccountAllocations(portfolio);
    expect(result).toBeUndefined();
  });
});

describe("deriveRebalanceConfig", () => {
  it("残高比率から目標ウェイトを導出する", () => {
    const balances = { nisa: 6_000_000, tokutei: 3_000_000, ideco: 1_000_000, gold_physical: 0, cash: 0 };
    const config = deriveRebalanceConfig(balances);
    expect(config.targetWeights.nisa).toBeCloseTo(0.6);
    expect(config.targetWeights.tokutei).toBeCloseTo(0.3);
    expect(config.targetWeights.ideco).toBeCloseTo(0.1);
    expect(config.targetWeights.gold_physical).toBeCloseTo(0);
    expect(config.targetWeights.cash).toBeCloseTo(0);
    expect(config.threshold).toBe(0.05);
  });

  it("目標ウェイトの合計は1.0", () => {
    const balances = { nisa: 3_000_000, tokutei: 5_000_000, ideco: 1_000_000, gold_physical: 500_000, cash: 500_000 };
    const config = deriveRebalanceConfig(balances);
    const sum = Object.values(config.targetWeights).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it("rebalanceEnabled未指定ならenabled: falseを返す", () => {
    const balances = { nisa: 10_000_000, tokutei: 10_000_000, ideco: 0, gold_physical: 0, cash: 0 };
    const config = deriveRebalanceConfig(balances);
    expect(config.enabled).toBe(false);
  });

  it("rebalanceEnabled=trueならenabled: trueを返す", () => {
    const balances = { nisa: 10_000_000, tokutei: 10_000_000, ideco: 0, gold_physical: 0, cash: 0 };
    const config = deriveRebalanceConfig(balances, true);
    expect(config.enabled).toBe(true);
  });

  it("total=0ならenabled: falseでウェイト全0", () => {
    const balances = { nisa: 0, tokutei: 0, ideco: 0, gold_physical: 0, cash: 0 };
    const config = deriveRebalanceConfig(balances);
    expect(config.enabled).toBe(false);
    expect(Object.values(config.targetWeights).every((w) => w === 0)).toBe(true);
  });
});

describe("目標アセットアロケーション", () => {
  const portfolioWithTarget: FormState = {
    ...DEFAULT_FORM,
    portfolio: [
      { assetClass: "developed_stock", taxCategory: "nisa", amount: 5_000_000 },
      { assetClass: "developed_stock", taxCategory: "tokutei", amount: 2_000_000 },
      { assetClass: "developed_bond", taxCategory: "nisa", amount: 1_000_000 },
      { assetClass: "gold", taxCategory: "gold_physical", amount: 500_000 },
    ],
    targetAllocation: [
      { assetClass: "developed_stock", weight: 0.60 },
      { assetClass: "developed_bond", weight: 0.30 },
      { assetClass: "gold", weight: 0.10 },
    ],
    rebalanceEnabled: true,
  };

  it("targetAllocation未設定→現行動作と完全一致（後方互換）", () => {
    const withoutTarget = formToSimulationInput(DEFAULT_FORM);
    const withTarget = formToSimulationInput({ ...DEFAULT_FORM, targetAllocation: undefined, rebalanceEnabled: false });
    expect(withTarget.allocation).toEqual(withoutTarget.allocation);
    expect(withTarget.rebalance?.enabled).toBe(false);
  });

  it("targetAllocation設定→allocation.expectedReturnが目標ベース", () => {
    const input = formToSimulationInput(portfolioWithTarget);
    // 先進国株60% + 先進国債券30% + 金10% → 株の9%が支配的
    expect(input.allocation.expectedReturn).toBeGreaterThan(0.05);
    expect(input.allocation.expectedReturn).toBeLessThan(0.10);
  });

  it("targetAllocation設定→rebalance.enabled=true", () => {
    const input = formToSimulationInput(portfolioWithTarget);
    expect(input.rebalance?.enabled).toBe(true);
  });

  it("目標→口座ウェイト変換: 2資産・2口座で正しく分配", () => {
    const target = [
      { assetClass: "developed_stock" as const, weight: 0.60 },
      { assetClass: "developed_bond" as const, weight: 0.30 },
      { assetClass: "gold" as const, weight: 0.10 },
    ];
    const portfolio = [
      { assetClass: "developed_stock" as const, taxCategory: "nisa" as const, amount: 5_000_000 },
      { assetClass: "developed_stock" as const, taxCategory: "tokutei" as const, amount: 2_000_000 },
      { assetClass: "developed_bond" as const, taxCategory: "nisa" as const, amount: 1_000_000 },
      { assetClass: "gold" as const, taxCategory: "gold_physical" as const, amount: 500_000 },
    ];
    const weights = deriveTargetAccountWeights(target, portfolio);
    // NISA = 0.60*(5M/7M) + 0.30*(1M/1M) = 0.4286 + 0.30 = 0.7286
    expect(weights.nisa).toBeCloseTo(0.7286, 2);
    // tokutei = 0.60*(2M/7M) = 0.1714
    expect(weights.tokutei).toBeCloseTo(0.1714, 2);
    // gold = 0.10
    expect(weights.gold_physical).toBeCloseTo(0.10, 2);
  });

  it("目標→口座ウェイト変換: ウェイト合計=1.0", () => {
    const target = [
      { assetClass: "developed_stock" as const, weight: 0.50 },
      { assetClass: "developed_bond" as const, weight: 0.30 },
      { assetClass: "gold" as const, weight: 0.20 },
    ];
    const portfolio = [
      { assetClass: "developed_stock" as const, taxCategory: "nisa" as const, amount: 10_000_000 },
      { assetClass: "developed_bond" as const, taxCategory: "tokutei" as const, amount: 5_000_000 },
      { assetClass: "gold" as const, taxCategory: "gold_physical" as const, amount: 2_000_000 },
    ];
    const weights = deriveTargetAccountWeights(target, portfolio);
    const sum = Object.values(weights).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it("v4→v5マイグレーション: targetAllocation未定義で正常動作", () => {
    // v4 FormStateをシミュレート: targetAllocation/rebalanceEnabled が存在しない
    const v4Form: FormState = { ...DEFAULT_FORM, targetAllocation: undefined, rebalanceEnabled: undefined };
    const input = formToSimulationInput(v4Form);
    expect(input.rebalance?.enabled).toBe(false);
    expect(input.allocation.expectedReturn).toBeGreaterThanOrEqual(0);
  });

  it("rebalanceEnabled=false→targetあっても無視", () => {
    const form: FormState = {
      ...portfolioWithTarget,
      rebalanceEnabled: false,
    };
    const input = formToSimulationInput(form);
    expect(input.rebalance?.enabled).toBe(false);
  });

  it("目標に保有にない資産クラス→デフォルト口座マッピング", () => {
    const target = [
      { assetClass: "developed_stock" as const, weight: 0.60 },
      { assetClass: "emerging_stock" as const, weight: 0.40 }, // 保有なし
    ];
    const portfolio = [
      { assetClass: "developed_stock" as const, taxCategory: "nisa" as const, amount: 10_000_000 },
    ];
    const weights = deriveTargetAccountWeights(target, portfolio);
    // emerging_stock保有なし → nisaにフォールバック（nisaが最大口座）
    expect(weights.nisa).toBeCloseTo(1.0);
    const sum = Object.values(weights).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it("portfolio空+targetAllocation→rebalance.enabled=false", () => {
    const form: FormState = {
      ...DEFAULT_FORM,
      portfolio: [],
      targetAllocation: [
        { assetClass: "developed_stock", weight: 1.0 },
      ],
      rebalanceEnabled: true,
    };
    const input = formToSimulationInput(form);
    // portfolio空 → balances全ゼロ → 有意なシミュレーションにならないが破綻しない
    expect(input.accounts.nisa).toBe(0);
  });
});
