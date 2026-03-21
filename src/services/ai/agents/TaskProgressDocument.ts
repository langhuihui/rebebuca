/**
 * Rebebuca AI Agent System - Task Progress Document
 * Copyright (C) 2025 rebebuca contributors
 *
 * Provides persistent task progress documentation for Supervisor-Worker coordination.
 * - Worker writes progress updates to document
 * - Supervisor reads document to evaluate task completion when Worker stops
 */

import type { TaskGoal, TaskProgress } from './types';
import type { FileSystemAdapter, DirEntry, FileInfo } from '../../../adapters/types';

export interface ProgressDocument {
  version: string;
  sessionId: string;
  goal: TaskGoal;
  startedAt: number;
  updatedAt: number;
  progress: TaskProgress;
  completedItems: CompletedItem[];
  recentActions: RecentAction[];
  status: 'running' | 'paused' | 'stopped' | 'completed' | 'error';
  workerHeartbeat: number;
  error?: {
    message: string;
    occurredAt: number;
  };
}

export interface CompletedItem {
  description: string;
  completedAt: number;
  files?: string[];
}

export interface RecentAction {
  action: string;
  timestamp: number;
  tool?: string;
  result?: string;
}

export class TaskProgressDocument {
  private documentPath: string;
  private document: ProgressDocument;
  private dirty: boolean = false;
  private fs: FileSystemAdapter;

  constructor(config: {
    projectPath: string;
    sessionId: string;
    goal: TaskGoal;
    fsAdapter?: FileSystemAdapter;
  }) {
    this.documentPath = `${config.projectPath}/.task-progress.json`;
    this.fs = config.fsAdapter ?? this.createDefaultFsAdapter();
    this.document = {
      version: '1.0.0',
      sessionId: config.sessionId,
      goal: config.goal,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      progress: {
        currentStep: 0,
        totalSteps: config.goal.acceptanceCriteria.length * 3,
        completedMilestones: [],
        currentAction: '准备开始',
        isStuck: false,
        stuckCount: 0,
      },
      completedItems: [],
      recentActions: [],
      status: 'running',
      workerHeartbeat: Date.now(),
    };
  }

  private createDefaultFsAdapter(): FileSystemAdapter {
    return {
      async readTextFile(path: string): Promise<string> {
        const response = await fetch(`file://${path}`);
        if (!response.ok) throw new Error(`Failed to read ${path}`);
        return response.text();
      },
      async writeTextFile(_path: string, _content: string): Promise<void> {
        throw new Error('writeTextFile not available in web mode');
      },
      async readDir(): Promise<DirEntry[]> { return []; },
      async exists(): Promise<boolean> { return false; },
      async stat(): Promise<FileInfo> { throw new Error('Not implemented'); },
      async mkdir(): Promise<void> { throw new Error('Not implemented'); },
      async remove(): Promise<void> { throw new Error('Not implemented'); },
    };
  }

  async initialize(): Promise<void> {
    try {
      const existing = await this.fs.readTextFile(this.documentPath);
      this.document = JSON.parse(existing);
      this.document.status = 'running';
      this.document.workerHeartbeat = Date.now();
      this.document.updatedAt = Date.now();
      this.dirty = true;
    } catch {
      this.dirty = true;
    }
  }

  async save(): Promise<void> {
    if (!this.dirty) return;

    try {
      this.document.updatedAt = Date.now();
      await this.fs.writeTextFile(this.documentPath, JSON.stringify(this.document, null, 2));
      this.dirty = false;
    } catch (error) {
      console.error('[ProgressDocument] Failed to save:', error);
    }
  }

  updateProgress(updates: Partial<TaskProgress>): void {
    this.document.progress = { ...this.document.progress, ...updates };
    this.dirty = true;
  }

  addCompletedItem(item: Omit<CompletedItem, 'completedAt'>): void {
    this.document.completedItems.push({
      ...item,
      completedAt: Date.now(),
    });
    this.dirty = true;
  }

  addAction(action: Omit<RecentAction, 'timestamp'>): void {
    this.document.recentActions.push({
      ...action,
      timestamp: Date.now(),
    });

    if (this.document.recentActions.length > 20) {
      this.document.recentActions = this.document.recentActions.slice(-20);
    }
    this.dirty = true;
  }

  heartbeat(): void {
    this.document.workerHeartbeat = Date.now();
    this.dirty = true;
  }

  setStatus(status: ProgressDocument['status'], errorMessage?: string): void {
    this.document.status = status;
    if (status === 'error' && errorMessage) {
      this.document.error = {
        message: errorMessage,
        occurredAt: Date.now(),
      };
    }
    this.dirty = true;
  }

  getDocument(): ProgressDocument {
    return { ...this.document };
  }

  getProgress(): TaskProgress {
    return { ...this.document.progress };
  }

  getCompletedItems(): CompletedItem[] {
    return [...this.document.completedItems];
  }

  getStatus(): ProgressDocument['status'] {
    return this.document.status;
  }

  isWorkerAlive(maxAgeMs: number = 120000): boolean {
    return Date.now() - this.document.workerHeartbeat < maxAgeMs;
  }

  async readFromDisk(): Promise<ProgressDocument | null> {
    try {
      const content = await this.fs.readTextFile(this.documentPath);
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  getPath(): string {
    return this.documentPath;
  }
}
