/**
 * Directory Picker Service
 * 
 * Provides a way to show directory picker dialog from non-Vue code (like adapters)
 */

import type { DirEntry } from '../adapters/types';

export interface DirectoryPickerOptions {
  title?: string;
  defaultPath?: string;
  homeDir?: string;
}

export interface DirectoryPickerService {
  show(options?: DirectoryPickerOptions): Promise<string | null>;
  setFsAdapter(adapter: { readDir: (path: string) => Promise<DirEntry[]> }): void;
}

// Global state for the directory picker
let resolvePromise: ((value: string | null) => void) | null = null;
let showCallback: ((options: DirectoryPickerOptions) => void) | null = null;
let fsAdapter: { readDir: (path: string) => Promise<DirEntry[]> } | null = null;

/**
 * Register the directory picker component's show callback
 */
export function registerDirectoryPicker(callback: (options: DirectoryPickerOptions) => void): void {
  showCallback = callback;
}

/**
 * Unregister the directory picker component
 */
export function unregisterDirectoryPicker(): void {
  showCallback = null;
}

/**
 * Set the file system adapter for directory listing
 */
export function setDirectoryPickerFsAdapter(adapter: { readDir: (path: string) => Promise<DirEntry[]> }): void {
  fsAdapter = adapter;
}

/**
 * Get the file system adapter
 */
export function getDirectoryPickerFsAdapter(): { readDir: (path: string) => Promise<DirEntry[]> } | null {
  return fsAdapter;
}

/**
 * Show the directory picker dialog
 */
export function showDirectoryPicker(options?: DirectoryPickerOptions): Promise<string | null> {
  return new Promise((resolve) => {
    if (!showCallback) {
      console.warn('[DirectoryPickerService] No directory picker registered, falling back to prompt');
      resolve(prompt('Enter folder path:'));
      return;
    }

    resolvePromise = resolve;
    showCallback(options || {});
  });
}

/**
 * Called when user selects a directory or cancels
 */
export function onDirectorySelected(path: string | null): void {
  if (resolvePromise) {
    resolvePromise(path);
    resolvePromise = null;
  }
}
