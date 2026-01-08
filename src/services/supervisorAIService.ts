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

import { getAdapter, type BackendAdapter, type TerminalDataEvent, type TerminalExitEvent } from '../adapters';
import { useSupervisorAIStore, type SupervisorSession, type AnalysisResult } from '../stores/supervisorAI';
import { useNotificationStore } from '../stores/notification';
import type { AIToolType } from '../stores/aiTools';
import {
  analyzeOutputWithPatterns,
  isOutputIdle,
  detectPromptWaiting,
  generateFollowUpInstruction,
  detectLoop,
  stripAnsiCodes,
} from '../utils/supervisorAnalyzer';

// Service state
let adapter: BackendAdapter | null = null;
let initialized = false;
let unlistenData: (() => void) | null = null;
let unlistenExit: (() => void) | null = null;

// Debounce timers for analysis
const analysisTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

// Output history for loop detection
const outputSnapshots: Map<string, string[]> = new Map();

/**
 * Initialize the Supervisor AI Service
 */
export async function initSupervisorAIService(): Promise<void> {
  if (initialized) return;
  
  try {
    adapter = await getAdapter();
    
    // Only run in Tauri environment
    if (adapter.type !== 'tauri') {
      console.log('[SupervisorAI Service] Not in Tauri environment, skipping initialization');
      return;
    }
    
    const supervisorStore = useSupervisorAIStore();
    await supervisorStore.initialize();
    
    // Setup PTY output listener
    setupOutputListener();
    
    // Setup PTY exit listener
    setupExitListener();
    
    // Setup idle check interval
    setupIdleChecker();
    
    initialized = true;
    console.log('[SupervisorAI Service] Initialized');
  } catch (error) {
    console.error('[SupervisorAI Service] Failed to initialize:', error);
  }
}

/**
 * Setup listener for PTY output events
 */
function setupOutputListener(): void {
  if (!adapter) return;
  
  unlistenData = adapter.terminal.onData((event: TerminalDataEvent) => {
    handlePtyOutput(event.ptyId, event.data);
  });
}

/**
 * Setup listener for PTY exit events
 */
function setupExitListener(): void {
  if (!adapter) return;
  
  unlistenExit = adapter.terminal.onExit((event: TerminalExitEvent) => {
    handlePtyExit(event.ptyId, event.exitCode);
  });
}

/**
 * Handle PTY output data
 */
function handlePtyOutput(ptyId: string, data: string): void {
  const supervisorStore = useSupervisorAIStore();
  
  // Find session by PTY ID
  const session = supervisorStore.getSessionByPtyId(ptyId);
  if (!session) return;
  
  // Skip if session is ended
  if (['completed', 'failed', 'stopped'].includes(session.status)) return;
  
  // Clean the data (strip ANSI codes for analysis)
  const cleanData = stripAnsiCodes(data);
  
  // Append to session buffer
  supervisorStore.appendOutput(session.id, cleanData);
  
  // Debounce analysis
  scheduleAnalysis(session.id);
}

/**
 * Handle PTY exit
 */
function handlePtyExit(ptyId: string, exitCode: number | null): void {
  const supervisorStore = useSupervisorAIStore();
  
  const session = supervisorStore.getSessionByPtyId(ptyId);
  if (!session) return;
  
  // Cancel any pending analysis
  const timer = analysisTimers.get(session.id);
  if (timer) {
    clearTimeout(timer);
    analysisTimers.delete(session.id);
  }
  
  // Determine final status based on exit code
  const finalStatus = exitCode === 0 ? 'completed' : 'failed';
  supervisorStore.endSession(session.id, finalStatus);
  
  // Notify user
  const notificationStore = useNotificationStore();
  const config = supervisorStore.config;
  
  if (finalStatus === 'completed' && config.notifyOnComplete) {
    notificationStore.addInfo(
      'Supervisor AI',
      'AI tool task completed successfully'
    );
  } else if (finalStatus === 'failed' && config.notifyOnError) {
    notificationStore.addError(
      'Supervisor AI',
      `AI tool task failed (exit code: ${exitCode})`
    );
  }
  
  // Cleanup
  outputSnapshots.delete(session.id);
  console.log('[SupervisorAI Service] Session ended:', session.id, 'status:', finalStatus);
}

/**
 * Schedule analysis with debouncing
 */
