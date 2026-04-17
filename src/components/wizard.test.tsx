import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FORM } from "@/lib/form-state";
import { Wizard } from "./wizard";

describe("Wizard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders quick start and submits edited values", async () => {
    const onComplete = vi.fn();

    await act(async () => {
      render(<Wizard onComplete={onComplete} />);
    });

    const quickStart = screen.getByRole("region", { name: "クイックスタート" });
    expect(within(quickStart).getByRole("heading", { name: "まずは3項目で試してみる" })).toBeInTheDocument();
    expect(within(quickStart).getByLabelText("現在の資産総額")).toBeInTheDocument();

    fireEvent.change(within(quickStart).getByLabelText("年収（税引き前）"), { target: { value: "7000000" } });
    fireEvent.change(within(quickStart).getByLabelText("現在の資産総額"), { target: { value: "12300000" } });

    fireEvent.click(within(quickStart).getByRole("button", { name: "すぐにシミュレーション" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        currentAge: DEFAULT_FORM.currentAge,
        annualSalary: 7_000_000,
        portfolio: [
          expect.objectContaining({ amount: 12_300_000 }),
        ],
      }),
    );
  });

  it("disables quick start when the full-form validation fails", async () => {
    const onComplete = vi.fn();

    await act(async () => {
      render(<Wizard onComplete={onComplete} />);
    });

    fireEvent.change(screen.getByLabelText("月間生活費"), { target: { value: "0" } });

    const quickStart = screen.getByRole("region", { name: "クイックスタート" });
    const quickRunButton = within(quickStart).getByRole("button", { name: "すぐにシミュレーション" });

    expect(quickRunButton).toBeDisabled();
    fireEvent.click(quickRunButton);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("keeps the entered total assets consistent for multi-row portfolios", async () => {
    const onComplete = vi.fn();
    localStorage.setItem(
      "fire-sanbo-form",
      JSON.stringify({
        version: 5,
        form: {
          ...DEFAULT_FORM,
          portfolio: [
            { id: "row-1", assetClass: "developed_stock", taxCategory: "nisa", amount: 6_000_000 },
            { id: "row-2", assetClass: "domestic_bond", taxCategory: "tokutei", amount: 4_000_000 },
          ],
        },
      }),
    );

    await act(async () => {
      render(<Wizard onComplete={onComplete} />);
    });

    const quickStart = screen.getByRole("region", { name: "クイックスタート" });
    fireEvent.change(within(quickStart).getByLabelText("現在の資産総額"), { target: { value: "0" } });
    fireEvent.change(within(quickStart).getByLabelText("現在の資産総額"), { target: { value: "12000000" } });
    fireEvent.click(within(quickStart).getByRole("button", { name: "すぐにシミュレーション" }));

    expect(onComplete).toHaveBeenCalledTimes(1);

    const submittedForm = onComplete.mock.calls[0][0];
    const submittedTotal = submittedForm.portfolio.reduce((sum: number, entry: { amount: number }) => sum + entry.amount, 0);

    expect(submittedTotal).toBe(12_000_000);
    expect(submittedForm.portfolio).toEqual([
      expect.objectContaining({ amount: 7_200_000 }),
      expect.objectContaining({ amount: 4_800_000 }),
    ]);
  });

  it("preserves multi-row weights when editing total assets directly", async () => {
    const onComplete = vi.fn();
    localStorage.setItem(
      "fire-sanbo-form",
      JSON.stringify({
        version: 5,
        form: {
          ...DEFAULT_FORM,
          portfolio: [
            { id: "row-1", assetClass: "developed_stock", taxCategory: "nisa", amount: 6_000_000 },
            { id: "row-2", assetClass: "domestic_bond", taxCategory: "tokutei", amount: 4_000_000 },
          ],
        },
      }),
    );

    await act(async () => {
      render(<Wizard onComplete={onComplete} />);
    });

    const quickStart = screen.getByRole("region", { name: "クイックスタート" });
    fireEvent.change(within(quickStart).getByLabelText("現在の資産総額"), { target: { value: "12000000" } });
    fireEvent.click(within(quickStart).getByRole("button", { name: "すぐにシミュレーション" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].portfolio).toEqual([
      expect.objectContaining({ amount: 7_200_000 }),
      expect.objectContaining({ amount: 4_800_000 }),
    ]);
  });
});