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

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { getAdapter, type BackendAdapter } from '../adapters';
import type { AIToolType } from './aiTools';

/**
 * Supervisor AI Session Status
 */
export type SupervisorSessionStatus = 
  | 'idle'           // Waiting for AI tool output
  | 'monitoring'     // Actively monitoring output
  | 'analyzing'      // Analyzing output to determine next action
  | 'waiting-input'  // Waiting for user decision
  | 'sending'        // Sending instruction to AI tool
  | 'completed'      // Task completed successfully
  | 'failed'         // Task failed after max iterations or error
  | 'stopped';       // Manually stopped by user

/**
 * Supervisor AI Analysis Result
 */
export interface AnalysisResult {
  status: 'complete' | 'needs-work' | 'error' | 'unclear';
  confidence: number;        // 0-1 confidence score
  reason: string;            // Human-readable explanation
  suggestedAction?: string;  // Suggested next instruction (if needs-work)
  errorDetails?: string;     // Error details (if error)
}

/**
 * Supervisor AI Session - represents one monitored AI tool execution
 */
export interface SupervisorSession {
  id: string;
  ptyId: string;                      // PTY identifier of the AI tool terminal
  tabId: string;                      // Terminal tab ID
  toolType: AIToolType;               // Type of AI tool being monitored
  taskDescription: string;            // Original task description/prompt
  status: SupervisorSessionStatus;
  
  // Output tracking
  outputBuffer: string;               // Accumulated output (sliding window)
  lastOutputTime: number;             // Timestamp of last output received
  
  // Iteration tracking
  iterationCount: number;             // Number of iterations/instructions sent
  maxIterations: number;              // Maximum allowed iterations
  
  // History
  analysisHistory: AnalysisResult[];  // History of analysis results
  instructionHistory: string[];       // History of instructions sent
  
  // Loop detection
  duplicateInstructionCount: number;  // Count of consecutive duplicate instructions
  lastInstructionHash: string | null; // Hash of last instruction for duplicate detection
  
  // Timing
  startTime: number;
  lastAnalysisTime?: number;
  
  // Configuration overrides (per-session)
  idleTimeout?: number;               // Override global idle timeout
  autoMode?: boolean;                 // Auto-send instructions without confirmation
}

/**
 * Supervisor AI Configuration
 */
export interface SupervisorConfig {
  enabled: boolean;                   // Global enable/disable
  
  // Monitored tools
  monitoredTools: AIToolType[];       // Which AI tools to monitor
  
  // Timing settings
  idleTimeout: number;                // Seconds of idle before triggering analysis (default: 30)
  analysisDebounce: number;           // Debounce time for analysis (default: 2s)
  
  // Iteration limits
  defaultMaxIterations: number;       // Default max iterations per session (default: 5)
  globalMaxIterations: number;        // Hard limit across all sessions (default: 20)
  
  // Loop detection settings
  loopDetectionEnabled: boolean;      // Enable loop detection (default: true)
  loopDetectionThreshold: number;     // Number of duplicate instructions before triggering (default: 2)
  autoRecoveryEnabled: boolean;       // Enable automatic recovery from loops (default: true)
  
  // Output buffer settings
  maxBufferLines: number;             // Max lines to keep in buffer (default: 500)
  maxBufferSize: number;              // Max buffer size in chars (default: 50000)
  
  // Analysis settings
  useRegexOnly: boolean;              // Only use regex patterns, no LLM (default: false)
  llmProvider?: string;               // LLM provider for analysis (optional)
  llmApiKey?: string;                 // LLM API key (optional)
  llmModel?: string;                  // LLM model to use (optional)
  
  // Auto mode settings
  autoModeEnabled: boolean;           // Enable auto-send mode (default: false)
  requireConfirmation: boolean;       // Require user confirmation before sending (default: true)
  
  // Notification settings
  notifyOnComplete: boolean;          // Notify when task completes (default: true)
  notifyOnError: boolean;             // Notify on errors (default: true)
  notifyOnIteration: boolean;         // Notify on each iteration (default: false)
}

