// Program icon and safe invoke (Tauri removed; invoke not available)

export const getProgramIcon = (command: string) => {
  if (!command) return "?";
  const programName = command.trim().split(" ")[0].toLowerCase();
  const firstChar = programName.charAt(0).toUpperCase();
  return firstChar;
};

export const safeInvoke = async <T = unknown>(_command: string, _args?: any): Promise<T | undefined> => {
  throw new Error('Invoke is not available (desktop/Tauri removed). Use adapter or server API.');
};
