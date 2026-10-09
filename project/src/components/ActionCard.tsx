import {
  Pill,
  FlaskConical,
  Stethoscope,
  ClipboardList,
  Calendar,
  Link2,
  ArrowRight,
} from 'lucide-react';
import type { CareAction } from '@/types/consultation';
import { ACTION_TYPE_META } from '@/types/consultation';

const ICON_MAP = {
  Pill,
  FlaskConical,
  Stethoscope,
  ClipboardList,
};

interface ActionCardProps {
  action: CareAction;
  index: number;
}

export function ActionCard({ action, index }: ActionCardProps) {
  const meta = ACTION_TYPE_META[action.type] || ACTION_TYPE_META.review;
  const Icon = ICON_MAP[meta.icon as keyof typeof ICON_MAP] || ClipboardList;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (action.due_days_from_today || 0));
  const dueDateStr = dueDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isOverdue = action.due_days_from_today === 0;
  const dueLabel = action.due_days_from_today === 0
    ? 'Today'
    : action.due_days_from_today === 1
    ? 'Tomorrow'
    : `In ${action.due_days_from_today} days`;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border ${meta.borderColor} ${meta.bgColor} p-5 transition-all duration-300 hover:shadow-md animate-slide-up`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${meta.color} bg-white/60`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-secondary-900 text-sm leading-snug">
              {action.title}
            </h4>
            <div className="mt-1.5 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color} bg-white/70`}>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dotColor}`} />
                {meta.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-secondary-600">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-secondary-400" />
          <span className="font-medium">{dueLabel}</span>
          <span className="text-secondary-400">·</span>
          <span>{dueDateStr}</span>
          {isOverdue && (
            <span className="ml-1 rounded-full bg-error-100 px-1.5 py-0.5 text-[10px] font-semibold text-error-600">
              URGENT
            </span>
          )}
        </span>
      </div>

      {action.depends_on && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-white/50 px-3 py-2 text-xs text-secondary-600">
          <Link2 className="h-3.5 w-3.5 text-secondary-400" />
          <span>Depends on:</span>
          <span className="font-medium text-secondary-700">{action.depends_on}</span>
          <ArrowRight className="h-3 w-3 text-secondary-400 ml-auto rotate-[-30deg]" />
        </div>
      )}
    </div>
  );
}
