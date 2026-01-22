/**
 * Rebebuca
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { AIToolType } from '../stores/aiTools';
import type { AnalysisResult } from '../stores/supervisorAI';

/**
 * Output patterns for detecting AI tool states
 */
export interface OutputPatterns {
  // Patterns indicating task completion
  completion: RegExp[];
  // Patterns indicating errors/failures
  error: RegExp[];
  // Patterns indicating the tool is waiting for input
  waitingInput: RegExp[];
  // Patterns indicating the tool is still working
  working: RegExp[];
  // Patterns to extract error messages
  errorExtract: RegExp[];
}

/**
 * AI tool-specific output patterns
 * These patterns help detect the state of each AI CLI tool
 */
export const AI_TOOL_PATTERNS: Record<AIToolType, OutputPatterns> = {
  'claude-code': {
    completion: [
      /Task completed successfully/i,
      /All changes have been applied/i,
      /Done\./i,
      /✓ Complete/i,
      /Finished processing/i,
      /No more changes needed/i,
    ],
    error: [
      /Error:/i,
      /Failed to/i,
      /Exception:/i,
      /✗ Failed/i,
      /Permission denied/i,
      /Command failed/i,
      /ENOENT/i,
      /EACCES/i,
    ],
    waitingInput: [
      /\?\s*$/,
      /Press Enter to continue/i,
      /\[Y\/n\]/i,
      /\(y\/n\)/i,
      /Enter your choice/i,
      /What would you like/i,
      /How can I help/i,
      />\s*$/,
    ],
    working: [
      /Working\.\.\./i,
      /Processing/i,
      /Analyzing/i,
      /Reading files/i,
      /Writing to/i,
      /Searching/i,
      /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/, // Spinner characters
    ],
    errorExtract: [
      /Error:\s*(.+)/i,
      /Failed:\s*(.+)/i,
      /Exception:\s*(.+)/i,
    ],
  },
  
  'codex': {
    completion: [
      /Completed successfully/i,
      /All done/i,
      /Changes applied/i,
      /✓/,
      /Task finished/i,
    ],
    error: [
      /Error:/i,
      /Failed/i,
      /Exception/i,
      /✗/,
      /Could not/i,
      /Unable to/i,
    ],
    waitingInput: [
      /\?\s*$/,
      /Enter.*:/i,
      /\[Y\/n\]/i,
      /Confirm/i,
      />\s*$/,
    ],
    working: [
      /Processing/i,
      /Generating/i,
      /Thinking/i,
      /Loading/i,
    ],
    errorExtract: [
      /Error:\s*(.+)/i,
      /Failed:\s*(.+)/i,
    ],
  },
  
  'gemini-cli': {
    completion: [
      /Complete/i,
      /Done/i,
      /Finished/i,
      /✓/,
      /Successfully/i,
    ],
    error: [
      /Error:/i,
      /Failed/i,
      /Exception/i,
      /✗/,
      /API error/i,
    ],
    waitingInput: [
      /\?\s*$/,
      /Enter/i,
      /\[Y\/n\]/i,
      />\s*$/,
      /What.*\?/i,
    ],
    working: [
      /Generating/i,
      /Processing/i,
      /Thinking/i,
      /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,
    ],
    errorExtract: [
      /Error:\s*(.+)/i,
    ],
  },
  
  'opencode': {
    completion: [
      /✓ Done/i,
      /Completed/i,
      /All changes applied/i,
      /Finished/i,
    ],
    error: [
      /✗ Error/i,
      /Failed/i,
      /Exception/i,
      /Could not/i,
    ],
    waitingInput: [
      /\?\s*$/,
      />\s*$/,
      /Press.*continue/i,
      /\[Y\/n\]/i,
    ],
    working: [
      /Working/i,
      /Processing/i,
      /Analyzing/i,
    ],
    errorExtract: [
      /Error:\s*(.+)/i,
      /Failed:\s*(.+)/i,
    ],
  },
  
  'codebuddy': {
    completion: [
      /Task completed/i,
      /✓ Success/i,
      /Done/i,
      /Finished/i,
    ],
    error: [
      /Error:/i,
      /✗ Failed/i,
      /Exception/i,
    ],
    waitingInput: [
      /\?\s*$/,
      />\s*$/,
      /\[Y\/n\]/i,
      /How can I help/i,
    ],
    working: [
      /Processing/i,
      /Analyzing/i,
      /Thinking/i,
    ],
    errorExtract: [
      /Error:\s*(.+)/i,
    ],
  },
  
  'qoder-cli': {
    completion: [
      /Complete/i,
      /Done/i,
      /✓/,
      /Finished/i,
    ],
    error: [
      /Error/i,
      /Failed/i,
      /✗/,
    ],
    waitingInput: [
      /\?\s*$/,
      />\s*$/,
      /\[Y\/n\]/i,
    ],
    working: [
      /Processing/i,
      /Working/i,
    ],
    errorExtract: [
      /Error:\s*(.+)/i,
    ],
  },
  
  'copilot-cli': {
    completion: [
      /✓ Done/i,
      /Complete/i,
      /Finished/i,
      /All done/i,
    ],
    error: [
      /Error:/i,
      /Failed/i,
      /✗/,
      /Authentication failed/i,
    ],
    waitingInput: [
      /\?\s*$/,
      />\s*$/,
      /\[Y\/n\]/i,
      /Press Enter/i,
    ],
    working: [
      /Processing/i,
      /Generating/i,
      /Thinking/i,
    ],
    errorExtract: [
      /Error:\s*(.+)/i,
    ],
  },
  
  'droid': {
    completion: [
      /✓ Task complete/i,
      /Done/i,
      /Finished/i,
      /Successfully completed/i,
    ],
    error: [
      /Error:/i,
      /✗ Failed/i,
      /Exception/i,
      /Could not/i,
    ],
    waitingInput: [
      /\?\s*$/,
      />\s*$/,
      /\[Y\/n\]/i,
      /What would you like/i,
    ],
    working: [
      /Working/i,
      /Processing/i,
      /Analyzing/i,
      /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,
    ],
    errorExtract: [
      /Error:\s*(.+)/i,
      /Failed:\s*(.+)/i,
    ],
  },
  
  'augment-cli': {
    completion: [
      /Complete/i,
      /Done/i,
      /✓/,
      /Finished/i,
    ],
    error: [
      /Error/i,
      /Failed/i,
      /✗/,
    ],
    waitingInput: [
      /\?\s*$/,
      />\s*$/,
      /\[Y\/n\]/i,
    ],
    working: [
      /Processing/i,
      /Working/i,
      /Thinking/i,
    ],
    errorExtract: [
      /Error:\s*(.+)/i,
    ],
  },
  
  'cursor-cli': {
    completion: [
      /Complete/i,
      /Done/i,
      /✓/,
      /Finished/i,
      /All changes applied/i,
    ],
    error: [
      /Error/i,
      /Failed/i,
      /✗/,
      /Exception/i,
    ],
    waitingInput: [
      /\?\s*$/,
      />\s*$/,
      /\[Y\/n\]/i,
      /Press Enter/i,
    ],
    working: [
      /Processing/i,
      /Working/i,
      /Generating/i,
    ],
    errorExtract: [
      /Error:\s*(.+)/i,
    ],
  },
  
  'crush': {
    completion: [
      /✓ Done/i,
      /Complete/i,
      /Finished/i,
      /All changes applied/i,
    ],
    error: [
      /Error:/i,
      /✗ Failed/i,
      /Exception/i,
    ],
    waitingInput: [
      /\?\s*$/,
      />\s*$/,
      /\[Y\/n\]/i,
      /How can I help/i,
    ],
    working: [
      /Working/i,
      /Processing/i,
      /Thinking/i,
      /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,
    ],
    errorExtract: [
      /Error:\s*(.+)/i,
      /Failed:\s*(.+)/i,
    ],
  },
  
  'ampcode': {
    completion: [
      /✓ Complete/i,
      /Task completed/i,
      /Done/i,
      /Finished/i,
      /All changes applied/i,
      /Successfully/i,
    ],
    error: [
      /Error:/i,
      /Failed/i,
      /Exception/i,
      /✗/,
      /Permission denied/i,
      /Command failed/i,
    ],
    waitingInput: [
      /\?\s*$/,
      />\s*$/,
      /\[Y\/n\]/i,
      /\(y\/n\)/i,
      /Enter your choice/i,
      /What would you like/i,
      /How can I help/i,
    ],
    working: [
      /Working/i,
      /Processing/i,
      /Analyzing/i,
      /Generating/i,
      /Thinking/i,
      /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,
    ],
    errorExtract: [
      /Error:\s*(.+)/i,
      /Failed:\s*(.+)/i,
      /Exception:\s*(.+)/i,
    ],
  },
  
  'kilocode': {
    completion: [
      /Task completed/i,
      /✓ Done/i,
      /Finished/i,
      /All changes applied/i,
    ],
    error: [
      /Error:/i,
      /Failed/i,
      /Exception/i,
      /✗/,
    ],
    waitingInput: [
      /\?\s*$/,
      />\s*$/,
      /\[Y\/n\]/i,
      /Confirm/i,
    ],
    working: [
      /Processing/i,
      /Working/i,
      /Analyzing/i,
      /Thinking/i,
    ],
    errorExtract: [
      /Error:\s*(.+)/i,
      /Failed:\s*(.+)/i,
    ],
  },
};

