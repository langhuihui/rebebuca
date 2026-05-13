// Program icon and safe invoke (no native invoke; use adapter / server API)

export const getProgramIcon = (command: string) => {
  if (!command) return "?";
  const programName = command.trim().split(" ")[0].toLowerCase();
  const firstChar = programName.charAt(0).toUpperCase();
  return firstChar;
};

export const safeInvoke = async <T = unknown>(_command: string, _args?: any): Promise<T | undefined> => {
  throw new Error('Native invoke is not available. Use adapter or server API.');
};
