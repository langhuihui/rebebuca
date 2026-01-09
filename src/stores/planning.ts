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
import { PlanningTool, type Plan, PlanStepStatus } from '../utils/planningTool';
import { getAdapter, type BackendAdapter } from '../adapters';

/**
 * Planning Store for managing AI task plans
 * Provides state management for the PlanningTool
 */
export const usePlanningStore = defineStore('planning', () => {
  // ============================================
  // State
  // ============================================
  
  // Planning tool instance
  const planningTool = ref<PlanningTool>(new PlanningTool());
  
  // Initialization flag
  const initialized = ref(false);
  
  // Adapter instance
  let adapter: BackendAdapter | null = null;
  
  // ============================================
  // Computed
  // ============================================
  
  // All plans from the planning tool
  const allPlans = computed(() => {
    return Array.from(planningTool.value.getPlans().values());
  });
  
  // Current active plan ID
  const currentPlanId = computed(() => {
    return planningTool.value.getCurrentPlanId();
  });
  
  // Current active plan
  const currentPlan = computed(() => {
    const planId = currentPlanId.value;
    if (!planId) return null;
    return planningTool.value.getPlans().get(planId) || null;
  });
  
  // Count of plans
  const planCount = computed(() => {
    return allPlans.value.length;
  });
  
  // Active plans (plans with incomplete steps)
  const activePlans = computed(() => {
    return allPlans.value.filter(plan => {
      return plan.step_statuses.some(
        status => status !== PlanStepStatus.COMPLETED
      );
    });
  });
  
  // Completed plans (all steps completed)
  const completedPlans = computed(() => {
    return allPlans.value.filter(plan => {
      return plan.step_statuses.every(
        status => status === PlanStepStatus.COMPLETED
      );
    });
  });
  
  // ============================================
  // Methods
  // ============================================
  
  /**
   * Get adapter instance
   */
  async function getAdapterInstance(): Promise<BackendAdapter> {
    if (!adapter) {
      adapter = await getAdapter();
    }
    return adapter;
  }
  
  /**
   * Initialize the store - load saved plans
   */
  async function initialize() {
    if (initialized.value) return;
    
    try {
      const adapterInstance = await getAdapterInstance();
      const savedPlans = await adapterInstance.storage.get<Plan[]>('planningPlans');
      const savedCurrentId = await adapterInstance.storage.get<string | null>('planningCurrentId');
      
      if (savedPlans && Array.isArray(savedPlans)) {
        // Restore plans
        planningTool.value.clearPlans();
        for (const plan of savedPlans) {
          const createResult = await planningTool.value.execute({
            command: 'create',
            plan_id: plan.plan_id,
            title: plan.title,
            steps: plan.steps,
          });
          
          if (createResult.error) {
            console.warn('[Planning Store] Failed to restore plan:', plan.plan_id, createResult.error);
            continue;
          }
          
          // Restore step statuses and notes
          for (let i = 0; i < plan.steps.length; i++) {
            const markResult = await planningTool.value.execute({
              command: 'mark_step',
              plan_id: plan.plan_id,
              step_index: i,
              step_status: plan.step_statuses[i],
              step_notes: plan.step_notes[i] || undefined,
            });
            
            if (markResult.error) {
              console.warn('[Planning Store] Failed to restore step:', plan.plan_id, i, markResult.error);
            }
          }
        }
        
        // Restore current plan
        if (savedCurrentId && planningTool.value.getPlans().has(savedCurrentId)) {
          await planningTool.value.execute({
            command: 'set_active',
            plan_id: savedCurrentId,
          });
        }
        
        console.log('[Planning Store] Initialized with', savedPlans.length, 'plans');
      }
      
      initialized.value = true;
    } catch (error) {
      console.error('[Planning Store] Failed to initialize:', error);
      initialized.value = true; // Mark as initialized to prevent retry loops
    }
  }
  
  /**
   * Save plans to storage
   */
  async function savePlans() {
    try {
      const adapterInstance = await getAdapterInstance();
      const plans = Array.from(planningTool.value.getPlans().values());
      const currentId = planningTool.value.getCurrentPlanId();
      
      await adapterInstance.storage.set('planningPlans', plans);
      await adapterInstance.storage.set('planningCurrentId', currentId);
      await adapterInstance.storage.save();
      
      console.log('[Planning Store] Saved', plans.length, 'plans');
    } catch (error) {
      console.error('[Planning Store] Failed to save plans:', error);
    }
  }
  
  /**
   * Create a new plan
   */
  async function createPlan(planId: string, title: string, steps: string[]) {
    const result = await planningTool.value.execute({
      command: 'create',
      plan_id: planId,
      title,
      steps,
    });
    
    if (!result.error) {
      await savePlans();
    }
    
    return result;
  }
  
  /**
   * Update an existing plan
   */
  async function updatePlan(planId: string, title?: string, steps?: string[]) {
    const result = await planningTool.value.execute({
      command: 'update',
      plan_id: planId,
      title,
      steps,
    });
    
    if (!result.error) {
      await savePlans();
    }
    
    return result;
  }
  
  /**
   * Get a specific plan
   */
  async function getPlan(planId?: string) {
    return await planningTool.value.execute({
      command: 'get',
      plan_id: planId,
    });
  }
  
  /**
   * List all plans
   */
  async function listPlans() {
    return await planningTool.value.execute({
      command: 'list',
    });
  }
  
  /**
   * Set the active plan
   */
  async function setActivePlan(planId: string) {
    const result = await planningTool.value.execute({
      command: 'set_active',
      plan_id: planId,
    });
    
    if (!result.error) {
      await savePlans();
    }
    
    return result;
  }
  
  /**
   * Mark a step with status and optional notes
   */
  async function markStep(
    planId: string,
    stepIndex: number,
    stepStatus?: PlanStepStatus,
    stepNotes?: string
  ) {
    const result = await planningTool.value.execute({
      command: 'mark_step',
      plan_id: planId,
      step_index: stepIndex,
      step_status: stepStatus,
      step_notes: stepNotes,
    });
    
    if (!result.error) {
      await savePlans();
    }
    
    return result;
  }
  
  /**
   * Delete a plan
   */
  async function deletePlan(planId: string) {
    const result = await planningTool.value.execute({
      command: 'delete',
      plan_id: planId,
    });
    
    if (!result.error) {
      await savePlans();
    }
    
    return result;
  }
  
  /**
   * Clear all plans
   */
  async function clearAllPlans() {
    planningTool.value.clearPlans();
    await savePlans();
  }
  
  /**
   * Get the next step to execute for a plan
   */
  function getNextStep(planId: string): { index: number; step: string } | null {
    const plan = planningTool.value.getPlans().get(planId);
    if (!plan) return null;
    
    for (let i = 0; i < plan.steps.length; i++) {
      const status = plan.step_statuses[i];
      if (status === PlanStepStatus.NOT_STARTED || status === PlanStepStatus.IN_PROGRESS) {
        return {
          index: i,
          step: plan.steps[i],
        };
      }
    }
    
    return null; // All steps completed
  }
  
  /**
   * Check if a plan is completed
   */
  function isPlanCompleted(planId: string): boolean {
    const plan = planningTool.value.getPlans().get(planId);
    if (!plan) return false;
    
    return plan.step_statuses.every(status => status === PlanStepStatus.COMPLETED);
  }
  
  /**
   * Get plan progress (0-100)
   */
  function getPlanProgress(planId: string): number {
    const plan = planningTool.value.getPlans().get(planId);
    if (!plan || plan.steps.length === 0) return 0;
    
    const completed = plan.step_statuses.filter(
      status => status === PlanStepStatus.COMPLETED
    ).length;
    
    return Math.round((completed / plan.steps.length) * 100);
  }
  
  return {
    // State
    planningTool,
    initialized,
    
    // Computed
    allPlans,
    currentPlanId,
    currentPlan,
    planCount,
    activePlans,
    completedPlans,
    
    // Methods
    initialize,
    savePlans,
    createPlan,
    updatePlan,
    getPlan,
    listPlans,
    setActivePlan,
    markStep,
    deletePlan,
    clearAllPlans,
    getNextStep,
    isPlanCompleted,
    getPlanProgress,
  };
});