function scheduleAnalysis(sessionId: string): void {
  const supervisorStore = useSupervisorAIStore();
  const config = supervisorStore.config;
  
  // Clear existing timer
  const existingTimer = analysisTimers.get(sessionId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  // Schedule new analysis
  const timer = setTimeout(() => {
    analysisTimers.delete(sessionId);
    performAnalysis(sessionId);
  }, config.analysisDebounce * 1000);
  
  analysisTimers.set(sessionId, timer);
}

/**
 * Perform output analysis for a session
 */
async function performAnalysis(sessionId: string): Promise<void> {
  const supervisorStore = useSupervisorAIStore();
  const session = supervisorStore.getSession(sessionId);
  
  if (!session) return;
  if (['completed', 'failed', 'stopped', 'sending'].includes(session.status)) return;
  
  console.log('[SupervisorAI Service] Analyzing session:', sessionId);
  
  // Update status
  supervisorStore.updateSessionStatus(sessionId, 'analyzing');
  
  // Analyze with regex patterns
  const result = analyzeOutputWithPatterns(session.outputBuffer, session.toolType);
  
  // Record analysis
  supervisorStore.recordAnalysis(sessionId, result);
  
  // Store output snapshot for loop detection
  const snapshots = outputSnapshots.get(sessionId) || [];
  snapshots.push(session.outputBuffer.slice(-1000)); // Keep last 1000 chars
  if (snapshots.length > 5) snapshots.shift();
  outputSnapshots.set(sessionId, snapshots);
  
  // Check for loops
  if (detectLoop(snapshots)) {
    console.warn('[SupervisorAI Service] Loop detected in session:', sessionId);
    supervisorStore.endSession(sessionId, 'failed');
    
    const notificationStore = useNotificationStore();
    notificationStore.addWarning(
      'Supervisor AI',
      'Detected repetitive output loop, stopping session'
    );
    return;
  }
  
  // Handle analysis result
  await handleAnalysisResult(session, result);
}

/**
 * Handle analysis result and take appropriate action
 */
async function handleAnalysisResult(
  session: SupervisorSession,
  result: AnalysisResult
): Promise<void> {
  const supervisorStore = useSupervisorAIStore();
  const config = supervisorStore.config;
  
  console.log('[SupervisorAI Service] Analysis result:', result);
  
  switch (result.status) {
    case 'complete':
      supervisorStore.endSession(session.id, 'completed');
      if (config.notifyOnComplete) {
        const notificationStore = useNotificationStore();
        notificationStore.addInfo(
          'Supervisor AI',
          'AI tool completed the task'
        );
      }
      break;
      
    case 'error':
      // Check if we should retry
      if (!supervisorStore.hasReachedMaxIterations(session.id)) {
        supervisorStore.updateSessionStatus(session.id, 'waiting-input');
        
        if (session.autoMode && !config.requireConfirmation) {
          // Auto-send retry instruction
          const instruction = generateFollowUpInstruction(
            session.taskDescription,
            result,
            session.iterationCount
          );
          await sendInstruction(session.id, instruction);
        } else {
          // Wait for user decision
          const notificationStore = useNotificationStore();
          notificationStore.addWarning(
            'Supervisor AI',
            `Error detected - ${result.errorDetails || 'unknown error'}`
          );
        }
      } else {
        supervisorStore.endSession(session.id, 'failed');
        if (config.notifyOnError) {
          const notificationStore = useNotificationStore();
          notificationStore.addError(
            'Supervisor AI',
            'Max iterations reached after errors'
          );
        }
      }
      break;
      
    case 'needs-work':
      if (!supervisorStore.hasReachedMaxIterations(session.id)) {
        supervisorStore.updateSessionStatus(session.id, 'waiting-input');
        
        if (session.autoMode && !config.requireConfirmation) {
          const instruction = generateFollowUpInstruction(
            session.taskDescription,
            result,
            session.iterationCount
          );
          await sendInstruction(session.id, instruction);
        }
        // In manual mode, wait for user to send instruction
      } else {
        supervisorStore.endSession(session.id, 'failed');
        const notificationStore = useNotificationStore();
        notificationStore.addWarning(
          'Supervisor AI',
          'Max iterations reached'
        );
      }
      break;
      
    case 'unclear':
    default:
      // Keep monitoring
      supervisorStore.updateSessionStatus(session.id, 'monitoring');
      break;
  }
}

/**
 * Send an instruction to the AI tool
 */
export async function sendInstruction(
  sessionId: string,
  instruction: string
): Promise<boolean> {
  if (!adapter) return false;
  
  const supervisorStore = useSupervisorAIStore();
  const session = supervisorStore.getSession(sessionId);
  
  if (!session) {
    console.error('[SupervisorAI Service] Session not found:', sessionId);
    return false;
  }
  
  if (supervisorStore.hasReachedMaxIterations(sessionId)) {
    console.warn('[SupervisorAI Service] Max iterations reached for session:', sessionId);
    return false;
  }
  
  try {
    supervisorStore.updateSessionStatus(sessionId, 'sending');
    
    // Write instruction to PTY
    await adapter.terminal.write(session.ptyId, instruction + '\n');
    
    // Record the instruction
    supervisorStore.recordInstruction(sessionId, instruction);
    
    // Update status back to monitoring
    supervisorStore.updateSessionStatus(sessionId, 'monitoring');
    
    // Notify if configured
    const config = supervisorStore.config;
    if (config.notifyOnIteration) {
      const notificationStore = useNotificationStore();
      notificationStore.addInfo(
        'Supervisor AI',
        `Sent instruction (iteration ${session.iterationCount + 1})`
      );
    }
    
    console.log('[SupervisorAI Service] Instruction sent to session:', sessionId);
    return true;
  } catch (error) {
    console.error('[SupervisorAI Service] Failed to send instruction:', error);
    supervisorStore.updateSessionStatus(sessionId, 'monitoring');
    return false;
  }
}

/**
 * Setup idle checker interval
 */
function setupIdleChecker(): void {
  // Check for idle sessions every 5 seconds
  setInterval(() => {
    checkIdleSessions();
  }, 5000);
}

/**
 * Check for idle sessions and trigger analysis
 */
function checkIdleSessions(): void {
  const supervisorStore = useSupervisorAIStore();
  
  supervisorStore.activeSessions.forEach(session => {
    if (session.status !== 'monitoring' && session.status !== 'idle') return;
    
    const idleTimeout = supervisorStore.getSessionIdleTimeout(session.id);
    
    if (isOutputIdle(session.outputBuffer, session.lastOutputTime, idleTimeout)) {
      console.log('[SupervisorAI Service] Session idle, triggering analysis:', session.id);
      
      // Check if prompt is waiting for input
      if (detectPromptWaiting(session.outputBuffer, session.toolType)) {
        supervisorStore.updateSessionStatus(session.id, 'waiting-input');
        
        // In auto mode, send continue instruction
        if (session.autoMode && !supervisorStore.config.requireConfirmation) {
          if (!supervisorStore.hasReachedMaxIterations(session.id)) {
            const instruction = generateFollowUpInstruction(
              session.taskDescription,
              { status: 'needs-work', confidence: 0.7, reason: 'Idle and waiting for input' },
              session.iterationCount
            );
            sendInstruction(session.id, instruction);
          }
        }
      } else {
        // Trigger analysis
        performAnalysis(session.id);
      }
    }
  });
}

/**
 * Start monitoring an AI tool execution
 */
export function startMonitoring(
  ptyId: string,
  tabId: string,
  toolType: AIToolType,
  taskDescription: string,
  options?: {
    maxIterations?: number;
    idleTimeout?: number;
    autoMode?: boolean;
  }
): string | null {
  const supervisorStore = useSupervisorAIStore();
  
  if (!supervisorStore.config.enabled) {
    console.log('[SupervisorAI Service] Supervisor is disabled');
    return null;
  }
  
  if (!supervisorStore.shouldMonitorTool(toolType)) {
    console.log('[SupervisorAI Service] Tool type not configured for monitoring:', toolType);
    return null;
  }
  
  // Check if already monitoring this PTY
  const existing = supervisorStore.getSessionByPtyId(ptyId);
  if (existing) {
    console.warn('[SupervisorAI Service] Already monitoring PTY:', ptyId);
    return existing.id;
  }
  
  // Create new session
  const session = supervisorStore.createSession(
    ptyId,
    tabId,
    toolType,
    taskDescription,
    options
  );
  
  console.log('[SupervisorAI Service] Started monitoring:', session.id, 'tool:', toolType);
  
  return session.id;
}

/**
 * Stop monitoring a session
 */
export function stopMonitoring(sessionId: string): void {
  const supervisorStore = useSupervisorAIStore();
  
  // Cancel any pending analysis
  const timer = analysisTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    analysisTimers.delete(sessionId);
  }
  
  supervisorStore.endSession(sessionId, 'stopped');
  outputSnapshots.delete(sessionId);
  
  console.log('[SupervisorAI Service] Stopped monitoring:', sessionId);
}

