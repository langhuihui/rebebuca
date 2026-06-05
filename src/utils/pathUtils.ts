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
