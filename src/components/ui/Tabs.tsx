import React from 'react';

interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div
      className={`w-full min-w-0 border-b border-border pb-2 ${className}`}
      role="tablist"
      aria-label="Admin sections"
    >
      <div className="grid w-full min-w-0 grid-cols-1 min-[520px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`relative flex min-h-11 min-w-0 w-full items-center justify-center gap-2 rounded-lg border px-2.5 py-2 text-center text-xs sm:text-sm font-semibold leading-5 whitespace-normal break-words transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                isActive
                  ? 'border-primary/40 bg-primary/10 text-fg'
                  : 'border-transparent text-fg-muted hover:border-border hover:bg-surface-hover hover:text-fg'
              }`}
            >
              {tab.icon && (
                <span className="inline-flex h-4 w-4 flex-none items-center justify-center" aria-hidden="true">
                  {tab.icon}
                </span>
              )}
              <span className="min-w-0 [overflow-wrap:anywhere]">{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`inline-flex flex-none items-center rounded-full px-2 py-0.5 text-xs font-medium leading-4 ${
                    isActive ? 'bg-primary/20 text-primary-text' : 'bg-surface-hover text-fg-muted'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
