import type { DatabaseProvider } from "../../../../../packages/shared/src/DatabaseProvider.ts";
import type { WorkflowTransaction } from "../types.ts";
import { createPgWorkflowDefinitionRepository } from "./pgWorkflowDefinitionRepository.ts";
import { createPgWorkflowDefinitionVersionRepository } from "./pgWorkflowDefinitionVersionRepository.ts";
import { createPgWorkflowStepRepository } from "./pgWorkflowStepRepository.ts";
import { createPgWorkflowInstanceRepository } from "./pgWorkflowInstanceRepository.ts";
import { createPgWorkflowTaskRepository } from "./pgWorkflowTaskRepository.ts";
import { createPgWorkflowTaskCandidateRepository } from "./pgWorkflowTaskCandidateRepository.ts";
import { createPgWorkflowDecisionRepository } from "./pgWorkflowDecisionRepository.ts";
import { createPgWorkflowEventRepository } from "./pgWorkflowEventRepository.ts";
import { createPgWorkflowSystemActionExecutionRepository } from "./pgWorkflowSystemActionExecutionRepository.ts";

/**
 * Real Postgres implementation of WorkflowTransaction — mirrors
 * platform-services/hrms's pgLifecycleTransaction.ts: constructs every
 * repository scoped to the SAME transaction connection, so all writes
 * inside `fn` commit or roll back together.
 */
export function createPgWorkflowTransaction(db: DatabaseProvider): WorkflowTransaction {
  return {
    async run(fn) {
      return db.transaction(async (tx) => {
        return fn({
          definitions: createPgWorkflowDefinitionRepository(tx),
          versions: createPgWorkflowDefinitionVersionRepository(tx),
          steps: createPgWorkflowStepRepository(tx),
          instances: createPgWorkflowInstanceRepository(tx),
          tasks: createPgWorkflowTaskRepository(tx),
          taskCandidates: createPgWorkflowTaskCandidateRepository(tx),
          decisions: createPgWorkflowDecisionRepository(tx),
          events: createPgWorkflowEventRepository(tx),
          systemActions: createPgWorkflowSystemActionExecutionRepository(tx),
        });
      });
    },
  };
}
