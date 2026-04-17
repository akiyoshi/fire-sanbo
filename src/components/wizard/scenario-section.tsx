import { useState, useRef } from "react";
import type { FormState } from "@/lib/form-state";
import type { Scenario } from "@/lib/form-state";
import {
  loadScenarios,
  saveScenario,
  updateScenario,
  deleteScenario,
  exportFormToJSON,
  importFormFromJSON,
  saveForm,
} from "@/lib/form-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ScenarioSectionProps {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  activeScenarioId: string | null;
  setActiveScenarioId: (id: string | null) => void;
}

export function ScenarioSection({
  form,
  setForm,
  activeScenarioId,
  setActiveScenarioId,
}: ScenarioSectionProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>(() => loadScenarios());
  const [scenarioName, setScenarioName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveScenario = () => {
    if (!scenarioName.trim()) return;
    const scenario = saveScenario(scenarioName.trim(), form);
    setScenarios(loadScenarios());
    setActiveScenarioId(scenario.id);
    setScenarioName("");
    setShowSaveDialog(false);
  };

  const handleUpdateScenario = () => {
    if (!activeScenarioId) return;
    updateScenario(activeScenarioId, form);
    setScenarios(loadScenarios());
  };

  const handleLoadScenario = (scenario: Scenario) => {
    setForm(scenario.form);
    saveForm(scenario.form);
    setActiveScenarioId(scenario.id);
  };

  const handleDeleteScenario = (id: string) => {
    deleteScenario(id);
    setScenarios(loadScenarios());
    if (activeScenarioId === id) setActiveScenarioId(null);
  };

  const handleExport = () => {
    const json = exportFormToJSON(form);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fire-sanbo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = importFormFromJSON(reader.result as string);
      if (imported) {
        setForm(imported);
        saveForm(imported);
        setActiveScenarioId(null);
      } else {
        alert("無効なファイルです。FIRE参謀のエクスポートファイルを選択してください。");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        {activeScenarioId && (
          <Button variant="outline" size="sm" onClick={handleUpdateScenario}>
            上書き保存
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(!showSaveDialog)}>
          名前を付けて保存
        </Button>
      </div>
      {showSaveDialog && (
        <div className="flex gap-2">
          <Input
            placeholder="シナリオ名（例: 現状維持、転職ケース）"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveScenario()}
            className="flex-1"
          />
          <Button size="sm" onClick={handleSaveScenario} disabled={!scenarioName.trim()}>
            保存
          </Button>
        </div>
      )}
      {scenarios.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                s.id === activeScenarioId
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted"
              }`}
              onClick={() => handleLoadScenario(s)}
            >
              <span>{s.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteScenario(s.id);
                }}
                className="ml-1 opacity-50 hover:opacity-100"
                aria-label={`${s.name}を削除`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          保存済みシナリオはありません。「名前を付けて保存」でパラメータセットを保存できます。
        </p>
      )}
      <div className="flex gap-3">
        <Button variant="ghost" size="sm" onClick={handleExport}>
          📥 エクスポート
        </Button>
        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
          📤 インポート
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
      </div>
    </div>
  );
}
