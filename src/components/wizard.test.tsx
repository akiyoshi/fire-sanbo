import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FORM } from "@/lib/form-state";
import { Wizard } from "./wizard";

describe("Wizard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders basic info and submits with quick run button", async () => {
    const onComplete = vi.fn();

    await act(async () => {
      render(<Wizard onComplete={onComplete} />);
    });

    expect(screen.getByRole("heading", { name: "基本情報" })).toBeInTheDocument();
    expect(screen.getByLabelText("年収（税引き前）")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("年収（税引き前）"), { target: { value: "7000000" } });

    fireEvent.click(screen.getByRole("button", { name: "すぐにシミュレーション" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        currentAge: DEFAULT_FORM.currentAge,
        annualSalary: 7_000_000,
      }),
    );
  });

  it("disables quick run when validation fails", async () => {
    const onComplete = vi.fn();

    await act(async () => {
      render(<Wizard onComplete={onComplete} />);
    });

    fireEvent.change(screen.getByLabelText("月間生活費"), { target: { value: "0" } });

    const quickRunButton = screen.getByRole("button", { name: "すぐにシミュレーション" });

    expect(quickRunButton).toBeDisabled();
    fireEvent.click(quickRunButton);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("submits via sticky CTA button", async () => {
    const onComplete = vi.fn();

    await act(async () => {
      render(<Wizard onComplete={onComplete} />);
    });

    fireEvent.click(screen.getByRole("button", { name: "シミュレーション開始" }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        currentAge: DEFAULT_FORM.currentAge,
      }),
    );
  });

  it("renders collapsible sections", async () => {
    const onComplete = vi.fn();

    await act(async () => {
      render(<Wizard onComplete={onComplete} />);
    });

    // Collapsible section titles should be visible
    expect(screen.getByText("年金・退職金・副収入")).toBeInTheDocument();
    expect(screen.getByText("ライフイベント")).toBeInTheDocument();
    expect(screen.getByText("詳細設定")).toBeInTheDocument();
    expect(screen.getByText("シナリオ管理")).toBeInTheDocument();
  });
});