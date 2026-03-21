export const safeGetPlatform = async (): Promise<'windows' | 'macos' | 'linux' | null> => {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  return null;
};

export const isWindows = async () => {
  const platform = await safeGetPlatform();
  return platform === 'windows';
};

export const isMacOS = async () => {
  const platform = await safeGetPlatform();
  return platform === 'macos';
};

export const isLinux = async () => {
  const platform = await safeGetPlatform();
  return platform === 'linux';
};
