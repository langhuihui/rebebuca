/**
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Result from admin command execution
 */
export interface AdminExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number | null;
}

/**
 * Check if a command needs administrator privileges
 * Calls the Rust backend to perform the check
 */
export async function checkNeedsAdmin(command: string): Promise<boolean> {
  try {
    return await invoke<boolean>('check_needs_admin', { command });
  } catch (error) {
    console.error('[Admin] Failed to check if command needs admin:', error);
    return false;
  }
}

/**
 * Execute a command with administrator privileges
 * - macOS: Uses osascript with "administrator privileges" (shows system password dialog)
 * - Windows: Uses PowerShell Start-Process -Verb RunAs (shows UAC dialog)
 * - Linux: Uses pkexec (shows PolicyKit dialog)
 * 
 * @param command The command to execute
 * @param args Optional arguments for the command
 * @returns The execution result
 * @throws Error if user cancels or execution fails
 */
export async function executeWithAdmin(
  command: string, 
  args?: string[]
): Promise<AdminExecResult> {
  try {
    const result = await invoke<AdminExecResult>('execute_with_admin', { 
      command, 
      args: args || null 
    });
    return result;
  } catch (error) {
    console.error('[Admin] Failed to execute with admin privileges:', error);
    throw error;
  }
}

/**
 * Request access to a protected folder
 * On macOS, this attempts to trigger the system permission dialog
 * 
 * @param path The folder path to access
 * @returns true if access is granted, false otherwise
 */
export async function requestFolderAccess(path: string): Promise<boolean> {
  try {
    return await invoke<boolean>('request_folder_access', { path });
  } catch (error) {
    console.error('[Admin] Failed to request folder access:', error);
    throw error;
  }
}

/**
 * Build the full command string from command and args
 */
export function buildFullCommand(command: string, args?: string[]): string {
  if (!args || args.length === 0) {
    return command;
  }
  
  // Quote arguments that contain spaces
  const quotedArgs = args.map(arg => {
    if (arg.includes(' ') && !arg.startsWith('"') && !arg.startsWith("'")) {
      return `"${arg}"`;
    }
    return arg;
  });
  
  return `${command} ${quotedArgs.join(' ')}`;
}

/**
 * Strip sudo prefix from command if present
 * Returns { command, args } without the sudo part
 */
export function stripSudoPrefix(command: string, args?: string[]): { command: string; args: string[] } {
  const trimmed = command.trim().toLowerCase();
  
  // If command itself is 'sudo', the actual command is in args
  if (trimmed === 'sudo' && args && args.length > 0) {
    return {
      command: args[0],
      args: args.slice(1),
    };
  }
  
  // If command starts with 'sudo ', split it
  if (trimmed.startsWith('sudo ')) {
    const parts = command.trim().split(/\s+/);
    parts.shift(); // Remove 'sudo'
    
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
