/**
 * Tauri Path API Stub for Server/Mock mode
 * These are no-op implementations that prevent runtime errors
 */

export enum BaseDirectory {
  Audio = 1,
  Cache = 2,
  Config = 3,
  Data = 4,
  LocalData = 5,
  Document = 6,
  Download = 7,
  Picture = 8,
  Public = 9,
  Video = 10,
  Resource = 11,
  Temp = 12,
  AppConfig = 13,
  AppData = 14,
  AppLocalData = 15,
  AppCache = 16,
  AppLog = 17,
  Desktop = 18,
  Executable = 19,
  Font = 20,
  Home = 21,
  Runtime = 22,
  Template = 23,
}

export async function appCacheDir(): Promise<string> {
  console.warn('[Tauri Stub] appCacheDir() called in non-Tauri environment');
  return '/tmp/cache';
}

export async function appConfigDir(): Promise<string> {
  console.warn('[Tauri Stub] appConfigDir() called in non-Tauri environment');
  return '/tmp/config';
}

export async function appDataDir(): Promise<string> {
  console.warn('[Tauri Stub] appDataDir() called in non-Tauri environment');
  return '/tmp/data';
}

export async function appLocalDataDir(): Promise<string> {
  console.warn('[Tauri Stub] appLocalDataDir() called in non-Tauri environment');
  return '/tmp/local-data';
}

export async function appLogDir(): Promise<string> {
  console.warn('[Tauri Stub] appLogDir() called in non-Tauri environment');
  return '/tmp/logs';
}

export async function audioDir(): Promise<string> {
  return '/home/user/Music';
}

export async function cacheDir(): Promise<string> {
  return '/tmp/cache';
}

export async function configDir(): Promise<string> {
  return '/home/user/.config';
}

export async function dataDir(): Promise<string> {
  return '/home/user/.local/share';
}

export async function desktopDir(): Promise<string> {
  return '/home/user/Desktop';
}

export async function documentDir(): Promise<string> {
  return '/home/user/Documents';
}

export async function downloadDir(): Promise<string> {
  return '/home/user/Downloads';
}

export async function executableDir(): Promise<string> {
  return '/usr/bin';
}

export async function fontDir(): Promise<string> {
  return '/home/user/.local/share/fonts';
}

export async function homeDir(): Promise<string> {
  return '/home/user';
}

export async function localDataDir(): Promise<string> {
  return '/home/user/.local/share';
}

export async function pictureDir(): Promise<string> {
  return '/home/user/Pictures';
}

export async function publicDir(): Promise<string> {
  return '/home/user/Public';
}

export async function resourceDir(): Promise<string> {
  return '/opt/app/resources';
}

export async function runtimeDir(): Promise<string> {
  return '/run/user/1000';
}

export async function templateDir(): Promise<string> {
  return '/home/user/Templates';
}

export async function videoDir(): Promise<string> {
  return '/home/user/Videos';
}

export async function resolve(...paths: string[]): Promise<string> {
  // Simple path resolution
  return paths.join('/').replace(/\/+/g, '/');
}

export async function normalize(path: string): Promise<string> {
  return path.replace(/\/+/g, '/');
}

export async function join(...paths: string[]): Promise<string> {
  return paths.join('/').replace(/\/+/g, '/');
}

export async function dirname(path: string): Promise<string> {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/') || '/';
}

export async function extname(path: string): Promise<string> {
  const filename = path.split('/').pop() || '';
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex > 0 ? filename.slice(dotIndex) : '';
}

export async function basename(path: string, ext?: string): Promise<string> {
  let name = path.split('/').pop() || '';
  if (ext && name.endsWith(ext)) {
    name = name.slice(0, -ext.length);
  }
  return name;
}

export async function isAbsolute(path: string): Promise<boolean> {
  return path.startsWith('/');
}

export const sep = '/';
export const delimiter = ':';