/**
 * Generic patterns that work across most AI tools
 */
export const GENERIC_PATTERNS: OutputPatterns = {
  completion: [
    /\b(complete|done|finished|success)\b/i,
    /✓/,
    /All (changes|tasks|operations) (have been )?(applied|completed|finished)/i,
    /No (more )?(changes|work|tasks) needed/i,
  ],
  error: [
    /\b(error|failed|exception|fatal)\b/i,
    /✗/,
    /Permission denied/i,
    /ENOENT|EACCES|EPERM/i,
    /Command (failed|not found)/i,
    /Syntax error/i,
    /Type error/i,
  ],
  waitingInput: [
    /\?\s*$/,
    />\s*$/,
    /\[Y\/n\]/i,
    /\(yes\/no\)/i,
    /Press (Enter|any key)/i,
    /Enter your/i,
    /What would you like/i,
    /How can I help/i,
  ],
  working: [
    /\.\.\./,
    /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,
    /Processing/i,
    /Working/i,
    /Loading/i,
    /Analyzing/i,
    /Generating/i,
    /Thinking/i,
  ],
  errorExtract: [
    /Error:\s*(.+)/i,
    /Failed:\s*(.+)/i,
    /Exception:\s*(.+)/i,
  ],
};

/**
 * Analyze output using regex patterns
 */