/**
 * Default supervisor configuration
 */
export const defaultSupervisorConfig: SupervisorConfig = {
  enabled: false,
  monitoredTools: ['claude-code', 'codex', 'gemini-cli', 'opencode', 'codebuddy', 'droid', 'crush', 'kilocode'],
  idleTimeout: 30,
  analysisDebounce: 2,
  defaultMaxIterations: 5,
  globalMaxIterations: 20,
  maxBufferLines: 500,
  maxBufferSize: 50000,
  useRegexOnly: false,
  autoModeEnabled: false,
  requireConfirmation: true,
  notifyOnComplete: true,
  notifyOnError: true,
  notifyOnIteration: false,
  loopDetectionEnabled: true,
  loopDetectionThreshold: 2,
  autoRecoveryEnabled: true,
};

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `supervisor-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Supervisor AI Store
 */
export const useSupervisorAIStore = defineStore('supervisorAI', () => {
  // Configuration
  const config = ref<SupervisorConfig>({ ...defaultSupervisorConfig });
  
  // Active sessions
  const sessions = ref<Map<string, SupervisorSession>>(new Map());
  
  // Initialization state
  const initialized = ref(false);
  
  // Adapter instance
  let adapter: BackendAdapter | null = null;
  
  // Get adapter instance
  const getAdapterInstance = async (): Promise<BackendAdapter> => {
    if (!adapter) {
      adapter = await getAdapter();
    }
    return adapter;
  };
  
  // Computed properties
  const activeSessions = computed(() => {
    return Array.from(sessions.value.values()).filter(
      s => !['completed', 'failed', 'stopped'].includes(s.status)
    );
  });
  
  const sessionCount = computed(() => sessions.value.size);
  
  const activeSessionCount = computed(() => activeSessions.value.length);
  
  const totalIterations = computed(() => {
    let total = 0;
    sessions.value.forEach(s => {
      total += s.iterationCount;
    });
    return total;
  });
  
  /**
   * Initialize the store - load configuration from storage
   */
  async function initialize() {
    if (initialized.value) return;
    
    try {
      const adapterInstance = await getAdapterInstance();
      const savedConfig = await adapterInstance.storage.get<SupervisorConfig>('supervisorAIConfig');
      
      if (savedConfig) {
        config.value = { ...defaultSupervisorConfig, ...savedConfig };
      }
      
      initialized.value = true;
      console.log('[SupervisorAI Store] Initialized with config:', config.value);
    } catch (error) {
      console.error('[SupervisorAI Store] Failed to initialize:', error);
      initialized.value = true; // Still mark as initialized to prevent retry loops
    }
  }
  
  /**
   * Save configuration to storage
   */
  async function saveConfig() {
    try {
      const adapterInstance = await getAdapterInstance();
      await adapterInstance.storage.set('supervisorAIConfig', config.value);
      await adapterInstance.storage.save();
      console.log('[SupervisorAI Store] Config saved');
    } catch (error) {
      console.error('[SupervisorAI Store] Failed to save config:', error);
    }
  }
  
  /**
   * Update configuration
   */
  async function updateConfig(updates: Partial<SupervisorConfig>) {
    config.value = { ...config.value, ...updates };
    await saveConfig();
  }
  
  /**
   * Create a new supervisor session
   */
  function createSession(
    ptyId: string,
    tabId: string,
    toolType: AIToolType,
    taskDescription: string,
    options?: {
      maxIterations?: number;
      idleTimeout?: number;
      autoMode?: boolean;
    }
  ): SupervisorSession {
    const session: SupervisorSession = {
      id: generateSessionId(),
      ptyId,
      tabId,
      toolType,
      taskDescription,
      status: 'idle',
      outputBuffer: '',
      lastOutputTime: Date.now(),
      iterationCount: 0,
      maxIterations: options?.maxIterations ?? config.value.defaultMaxIterations,
      analysisHistory: [],
      instructionHistory: [],
      startTime: Date.now(),
      idleTimeout: options?.idleTimeout,
      autoMode: options?.autoMode ?? config.value.autoModeEnabled,
      duplicateInstructionCount: 0,
      lastInstructionHash: null,
    };
    
    sessions.value.set(session.id, session);
    console.log('[SupervisorAI Store] Created session:', session.id, 'for PTY:', ptyId);
    
    return session;
  }
  
  /**
   * Get session by ID
   */
  function getSession(sessionId: string): SupervisorSession | undefined {
    return sessions.value.get(sessionId);
  }
  
  /**
   * Get session by PTY ID
   */
  function getSessionByPtyId(ptyId: string): SupervisorSession | undefined {
    return Array.from(sessions.value.values()).find(s => s.ptyId === ptyId);
  }
  
  /**
   * Get session by Tab ID
   */
  function getSessionByTabId(tabId: string): SupervisorSession | undefined {
    return Array.from(sessions.value.values()).find(s => s.tabId === tabId);
  }
  
  /**
   * Update session status
   */
  function updateSessionStatus(sessionId: string, status: SupervisorSessionStatus) {
    const session = sessions.value.get(sessionId);
    if (session) {
      session.status = status;
      console.log('[SupervisorAI Store] Session', sessionId, 'status updated to:', status);
    }
  }
  
  /**
   * Append output to session buffer
   */
  function appendOutput(sessionId: string, data: string) {
    const session = sessions.value.get(sessionId);
    if (!session) return;
    
    session.outputBuffer += data;
    session.lastOutputTime = Date.now();
    
    // Trim buffer if too large
    if (session.outputBuffer.length > config.value.maxBufferSize) {
      const lines = session.outputBuffer.split('\n');
      const trimmedLines = lines.slice(-config.value.maxBufferLines);
      session.outputBuffer = trimmedLines.join('\n');
    }
    
    // Update status to monitoring if was idle
    if (session.status === 'idle') {
      session.status = 'monitoring';
    }
  }
  
  /**
   * Record an analysis result
   */
  function recordAnalysis(sessionId: string, result: AnalysisResult) {
    const session = sessions.value.get(sessionId);
    if (session) {
      session.analysisHistory.push(result);
      session.lastAnalysisTime = Date.now();
    }
  }
  
  /**
   * Simple hash function for loop detection
   * Based on djb2 algorithm - fast and effective for short strings
   * Returns hex string representation of 32-bit signed integer hash
   */
  function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash | 0; // Convert to 32bit signed integer
    }
    return hash.toString(16);
  }
  
  /**
   * Check if the agent is stuck in a loop
   */
  function isStuckInLoop(sessionId: string, instruction: string): boolean {
    const session = sessions.value.get(sessionId);
    if (!session || !config.value.loopDetectionEnabled) {
      return false;
    }
    
    // Calculate hash of the current instruction
    const instructionHash = simpleHash(instruction.trim().toLowerCase());
    
    // Check if this is the same as the last instruction
    if (session.lastInstructionHash === instructionHash) {
      session.duplicateInstructionCount++;
    } else {
      // Reset counter if instruction is different
      session.duplicateInstructionCount = 0;
      session.lastInstructionHash = instructionHash;
    }
    
    // Check if we've exceeded the threshold
    return session.duplicateInstructionCount >= config.value.loopDetectionThreshold;
  }
  
  /**
   * Generate recovery suggestion when loop is detected
   * Uses deterministic rotation based on iteration count for predictable behavior
   */
  function generateRecoverySuggestion(sessionId: string): string {
    const session = sessions.value.get(sessionId);
    if (!session) {
      return 'Try a different approach.';
    }
    
    const suggestions = [
      'The previous approach seems to be repeating. Consider trying a completely different strategy.',
      'Loop detected: The same instruction has been sent multiple times. Try breaking down the task into smaller steps.',
      'You appear to be stuck. Take a step back and analyze what went wrong in the previous attempts.',
      'Repeated actions detected. Try examining the error messages more carefully and adjust your approach.',
      'Pattern repetition noticed. Consider using alternative tools or commands to achieve the goal.',
    ];
    
    // Use iteration count for deterministic rotation, making testing easier
    const suggestionIndex = session.iterationCount % suggestions.length;
    return suggestions[suggestionIndex];
  }
  
  /**
   * Handle stuck state by suggesting recovery
   */
  function handleStuckState(sessionId: string): string | null {
    if (!config.value.autoRecoveryEnabled) {
      return null;
    }
    
    const suggestion = generateRecoverySuggestion(sessionId);
    console.log(`[SupervisorAI Store] Loop detected in session ${sessionId}, suggesting recovery: ${suggestion}`);
    
    return suggestion;
  }
  
  /**
   * Record an instruction sent
   */
  function recordInstruction(sessionId: string, instruction: string) {
    const session = sessions.value.get(sessionId);
    if (session) {
      // Check for loop first, before recording
      const isLoop = isStuckInLoop(sessionId, instruction);
      
      // Record the instruction
      session.instructionHistory.push(instruction);
      session.iterationCount++;
      
      // If loop detected and auto-recovery enabled, add recovery suggestion
      if (isLoop && config.value.autoRecoveryEnabled) {
        const recoverySuggestion = handleStuckState(sessionId);
        if (recoverySuggestion) {
          session.instructionHistory.push(`[AUTO-RECOVERY] ${recoverySuggestion}`);
        }
      }
    }
  }
  
  /**
   * Check if session has reached max iterations
   */
  function hasReachedMaxIterations(sessionId: string): boolean {
    const session = sessions.value.get(sessionId);
    if (!session) return true;
    
    // Check session limit
    if (session.iterationCount >= session.maxIterations) {
      return true;
    }
    
    // Check global limit
    if (totalIterations.value >= config.value.globalMaxIterations) {
      return true;
    }
    
    return false;
  }
  
  /**
   * End a session
   */
  function endSession(sessionId: string, status: 'completed' | 'failed' | 'stopped') {
    const session = sessions.value.get(sessionId);
    if (session) {
      session.status = status;
      console.log('[SupervisorAI Store] Session', sessionId, 'ended with status:', status);
    }
  }
  
  /**
   * Remove a session (cleanup)
   */
  function removeSession(sessionId: string) {
    sessions.value.delete(sessionId);
    console.log('[SupervisorAI Store] Session', sessionId, 'removed');
  }
  
  /**
   * Clear all sessions
   */
  function clearAllSessions() {
    sessions.value.clear();
    console.log('[SupervisorAI Store] All sessions cleared');
  }
  
  /**
   * Clear completed/failed/stopped sessions
   */
  function clearEndedSessions() {
    const toRemove: string[] = [];
    sessions.value.forEach((session, id) => {
      if (['completed', 'failed', 'stopped'].includes(session.status)) {
        toRemove.push(id);
      }
    });
    toRemove.forEach(id => sessions.value.delete(id));
    console.log('[SupervisorAI Store] Cleared', toRemove.length, 'ended sessions');
  }
  
  /**
   * Check if a tool type should be monitored
   */
  function shouldMonitorTool(toolType: AIToolType): boolean {
    return config.value.enabled && config.value.monitoredTools.includes(toolType);
  }
  
  /**
   * Get idle timeout for a session (session override or global)
   */
  function getSessionIdleTimeout(sessionId: string): number {
    const session = sessions.value.get(sessionId);
    return session?.idleTimeout ?? config.value.idleTimeout;
  }
  
  return {
    // State
    config,
    sessions,
    initialized,
    
    // Computed
    activeSessions,
    sessionCount,
    activeSessionCount,
    totalIterations,
    
    // Methods
    initialize,
    saveConfig,
    updateConfig,
    createSession,
    getSession,
    getSessionByPtyId,
    getSessionByTabId,
    updateSessionStatus,
    appendOutput,
    recordAnalysis,
    recordInstruction,
    hasReachedMaxIterations,
    endSession,
    removeSession,
    clearAllSessions,
    clearEndedSessions,
    shouldMonitorTool,
    getSessionIdleTimeout,
    isStuckInLoop,
    generateRecoverySuggestion,
    handleStuckState,
  };
});
