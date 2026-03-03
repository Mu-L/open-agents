"use client";

import { useState } from "react";
import useSWR from "swr";
import { type ThemePreference, useTheme } from "@/app/providers";
import {
  DEFAULT_SANDBOX_TYPE,
  type SandboxType,
} from "@/components/sandbox-selector-compact";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelCombobox } from "@/components/model-combobox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import {
  type AvailableModel,
  DEFAULT_MODEL_ID,
  getModelDisplayName,
} from "@/lib/models";
import type { SandboxSnapshotPreset } from "@/lib/sandbox/config";
import { fetcher } from "@/lib/swr";

interface ModelsResponse {
  models: AvailableModel[];
}

const SANDBOX_OPTIONS: Array<{ id: SandboxType; name: string }> = [
  { id: "hybrid", name: "Hybrid" },
  { id: "vercel", name: "Vercel" },
  { id: "just-bash", name: "Just Bash" },
];

const THEME_OPTIONS: Array<{ id: ThemePreference; name: string }> = [
  { id: "system", name: "System" },
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
];

const SANDBOX_SNAPSHOT_PRESET_OPTIONS: Array<{
  id: SandboxSnapshotPreset;
  label: string;
  description: string;
}> = [
  {
    id: "default",
    label: "Default snapshot",
    description: "Includes bun and jq.",
  },
  {
    id: "browser",
    label: "Browser-enabled snapshot",
    description: "Includes bun, jq, agent-browser, and Chromium.",
  },
];

function isThemePreference(value: string): value is ThemePreference {
  return THEME_OPTIONS.some((option) => option.id === value);
}

