import React from 'react';

export type StatCardColorTheme = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'maroon';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  colorTheme?: StatCardColorTheme;
  subtext?: string;
  onClick?: () => void;
  className?: string;
}

const themeStyles: Record<StatCardColorTheme, { border: string; iconBg: string; text: string; bg: string }> = {
  neutral: {
    border: 'border-gray-200/80',
    iconBg: 'bg-gray-100 text-gray-700',
    text: 'text-gray-900',
    bg: 'bg-white',
  },
  success: {
    border: 'border-emerald-200/80',
    iconBg: 'bg-emerald-50 text-emerald-700',
    text: 'text-emerald-700',
    bg: 'bg-white',
  },
  warning: {
    border: 'border-amber-200/80',
    iconBg: 'bg-amber-50 text-amber-700',
    text: 'text-amber-700',
    bg: 'bg-white',
  },
  danger: {
    border: 'border-red-200/80',
    iconBg: 'bg-red-50 text-red-700',
    text: 'text-red-700',
    bg: 'bg-white',
  },
  info: {
    border: 'border-blue-200/80',
    iconBg: 'bg-blue-50 text-blue-700',
    text: 'text-blue-700',
    bg: 'bg-white',
  },
  purple: {
    border: 'border-purple-200/80',
    iconBg: 'bg-purple-50 text-purple-700',
    text: 'text-purple-700',
    bg: 'bg-white',
  },
  maroon: {
    border: 'border-red-900/20',
    iconBg: 'bg-red-900/10 text-[#5A0000]',
    text: 'text-[#5A0000]',
    bg: 'bg-white',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  colorTheme = 'neutral',
  subtext,
  onClick,
  className = '',
}) => {
  const styles = themeStyles[colorTheme] || themeStyles.neutral;
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-2.5 sm:p-3.5 shadow-xs transition-all ${styles.bg} ${styles.border} ${
        isClickable ? 'cursor-pointer hover:shadow-sm active:scale-98' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-1.5 mb-1">
        <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 truncate">
          {label}
        </span>
        {icon && (
          <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center shrink-0 ${styles.iconBg}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className={`text-base sm:text-lg font-bold tracking-tight ${styles.text}`}>
          {value}
        </span>
        {subtext && (
          <span className="text-[10px] font-medium text-gray-400 truncate">
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatCard;
