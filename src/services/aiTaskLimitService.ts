/**
 * Rebebuca - AI Task Concurrency Limit Service
 * Copyright (C) 2025 rebebuca contributors
 * 
 * This service manages the concurrency limits for AI collaboration tasks.
 * - Not logged in: max 5 concurrent tasks
 * - Free plan: max 10 concurrent tasks
 * - Other plans: to be determined
 */

import { computed, type ComputedRef } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useTaskManagerStore } from '../stores/taskManager';

// Concurrency limits by plan type
export const TASK_LIMITS = {
  anonymous: 5,    // Not logged in
  free: 10,        // Free plan
  pro: 50,         // Pro plan (planned)
  enterprise: 100, // Enterprise plan (planned)
} as const;

export type PlanType = keyof typeof TASK_LIMITS;

export interface AITaskLimitInfo {
  /** Current number of active AI tasks */
  currentCount: number;
  /** Maximum allowed concurrent tasks based on plan */
  maxLimit: number;
  /** Whether user can create more tasks */
  canCreateTask: boolean;
  /** Number of remaining task slots */
  remainingSlots: number;
  /** User's current plan type */
  planType: PlanType;
  /** Whether user is logged in */
  isLoggedIn: boolean;
}

/**
 * Get the concurrency limit for a given plan type
 */
export function getLimitForPlan(planType: PlanType | string): number {
  if (planType in TASK_LIMITS) {
    return TASK_LIMITS[planType as PlanType];
  }
  // Default to free plan limit for unknown plans
  return TASK_LIMITS.free;
}

/**
 * Create a composable for AI task limit management
 */
export function useAITaskLimit(): {
  limitInfo: ComputedRef<AITaskLimitInfo>;
  checkCanCreateTask: () => { allowed: boolean; reason?: string };
} {
  const authStore = useAuthStore();
  const taskManagerStore = useTaskManagerStore();

  const limitInfo = computed<AITaskLimitInfo>(() => {
    const isLoggedIn = authStore.isAuthenticated;
    const planType: PlanType = isLoggedIn
      ? (authStore.planType as PlanType) || 'free'
      : 'anonymous';

    const maxLimit = getLimitForPlan(planType);

    // Count active tasks from task manager store
    const currentCount = taskManagerStore.runningTasks.size;

    const remainingSlots = Math.max(0, maxLimit - currentCount);
    const canCreateTask = currentCount < maxLimit;

    return {
      currentCount,
      maxLimit,
      canCreateTask,
      remainingSlots,
      planType,
      isLoggedIn,
    };
  });

  /**
   * Check if user can create a new AI task
   * Returns an object with allowed status and optional reason
   */
  function checkCanCreateTask(): { allowed: boolean; reason?: string } {
    const info = limitInfo.value;
    
    if (info.canCreateTask) {
      return { allowed: true };
    }

    // Build reason message based on login status
    if (!info.isLoggedIn) {
      return {
        allowed: false,
        reason: 'taskLimitAnonymous', // i18n key
      };
    }

    return {
      allowed: false,
      reason: 'taskLimitReached', // i18n key
    };
  }

  return {
    limitInfo,
    checkCanCreateTask,
  };
}

/**
 * Singleton service for non-composable contexts
 */
class AITaskLimitService {
  /**
   * Check if user can create a new AI task (for use outside Vue components)
   */
  checkCanCreateTask(): { allowed: boolean; reason?: string; info: AITaskLimitInfo } {
    const authStore = useAuthStore();
    const taskManagerStore = useTaskManagerStore();

    const isLoggedIn = authStore.isAuthenticated;
    const planType: PlanType = isLoggedIn
      ? (authStore.planType as PlanType) || 'free'
      : 'anonymous';

    const maxLimit = getLimitForPlan(planType);

    // Count active tasks from task manager store
    const currentCount = taskManagerStore.runningTasks.size;

    const remainingSlots = Math.max(0, maxLimit - currentCount);
    const canCreateTask = currentCount < maxLimit;

    const info: AITaskLimitInfo = {
      currentCount,
      maxLimit,
      canCreateTask,
      remainingSlots,
      planType,
      isLoggedIn,
    };

    if (canCreateTask) {
      return { allowed: true, info };
    }

    if (!isLoggedIn) {
      return {
        allowed: false,
        reason: 'taskLimitAnonymous',
        info,
      };
    }

    return {
      allowed: false,
      reason: 'taskLimitReached',
      info,
    };
  }

  /**
   * Get the current limit info
   */
  getLimitInfo(): AITaskLimitInfo {
    return this.checkCanCreateTask().info;
  }
}

export const aiTaskLimitService = new AITaskLimitService();
export default aiTaskLimitService;
