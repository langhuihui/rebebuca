/**
 * Cross-platform path utilities for use in the frontend.
 *
 * These helpers handle both Unix-style paths (/home/user) and Windows-style
 * paths (C:\Users\user) without relying on Node.js's `path` module.
 */

/**
 * Returns true when the given path is a filesystem root:
 *   - Unix root:   "/"
 *   - Windows drive root: "C:", "C:/", "C:\"
 */
export const isRootPath = (p: string): boolean => {
  return p === '/' || /^[A-Za-z]:[/\\]?$/.test(p);
};

/**
 * Returns the parent directory of a path, handling both Unix and Windows
 * path styles.
 *
 * Examples:
 *   "/home/john/docs"   → "/home/john"
 *   "/home/john"        → "/home"
 *   "/home"             → "/"
 *   "C:\\Users\\John"   → "C:/Users"
 *   "C:\\Users"         → "C:/"
 *   "C:\\"              → "C:/"  (already at drive root)
 */
export const getParentPath = (p: string): string => {
  // Normalize backslashes to forward slashes and strip any trailing slash
  const normalized = p.replace(/\\/g, '/').replace(/\/$/, '');
  // Already at a Windows drive root (e.g. "C:") – return with trailing slash
  if (/^[A-Za-z]:$/.test(normalized)) {
    return normalized + '/';
  }
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash < 0) {
    // No separator found – treat as root
    return normalized;
  }
  if (lastSlash === 0) {
    // Unix root
    return '/';
  }
  const parent = normalized.substring(0, lastSlash);
  // If the parent portion is just a Windows drive letter (e.g. "C:"), add
  // a trailing slash so the result is a valid drive root path "C:/".
  if (/^[A-Za-z]:$/.test(parent)) {
    return parent + '/';
  }
  return parent;
};

/**
 * Join a directory path with a child name, preserving Windows or Unix separators.
 */
export const joinPath = (dir: string, name: string): string => {
  if (!dir || dir === '/') return `/${name}`;
  const sep = dir.includes('\\') ? '\\' : '/';
  const trimmed = dir.replace(/[/\\]+$/, '');
  return `${trimmed}${sep}${name}`;
};

/**
 * Normalize a folder path into a stable, colon-safe segment for task IDs.
 * Ensures tasks from different root folders never share the same ID.
 */
export const folderPathToTaskIdSegment = (folderPath: string): string => {
  return folderPath.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1_');
};

/**
 * Build a scoped task ID from a provider prefix, folder path, and task name.
 */
export const scopedTaskId = (prefix: string, folderPath: string, name: string): string => {
  return `${prefix}:${folderPathToTaskIdSegment(folderPath)}:${name}`;
};

/**
 * Normalize a path for prefix/suffix comparisons.
 */
export const normalizePathForCompare = (p: string): string => {
  if (!p) return '';
  const normalized = p.replace(/\\/g, '/');
  if (normalized === '/') return '/';
  return normalized.replace(/\/$/, '');
};

const pathStartsWith = (path: string, prefix: string): boolean => {
  if (prefix === '/') return path.startsWith('/');
  return path === prefix || path.startsWith(`${prefix}/`);
};

const getPathSuffix = (path: string, prefix: string): string => {
  if (prefix === '/') return path.replace(/^\/+/, '');
  return path.slice(prefix.length).replace(/^[/\\]+/, '');
};

const findDirectoryEntry = (
  segment: string,
  entries: DirectoryPickerEntry[]
): DirectoryPickerEntry | undefined => {
  return entries.find(entry => entry.name.toLowerCase() === segment.toLowerCase());
};

/**
 * Parse typed path relative to the currently browsed directory.
 */
const parseInputRelativeToCurrent = (
  inputPath: string,
  currentPath: string
): { remainder: string; endsWithSlash: boolean } | null => {
  const raw = inputPath.trim().replace(/\\/g, '/');
  if (!raw) return null;

  const endsWithSlash = raw.length > 1 && raw.endsWith('/');
  const inputWithoutTrailing = endsWithSlash ? raw.replace(/\/$/, '') : raw;
  const normalizedCurrent = normalizePathForCompare(currentPath);

  if (!pathStartsWith(inputWithoutTrailing, normalizedCurrent)) return null;

  const remainder = getPathSuffix(inputWithoutTrailing, normalizedCurrent);
  return { remainder, endsWithSlash };
};

export interface DirectoryPickerEntry {
  name: string;
  path: string;
}

/**
 * Extract a directory-name filter from path input while browsing.
 * Uses only the final path segment as the active filter.
 */
export const getDirectoryEntryFilter = (inputPath: string, currentPath: string): string => {
  const input = inputPath.trim();
  if (!input) return '';

  const parsed = parseInputRelativeToCurrent(input, currentPath);
  if (parsed) {
    const { remainder, endsWithSlash } = parsed;
    if (!remainder || endsWithSlash) return '';
    const lastSlash = remainder.lastIndexOf('/');
    return lastSlash >= 0 ? remainder.slice(lastSlash + 1) : remainder;
  }

  const normalizedInput = input.replace(/\\/g, '/');
  const normalizedCurrent = normalizePathForCompare(currentPath);
  if (!normalizedInput.includes('/') && !normalizedInput.includes('\\') && normalizedInput !== normalizedCurrent) {
    return normalizedInput;
  }

  return '';
};

/**
 * When typing a multi-level path, return the next existing child directory to enter.
 */
export const getNextDirectoryFromInput = (
  inputPath: string,
  currentPath: string,
  entries: DirectoryPickerEntry[]
): string | null => {
  const parsed = parseInputRelativeToCurrent(inputPath, currentPath);
  if (!parsed) return null;

  const { remainder, endsWithSlash } = parsed;
  if (!remainder) return null;

  if (remainder.includes('/')) {
    const segment = remainder.slice(0, remainder.indexOf('/'));
    if (!segment) return null;
    return findDirectoryEntry(segment, entries)?.path ?? null;
  }

  if (endsWithSlash) {
    return findDirectoryEntry(remainder, entries)?.path ?? null;
  }

  return null;
};

/**
 * True when input contains completed child segments that still need auto-navigation.
 */
export const hasPendingDirectoryNavigation = (
  inputPath: string,
  currentPath: string,
  entries: DirectoryPickerEntry[]
): boolean => {
  return getNextDirectoryFromInput(inputPath, currentPath, entries) !== null;
};
