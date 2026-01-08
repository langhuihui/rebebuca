import { isTauri } from '../adapters';

// 获取程序图标（基于命令的第一个字符）
export const getProgramIcon = (command: string) => {
  if (!command) return "?";

  // Extract the first word (program name) from command
  const programName = command.trim().split(" ")[0].toLowerCase();

  // Get the first character and make it uppercase
  const firstChar = programName.charAt(0).toUpperCase();

  return firstChar;
};

// Safe invoke function that handles browser environment
export const safeInvoke = async <T = unknown>(command: string, args?: any): Promise<T | undefined> => {
  if (!isTauri()) {
    throw new Error(`Command '${command}' not available in browser environment`);
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(command, args);
  } catch (error) {
    if (command === 'get_process_stats') {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Process not found - it has finished") ||
        errorMessage.includes("Process has finished")) {
        throw error;
      } else {
        console.warn(`Process stats temporarily unavailable: ${errorMessage}`);
        throw error;
      }
    }
    console.error(`Failed to invoke '${command}':`, error);
    throw error;
  }
};