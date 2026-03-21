/**
 * Admin / elevated execution helpers. Tauri-only (invoke) has been removed; server mode uses adapter.
 */

import { getAdapter } from '../adapters';

export interface AdminExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number | null;
}

export async function checkNeedsAdmin(_command: string): Promise<boolean> {
  try {
    const adapter = await getAdapter();
    if (adapter.system?.executeWithAdmin) {
      return false;
    }
  } catch (_) {}
  return false;
}

export async function executeWithAdmin(
  command: string,
  args?: string[]
): Promise<AdminExecResult> {
  try {
    const adapter = await getAdapter();
    const result = await adapter.system.executeWithAdmin(command, args || []);
    return {
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: null,
    };
  } catch (error) {
    console.error('[Admin] Failed to execute with admin privileges:', error);
    throw error;
  }
}

export async function requestFolderAccess(_path: string): Promise<boolean> {
  return false;
}

export function buildFullCommand(command: string, args?: string[]): string {
  if (!args || args.length === 0) {
    return command;
  }
  const quotedArgs = args.map(arg => {
    if (arg.includes(' ') && !arg.startsWith('"') && !arg.startsWith("'")) {
      return `"${arg}"`;
    }
    return arg;
  });
  return `${command} ${quotedArgs.join(' ')}`;
}

export function stripSudoPrefix(command: string, args?: string[]): { command: string; args: string[] } {
  const trimmed = command.trim().toLowerCase();

  if (trimmed === 'sudo' && args && args.length > 0) {
    return {
      command: args[0],
      args: args.slice(1),
    };
  }

  if (trimmed.startsWith('sudo ')) {
    const parts = command.trim().split(/\s+/);
    parts.shift();
    if (parts.length > 0) {
      return {
        command: parts[0],
        args: [...parts.slice(1), ...(args || [])],
      };
    }
  }

  return {
    command,
    args: args || [],
  };
}
