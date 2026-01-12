/**
 * Rebebuca AI Service Layer - ID Generator
 * Generate unique IDs for sessions, messages, tools, etc.
 */

let counter = 0;

/**
 * Generate a unique ID with optional prefix
 */
export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const count = (counter++).toString(36);
  
  const id = `${timestamp}${random}${count}`;
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Generate session ID
 */
export function generateSessionId(): string {
  return generateId('session');
}

/**
 * Generate message ID
 */
export function generateMessageId(): string {
  return generateId('msg');
}

/**
 * Generate tool call ID
 */
export function generateToolCallId(): string {
  return generateId('call');
}

/**
 * Generate permission request ID
 */
export function generatePermissionId(): string {
  return generateId('perm');
}
