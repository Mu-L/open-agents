import { ToolLoopAgent, stepCountIs } from "ai";
import { z } from "zod";
import { readFileTool } from "../context/read";
import { writeFileTool, editFileTool } from "../context/write";
import { grepTool } from "../context/grep";
import { globTool } from "../context/glob";
import { bashTool } from "../context/bash";

const SUBAGENT_SYSTEM_PROMPT = `You are a task executor - a focused subagent that completes specific, well-defined tasks.

IMPORTANT:
- You work autonomously without asking follow-up questions
- Complete the task fully before returning
- Return a concise summary of what you accomplished
- If you encounter blockers, document them in your response

You have access to file operations and bash commands. Use them to complete your task.`;

const callOptionsSchema = z.object({
  task: z.string().describe("Short description of the task"),
  cwd: z.string().describe("Working directory for the subagent"),
  instructions: z.string().describe("Detailed instructions for the task"),
});

export type SubagentCallOptions = z.infer<typeof callOptionsSchema>;

export const subagent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4-20250514",
  instructions: SUBAGENT_SYSTEM_PROMPT,
  tools: {
    read: readFileTool,
    write: writeFileTool,
    edit: editFileTool,
    grep: grepTool,
    glob: globTool,
    bash: bashTool,
  },
  stopWhen: stepCountIs(30),
  callOptionsSchema,
  prepareCall: ({ options, ...settings }) => ({
    ...settings,
    instructions: `${SUBAGENT_SYSTEM_PROMPT}

Working directory: ${options.cwd}

## Task
${options.task}

## Instructions
${options.instructions}`,
  }),
});
