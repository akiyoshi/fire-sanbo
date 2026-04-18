import { test, expect } from "@playwright/test";

// 基本情報カード内の入力を操作するヘルパー
async function quickRun(page: import("@playwright/test").Page) {
  await page.getByLabel("年収（税引き前）").fill("6000000");
  await page.getByRole("button", { name: "すぐにシミュレーション" }).click();
  await expect(page.getByText("成功確率")).toBeVisible({ timeout: 15000 });
}

test.describe("FIRE参謀 E2E", () => {
  test("QuickStart → 結果画面 → 成功率表示", async ({ page }) => {
    await page.goto("/fire-sanbo/");
    await quickRun(page);

    // チャートが描画される
    await expect(page.getByRole("img", { name: /^資産推移チャート/ })).toBeVisible({ timeout: 10000 });

    // 処方箋カードを展開できる
    await page.locator("summary").filter({ hasText: "処方箋" }).click();
    await expect(page.getByRole("heading", { name: "処方箋" })).toBeVisible();
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
});
