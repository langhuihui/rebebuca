/**
 * File System Handler
 *
 * Wraps Node.js fs/promises to implement the BackendAdapter FileSystemAdapter interface.
 */

import fs from 'fs/promises';
import path from 'path';
import { existsSync, statSync } from 'fs';

/**
 * Read a text file and return its content as a string.
 */
export async function readTextFile(filePath) {
  return fs.readFile(filePath, 'utf8');
}

/**
 * List the entries in a directory.
 * Returns an array of { name, path, isDirectory, isFile } objects.
 */
export async function readDir(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    path: path.join(dirPath, entry.name),
    isDirectory: entry.isDirectory(),
    isFile: entry.isFile(),
  }));
}

/**
 * Check whether a path exists.
 */
export async function exists(filePath) {
  return existsSync(filePath);
}

/**
 * Return metadata for a path.
 */
export async function stat(filePath) {
  const s = await fs.stat(filePath);
  return {
    path: filePath,
    size: s.size,
    isDirectory: s.isDirectory(),
    isFile: s.isFile(),
    modifiedAt: s.mtimeMs,
  };
}

/**
 * Write a string to a file (creates or overwrites).
 */
export async function writeTextFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Create a directory (optionally recursive).
 */
export async function mkdir(dirPath, options = {}) {
  await fs.mkdir(dirPath, { recursive: options.recursive ?? false });
}

/**
 * Remove a file or directory.
 */
export async function remove(targetPath, options = {}) {
  await fs.rm(targetPath, { recursive: options.recursive ?? false, force: true });
}
