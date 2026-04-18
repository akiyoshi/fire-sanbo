import { test, expect } from "@playwright/test";
import { deflateRaw } from "pako";

// 基本情報カード内の入力を操作するヘルパー
async function quickRun(page: import("@playwright/test").Page) {
  await page.getByLabel("年収（税引き前）").fill("6000000");
  await page.getByRole("button", { name: "すぐにシミュレーション" }).click();
  await expect(page.getByText("成功確率")).toBeVisible({ timeout: 15000 });
}

/** FormState → #s=... ハッシュを生成（テスト用の簡易実装） */
function buildShareHash(form: Record<string, unknown>): string {
  const json = JSON.stringify({ version: 5, form });
  const compressed = deflateRaw(new TextEncoder().encode(json));
  const bin = Array.from(compressed, (b) => String.fromCharCode(b)).join("");
  const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return "#s=" + b64;
}

test.describe("FIRE参謀 E2E", () => {
  test("QuickStart → 結果画面 → 成功率表示", async ({ page }) => {
    await page.goto("/fire-sanbo/");
    await quickRun(page);

    // チャートが描画される
    await expect(page.getByRole("img", { name: /^資産推移チャート/ })).toBeVisible({ timeout: 10000 });

    // 処方箋カードを展開できる
    await page.locator("summary").filter({ hasText: "処方箋" }).click();
    await expect(page.locator("summary").filter({ hasText: "処方箋" })).toBeVisible();
  });

  test("結果画面 → 計算根拠ページ → 戻る", async ({ page }) => {
    await page.goto("/fire-sanbo/");
    await quickRun(page);

    // 計算根拠ページに遷移
    await page.getByText("計算根拠").click();
    await expect(page.getByRole("heading", { name: "計算根拠書" })).toBeVisible({ timeout: 10000 });

    // 入力画面に戻る
    await page.getByRole("button", { name: /戻る/ }).click();
    await expect(page.getByText("基本情報")).toBeVisible({ timeout: 10000 });
  });

  test("共有URLボタンが存在する", async ({ page }) => {
    await page.goto("/fire-sanbo/");
    await quickRun(page);

    // 共有ボタンが表示される
    await expect(page.getByRole("button", { name: /共有|シェア|コピー|結果を共有/ })).toBeVisible();
  });

  test("ダークモード切替", async ({ page }) => {
    await page.goto("/fire-sanbo/");

    // トグルボタンをクリック
    const toggle = page.getByRole("button", { name: /モードに切り替え/ });
    await toggle.click();

    // html要素にdarkクラスが付与される
    await expect(page.locator("html")).toHaveClass(/dark/, { timeout: 3000 });

    // もう一度クリック
    await toggle.click();
    await expect(page.locator("html")).not.toHaveClass(/dark/, { timeout: 3000 });
  });

  test("共有URL復元 → 結果画面自動表示", async ({ page }) => {
    // QuickStart相当の最小FormStateで共有ハッシュを生成
    const form = {
      currentAge: 35,
      retirementAge: 65,
      endAge: 95,
      annualSalary: 6_000_000,
      monthlyExpense: 200_000,
      portfolio: [
        { assetClass: "developed_stock", taxCategory: "nisa", amount: 3_000_000 },
      ],
      idecoYearsOfService: 15,
      tokuteiGainRatio: 50,
      goldGainRatio: 30,
      inflationRate: 2,
      numTrials: 100,
    };
    const hash = buildShareHash(form);

    // ハッシュ付きURLでアクセス
    await page.goto("/fire-sanbo/" + hash);

    // 結果画面が自動表示される（共有バナー + 成功確率）
    await expect(page.getByText("共有されたプランを表示中")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("成功確率")).toBeVisible({ timeout: 15000 });

    // チャートが描画される
    await expect(page.getByRole("img", { name: /^資産推移チャート/ })).toBeVisible({ timeout: 10000 });
  });

  test("What-ifスライダー操作 → 成功率変化", async ({ page }) => {
    await page.goto("/fire-sanbo/");
    await quickRun(page);

    // 初期成功率をaria-labelから取得（例: "FIRE成功確率 72パーセント"）
    const rateStatus = page.locator("[role=status][aria-label*=成功確率]");
    await expect(rateStatus).toBeVisible();
    const initialLabel = await rateStatus.getAttribute("aria-label");
    expect(initialLabel).toBeTruthy();

    // 月間生活費スライダーを最小値(10万)に変更 → 成功率が上がるはず
    // 「月間生活費」テキストを含む space-y-2 divの中のslider
    const expenseSection = page.locator("div.space-y-2", { hasText: "月間生活費" });
    const slider = expenseSection.getByRole("slider");
    await slider.fill("100000");

    // 再計算完了を待つ: aria-labelの値が変化するまで待機
    await expect(rateStatus).not.toHaveAttribute("aria-label", initialLabel!, { timeout: 10000 });

    // 成功率テキストが引き続き表示されている
    await expect(page.getByText("成功確率")).toBeVisible();
  });
});
