"use client";

import { GitCompare, Plus, X } from "lucide-react";
import { useSessionLayout } from "@/app/sessions/[sessionId]/session-layout-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useGitPanel, type ActiveView } from "./git-panel-context";

type ChatTabsProps = {
  activeChatId: string;
  /** Whether diff data is available */
  hasDiff: boolean;
  /** +/- summary for the diff tab badge */
  diffSummary?: {
    totalAdditions: number;
    totalDeletions: number;
  } | null;
};

export function ChatTabs({
  activeChatId,
  hasDiff,
  diffSummary,
}: ChatTabsProps) {
  const { chats, createChat, switchChat } = useSessionLayout();
  const { activeView, setActiveView } = useGitPanel();

  const handleNewChat = () => {
    const { chat } = createChat();
    switchChat(chat.id);
  };

  const hasDiffChanges =
    diffSummary &&
    (diffSummary.totalAdditions > 0 || diffSummary.totalDeletions > 0);

  return (
    <div className="flex items-center gap-0 border-b border-border bg-muted/30 px-1">
      {/* Chat tabs */}
      <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
        {chats.map((chat) => {
          const isActive =
            chat.id === activeChatId && activeView === "chat";

          return (
            <button
              key={chat.id}
              type="button"
              onClick={() => {
                if (chat.id !== activeChatId) {
                  switchChat(chat.id);
                }
                setActiveView("chat");
              }}
              className={cn(
                "group relative flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="max-w-[120px] truncate">
                {chat.title || "New Chat"}
              </span>
              {chat.hasUnread && (
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}

        {/* Diff tab */}
        {hasDiff && (
          <button
            type="button"
            onClick={() => setActiveView("diff")}
            className={cn(
              "group relative flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-1.5 text-xs font-medium transition-colors",
              activeView === "diff"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <GitCompare className="h-3 w-3" />
            <span>Diff</span>
            {hasDiffChanges && (
              <span className="flex items-center gap-1 text-[10px]">
                <span className="text-green-500">
                  +{diffSummary.totalAdditions}
                </span>
                <span className="text-red-400">
                  -{diffSummary.totalDeletions}
                </span>
              </span>
            )}
          </button>
        )}

        {/* New chat button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleNewChat}
              className="ml-1 flex shrink-0 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New chat</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
