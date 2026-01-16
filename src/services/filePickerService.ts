/**
 * File Picker Service
 * 
 * Provides a way to show file picker dialog from non-Vue code (like adapters)
 */

import type { DirEntry } from '../adapters/types';

export interface FilePickerOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface FilePickerService {
  show(options?: FilePickerOptions): Promise<string | null>;
  setFsAdapter(adapter: { readDir: (path: string) => Promise<DirEntry[]> }): void;
}

// Global state for the file picker
let resolvePromise: ((value: string | null) => void) | null = null;
let showCallback: ((options: FilePickerOptions) => void) | null = null;
let fsAdapter: { readDir: (path: string) => Promise<DirEntry[]> } | null = null;

/**
 * Register the file picker component's show callback
 */
export function registerFilePicker(callback: (options: FilePickerOptions) => void): void {
  showCallback = callback;
}

/**
 * Unregister the file picker component
 */
export function unregisterFilePicker(): void {
  showCallback = null;
}

/**
 * Set the file system adapter for file listing
 */
export function setFilePickerFsAdapter(adapter: { readDir: (path: string) => Promise<DirEntry[]> }): void {
  fsAdapter = adapter;
}

/**
 * Get the file system adapter
 */
export function getFilePickerFsAdapter(): { readDir: (path: string) => Promise<DirEntry[]> } | null {
  return fsAdapter;
}

/**
 * Show the file picker dialog
 */
export function showFilePicker(options?: FilePickerOptions): Promise<string | null> {
  return new Promise((resolve) => {
    if (!showCallback) {
      console.warn('[FilePickerService] No file picker registered, falling back to prompt');
      resolve(prompt('Enter file path:'));
      return;
    }

    resolvePromise = resolve;
    showCallback(options || {});
  });
}

/**
 * Called when user selects a file or cancels
 */
export function onFileSelected(path: string | null): void {
  if (resolvePromise) {
    resolvePromise(path);
    resolvePromise = null;
  }
}
