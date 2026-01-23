/**
 * Shared utilities for plan file creation and management.
 * Used by both the enter_plan_mode tool and manual TUI plan mode entry.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

// Word lists for generating random plan names
const ADJECTIVES = [
  "giggling",
  "dancing",
  "sleeping",
  "running",
  "jumping",
  "singing",
  "floating",
  "spinning",
  "glowing",
  "buzzing",
  "flying",
  "crawling",
  "bouncing",
  "whistling",
  "humming",
  "drifting",
  "twirling",
  "shimmering",
  "sparkling",
  "flickering",
  "swaying",
  "tumbling",
  "soaring",
  "prancing",
  "skipping",
];

const COLORS = [
  "crimson",
  "azure",
  "golden",
  "silver",
  "coral",
  "violet",
  "emerald",
  "amber",
  "ivory",
  "jade",
  "scarlet",
  "cobalt",
  "copper",
  "indigo",
  "bronze",
  "teal",
  "sage",
  "rust",
  "plum",
  "slate",
];

const ANIMALS = [
  "lark",
  "panda",
  "otter",
  "fox",
  "owl",
  "tiger",
  "dolphin",
  "koala",
  "penguin",
  "rabbit",
  "eagle",
  "salmon",
  "turtle",
  "zebra",
  "falcon",
  "badger",
  "heron",
  "lynx",
  "crane",
  "finch",
  "lemur",
  "marmot",
  "osprey",
  "wombat",
  "quail",
];

function randomElement<T>(array: T[]): T {
  const index = Math.floor(Math.random() * array.length);
  return array[index]!;
}

/**
 * Generate a random plan name in the format "adjective-color-animal"
 */
export function generatePlanName(): string {
  const adjective = randomElement(ADJECTIVES);
  const color = randomElement(COLORS);
  const animal = randomElement(ANIMALS);
  return `${adjective}-${color}-${animal}`;
}

export const CONFIG_DIR = join(homedir(), ".config", "open-harness");
export const PLANS_DIR = join(CONFIG_DIR, "plans");

/**
 * Create a new plan file and return its path.
 * Creates the plans directory if it doesn't exist.
 */
export async function createPlanFile(): Promise<{
  planFilePath: string;
  planName: string;
}> {
  // Ensure plans directory exists
  await mkdir(PLANS_DIR, { recursive: true });

  // Generate unique plan name
  const planName = generatePlanName();
  const planFilePath = join(PLANS_DIR, `${planName}.md`);

  return { planFilePath, planName };
}
