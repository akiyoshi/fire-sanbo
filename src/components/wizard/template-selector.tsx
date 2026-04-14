import type { FormState } from "@/lib/form-state";
import { SCENARIO_TEMPLATES, applyTemplate } from "@/config/scenario-templates";
import type { ScenarioTemplate } from "@/config/scenario-templates";
import { Card, CardContent } from "@/components/ui/card";
import { Briefcase, Home, GraduationCap, Palmtree, Clock } from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  Briefcase: <Briefcase className="h-5 w-5" aria-hidden="true" />,
  Home: <Home className="h-5 w-5" aria-hidden="true" />,
  GraduationCap: <GraduationCap className="h-5 w-5" aria-hidden="true" />,
  Palmtree: <Palmtree className="h-5 w-5" aria-hidden="true" />,
  Clock: <Clock className="h-5 w-5" aria-hidden="true" />,
};

interface TemplateSelectorProps {
  form: FormState;
  setForm: (form: FormState) => void;
  onOpenSections: (sections: string[]) => void;
}

export function TemplateSelector({ form, setForm, onOpenSections }: TemplateSelectorProps) {
  const handleSelect = (template: ScenarioTemplate) => {
    const next = applyTemplate(form, template);
    setForm(next);
    onOpenSections(template.openSections);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground px-1">
        テンプレートから始める
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {SCENARIO_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleSelect(t)}
            className="text-left focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl"
          >
            <Card className="h-full hover:ring-2 hover:ring-primary/50 transition-all cursor-pointer" size="sm">
              <CardContent className="flex flex-col items-center gap-1.5 py-3 px-2 text-center">
                <span className="text-primary">{ICON_MAP[t.icon]}</span>
                <span className="text-sm font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground leading-tight">{t.description}</span>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
