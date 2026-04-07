"use client";

import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  FolderGit2,
  GitCommit,
  GitCompare,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Loader2,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useGitPanel, type GitPanelTab } from "./git-panel-context";
import type { DevServerControls } from "./hooks/use-dev-server";
import type { CodeEditorControls } from "./hooks/use-code-editor";

type GitPanelProps = {
  session: {
    id: string;
    repoName: string | null;
    repoOwner: string | null;
    cloneUrl: string | null;
    branch: string | null;
    prNumber: number | null;
    prStatus: string | null;
    linesAdded: number | null;
    linesRemoved: number | null;
  };
  // Git state
  hasRepo: boolean;
  hasExistingPr: boolean;
  existingPrUrl: string | null;
  canCreatePr: boolean;
  isCreatePrBranchReady: boolean;
  showCommitAction: boolean;
  commitActionLabel: string;
  hasUncommittedGitChanges: boolean;
  canMergeAndArchive: boolean;
  canCloseAndArchive: boolean;
  supportsRepoCreation: boolean;
  supportsDiff: boolean;
  hasDiff: boolean;

  // Auto-commit
  isAutoCommitting: boolean;
  isChatReady: boolean;

  // Preview/deployment
  prDeploymentUrl: string | null;
  isDeploymentStale: boolean;
  buildingDeploymentUrl: string | null;

  // Sandbox
  sandboxStatus: { label: string; className: string };
  isArchived: boolean;
  canRunDevServer: boolean;
  devServer: DevServerControls;
  codeEditor: CodeEditorControls;

  // Diff summary
  diffSummary?: {
    totalAdditions: number;
    totalDeletions: number;
  } | null;

  // Actions
  onCommitClick: () => void;
  onCreatePrClick: () => void;
  onMergeClick: () => void;
  onCloseClick: () => void;
  onCreateRepoClick: () => void;
  onDiffClick: () => void;
  onArchiveClick: () => void;
  onUnarchiveClick: () => void;
  isUnarchiving: boolean;
  isArchiveSnapshotPending: boolean;
  onOpenPreview: () => void;
  onOpenPr: () => void;
  onOpenBuildingDeployment: () => void;

  /** Content to render inside the Checks tab */
  checksContent?: React.ReactNode;
};

function PanelSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-3 py-2">
      {title && (
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function PanelActionRow({
  icon: Icon,
  label,
  onClick,
  disabled,
  detail,
  variant = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  detail?: string;
  variant?: "default" | "destructive";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        disabled
          ? "cursor-not-allowed opacity-50"
          : variant === "destructive"
            ? "text-destructive hover:bg-destructive/10"
            : "text-foreground hover:bg-accent",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{label}</span>
        {detail && (
          <span className="truncate text-xs text-muted-foreground">
            {detail}
          </span>
        )}
      </div>
    </button>
  );
}

export function GitPanel(props: GitPanelProps) {
  const { gitPanelOpen, setGitPanelOpen, gitPanelTab, setGitPanelTab } =
    useGitPanel();

  if (!gitPanelOpen) return null;

  const {
    session,
    hasRepo,
    hasExistingPr,
    existingPrUrl,
    canCreatePr,
    isCreatePrBranchReady,
    showCommitAction,
    commitActionLabel,
    hasUncommittedGitChanges,
    canMergeAndArchive,
    canCloseAndArchive,
    supportsRepoCreation,
    supportsDiff,
    hasDiff,
    isAutoCommitting,
    isChatReady,
    prDeploymentUrl,
    isDeploymentStale,
    buildingDeploymentUrl,
    sandboxStatus,
    isArchived,
    canRunDevServer,
    devServer,
    codeEditor,
    diffSummary,
    onCommitClick,
    onCreatePrClick,
    onMergeClick,
    onCloseClick,
    onCreateRepoClick,
    onDiffClick,
    onArchiveClick,
    onUnarchiveClick,
    isUnarchiving,
    isArchiveSnapshotPending,
    onOpenPreview,
    onOpenPr,
    onOpenBuildingDeployment,
    checksContent,
  } = props;

  // Determine primary action button
  const renderPrimaryAction = () => {
    if (hasRepo && showCommitAction) {
      return (
        <Button
          size="sm"
          className="w-full"
          disabled={isAutoCommitting || !isChatReady}
          onClick={onCommitClick}
        >
          {isAutoCommitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GitCommit className="mr-2 h-4 w-4" />
          )}
          {isAutoCommitting ? "Committing..." : commitActionLabel}
        </Button>
      );
    }

    if (hasRepo && hasExistingPr && canMergeAndArchive) {
      return (
        <Button size="sm" className="w-full" onClick={onMergeClick}>
          <GitMerge className="mr-2 h-4 w-4" />
          Merge & Archive
        </Button>
      );
    }

    if (hasRepo && canCreatePr && isCreatePrBranchReady) {
      return (
        <Button size="sm" className="w-full" onClick={onCreatePrClick}>
          <GitPullRequest className="mr-2 h-4 w-4" />
          Create PR
        </Button>
      );
    }

    if (!hasRepo && supportsRepoCreation) {
      return (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={onCreateRepoClick}
        >
          <FolderGit2 className="mr-2 h-4 w-4" />
          Create Repo
        </Button>
      );
    }

    return null;
  };

  const primaryAction = renderPrimaryAction();

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l border-border bg-background xl:w-80">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setGitPanelTab("info")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              gitPanelTab === "info"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Info
          </button>
          <button
            type="button"
            onClick={() => setGitPanelTab("checks")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              gitPanelTab === "checks"
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Checks
          </button>
        </div>
        <button
          type="button"
          onClick={() => setGitPanelOpen(false)}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Primary action button */}
      {primaryAction && (
        <div className="border-b border-border px-3 py-2">{primaryAction}</div>
      )}

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {gitPanelTab === "info" ? (
          <div className="space-y-0">
            {/* Status */}
            <PanelSection title="Status">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    sandboxStatus.className,
                  )}
                >
                  {sandboxStatus.label}
                </span>
              </div>
            </PanelSection>

            <Separator />

            {/* Git info */}
            {hasRepo && (
              <>
                <PanelSection title="Repository">
                  <div className="space-y-1.5 text-sm">
                    {session.repoOwner && session.repoName && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="truncate">
                          {session.repoOwner}/{session.repoName}
                        </span>
                      </div>
                    )}
                    {session.branch && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="truncate font-mono text-xs">
                          {session.branch}
                        </span>
                      </div>
                    )}
                    {diffSummary &&
                      (diffSummary.totalAdditions > 0 ||
                        diffSummary.totalDeletions > 0) && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-600 dark:text-green-500">
                            +{diffSummary.totalAdditions}
                          </span>
                          <span className="text-red-600 dark:text-red-400">
                            -{diffSummary.totalDeletions}
                          </span>
                        </div>
                      )}
                  </div>
                </PanelSection>

                <Separator />
              </>
            )}

            {/* PR info */}
            {hasExistingPr && (
              <>
                <PanelSection title="Pull Request">
                  <div className="space-y-1">
                    <PanelActionRow
                      icon={GitPullRequest}
                      label={`View PR #${session.prNumber}`}
                      onClick={onOpenPr}
                      disabled={!existingPrUrl}
                    />
                    {prDeploymentUrl && (
                      <PanelActionRow
                        icon={ExternalLink}
                        label={
                          isDeploymentStale ? "Deploying…" : "Preview"
                        }
                        onClick={
                          isDeploymentStale && buildingDeploymentUrl
                            ? onOpenBuildingDeployment
                            : onOpenPreview
                        }
                        disabled={
                          isDeploymentStale && !buildingDeploymentUrl
                        }
                      />
                    )}
                    {canCloseAndArchive && (
                      <PanelActionRow
                        icon={GitPullRequestClosed}
                        label="Close & Archive"
                        onClick={onCloseClick}
                      />
                    )}
                  </div>
                </PanelSection>

                <Separator />
              </>
            )}

            {/* Quick actions */}
            <PanelSection title="Actions">
              <div className="space-y-1">
                {supportsDiff && (
                  <PanelActionRow
                    icon={GitCompare}
                    label="View Diff"
                    onClick={onDiffClick}
                    disabled={!hasDiff}
                    detail={
                      diffSummary &&
                      (diffSummary.totalAdditions > 0 ||
                        diffSummary.totalDeletions > 0)
                        ? `+${diffSummary.totalAdditions} -${diffSummary.totalDeletions}`
                        : undefined
                    }
                  />
                )}

                {/* Dev server */}
                {canRunDevServer && (
                  <PanelActionRow
                    icon={
                      devServer.state.status === "starting" ||
                      devServer.state.status === "stopping"
                        ? Loader2
                        : ExternalLink
                    }
                    label={devServer.menuLabel}
                    detail={devServer.menuDetail ?? undefined}
                    onClick={() => void devServer.handlePrimaryAction()}
                    disabled={
                      devServer.state.status === "starting" ||
                      devServer.state.status === "stopping"
                    }
                  />
                )}
                {canRunDevServer && devServer.showStopAction && (
                  <PanelActionRow
                    icon={Square}
                    label={
                      devServer.state.status === "stopping"
                        ? "Stopping Dev Server..."
                        : "Stop Dev Server"
                    }
                    onClick={() => void devServer.handleStopAction()}
                    disabled={devServer.state.status === "stopping"}
                  />
                )}

                {/* Code editor */}
                {canRunDevServer && (
                  <PanelActionRow
                    icon={
                      codeEditor.state.status === "starting" ||
                      codeEditor.state.status === "stopping"
                        ? Loader2
                        : ExternalLink
                    }
                    label={codeEditor.menuLabel}
                    detail={codeEditor.menuDetail ?? undefined}
                    onClick={() => void codeEditor.handleOpen()}
                    disabled={
                      codeEditor.state.status === "starting" ||
                      codeEditor.state.status === "stopping"
                    }
                  />
                )}

                <Separator className="my-1" />

                {/* Archive / Unarchive */}
                {isArchived ? (
                  <PanelActionRow
                    icon={ArchiveRestore}
                    label={
                      isUnarchiving
                        ? "Unarchiving..."
                        : isArchiveSnapshotPending
                          ? "Pausing..."
                          : "Unarchive"
                    }
                    onClick={onUnarchiveClick}
                    disabled={isUnarchiving || isArchiveSnapshotPending}
                  />
                ) : (
                  <PanelActionRow
                    icon={Archive}
                    label="Archive"
                    onClick={onArchiveClick}
                  />
                )}
              </div>
            </PanelSection>
          </div>
        ) : (
          /* Checks tab */
          <div className="p-3">{checksContent}</div>
        )}
      </div>
    </div>
  );
}
