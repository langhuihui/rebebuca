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

import { BaseToolClass, ToolError, type ToolResult } from '../types/baseTool';

/**
 * Plan step status enum
 */
export enum PlanStepStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
}

/**
 * Status marks for display
 */
export const PLAN_STATUS_MARKS: Record<PlanStepStatus, string> = {
  [PlanStepStatus.NOT_STARTED]: '[ ]',
  [PlanStepStatus.IN_PROGRESS]: '[→]',
  [PlanStepStatus.COMPLETED]: '[✓]',
  [PlanStepStatus.BLOCKED]: '[!]',
};

/**
 * Plan data structure
 */
export interface Plan {
  plan_id: string;
  title: string;
  steps: string[];
  step_statuses: PlanStepStatus[];
  step_notes: string[];
}

/**
 * PlanningTool - A tool for creating and managing plans for complex AI tasks
 * Inspired by OpenManus planning architecture
 */
export class PlanningTool extends BaseToolClass {
  private plans: Map<string, Plan>;
  private currentPlanId: string | null;

  constructor() {
    super(
      'planning',
      'A planning tool that allows the agent to create and manage plans for solving complex tasks. ' +
      'The tool provides functionality for creating plans, updating plan steps, and tracking progress.',
      {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The command to execute. Available commands: create, update, list, get, set_active, mark_step, delete.',
            enum: ['create', 'update', 'list', 'get', 'set_active', 'mark_step', 'delete'],
          },
          plan_id: {
            type: 'string',
            description: 'Unique identifier for the plan. Required for create, update, set_active, and delete commands.',
          },
          title: {
            type: 'string',
            description: 'Title for the plan. Required for create command, optional for update command.',
          },
          steps: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of plan steps. Required for create command, optional for update command.',
          },
          step_index: {
            type: 'integer',
            description: 'Index of the step to update (0-based). Required for mark_step command.',
          },
          step_status: {
            type: 'string',
            enum: ['not_started', 'in_progress', 'completed', 'blocked'],
            description: 'Status to set for a step. Used with mark_step command.',
          },
          step_notes: {
            type: 'string',
            description: 'Additional notes for a step. Optional for mark_step command.',
          },
        },
        required: ['command'],
        additionalProperties: false,
      }
    );

    this.plans = new Map();
    this.currentPlanId = null;
  }

  async execute(kwargs: Record<string, any>): Promise<ToolResult> {
    const { command } = kwargs;

    try {
      switch (command) {
        case 'create':
          return this.createPlan(kwargs);
        case 'update':
          return this.updatePlan(kwargs);
        case 'list':
          return this.listPlans();
        case 'get':
          return this.getPlan(kwargs);
        case 'set_active':
          return this.setActivePlan(kwargs);
        case 'mark_step':
          return this.markStep(kwargs);
        case 'delete':
          return this.deletePlan(kwargs);
        default:
          throw new ToolError(
            `Unrecognized command: ${command}. Allowed commands are: create, update, list, get, set_active, mark_step, delete`
          );
      }
    } catch (error) {
      if (error instanceof ToolError) {
        return this.failResponse(error.message);
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.failResponse(`Unexpected error: ${errorMessage}`);
    }
  }

  /**
   * Create a new plan
   */
  private createPlan(kwargs: Record<string, any>): ToolResult {
    const { plan_id, title, steps } = kwargs;

    if (!plan_id) {
      throw new ToolError('Parameter `plan_id` is required for command: create');
    }

    if (this.plans.has(plan_id)) {
      throw new ToolError(
        `A plan with ID '${plan_id}' already exists. Use 'update' to modify existing plans.`
      );
    }

    if (!title) {
      throw new ToolError('Parameter `title` is required for command: create');
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      throw new ToolError(
        'Parameter `steps` must be a non-empty list of strings for command: create'
      );
    }

    const plan: Plan = {
      plan_id,
      title,
      steps,
      step_statuses: new Array(steps.length).fill(PlanStepStatus.NOT_STARTED),
      step_notes: new Array(steps.length).fill(''),
    };

    this.plans.set(plan_id, plan);
    this.currentPlanId = plan_id;

    return this.successResponse(
      `Plan created successfully with ID: ${plan_id}\n\n${this.formatPlan(plan)}`
    );
  }

  /**
   * Update an existing plan
   */
  private updatePlan(kwargs: Record<string, any>): ToolResult {
    const { plan_id, title, steps } = kwargs;

    if (!plan_id) {
      throw new ToolError('Parameter `plan_id` is required for command: update');
    }

    const plan = this.plans.get(plan_id);
    if (!plan) {
      throw new ToolError(`No plan found with ID: ${plan_id}`);
    }

    if (title) {
      plan.title = title;
    }

    if (steps && Array.isArray(steps)) {
      const oldSteps = plan.steps;
      const oldStatuses = plan.step_statuses;
      const oldNotes = plan.step_notes;

      const newStatuses: PlanStepStatus[] = [];
      const newNotes: string[] = [];

      for (let i = 0; i < steps.length; i++) {
        if (i < oldSteps.length && steps[i] === oldSteps[i]) {
          newStatuses.push(oldStatuses[i]);
          newNotes.push(oldNotes[i]);
        } else {
          newStatuses.push(PlanStepStatus.NOT_STARTED);
          newNotes.push('');
        }
      }

      plan.steps = steps;
      plan.step_statuses = newStatuses;
      plan.step_notes = newNotes;
    }

    return this.successResponse(
      `Plan updated successfully: ${plan_id}\n\n${this.formatPlan(plan)}`
    );
  }

  /**
   * List all plans
   */
  private listPlans(): ToolResult {
    if (this.plans.size === 0) {
      return this.successResponse(
        "No plans available. Create a plan with the 'create' command."
      );
    }

    let output = 'Available plans:\n';
    for (const [planId, plan] of this.plans.entries()) {
      const currentMarker = planId === this.currentPlanId ? ' (active)' : '';
      const completed = plan.step_statuses.filter(
        s => s === PlanStepStatus.COMPLETED
      ).length;
      const total = plan.steps.length;
      const progress = `${completed}/${total} steps completed`;
      output += `• ${planId}${currentMarker}: ${plan.title} - ${progress}\n`;
    }

    return this.successResponse(output);
  }

  /**
   * Get a specific plan
   */
  private getPlan(kwargs: Record<string, any>): ToolResult {
    let { plan_id } = kwargs;

    if (!plan_id) {
      if (!this.currentPlanId) {
        throw new ToolError(
          'No active plan. Please specify a plan_id or set an active plan.'
        );
      }
      plan_id = this.currentPlanId;
    }

    const plan = this.plans.get(plan_id);
    if (!plan) {
      throw new ToolError(`No plan found with ID: ${plan_id}`);
    }

    return this.successResponse(this.formatPlan(plan));
  }

  /**
   * Set the active plan
   */
  private setActivePlan(kwargs: Record<string, any>): ToolResult {
    const { plan_id } = kwargs;

    if (!plan_id) {
      throw new ToolError('Parameter `plan_id` is required for command: set_active');
    }

    const plan = this.plans.get(plan_id);
    if (!plan) {
      throw new ToolError(`No plan found with ID: ${plan_id}`);
    }

    this.currentPlanId = plan_id;
    return this.successResponse(
      `Plan '${plan_id}' is now the active plan.\n\n${this.formatPlan(plan)}`
    );
  }

  /**
   * Mark a step with a status and optional notes
   */
  private markStep(kwargs: Record<string, any>): ToolResult {
    let { plan_id, step_index, step_status, step_notes } = kwargs;

    if (!plan_id) {
      if (!this.currentPlanId) {
        throw new ToolError(
          'No active plan. Please specify a plan_id or set an active plan.'
        );
      }
      plan_id = this.currentPlanId;
    }

    const plan = this.plans.get(plan_id);
    if (!plan) {
      throw new ToolError(`No plan found with ID: ${plan_id}`);
    }

    if (step_index === undefined || step_index === null) {
      throw new ToolError('Parameter `step_index` is required for command: mark_step');
    }

    if (step_index < 0 || step_index >= plan.steps.length) {
      throw new ToolError(
        `Invalid step_index: ${step_index}. Valid indices range from 0 to ${plan.steps.length - 1}.`
      );
    }

    if (step_status) {
      const validStatuses = Object.values(PlanStepStatus);
      if (!validStatuses.includes(step_status as PlanStepStatus)) {
        throw new ToolError(
          `Invalid step_status: ${step_status}. Valid statuses are: ${validStatuses.join(', ')}`
        );
      }
      plan.step_statuses[step_index] = step_status as PlanStepStatus;
    }

    if (step_notes) {
      plan.step_notes[step_index] = step_notes;
    }

    return this.successResponse(
      `Step ${step_index} updated in plan '${plan_id}'.\n\n${this.formatPlan(plan)}`
    );
  }

  /**
   * Delete a plan
   */
  private deletePlan(kwargs: Record<string, any>): ToolResult {
    const { plan_id } = kwargs;

    if (!plan_id) {
      throw new ToolError('Parameter `plan_id` is required for command: delete');
    }

    if (!this.plans.has(plan_id)) {
      throw new ToolError(`No plan found with ID: ${plan_id}`);
    }

    this.plans.delete(plan_id);

    if (this.currentPlanId === plan_id) {
      this.currentPlanId = null;
    }

    return this.successResponse(`Plan '${plan_id}' has been deleted.`);
  }

  /**
   * Format a plan for display
   */
  private formatPlan(plan: Plan): string {
    const totalSteps = plan.steps.length;
    const completed = plan.step_statuses.filter(s => s === PlanStepStatus.COMPLETED).length;
    const inProgress = plan.step_statuses.filter(s => s === PlanStepStatus.IN_PROGRESS).length;
    const blocked = plan.step_statuses.filter(s => s === PlanStepStatus.BLOCKED).length;
    const notStarted = plan.step_statuses.filter(s => s === PlanStepStatus.NOT_STARTED).length;

    const percentage = totalSteps > 0 ? ((completed / totalSteps) * 100).toFixed(1) : '0.0';

    let output = `Plan: ${plan.title} (ID: ${plan.plan_id})\n`;
    output += '='.repeat(output.length) + '\n\n';
    output += `Progress: ${completed}/${totalSteps} steps completed (${percentage}%)\n`;
    output += `Status: ${completed} completed, ${inProgress} in progress, ${blocked} blocked, ${notStarted} not started\n\n`;
    output += 'Steps:\n';

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const status = plan.step_statuses[i];
      const notes = plan.step_notes[i];
      const statusMark = PLAN_STATUS_MARKS[status] || PLAN_STATUS_MARKS[PlanStepStatus.NOT_STARTED];

      output += `${i}. ${statusMark} ${step}\n`;
      if (notes) {
        output += `   Notes: ${notes}\n`;
      }
    }

    return output;
  }

  /**
   * Get all plans (for external use)
   */
  getPlans(): Map<string, Plan> {
    return new Map(this.plans);
  }

  /**
   * Get current plan ID (for external use)
   */
  getCurrentPlanId(): string | null {
    return this.currentPlanId;
  }

  /**
   * Clear all plans (for testing/reset)
   */
  clearPlans(): void {
    this.plans.clear();
    this.currentPlanId = null;
  }
}