export function analyzeOutputWithPatterns(
  output: string,
  toolType: AIToolType
): AnalysisResult {
  const patterns = AI_TOOL_PATTERNS[toolType] || GENERIC_PATTERNS;
  
  // Get the last portion of output (most recent activity)
  const recentOutput = getRecentOutput(output, 50); // Last 50 lines
  const lastLines = getRecentOutput(output, 5);     // Last 5 lines for immediate state
  
  // Check for errors first (highest priority)
  for (const pattern of patterns.error) {
    if (pattern.test(recentOutput)) {
      const errorDetails = extractErrorMessage(recentOutput, patterns.errorExtract);
      return {
        status: 'error',
        confidence: 0.9,
        reason: 'Detected error pattern in output',
        errorDetails,
      };
    }
  }
  
  // Check if waiting for input
  for (const pattern of patterns.waitingInput) {
    if (pattern.test(lastLines)) {
      return {
        status: 'needs-work',
        confidence: 0.8,
        reason: 'AI tool appears to be waiting for input',
        suggestedAction: 'continue',
      };
    }
  }
  
  // Check for completion
  for (const pattern of patterns.completion) {
    if (pattern.test(recentOutput)) {
      return {
        status: 'complete',
        confidence: 0.85,
        reason: 'Detected completion pattern in output',
      };
    }
  }
  
  // Check if still working
  for (const pattern of patterns.working) {
    if (pattern.test(lastLines)) {
      return {
        status: 'unclear',
        confidence: 0.6,
        reason: 'AI tool appears to still be working',
      };
    }
  }
  
  // Default: unclear state
  return {
    status: 'unclear',
    confidence: 0.3,
    reason: 'Could not determine state from output patterns',
  };
}

