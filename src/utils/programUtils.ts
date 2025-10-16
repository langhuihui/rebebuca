// 获取程序图标（基于命令的第一个字符）
export const getProgramIcon = (command: string) => {
  if (!command) return "?";

  // Extract the first word (program name) from command
  const programName = command.trim().split(" ")[0].toLowerCase();

  // Get the first character and make it uppercase
  const firstChar = programName.charAt(0).toUpperCase();

  return firstChar;
};