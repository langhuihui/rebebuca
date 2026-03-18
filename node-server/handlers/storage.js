/**
 * Storage Handler
 *
 * A simple key-value store backed by a JSON file on disk.
 * Replaces Tauri's plugin-store with a Node.js-native implementation.
 *
 * Writes are debounced: changes accumulate in memory and are flushed to
 * disk after a short idle period (or on explicit `save()` calls).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// Storage file location: ~/.rebebuca/store.json
const STORE_DIR = path.join(os.homedir(), '.rebebuca');
const STORE_PATH = path.join(STORE_DIR, 'store.json');

/** In-memory cache of the store */
let cache = null;

/** Pending debounce timer */
let flushTimer = null;
const FLUSH_DELAY_MS = 500;

/**
 * Load the store from disk (lazy).
 */
function load() {
  if (cache !== null) return;

  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      cache = JSON.parse(raw);
    } else {
      cache = {};
    }
  } catch (err) {
    console.warn('[Storage] Failed to load store, starting fresh:', err.message);
    cache = {};
  }
}

/**
 * Persist the in-memory store to disk (synchronous).
 */
export function save() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  load();
  try {
    fs.mkdirSync(STORE_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error('[Storage] Failed to save store:', err.message);
  }
}

/**
 * Schedule a debounced flush so rapid successive writes don't cause
 * excessive disk I/O.
 */
function scheduleSave() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(save, FLUSH_DELAY_MS);
}

/**
 * Get a value by key. Returns null if not found.
 */
export function get(key) {
  load();
  const value = cache[key];
  return value !== undefined ? value : null;
}

/**
 * Set a value by key. Schedules a debounced disk flush.
 */
export function set(key, value) {
  load();
  cache[key] = value;
  scheduleSave();
}

/**
 * Delete a value by key. Schedules a debounced disk flush.
 */
export function del(key) {
  load();
  delete cache[key];
  scheduleSave();
}
