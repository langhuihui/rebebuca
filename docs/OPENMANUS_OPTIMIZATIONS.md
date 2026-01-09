# OpenManus-Inspired Optimizations

This document describes the three major optimizations implemented in Rebebuca, inspired by the [OpenManus](https://github.com/FoundationAgents/OpenManus) project.

## 1. PlanningTool - Make AI Tasks More Controllable and Trackable

The Planning Tool allows AI agents to create and manage structured plans for complex tasks. This makes AI task execution more predictable and traceable.

### Features

- **Create Plans**: Define a series of steps for accomplishing complex tasks
- **Track Progress**: Monitor plan execution with status indicators (✓ completed, → in progress, ! blocked, [ ] not started)
- **Update Steps**: Mark steps as completed, in progress, or blocked
- **Persistence**: Plans are automatically saved and restored across sessions

### Usage Example

```typescript
import { usePlanningStore } from '@/stores/planning';

const planningStore = usePlanningStore();

// Initialize the store
await planningStore.initialize();

// Create a new plan
await planningStore.createPlan(
  'plan-001',
  'Deploy Application',
  [
    'Run tests',
    'Build production bundle',
    'Upload to server',
    'Restart services',
    'Verify deployment'
  ]
);

// Mark a step as in progress
await planningStore.markStep('plan-001', 0, PlanStepStatus.IN_PROGRESS);

// Mark a step as completed
await planningStore.markStep('plan-001', 0, PlanStepStatus.COMPLETED, 'All tests passed');

// Get next step to execute
const nextStep = planningStore.getNextStep('plan-001');
console.log(nextStep); // { index: 1, step: 'Build production bundle' }

// Check plan progress
const progress = planningStore.getPlanProgress('plan-001'); // Returns 20 (1 out of 5 completed)
```

### API Reference

#### PlanningStore Methods

- `createPlan(planId: string, title: string, steps: string[])`: Create a new plan
- `updatePlan(planId: string, title?: string, steps?: string[])`: Update an existing plan
- `getPlan(planId?: string)`: Get a specific plan
- `listPlans()`: List all plans
- `setActivePlan(planId: string)`: Set the active plan
- `markStep(planId: string, stepIndex: number, status?: PlanStepStatus, notes?: string)`: Mark a step with status
- `deletePlan(planId: string)`: Delete a plan
- `getNextStep(planId: string)`: Get the next step to execute
- `isPlanCompleted(planId: string)`: Check if a plan is completed
- `getPlanProgress(planId: string)`: Get plan progress percentage (0-100)

#### Plan Step Status

```typescript
enum PlanStepStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
}
```

## 2. Loop Detection + Auto-Recovery - Prevent Agent Deadlocks

Loop detection prevents AI agents from getting stuck by detecting repeated instructions and automatically suggesting recovery strategies.

### Features

- **Duplicate Detection**: Identifies when the same instruction is sent multiple times
- **Hash-based Comparison**: Uses efficient hashing to detect identical instructions
- **Auto-Recovery**: Automatically suggests alternative approaches when loops are detected
- **Configurable Threshold**: Set how many duplicates trigger the recovery mechanism

### Configuration

```typescript
import { useSupervisorAIStore } from '@/stores/supervisorAI';

const supervisorStore = useSupervisorAIStore();

// Initialize and configure
await supervisorStore.initialize();

await supervisorStore.updateConfig({
  loopDetectionEnabled: true,        // Enable loop detection
  loopDetectionThreshold: 2,         // Trigger after 2 duplicate instructions
  autoRecoveryEnabled: true,         // Enable automatic recovery suggestions
});
```

### How It Works

1. **Detection**: The system tracks each instruction sent to the AI agent using a hash
2. **Comparison**: When a new instruction is sent, it's compared with the previous one
3. **Trigger**: If the same instruction is repeated `loopDetectionThreshold` times, a loop is detected
4. **Recovery**: The system automatically generates and injects a recovery suggestion

### Recovery Suggestions

When a loop is detected, the system provides suggestions like:

- "The previous approach seems to be repeating. Consider trying a completely different strategy."
- "Loop detected: The same instruction has been sent multiple times. Try breaking down the task into smaller steps."
- "You appear to be stuck. Take a step back and analyze what went wrong in the previous attempts."
- "Repeated actions detected. Try examining the error messages more carefully and adjust your approach."
- "Pattern repetition noticed. Consider using alternative tools or commands to achieve the goal."

### Usage in SupervisorAI Sessions

Loop detection is automatically active for all SupervisorAI sessions when enabled:

```typescript
// Loop detection works automatically in the background
// When a loop is detected, the session's instructionHistory will include an [AUTO-RECOVERY] entry

const session = supervisorStore.getSession(sessionId);
console.log(session.instructionHistory);
// [
//   "npm install dependencies",
//   "npm install dependencies",  // Duplicate detected!
//   "[AUTO-RECOVERY] Loop detected: The same instruction has been sent multiple times..."
// ]
```

## 3. Unified Tool Abstraction - Easy to Extend and Maintain

A standardized tool interface makes it easy to add new tools and manage existing ones.

### Features

- **Unified Interface**: All tools implement the same `BaseTool` interface
- **Tool Collection**: Manage multiple tools as a group
- **Easy Extension**: Add new tools by implementing the `BaseTool` interface
- **Type Safety**: Full TypeScript support with type checking

### Creating a Custom Tool

```typescript
import { BaseToolClass, type ToolResult } from '@/types/baseTool';

class MyCustomTool extends BaseToolClass {
  constructor() {
    super(
      'my_tool',
      'Description of what my tool does',
      {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: 'Description of parameter 1',
          },
          param2: {
            type: 'number',
            description: 'Description of parameter 2',
          },
        },
        required: ['param1'],
      }
    );
  }

  async execute(kwargs: Record<string, any>): Promise<ToolResult> {
    const { param1, param2 } = kwargs;

    try {
      // Your tool logic here
      const result = `Processed ${param1} with value ${param2}`;
      
      return this.successResponse(result);
    } catch (error) {
      return this.failResponse(error.message);
    }
  }
}
```

### Using Tool Collections

```typescript
import { ToolCollection } from '@/utils/toolCollection';
import { PlanningTool } from '@/utils/planningTool';

// Create a collection with multiple tools
const toolCollection = new ToolCollection(
  new PlanningTool(),
  new MyCustomTool()
);

// Add more tools dynamically
toolCollection.addTool(new AnotherTool());

// Execute a tool by name
const result = await toolCollection.execute('my_tool', {
  param1: 'test',
  param2: 42
});

// Get all tool parameters for LLM function calling
const toolParams = toolCollection.toParams();

// Check if a tool exists
if (toolCollection.hasTool('my_tool')) {
  console.log('Tool exists!');
}

// Remove a tool
toolCollection.removeTool('my_tool');
```

### BaseTool Interface

```typescript
interface BaseTool {
  name: string;
  description: string;
  parameters?: ToolParameterSchema;
  
  execute(kwargs: Record<string, any>): Promise<ToolResult>;
  toParam(): {
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters?: ToolParameterSchema;
    };
  };
}
```

### ToolResult Interface

```typescript
interface ToolResult {
  output?: string;        // Success output
  error?: string;         // Error message
  base64_image?: string;  // Optional image data
  system?: string;        // Optional system message
}
```

## Integration Example

Here's how all three features work together:

```typescript
import { usePlanningStore } from '@/stores/planning';
import { useSupervisorAIStore } from '@/stores/supervisorAI';
import { ToolCollection } from '@/utils/toolCollection';
import { PlanningTool } from '@/utils/planningTool';

// Setup
const planningStore = usePlanningStore();
const supervisorStore = useSupervisorAIStore();

await planningStore.initialize();
await supervisorStore.initialize();

// Configure loop detection
await supervisorStore.updateConfig({
  loopDetectionEnabled: true,
  loopDetectionThreshold: 2,
  autoRecoveryEnabled: true,
});

// Create a tool collection with planning capability
const tools = new ToolCollection(
  new PlanningTool()
);

// Create a plan for a complex task
await planningStore.createPlan(
  'deployment-001',
  'Production Deployment',
  [
    'Run test suite',
    'Build application',
    'Deploy to staging',
    'Run smoke tests',
    'Deploy to production',
  ]
);

// As the AI agent executes the plan:
// 1. Plans provide structure and tracking
// 2. Loop detection prevents getting stuck
// 3. Tool abstraction makes it easy to add capabilities

// Get next step
const nextStep = planningStore.getNextStep('deployment-001');

// Mark step in progress
await planningStore.markStep(
  'deployment-001',
  nextStep.index,
  PlanStepStatus.IN_PROGRESS
);

// If the AI gets stuck, loop detection will trigger
// and suggest alternative approaches automatically

// Mark step completed
await planningStore.markStep(
  'deployment-001',
  nextStep.index,
  PlanStepStatus.COMPLETED,
  'Tests passed successfully'
);
```

## Benefits

1. **Better Control**: Plans provide clear structure for complex AI tasks
2. **Improved Reliability**: Loop detection prevents infinite loops and deadlocks
3. **Easy Maintenance**: Unified tool abstraction simplifies code organization
4. **Extensibility**: Easy to add new tools and capabilities
5. **Observability**: Track progress and detect issues in real-time

## References

- [OpenManus Repository](https://github.com/FoundationAgents/OpenManus)
- [Rebebuca Planning Store](../src/stores/planning.ts)
- [Rebebuca SupervisorAI Store](../src/stores/supervisorAI.ts)
- [Tool Collection](../src/utils/toolCollection.ts)
- [Planning Tool](../src/utils/planningTool.ts)
- [Base Tool Types](../src/types/baseTool.ts)