/**
 * Get session status
 */
export function getSessionStatus(sessionId: string): SupervisorSession | undefined {
  const supervisorStore = useSupervisorAIStore();
  return supervisorStore.getSession(sessionId);
}

/**
 * Dispose the Supervisor AI Service
 */
export function disposeSupervisorAIService(): void {
  if (unlistenData) {
    unlistenData();
    unlistenData = null;
  }
  
  if (unlistenExit) {
    unlistenExit();
    unlistenExit = null;
  }
  
  // Clear all timers
  analysisTimers.forEach(timer => clearTimeout(timer));
  analysisTimers.clear();
  
  // Clear snapshots
  outputSnapshots.clear();
  
  initialized = false;
  adapter = null;
  
  console.log('[SupervisorAI Service] Disposed');
}

/**
 * Check if service is initialized
 */
export function isServiceInitialized(): boolean {
  return initialized;
}

/**
 * Get all active sessions
 */
export function getActiveSessions(): SupervisorSession[] {
  const supervisorStore = useSupervisorAIStore();
  return supervisorStore.activeSessions;
}

/**
 * Manually trigger analysis for a session
 */
export function triggerAnalysis(sessionId: string): void {
  // Clear any pending timer
  const timer = analysisTimers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    analysisTimers.delete(sessionId);
  }
  
  performAnalysis(sessionId);
}