export function PreferencesSectionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Preferences</CardTitle>
        <CardDescription>
          Default settings for new sessions. You can override these when
          starting a session or chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2">
          <Label htmlFor="appearance">Appearance</Label>
          <Select disabled>
            <SelectTrigger id="appearance" className="w-full max-w-xs">
              <Skeleton className="h-4 w-24" />
            </SelectTrigger>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose between light and dark mode.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="model">Default Model</Label>
          <Select disabled>
            <SelectTrigger id="model" className="w-full max-w-xs">
              <Skeleton className="h-4 w-32" />
            </SelectTrigger>
          </Select>
          <p className="text-xs text-muted-foreground">
            The AI model used for new chats.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sandbox">Default Sandbox</Label>
          <Select disabled>
            <SelectTrigger id="sandbox" className="w-full max-w-xs">
              <Skeleton className="h-4 w-28" />
            </SelectTrigger>
          </Select>
          <p className="text-xs text-muted-foreground">
            The execution environment for new sessions.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sandbox-snapshot">Sandbox Snapshot</Label>
          <Select disabled>
            <SelectTrigger id="sandbox-snapshot" className="w-full max-w-xs">
              <Skeleton className="h-4 w-40" />
            </SelectTrigger>
          </Select>
          <p className="text-xs text-muted-foreground">
            The base image used when provisioning cloud sandboxes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function PreferencesSection() {
  const { theme, setTheme } = useTheme();
  const { preferences, loading, updatePreferences } = useUserPreferences();
  const { data: modelsData, isLoading: modelsLoading } = useSWR<ModelsResponse>(
    "/api/models",
    fetcher,
  );
  const [isSaving, setIsSaving] = useState(false);

  const models = modelsData?.models ?? [];
  const selectedSnapshotPreset =
    SANDBOX_SNAPSHOT_PRESET_OPTIONS.find(
      (option) =>
        option.id === (preferences?.defaultSandboxSnapshotPreset ?? "default"),
    ) ?? SANDBOX_SNAPSHOT_PRESET_OPTIONS[0];

  const handleThemeChange = (nextTheme: string) => {
    if (isThemePreference(nextTheme)) {
      setTheme(nextTheme);
    }
  };

  const handleModelChange = async (modelId: string) => {
    setIsSaving(true);
    try {
      await updatePreferences({ defaultModelId: modelId });
    } catch (error) {
      console.error("Failed to update model preference:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubagentModelChange = async (value: string) => {
    setIsSaving(true);
    try {
      await updatePreferences({
        defaultSubagentModelId: value === "auto" ? null : value,
      });
    } catch (error) {
      console.error("Failed to update subagent model preference:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSandboxChange = async (sandboxType: SandboxType) => {
    setIsSaving(true);
    try {
      await updatePreferences({ defaultSandboxType: sandboxType });
    } catch (error) {
      console.error("Failed to update sandbox preference:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSandboxSnapshotPresetChange = async (
    snapshotPreset: SandboxSnapshotPreset,
  ) => {
    setIsSaving(true);
    try {
      await updatePreferences({ defaultSandboxSnapshotPreset: snapshotPreset });
    } catch (error) {
      console.error("Failed to update sandbox snapshot preset:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <PreferencesSectionSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Preferences</CardTitle>
        <CardDescription>
          Default settings for new sessions. You can override these when
          starting a session or chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-2">
          <Label htmlFor="appearance">Appearance</Label>
          <Select value={theme} onValueChange={handleThemeChange}>
            <SelectTrigger id="appearance" className="w-full max-w-xs">
              <SelectValue placeholder="Select an appearance" />
            </SelectTrigger>
            <SelectContent>
              {THEME_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose between light and dark mode. This preference is saved in your
            current browser.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="model">Default Model</Label>
          <ModelCombobox
            value={preferences?.defaultModelId ?? DEFAULT_MODEL_ID}
            items={models.map((model) => ({
              id: model.id,
              label: getModelDisplayName(model),
            }))}
            placeholder="Select a model"
            searchPlaceholder="Search models..."
            emptyText={modelsLoading ? "Loading..." : "No models found."}
            disabled={isSaving || modelsLoading}
            onChange={handleModelChange}
          />
          <p className="text-xs text-muted-foreground">
            The AI model used for new chats.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="subagent-model">Subagent Model</Label>
          <ModelCombobox
            value={preferences?.defaultSubagentModelId ?? "auto"}
            items={[
              { id: "auto", label: "Same as main model" },
              ...models.map((model) => ({
                id: model.id,
                label: getModelDisplayName(model),
              })),
            ]}
            placeholder="Select a model"
            searchPlaceholder="Search models..."
            emptyText={modelsLoading ? "Loading..." : "No models found."}
            disabled={isSaving || modelsLoading}
            onChange={handleSubagentModelChange}
          />
          <p className="text-xs text-muted-foreground">
            The AI model used for explorer and executor subagents. Defaults to
            the main model if not set.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sandbox">Default Sandbox</Label>
          <Select
            value={preferences?.defaultSandboxType ?? DEFAULT_SANDBOX_TYPE}
            onValueChange={(value) => handleSandboxChange(value as SandboxType)}
            disabled={isSaving}
          >
            <SelectTrigger id="sandbox" className="w-full max-w-xs">
              <SelectValue placeholder="Select a sandbox type" />
            </SelectTrigger>
            <SelectContent>
              {SANDBOX_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            The execution environment for new sessions.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="sandbox-snapshot">Sandbox Snapshot</Label>
          <Combobox
            items={SANDBOX_SNAPSHOT_PRESET_OPTIONS}
            value={selectedSnapshotPreset}
            itemToStringValue={(option) => option.label}
            disabled={isSaving}
            onValueChange={(option) => {
              void handleSandboxSnapshotPresetChange(option.id);
            }}
          >
            <ComboboxInput
              id="sandbox-snapshot"
              placeholder="Select a snapshot preset"
            />
            <ComboboxContent>
              <ComboboxEmpty>No snapshot presets found.</ComboboxEmpty>
              <ComboboxList>
                {(option: (typeof SANDBOX_SNAPSHOT_PRESET_OPTIONS)[number]) => (
                  <ComboboxItem key={option.id} value={option}>
                    <Item size="xs" className="p-0">
                      <ItemContent>
                        <ItemTitle>{option.label}</ItemTitle>
                        <ItemDescription>{option.description}</ItemDescription>
                      </ItemContent>
                    </Item>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <p className="text-xs text-muted-foreground">
            The base image used when provisioning cloud sandboxes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
