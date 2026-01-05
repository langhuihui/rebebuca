# Macro Tasks Example

This document demonstrates how to use macro tasks (composite tasks) in Rebebuca.

## What are Macro Tasks?

Macro tasks are composite tasks that can orchestrate multiple sub-tasks. They support two execution modes:
- **Serial** (串行): Tasks execute one after another, in sequence
- **Parallel** (并行): Tasks execute simultaneously

## Example: tasks.json

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "clean",
      "type": "shell",
      "command": "rm -rf dist",
      "group": "build"
    },
    {
      "label": "build-frontend",
      "type": "shell",
      "command": "npm run build",
      "group": "build"
    },
    {
      "label": "build-backend",
      "type": "shell",
      "command": "cargo build --release",
      "group": "build"
    },
    {
      "label": "run-tests",
      "type": "shell",
      "command": "npm test",
      "group": "test"
    },
    {
      "label": "build-serial",
      "type": "shell",
      "dependsOn": ["clean", "build-frontend", "build-backend"],
      "group": "build",
      "problemMatcher": []
    },
    {
      "label": "build-parallel",
      "type": "shell",
      "dependsOn": {
        "tasks": ["build-frontend", "build-backend"],
        "order": "parallel"
      },
      "group": "build",
      "problemMatcher": []
    },
    {
      "label": "build-and-test",
      "type": "shell",
      "dependsOn": ["build-serial", "run-tests"],
      "group": "build",
      "problemMatcher": []
    }
  ]
}
```

## Task Descriptions

### Simple Tasks
- **clean**: Removes the dist directory
- **build-frontend**: Builds the frontend using npm
- **build-backend**: Builds the backend using Cargo (Rust)
- **run-tests**: Runs tests

### Macro Tasks

#### build-serial (Serial Execution)
Executes tasks in sequence:
1. clean
2. build-frontend
3. build-backend

This ensures that cleaning completes before building, and frontend builds before backend.

#### build-parallel (Parallel Execution)
Executes `build-frontend` and `build-backend` simultaneously, which can significantly reduce build time when tasks don't depend on each other.

#### build-and-test (Nested Dependencies)
Demonstrates nested dependencies:
1. First executes `build-serial` (which runs clean → build-frontend → build-backend)
2. Then executes `run-tests`

## Visual Indicators

In the Rebebuca UI:
- Macro tasks with **parallel** execution show a **grid icon** (⊞)
- Macro tasks with **serial** execution show a **task icon** (☑)
- Hovering over a macro task shows its sub-tasks and execution mode

## Notes

- Macro tasks without a `command` field are automatically detected
- The `dependsOn` field can be:
  - A string: single dependency
  - An array: serial execution (default)
  - An object with `tasks` and `order`: explicit serial or parallel execution
- All sub-tasks must exist in the same tasks.json file
- Circular dependencies are detected and prevented
