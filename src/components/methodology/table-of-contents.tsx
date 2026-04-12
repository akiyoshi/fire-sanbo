import { useMemo } from "react";
import { useActiveSection } from "./use-active-section";

export interface TocGroup {
  label: string;
  anchorId: string;
  sections: { id: string; label: string }[];
}

interface TableOfContentsProps {
  groups: TocGroup[];
}

export function TableOfContents({ groups }: TableOfContentsProps) {
  const allIds = useMemo(
    () => groups.flatMap((g) => [g.anchorId, ...g.sections.map((s) => s.id)]),
    [groups],
  );
  const activeId = useActiveSection(allIds);

  return (
    <nav aria-label="目次" className="space-y-4 text-sm">
      {groups.map((group) => (
        <div key={group.anchorId}>
          <a
            href={`#${group.anchorId}`}
            className="font-medium text-foreground hover:text-primary transition-colors"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(group.anchorId)?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            {group.label}
          </a>
          <ul className="mt-1 space-y-0.5 border-l border-border pl-3">
            {group.sections.map((sec) => (
              <li key={sec.id}>
                <a
                  href={`#${sec.id}`}
                  className={`block py-0.5 transition-colors ${
                    activeId === sec.id
                      ? "text-primary font-medium border-l-2 border-primary -ml-[13px] pl-[11px]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(sec.id)?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {sec.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** モバイル用の目次カード(ページトップ表示) */
export function MobileToc({ groups }: TableOfContentsProps) {
  return (
    <details className="lg:hidden bg-muted rounded-lg p-4 mb-6">
      <summary className="cursor-pointer font-medium text-sm">📋 目次</summary>
      <nav aria-label="目次" className="mt-3 space-y-3 text-sm">
        {groups.map((group) => (
          <div key={group.anchorId}>
            <a
              href={`#${group.anchorId}`}
              className="font-medium text-foreground"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(group.anchorId)?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {group.label}
            </a>
            <ul className="mt-1 space-y-0.5 pl-4">
              {group.sections.map((sec) => (
                <li key={sec.id}>
                  <a
                    href={`#${sec.id}`}
                    className="text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(sec.id)?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    {sec.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </details>
  );
}
