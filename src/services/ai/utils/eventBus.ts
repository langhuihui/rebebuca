/**
 * Rebebuca AI Service Layer - Event Bus
 * Simple typed event emitter for AI service internal communication
 */

import type { AIServiceEvents } from '../types';

type EventCallback<T> = (data: T) => void;

class AIEventBus {
  private listeners = new Map<string, Set<EventCallback<unknown>>>();

  on<K extends keyof AIServiceEvents>(
    event: K,
    callback: EventCallback<AIServiceEvents[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<unknown>);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback as EventCallback<unknown>);
    };
  }

  once<K extends keyof AIServiceEvents>(
    event: K,
    callback: EventCallback<AIServiceEvents[K]>
  ): () => void {
    const wrapper = (data: AIServiceEvents[K]) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof AIServiceEvents>(
    event: K,
    callback: EventCallback<AIServiceEvents[K]>
  ): void {
    this.listeners.get(event)?.delete(callback as EventCallback<unknown>);
  }

  emit<K extends keyof AIServiceEvents>(event: K, data: AIServiceEvents[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(data);
        } catch (error) {
          console.error(`[AIEventBus] Error in ${event} handler:`, error);
        }
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const aiEventBus = new AIEventBus();
