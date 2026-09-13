import type { WorkflowDefinition, WorkflowDefinitionVersion, WorkflowStep, WorkflowInstance, WorkflowTask, WorkflowDecision, WorkflowEvent, WorkflowSystemActionExecution } from "../../domain/workflow.ts";

export interface InMemoryStore {
  definitions: WorkflowDefinition[];
  versions: WorkflowDefinitionVersion[];
  steps: WorkflowStep[];
  instances: WorkflowInstance[];
  tasks: WorkflowTask[];
  decisions: WorkflowDecision[];
  events: WorkflowEvent[];
  systemActionExecutions: WorkflowSystemActionExecution[];
}

export function createInMemoryStore(): InMemoryStore {
  return { definitions: [], versions: [], steps: [], instances: [], tasks: [], decisions: [], events: [], systemActionExecutions: [] };
}
