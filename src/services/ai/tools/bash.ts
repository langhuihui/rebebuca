/**
 * Rebebuca AI Service Layer - Bash Tool
 * Execute shell commands
 */

import { z, defineTool, type ToolExecuteResult } from './types';
import { getAdapter } from '../../../adapters';
import * as path from '../utils/path';

const DEFAULT_TIMEOUT = 120000; // 2 minutes
const MAX_OUTPUT_LENGTH = 50000; // 50KB

const DESCRIPTION = `Execute a shell command.

Usage:
- Runs the command in a shell (bash/zsh)
- Returns stdout and stderr combined
- Has a default timeout of 2 minutes

Important:
- Prefer using dedicated tools for file operations (read, write, edit, glob, grep)
- Avoid interactive commands that require user input
- Use absolute paths when possible`;

// Dangerous command patterns
const DANGEROUS_PATTERNS = [
  /rm\s+(-rf?|--recursive|--force)\s+[\/~]/i,
  /rm\s+-[rf]*\s+\//i,
  />\s*\/dev\/sd[a-z]/i,
  /mkfs\./i,
  /dd\s+.*of=\/dev/i,
  /:(){ :|:& };:/,
  /chmod\s+777\s+\//i,
  /chown\s+.*\s+\//i,
];

export const bashTool = defineTool({
  id: 'bash',
  description: DESCRIPTION,
  parameters: z.object({
    command: z.string().describe('The command to execute'),
    cwd: z.string().optional().describe('Working directory (default: project root)'),
    timeout: z.number().optional().describe('Timeout in milliseconds (default: 120000)'),
  }),

  async execute(params, ctx): Promise<ToolExecuteResult> {
    const adapter = await getAdapter();
    const { command, timeout = DEFAULT_TIMEOUT } = params;

    // Resolve working directory
    const cwd = params.cwd
      ? path.isAbsolute(params.cwd)
        ? params.cwd
        : path.join(ctx.projectPath, params.cwd)
      : ctx.projectPath;

    // Check for dangerous commands
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        await ctx.requestPermission({
          type: 'dangerous_command',
          command,
          patterns: [command],
          metadata: { pattern: pattern.source },
        });
      }
    }

    // Request bash permission
    await ctx.requestPermission({
      type: 'bash',
      command,
      patterns: [extractCommandPrefix(command)],
      metadata: { cwd, timeout },
    });

    // Check if cwd is outside project
    const relativeCwd = path.relative(ctx.projectPath, cwd);
    if (relativeCwd.startsWith('..')) {
      await ctx.requestPermission({
        type: 'external_directory',
        path: cwd,
        patterns: [cwd],
      });
    }

    try {
      // Create PTY and execute command
      const ptyInfo = await adapter.terminal.create({
        command,
        cwd,
      });

      let output = '';
      let exited = false;
      let exitCode: number | null = null;
      let timedOut = false;

      // Set up output listener
      const unlisten = adapter.terminal.onData((event) => {
        if (event.ptyId === ptyInfo.ptyId) {
          output += event.data;
          
          // Update UI with progress
          ctx.updateMetadata({
            output: output.length > MAX_OUTPUT_LENGTH
              ? '...' + output.slice(-MAX_OUTPUT_LENGTH)
              : output,
            running: true,
          });
        }
      });

      // Set up exit listener
      const exitPromise = new Promise<number>((resolve) => {
        const exitUnlisten = adapter.terminal.onExit((event) => {
          if (event.ptyId === ptyInfo.ptyId) {
            exited = true;
            exitCode = event.exitCode;
            exitUnlisten();
            resolve(event.exitCode ?? 1);
          }
        });
      });

      // Set up abort handler
      const abortHandler = () => {
        if (!exited) {
          adapter.terminal.kill(ptyInfo.ptyId);
        }
      };
      ctx.abortSignal.addEventListener('abort', abortHandler, { once: true });

      // Set up timeout
      const timeoutPromise = new Promise<number>((_, reject) => {
        setTimeout(() => {
          if (!exited) {
            timedOut = true;
            adapter.terminal.kill(ptyInfo.ptyId);
            reject(new Error(`Command timed out after ${timeout}ms`));
          }
        }, timeout);
      });

      // Wait for completion
      try {
        exitCode = await Promise.race([exitPromise, timeoutPromise]);
      } catch (error) {
        // Timeout or other error
      } finally {
        unlisten();
        ctx.abortSignal.removeEventListener('abort', abortHandler);
      }

      // Clean up ANSI escape codes for the output
      const cleanOutput = stripAnsi(output);

      // Truncate if too long
      const truncated = cleanOutput.length > MAX_OUTPUT_LENGTH;
      const finalOutput = truncated
        ? cleanOutput.slice(0, MAX_OUTPUT_LENGTH) + '\n\n... (output truncated)'
        : cleanOutput;

      ctx.updateMetadata({
        output: finalOutput,
        exitCode,
        timedOut,
        running: false,
      });

      if (timedOut) {
        return {
          title: extractCommandPrefix(command),
          output: `Command timed out after ${timeout}ms.\n\nPartial output:\n${finalOutput}`,
          metadata: { exitCode: null, timedOut: true, truncated },
        };
      }

      return {
        title: extractCommandPrefix(command),
        output: exitCode === 0
          ? finalOutput || '(no output)'
          : `Exit code: ${exitCode}\n\n${finalOutput}`,
        metadata: { exitCode, timedOut: false, truncated },
      };
    } catch (error) {
      return {
        title: extractCommandPrefix(command),
        output: `Error executing command: ${error instanceof Error ? error.message : String(error)}`,
        metadata: { error: 'execution_error' },
      };
    }
  },
});

/**
 * Extract command prefix for display (e.g., "npm install" from "npm install lodash")
 */
function extractCommandPrefix(command: string): string {
  const words = command.trim().split(/\s+/);
  
  // Common commands where we want to show more context
  const multiWordCommands: Record<string, number> = {
    npm: 2,      // npm install, npm run
    yarn: 2,     // yarn add, yarn run
    pnpm: 2,     // pnpm install, pnpm run
    git: 2,      // git commit, git push
    docker: 2,   // docker run, docker build
    kubectl: 2,  // kubectl apply, kubectl get
    cargo: 2,    // cargo build, cargo test
    go: 2,       // go build, go test
    python: 2,   // python -m, python script.py
    pip: 2,      // pip install
    make: 1,
  };

  const arity = multiWordCommands[words[0]] || 1;
  const prefix = words.slice(0, Math.min(arity, words.length)).join(' ');
  
  return prefix.length > 40 ? prefix.slice(0, 40) + '...' : prefix;
}

/**
 * Strip ANSI escape codes from string
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')  // OSC sequences
    .replace(/\r/g, '');  // Carriage returns
}