/**
 * Get the most recent lines of output
 */
function getRecentOutput(output: string, lineCount: number): string {
  const lines = output.split('\n');
  return lines.slice(-lineCount).join('\n');
}

/**
 * Extract error message from output
 */
function extractErrorMessage(output: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Fallback: look for lines containing "error"
  const lines = output.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/error/i.test(lines[i])) {
      return lines[i].trim();
    }
  }
  
  return 'Unknown error';
}

/**
 * Check if output indicates idle state (no recent activity)
 */
export function isOutputIdle(
  _output: string,
  lastOutputTime: number,
  idleTimeout: number
): boolean {
  const now = Date.now();
  const idleMs = idleTimeout * 1000;
  
  // Check time since last output
  if (now - lastOutputTime > idleMs) {
    return true;
  }
  
  return false;
}

/**
 * Detect if the output contains a prompt waiting for user input
 */
export function detectPromptWaiting(output: string, toolType: AIToolType): boolean {
  const patterns = AI_TOOL_PATTERNS[toolType] || GENERIC_PATTERNS;
  const lastLines = getRecentOutput(output, 3);
  
  for (const pattern of patterns.waitingInput) {
    if (pattern.test(lastLines)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate a follow-up instruction based on analysis
 */
export function generateFollowUpInstruction(
  taskDescription: string,
  analysisResult: AnalysisResult,
  iterationCount: number
): string {
  if (analysisResult.status === 'error') {
    return `The previous attempt encountered an error: ${analysisResult.errorDetails || 'unknown error'}. Please fix the issue and try again.`;
  }
  
  if (analysisResult.status === 'needs-work') {
    if (iterationCount === 0) {
      return taskDescription;
    }
    return 'Please continue with the task. If you need clarification, let me know what information you need.';
  }
  
  // For unclear status, ask for status
  return 'What is the current status? Have you completed the task or do you need more information?';
}

/**
 * Calculate similarity between two outputs (for loop detection)
 */
export function calculateOutputSimilarity(output1: string, output2: string): number {
  if (!output1 || !output2) return 0;
  
  // Simple Jaccard similarity on words
  const words1 = new Set(output1.toLowerCase().split(/\s+/));
  const words2 = new Set(output2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Detect if we're in a loop (similar outputs repeatedly)
 */
export function detectLoop(
  outputHistory: string[],
  threshold: number = 0.8
): boolean {
  if (outputHistory.length < 2) return false;
  
  const recent = outputHistory.slice(-3);
  
  for (let i = 0; i < recent.length - 1; i++) {
    for (let j = i + 1; j < recent.length; j++) {
      const similarity = calculateOutputSimilarity(recent[i], recent[j]);
      if (similarity > threshold) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Strip ANSI escape codes from output for cleaner analysis
 */
export function stripAnsiCodes(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
            .replace(/\x1b\][^\x07]*\x07/g, '') // OSC sequences
            .replace(/\x1b[PX^_][^\x1b]*\x1b\\/g, '') // Other sequences
            .replace(/[\x00-\x09\x0b\x0c\x0e-\x1f]/g, ''); // Control chars except \n \r
}
