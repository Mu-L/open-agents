"use client";

import { useMemo } from "react";
import {
  Archive,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Loader2,
  Monitor,
} from "lucide-react";
import type { SessionWithUnread } from "@/hooks/use-sessions";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SessionsKanbanBoardProps = {
  sessions: SessionWithUnread[];
  onSessionClick: (session: SessionWithUnread) => void;
  onArchiveSession: (sessionId: string) => Promise<void>;
};

type ColumnDef = {
  id: string;
  title: string;
  sessions: SessionWithUnread[];
};

function getSessionIcon(session: SessionWithUnread) {
  if (session.hasStreaming) {
    return (
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
    );
  }
  if (session.prStatus === "merged") {
    return <GitMerge className="h-3.5 w-3.5 shrink-0 text-purple-500" />;
  }
  if (session.prStatus === "open") {
    return (
      <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-green-500" />
    );
  }
  if (session.prStatus === "closed") {
    return <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-red-500" />;
  }
  if (
    session.branch &&
    (session.linesAdded || session.linesRemoved)
  ) {
    return <GitBranch className="h-3.5 w-3.5 shrink-0 text-amber-500" />;
  }
  if (session.branch) {
    return (
      <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
    );
  }
  return (
    <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
  );
}

function getCardAccent(session: SessionWithUnread): string {
  if (session.hasStreaming) return "border-l-cyan-500";
  if (session.hasUnread && !session.hasStreaming) return "border-l-amber-500";
  if (session.prStatus === "open") return "border-l-green-500";
  if (session.prStatus === "merged") return "border-l-purple-500";
  return "border-l-transparent";
}

function categorizeSessions(sessions: SessionWithUnread[]): ColumnDef[] {
  const inProgress: SessionWithUnread[] = [];
  const inReview: SessionWithUnread[] = [];
  const done: SessionWithUnread[] = [];

  for (const session of sessions) {
    if (session.status === "archived") continue;

    if (session.prNumber && session.prStatus === "merged") {
      done.push(session);
    } else if (session.prNumber && session.prStatus === "open") {
      inReview.push(session);
    } else {
      inProgress.push(session);
    }
  }

  // Sort In Progress: streaming first, then unread, then by lastActivityAt
  inProgress.sort((a, b) => {
    if (a.hasStreaming && !b.hasStreaming) return -1;
    if (!a.hasStreaming && b.hasStreaming) return 1;
    if (a.hasUnread && !b.hasUnread) return -1;
    if (!a.hasUnread && b.hasUnread) return 1;
    const aTime = new Date(a.lastActivityAt).getTime();
    const bTime = new Date(b.lastActivityAt).getTime();
    return bTime - aTime;
  });

  // Sort others by lastActivityAt descending
  inReview.sort(
    (a, b) =>
      new Date(b.lastActivityAt).getTime() -
      new Date(a.lastActivityAt).getTime(),
  );
  done.sort(
    (a, b) =>
      new Date(b.lastActivityAt).getTime() -
      new Date(a.lastActivityAt).getTime(),
  );

  return [
    { id: "in-progress", title: "In Progress", sessions: inProgress },
    { id: "in-review", title: "In Review", sessions: inReview },
    { id: "done", title: "Done", sessions: done },
  ];
}

function SessionCard({
  session,
  columnId,
  onSessionClick,
  onArchiveSession,
}: {
  session: SessionWithUnread;
  columnId: string;
  onSessionClick: (session: SessionWithUnread) => void;
  onArchiveSession: (sessionId: string) => Promise<void>;
}) {
  const accent = getCardAccent(session);
  const needsAttention = session.hasUnread && !session.hasStreaming;
  const hasDiff = Boolean(session.linesAdded || session.linesRemoved);
  const prUrl =
    session.prNumber && session.repoOwner && session.repoName
      ? `https://github.com/${session.repoOwner}/${session.repoName}/pull/${session.prNumber}`
      : null;

  return (
    <button
      type="button"
      onClick={() => onSessionClick(session)}
      className={`group relative w-full cursor-pointer rounded-lg border border-border/50 border-l-2 bg-card text-left transition-all hover:border-border hover:bg-accent/50 ${accent}`}
    >
      <div className="space-y-2.5 p-3.5">
        {/* Header: icon + title */}
        <div className="flex items-start gap-2">
          <div className="mt-0.5">{getSessionIcon(session)}</div>
          <span className="line-clamp-2 flex-1 text-sm font-medium leading-snug text-foreground">
            {session.title || "Untitled session"}
          </span>
          {needsAttention && (
            <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              New
            </span>
          )}
        </div>

        {/* Repo */}
        {session.repoOwner && session.repoName && (
          <p className="truncate text-xs text-muted-foreground">
            {session.repoOwner}/{session.repoName}
          </p>
        )}

        {/* Branch */}
        {session.branch && (
          <p className="truncate font-mono text-[11px] text-muted-foreground/70">
            {session.branch}
          </p>
        )}

        {/* Bottom row: diff stats, PR, time, archive */}
        <div className="flex items-center gap-2 text-[11px]">
          {hasDiff && (
            <span className="flex items-center gap-1">
              {session.linesAdded ? (
                <span className="text-green-400">+{session.linesAdded}</span>
              ) : null}
              {session.linesRemoved ? (
                <span className="text-red-400">-{session.linesRemoved}</span>
              ) : null}
            </span>
          )}

          {prUrl && (
            <a
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              #{session.prNumber}
            </a>
          )}

          <span className="ml-auto text-muted-foreground/60">
            {formatRelativeTime(session.lastActivityAt)}
          </span>

          {columnId === "done" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onArchiveSession(session.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      void onArchiveSession(session.id);
                    }
                  }}
                  className="rounded p-0.5 text-muted-foreground/40 opacity-0 transition-all hover:bg-muted hover:text-muted-foreground group-hover:opacity-100"
                >
                  <Archive className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Archive</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </button>
  );
}

function KanbanColumn({
  column,
  onSessionClick,
  onArchiveSession,
}: {
  column: ColumnDef;
  onSessionClick: (session: SessionWithUnread) => void;
  onArchiveSession: (sessionId: string) => Promise<void>;
}) {
  return (
    <div className="flex h-full w-80 shrink-0 flex-col rounded-xl border border-border/30 bg-muted/20">
      {/* Column header */}
      <div className="flex items-center gap-2 border-b border-border/20 px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {column.title}
        </span>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted/60 px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {column.sessions.length}
        </span>
      </div>

      {/* Card list */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
        {column.sessions.length === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <p className="text-xs text-muted-foreground/40">No sessions</p>
          </div>
        ) : (
          column.sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              columnId={column.id}
              onSessionClick={onSessionClick}
              onArchiveSession={onArchiveSession}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function SessionsKanbanBoard({
  sessions,
  onSessionClick,
  onArchiveSession,
}: SessionsKanbanBoardProps) {
  const columns = useMemo(() => categorizeSessions(sessions), [sessions]);

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
        <SidebarTrigger />
        <h1 className="text-sm font-semibold tracking-tight text-foreground">
          Board
        </h1>
      </div>

      {/* Board */}
      <div className="flex flex-1 gap-4 overflow-x-auto p-4">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            onSessionClick={onSessionClick}
            onArchiveSession={onArchiveSession}
          />
        ))}
      </div>
    </div>
  );
}
