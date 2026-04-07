"use client";

import {
  ExternalLink,
  Link2,
  Loader2,
  PanelLeft,
  PanelRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useGitPanel } from "./git-panel-context";
import type { SandboxInfo } from "./session-chat-context";

type SessionHeaderProps = {
  session: {
    id: string;
    title: string;
    repoName: string | null;
    repoOwner: string | null;
    cloneUrl: string | null;
    branch: string | null;
  };
  chatId: string;
  sandboxInfo: SandboxInfo | null;
  isSandboxActive: boolean;
  isCreatingSandbox: boolean;
  isRestoringSnapshot: boolean;
  isReconnectingSandbox: boolean;
  isHibernating: boolean;
  onShareClick: () => void;
};

function SandboxDot({
  sandboxInfo,
  isActive,
  isCreating,
  isRestoring,
  isReconnecting,
  isHibernating,
}: {
  sandboxInfo: SandboxInfo | null;
  isActive: boolean;
  isCreating: boolean;
  isRestoring: boolean;
  isReconnecting: boolean;
  isHibernating: boolean;
}) {
  if (isCreating || isRestoring || isReconnecting || isHibernating) {
    const transitionLabel = isHibernating
      ? "Hibernating sandbox..."
      : isReconnecting
        ? "Reconnecting sandbox..."
        : "Creating sandbox...";

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center">
            <Loader2 className="size-3 animate-spin text-yellow-500" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          {isRestoring ? "Restoring sandbox..." : transitionLabel}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!sandboxInfo || !isActive) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center p-0.5">
            <span className="size-2 rounded-full bg-muted-foreground/40" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={8}>
          Sandbox inactive
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center p-0.5">
          <span className="size-2 rounded-full bg-green-500" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        Sandbox active
      </TooltipContent>
    </Tooltip>
  );
}

export function SessionHeader({
  session,
  chatId,
  sandboxInfo,
  isSandboxActive,
  isCreatingSandbox,
  isRestoringSnapshot,
  isReconnectingSandbox,
  isHibernating,
  onShareClick,
}: SessionHeaderProps) {
  const { toggleSidebar } = useSidebar();
  const { gitPanelOpen, toggleGitPanel } = useGitPanel();

  return (
    <header className="border-b border-border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        {/* Left side: panel toggle + repo/branch + sandbox dot */}
        <div className="flex min-w-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={toggleSidebar}
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Toggle sidebar</TooltipContent>
          </Tooltip>

          <div className="flex min-w-0 items-center gap-1.5 text-sm">
            {session.repoName && (
              <div className="hidden min-w-0 items-center gap-1.5 sm:flex">
                {session.cloneUrl ? (
                  /* oxlint-disable-next-line nextjs/no-html-link-for-pages */
                  <a
                    href={`https://github.com/${session.repoOwner}/${session.repoName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 truncate font-medium text-foreground hover:underline"
                  >
                    {session.repoName}
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </a>
                ) : (
                  <span className="truncate font-medium text-foreground">
                    {session.repoName}
                  </span>
                )}
                {session.branch && (
                  <>
                    <span className="text-muted-foreground/40">/</span>
                    <span className="truncate text-muted-foreground">
                      {session.branch}
                    </span>
                  </>
                )}
                <span className="text-muted-foreground/40">/</span>
              </div>
            )}
            <span className="truncate font-medium text-foreground sm:font-normal sm:text-muted-foreground">
              {session.title}
            </span>

            <SandboxDot
              sandboxInfo={sandboxInfo}
              isActive={isSandboxActive}
              isCreating={isCreatingSandbox}
              isRestoring={isRestoringSnapshot}
              isReconnecting={isReconnectingSandbox}
              isHibernating={isHibernating}
            />

            {/* Share link icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onShareClick}
                  className="ml-1 rounded p-1 text-muted-foreground/60 transition-colors hover:text-foreground"
                >
                  <Link2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Share chat</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Right side: git panel toggle */}
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 shrink-0",
                  gitPanelOpen && "bg-accent text-accent-foreground",
                )}
                onClick={toggleGitPanel}
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Toggle git panel</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
