/**
 * Rebebuca AI Service Layer - Permission Manager
 * Handle permission requests for file access, command execution, etc.
 */

import type { PermissionRequest, PermissionRule, PermissionReply, PermissionType } from '../types';
import { aiEventBus } from '../utils/eventBus';
import { generatePermissionId } from '../utils/id';

interface PendingRequest {
  request: PermissionRequest;
  resolve: () => void;
  reject: (error: Error) => void;
}

/**
 * Permission rejected by user
 */
export class PermissionRejectedError extends Error {
  constructor(message = 'Permission rejected by user') {
    super(message);
    this.name = 'PermissionRejectedError';
  }
}

/**
 * Permission denied by rule
 */
export class PermissionDeniedError extends Error {
  constructor(message = 'Permission denied by rule') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

class PermissionManager {
  private rules: PermissionRule[] = [];
  private pending = new Map<string, PendingRequest>();
  private sessionRules = new Map<string, PermissionRule[]>();

  constructor() {
    // Initialize default rules
    this.initDefaultRules();
  }

  private initDefaultRules(): void {
    // Default safe operations - always allow
    this.rules = [
      // Allow reading any file by default (will be shown in UI)
      { type: 'read', pattern: '*', action: 'allow' },
      // Allow glob/grep by default
      { type: 'read', pattern: '**/*', action: 'allow' },
    ];
  }

  /**
   * Add a permanent rule
   */
  addRule(rule: PermissionRule): void {
    // Remove existing rules for same type/pattern
    this.rules = this.rules.filter(
      r => !(r.type === rule.type && r.pattern === rule.pattern)
    );
    this.rules.push(rule);
  }

  /**
   * Add a session-specific rule (cleared when session ends)
   */
  addSessionRule(sessionId: string, rule: PermissionRule): void {
    if (!this.sessionRules.has(sessionId)) {
      this.sessionRules.set(sessionId, []);
    }
    const rules = this.sessionRules.get(sessionId)!;
    // Remove existing rules for same type/pattern
    const filtered = rules.filter(
      r => !(r.type === rule.type && r.pattern === rule.pattern)
    );
    filtered.push(rule);
    this.sessionRules.set(sessionId, filtered);
  }

  /**
   * Clear session-specific rules
   */
  clearSessionRules(sessionId: string): void {
    this.sessionRules.delete(sessionId);
  }

  /**
   * Evaluate permission for a specific pattern
   */
  private evaluate(
    type: PermissionType,
    pattern: string,
    sessionId?: string
  ): PermissionRule | null {
    // Check session rules first (higher priority)
    if (sessionId) {
      const sessionRules = this.sessionRules.get(sessionId) || [];
      const sessionMatch = this.findMatchingRule(sessionRules, type, pattern);
      if (sessionMatch) return sessionMatch;
    }

    // Check global rules
    return this.findMatchingRule(this.rules, type, pattern);
  }

  private findMatchingRule(
    rules: PermissionRule[],
    type: PermissionType,
    pattern: string
  ): PermissionRule | null {
    // Find the most specific matching rule (last match wins)
    let matched: PermissionRule | null = null;

    for (const rule of rules) {
      if (rule.type === type && this.matchPattern(pattern, rule.pattern)) {
        matched = rule;
      }
    }

    return matched;
  }

  /**
   * Simple wildcard pattern matching
   */
  private matchPattern(value: string, pattern: string): boolean {
    if (pattern === '*' || pattern === '**/*') {
      return true;
    }

    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '{{DOUBLESTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{DOUBLESTAR}}/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(value);
  }

  /**
   * Request permission
   * Returns a promise that resolves when permission is granted
   * Throws PermissionRejectedError if denied by user
   * Throws PermissionDeniedError if denied by rule
   */
  async request(
    request: Omit<PermissionRequest, 'id'>,
    sessionId?: string
  ): Promise<void> {
    // Check each pattern
    for (const pattern of request.patterns) {
      const rule = this.evaluate(request.type, pattern, sessionId);

      if (rule?.action === 'deny') {
        throw new PermissionDeniedError(
          `Permission denied for ${request.type}: ${pattern}`
        );
      }

      if (rule?.action === 'allow') {
        continue;
      }

      // Need to ask user
      const id = generatePermissionId();
      const fullRequest: PermissionRequest = { ...request, id };

      return new Promise<void>((resolve, reject) => {
        this.pending.set(id, { request: fullRequest, resolve, reject });
        
        // Emit event for UI to show permission dialog
        aiEventBus.emit('permission:request', { request: fullRequest });
      });
    }
  }

  /**
   * Reply to a permission request
   */
  reply(requestId: string, replyAction: PermissionReply, optSessionId?: string): void {
    const pending = this.pending.get(requestId);
    if (!pending) {
      console.warn(`[PermissionManager] No pending request found: ${requestId}`);
      return;
    }

    this.pending.delete(requestId);
    const req = pending.request;

    switch (replyAction) {
      case 'allow':
        pending.resolve();
        break;

      case 'always':
        // Add rule for future requests
        for (const pattern of req.patterns) {
          if (optSessionId) {
            this.addSessionRule(optSessionId, {
              type: req.type,
              pattern,
              action: 'allow',
            });
          } else {
            this.addRule({
              type: req.type,
              pattern,
              action: 'allow',
            });
          }
        }
        pending.resolve();
        
        // Also auto-approve any similar pending requests
        this.autoApproveSimilar(req.type, req.patterns, optSessionId);
        break;

      case 'deny':
        pending.reject(new PermissionRejectedError());
        
        // Also reject similar pending requests
        this.rejectSimilar(req.type, req.patterns);
        break;
    }

    // Emit reply event
    aiEventBus.emit('permission:reply', { requestId, reply: replyAction });
  }

  private autoApproveSimilar(
    type: PermissionType,
    patterns: string[],
    _sessionId?: string
  ): void {
    for (const [id, pending] of this.pending.entries()) {
      if (pending.request.type === type) {
        const allMatch = pending.request.patterns.every(p =>
          patterns.some(approved => this.matchPattern(p, approved))
        );
        if (allMatch) {
          this.pending.delete(id);
          pending.resolve();
        }
      }
    }
  }

  private rejectSimilar(type: PermissionType, patterns: string[]): void {
    for (const [id, pending] of this.pending.entries()) {
      if (pending.request.type === type) {
        const anyMatch = pending.request.patterns.some(p =>
          patterns.some(rejected => this.matchPattern(p, rejected))
        );
        if (anyMatch) {
          this.pending.delete(id);
          pending.reject(new PermissionRejectedError());
        }
      }
    }
  }

  /**
   * Cancel all pending requests for a session
   */
  cancelSession(sessionId: string): void {
    for (const [id, pending] of this.pending.entries()) {
      this.pending.delete(id);
      pending.reject(new PermissionRejectedError('Session cancelled'));
    }
    this.clearSessionRules(sessionId);
  }

  /**
   * Get all pending requests
   */
  getPendingRequests(): PermissionRequest[] {
    return Array.from(this.pending.values()).map(p => p.request);
  }

  /**
   * Check if a specific operation would require user confirmation
   */
  wouldRequirePermission(
    type: PermissionType,
    pattern: string,
    sessionId?: string
  ): boolean {
    const rule = this.evaluate(type, pattern, sessionId);
    return !rule || rule.action === 'ask';
  }
}

// Singleton instance
export const permissionManager = new PermissionManager();
