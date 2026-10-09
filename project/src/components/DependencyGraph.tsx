import { useMemo } from 'react';
import { Link2, Circle } from 'lucide-react';
import type { CareAction } from '@/types/consultation';
import { ACTION_TYPE_META } from '@/types/consultation';

interface DependencyGraphProps {
  actions: CareAction[];
}

export function DependencyGraph({ actions }: DependencyGraphProps) {
  const { levels, hasDependencies } = useMemo(() => {
    const visited = new Map<string, number>();

    const getLevel = (action: CareAction): number => {
      if (visited.has(action.title)) return visited.get(action.title)!;
      if (!action.depends_on) {
        visited.set(action.title, 0);
        return 0;
      }
      const parent = actions.find((a) => a.title === action.depends_on);
      const level = parent ? getLevel(parent) + 1 : 0;
      visited.set(action.title, level);
      return level;
    };

    actions.forEach((a) => getLevel(a));

    const maxLevel = Math.max(0, ...Array.from(visited.values()));
    const levelsArr: CareAction[][] = Array.from({ length: maxLevel + 1 }, () => []);
    actions.forEach((a) => {
      const lvl = visited.get(a.title) || 0;
      levelsArr[lvl].push(a);
    });

    return { levels: levelsArr, hasDependencies: actions.some((a) => a.depends_on) };
  }, [actions]);

  if (!hasDependencies) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-secondary-200 bg-white p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-5">
        <Link2 className="h-5 w-5 text-primary-500" />
        <h3 className="text-base font-semibold text-secondary-900">Dependency Graph</h3>
        <span className="text-xs text-secondary-400 ml-1">Actions execute in order</span>
      </div>

      <div className="flex gap-6 overflow-x-auto pb-2">
        {levels.map((levelActions, levelIdx) => (
          <div key={levelIdx} className="flex flex-col items-center gap-3 min-w-[180px]">
            <div className="text-xs font-medium text-secondary-400 mb-1">
              {levelIdx === 0 ? 'Start' : `Step ${levelIdx + 1}`}
            </div>
            {levelActions.map((action) => {
              const meta = ACTION_TYPE_META[action.type] || ACTION_TYPE_META.review;
              return (
                <div
                  key={action.title}
                  className={`w-full rounded-xl border ${meta.borderColor} bg-white px-4 py-3 shadow-sm transition-all hover:shadow-md`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${meta.dotColor} flex-shrink-0`} />
                    <span className="text-xs font-medium text-secondary-800 line-clamp-2">
                      {action.title}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.color} ${meta.bgColor}`}>
                      {meta.label}
                    </span>
                  </div>
                </div>
              );
            })}
            {levelIdx < levels.length - 1 && (
              <div className="flex items-center justify-center mt-1">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="h-4 w-px bg-secondary-300" />
                  <Circle className="h-2 w-2 text-secondary-400 fill-secondary-400" />
                  <div className="h-4 w-px bg-secondary-300" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
