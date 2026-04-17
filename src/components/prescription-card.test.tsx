import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FORM, formToSimulationInput } from "@/lib/form-state";
import type { PrescriptionResult } from "@/lib/prescription";
import type { SimulationWorker } from "@/lib/simulation";
import { PrescriptionCard } from "./prescription-card";

vi.mock("@/components/ui/slider", () => ({
  Slider: ({
    value,
    onValueChange,
    min,
    max,
    step,
    "aria-label": ariaLabel,
  }: {
    value?: number[];
    onValueChange: (value: number[]) => void;
    min?: number;
    max?: number;
    step?: number;
    "aria-label"?: string;
  }) => (
    <input
      aria-label={ariaLabel}
      type="range"
      min={min}
      max={max}
      step={step}
      value={Array.isArray(value) ? value[0] : 0}
      onChange={(event) => onValueChange([Number(event.target.value)])}
    />
  ),
}));

const RESULT: PrescriptionResult = {
  targetRate: 0.95,
  currentRate: 0.5,
  alreadyAchieved: false,
  prescriptions: [],
};

function createWorker() {
  const prescribe = vi.fn().mockResolvedValue(RESULT);
  return {
    worker: { prescribe } as unknown as SimulationWorker,
    prescribe,
  };
}

describe("PrescriptionCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("keeps the selected target rate when input changes", async () => {
    const { worker, prescribe } = createWorker();
    const initialInput = formToSimulationInput(DEFAULT_FORM);
    const { rerender } = render(
      <PrescriptionCard worker={worker} input={initialInput} currentRate={0.5} />,
    );

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    prescribe.mockClear();

    fireEvent.change(screen.getByLabelText("目標成功率"), {
      target: { value: "95" },
    });

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(prescribe).toHaveBeenLastCalledWith(initialInput, 0.95, expect.any(Number), undefined);

    prescribe.mockClear();

    const updatedInput = formToSimulationInput({
      ...DEFAULT_FORM,
      annualSalary: DEFAULT_FORM.annualSalary + 1_000,
    });

    rerender(
      <PrescriptionCard worker={worker} input={updatedInput} currentRate={0.5} />,
    );

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(prescribe).toHaveBeenCalledTimes(1);
    expect(prescribe).toHaveBeenLastCalledWith(updatedInput, 0.95, expect.any(Number), undefined);
  });
});