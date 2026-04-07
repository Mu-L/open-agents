"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";

export type GitPanelTab = "info" | "checks";
export type ActiveView = "chat" | "diff";

type GitPanelContextValue = {
  /** Whether the right git panel is open */
  gitPanelOpen: boolean;
  setGitPanelOpen: (open: boolean) => void;
  toggleGitPanel: () => void;

  /** Active tab within the git panel */
  gitPanelTab: GitPanelTab;
  setGitPanelTab: (tab: GitPanelTab) => void;

  /** Active view in the main content area (chat messages vs diff) */
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
};

const GitPanelContext = createContext<GitPanelContextValue | undefined>(
  undefined,
);

export function GitPanelProvider({ children }: { children: ReactNode }) {
  const [gitPanelOpen, setGitPanelOpen] = useState(false);
  const [gitPanelTab, setGitPanelTab] = useState<GitPanelTab>("info");
  const [activeView, setActiveView] = useState<ActiveView>("chat");

  const toggleGitPanel = useCallback(() => {
    setGitPanelOpen((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      gitPanelOpen,
      setGitPanelOpen,
      toggleGitPanel,
      gitPanelTab,
      setGitPanelTab,
      activeView,
      setActiveView,
    }),
    [gitPanelOpen, toggleGitPanel, gitPanelTab, activeView],
  );

  return (
    <GitPanelContext.Provider value={value}>
      {children}
    </GitPanelContext.Provider>
  );
}

export function useGitPanel() {
  const context = useContext(GitPanelContext);
  if (!context) {
    throw new Error("useGitPanel must be used within a GitPanelProvider");
  }
  return context;
}
