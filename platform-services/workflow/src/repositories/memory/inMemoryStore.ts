import type { WorkflowDefinition, WorkflowDefinitionVersion, WorkflowStep, WorkflowInstance, WorkflowTask, WorkflowTaskCandidate, WorkflowDecision, WorkflowEvent, WorkflowSystemActionExecution } from "../../domain/workflow.ts";

export interface InMemoryStore {
  definitions: WorkflowDefinition[];
  versions: WorkflowDefinitionVersion[];
  steps: WorkflowStep[];
  instances: WorkflowInstance[];
  tasks: WorkflowTask[];
  taskCandidates: WorkflowTaskCandidate[];
  decisions: WorkflowDecision[];
  events: WorkflowEvent[];
  systemActionExecutions: WorkflowSystemActionExecution[];
}

export function createInMemoryStore(): InMemoryStore {
  return { definitions: [], versions: [], steps: [], instances: [], tasks: [], taskCandidates: [], decisions: [], events: [], systemActionExecutions: [] };
}
