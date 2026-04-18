import type { FormState, Scenario } from "./types";

const SCENARIOS_KEY = "fire-sanbo-scenarios";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function loadScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Scenario[];
  } catch {
    return [];
  }
}

export function saveScenarios(scenarios: Scenario[]): void {
  try {
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify(scenarios));
  } catch {
    // localStorage 満杯等 → 無視
  }
}

export function saveScenario(name: string, form: FormState): Scenario {
  const scenarios = loadScenarios();
  const now = new Date().toISOString();
  const scenario: Scenario = { id: generateId(), name, form, createdAt: now, updatedAt: now };
  scenarios.push(scenario);
  saveScenarios(scenarios);
  return scenario;
}

export function updateScenario(id: string, form: FormState): void {
  const scenarios = loadScenarios();
  const idx = scenarios.findIndex((s) => s.id === id);
  if (idx >= 0) {
    scenarios[idx] = { ...scenarios[idx], form, updatedAt: new Date().toISOString() };
    saveScenarios(scenarios);
  }
}

export function deleteScenario(id: string): void {
  const scenarios = loadScenarios().filter((s) => s.id !== id);
  saveScenarios(scenarios);
}
