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
      className={`w-full min-w-0 overflow-x-auto overflow-y-hidden border-b border-border no-scrollbar ${className}`}
      role="tablist"
    >
      <div className="flex w-max min-w-full items-stretch gap-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`relative inline-flex min-h-[48px] flex-none items-center justify-center gap-2 whitespace-nowrap px-3 py-3 text-xs sm:px-4 sm:text-sm font-semibold leading-5 transition-colors focus:outline-none focus-visible:text-primary ${isActive ? 'text-fg' : 'text-fg-muted hover:text-fg'}`}
            >
              {tab.icon && <span className="inline-flex h-4 w-4 flex-none items-center justify-center">{tab.icon}</span>}
              <span className="inline-block flex-none">{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`inline-flex flex-none items-center rounded-full px-2 py-0.5 text-xs font-medium leading-4 ${
                    isActive ? 'bg-primary/20 text-primary-text' : 'bg-surface-hover text-fg-muted'
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {isActive && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-blue-500 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
