/**
 * Default interactive shell path when the user has not set preferredShell.
 * macOS ships bash 3.2 at /bin/bash; zsh is the system default shell since Catalina.
 */
export type ShellPlatform = 'darwin' | 'windows' | 'linux';

export function defaultShellForPlatform(platform: ShellPlatform): string {
  if (platform === 'windows') return 'cmd.exe';
  if (platform === 'darwin') return '/bin/zsh';
  return '/bin/bash';
}
