/**
 * Rebebuca AI Service Layer - Path Utilities
 * Cross-platform path operations
 */

// Detect platform
const isWindows = typeof navigator !== 'undefined' 
  ? navigator.platform.toLowerCase().includes('win')
  : false;

const SEP = isWindows ? '\\' : '/';
const SEP_PATTERN = isWindows ? /[\\/]/g : /\//g;

/**
 * Check if path is absolute
 */
export function isAbsolute(path: string): boolean {
  if (!path) return false;
  
  if (isWindows) {
    // Windows: C:\ or \\server\share
    return /^([a-zA-Z]:|\\\\)/.test(path);
  }
  
  // Unix: starts with /
  return path.startsWith('/');
}

/**
 * Join path segments
 */
export function join(...parts: string[]): string {
  const segments: string[] = [];
  
  for (const part of parts) {
    if (!part) continue;
    
    // Split by separator
    const subParts = part.split(SEP_PATTERN);
    
    for (const sub of subParts) {
      if (!sub || sub === '.') continue;
      
      if (sub === '..') {
        if (segments.length > 0 && segments[segments.length - 1] !== '..') {
          segments.pop();
        } else if (!isAbsolute(parts[0])) {
          segments.push('..');
        }
      } else {
        segments.push(sub);
      }
    }
  }
  
  let result = segments.join(SEP);
  
  // Preserve leading slash for absolute paths
  if (parts[0] && isAbsolute(parts[0])) {
    if (isWindows) {
      // Preserve drive letter
      const match = parts[0].match(/^([a-zA-Z]:)/);
      if (match) {
        result = match[1] + SEP + result;
      }
    } else {
      result = SEP + result;
    }
  }
  
  return result || '.';
}

/**
 * Get directory name
 */
export function dirname(path: string): string {
  if (!path) return '.';
  
  // Remove trailing separator
  path = path.replace(/[\\/]+$/, '');
  
  const lastSep = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  
  if (lastSep === -1) return '.';
  if (lastSep === 0) return SEP;
  
  // Handle Windows drive root
  if (isWindows && lastSep === 2 && path[1] === ':') {
    return path.slice(0, 3);
  }
  
  return path.slice(0, lastSep);
}

/**
 * Get base name
 */
export function basename(path: string, ext?: string): string {
  if (!path) return '';
  
  // Remove trailing separator
  path = path.replace(/[\\/]+$/, '');
  
  const lastSep = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  let base = lastSep === -1 ? path : path.slice(lastSep + 1);
  
  if (ext && base.endsWith(ext)) {
    base = base.slice(0, -ext.length);
  }
  
  return base;
}

/**
 * Get file extension
 */
export function extname(path: string): string {
  const base = basename(path);
  const lastDot = base.lastIndexOf('.');
  
  if (lastDot === -1 || lastDot === 0) return '';
  
  return base.slice(lastDot);
}

/**
 * Get relative path from 'from' to 'to'
 */
export function relative(from: string, to: string): string {
  if (!from || !to) return to;
  
  // Normalize paths
  const fromParts = from.split(SEP_PATTERN).filter(p => p && p !== '.');
  const toParts = to.split(SEP_PATTERN).filter(p => p && p !== '.');
  
  // Find common prefix
  let commonLength = 0;
  const minLength = Math.min(fromParts.length, toParts.length);
  
  for (let i = 0; i < minLength; i++) {
    if (fromParts[i].toLowerCase() === toParts[i].toLowerCase()) {
      commonLength = i + 1;
    } else {
      break;
    }
  }
  
  // Build relative path
  const upCount = fromParts.length - commonLength;
  const upParts = Array(upCount).fill('..');
  const downParts = toParts.slice(commonLength);
  
  const result = [...upParts, ...downParts].join(SEP);
  return result || '.';
}

/**
 * Resolve path to absolute
 */
export function resolve(...parts: string[]): string {
  let resolved = '';
  
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (!part) continue;
    
    resolved = part + (resolved ? SEP + resolved : '');
    
    if (isAbsolute(part)) break;
  }
  
  return join(resolved);
}

/**
 * Normalize path separators
 */
export function normalize(path: string): string {
  if (!path) return '.';
  return join(path);
}
