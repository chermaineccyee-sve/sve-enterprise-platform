/**
 * The universal lifecycle-case engine: create/read/list/transition and
 * the shared milestone operations, reused by every type-specific service
 * (onboarding/probation/employmentChange/offboarding). Owns none of
 * Employee Master or Organisation's own data — a case references
 * employeeId/legalEntityId, it never stores a copy of employee identity
 * or employment-assignment fields. See docs/architecture/
 * hrms-employee-lifecycle.md "Lifecycle case model".
 */
import type { LifecycleCaseRepository, LifecycleEventRepository, LifecycleMilestoneRepository, ProbationReviewRepository, LifecycleTransaction } from "../repositories/types.ts";
import type { RbacService } from "../../../identity/src/services/rbacService.ts";
import type { AuditService } from "../../../identity/src/services/auditService.ts";
import type { OrganisationRepository, UserRepository } from "../../../identity/src/repositories/types.ts";
import type { EmploymentAssignmentService } from "../../../organisation/src/services/employmentAssignmentService.ts";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError } from "../domain/errors.ts";
import { assertValidTransition } from "../domain/stateMachine.ts";
import { formatCaseNumber } from "../domain/caseNumber.ts";
import type { HrLifecycleCase, HrLifecycleMilestone, HrLifecycleEvent, LifecycleStatus, LifecycleEventType, LifecycleCaseFilter, CreateLifecycleCaseInput, CreateMilestoneInput, MilestoneStatus } from "../domain/lifecycle.ts";
import { PERMISSIONS, checkAccess, baseCeiling, restrictedCeiling, decisionCeiling, type ActorContext } from "./access.ts";

export interface LifecycleCaseView {
  case: HrLifecycleCase;
  canReadRestricted: boolean;
  canReadDecision: boolean;
}

export interface TxRepos {
  cases: LifecycleCaseRepository;
  events: LifecycleEventRepository;
  milestones: LifecycleMilestoneRepository;
  reviews: ProbationReviewRepository;
}

export function createLifecycleCaseService(deps: {
  cases: LifecycleCaseRepository;
  events: LifecycleEventRepository;
  milestones: LifecycleMilestoneRepository;
  organisation: OrganisationRepository;
  users: UserRepository;
  rbac: RbacService;
  audit: AuditService;
  transactions: LifecycleTransaction;
  assignments: EmploymentAssignmentService;
}) {
  async function resolveSelfEmployeeId(userId: string): Promise<string | null> {
    const link = await deps.users.findActiveLinkByUserId(userId);
    return link?.employeeId ?? null;
  }

  /** Access decision for a single case: base existence/metadata, restricted-tier, and decision-tier — see access.ts for the three-tier model. */
  async function resolveAccess(actor: ActorContext, hrCase: HrLifecycleCase): Promise<{ allowedBase: boolean; canReadRestricted: boolean; canReadDecision: boolean }> {
    const legalEntity = await deps.organisation.findLegalEntityById(hrCase.legalEntityId);
    const base = legalEntity ? baseCeiling(legalEntity) : "INTERNAL";
    const restricted = restrictedCeiling(base);
    const decision = decisionCeiling(restricted);
    const target = { legalEntityId: hrCase.legalEntityId };

    const selfEmployeeId = await resolveSelfEmployeeId(actor.userId);
    const isSelf = selfEmployeeId !== null && selfEmployeeId === hrCase.employeeId;

    let allowedBase = (await checkAccess(deps.rbac, actor.userId, PERMISSIONS.READ, PERMISSIONS.READ_PRIVILEGED, { ...target, recordClassification: base })).allowed;
    if (!allowedBase && isSelf) allowedBase = true;
    if (!allowedBase) {
      const isManager = await deps.assignments.isDirectManagerOf(actor.userId, hrCase.employeeId);
      if (isManager) {
        const teamCheck = await deps.rbac.authorize({ userId: actor.userId, permissionKey: PERMISSIONS.READ_TEAM });
        if (teamCheck.allowed) allowedBase = true;
      }
    }

    // Self-access is a PARTIAL bypass only: base + restricted tiers, NEVER
    // the decision tier — an employee must not automatically see
    // confidential manager recommendations or HR decision notes about
    // their own case (PR brief item 20). Manager (read.team) access is
    // base-tier only, mirroring Organisation's own team fallback.
    const canReadRestricted = isSelf || (await checkAccess(deps.rbac, actor.userId, PERMISSIONS.READ_RESTRICTED, PERMISSIONS.READ_RESTRICTED_PRIVILEGED, { ...target, recordClassification: restricted })).allowed;
    const canReadDecision = (await checkAccess(deps.rbac, actor.userId, PERMISSIONS.READ_DECISION, PERMISSIONS.READ_DECISION_PRIVILEGED, { ...target, recordClassification: decision })).allowed;

    return { allowedBase, canReadRestricted, canReadDecision };
  }

  async function requireManagePermission(actor: ActorContext, legalEntityId: string, baseKey: string, privilegedKey: string): Promise<void> {
    const legalEntity = await deps.organisation.findLegalEntityById(legalEntityId);
    if (!legalEntity) throw new ValidationError("legalEntityId does not refer to a known legal entity.");
    const ceiling = baseCeiling(legalEntity);
    const access = await checkAccess(deps.rbac, actor.userId, baseKey, privilegedKey, { legalEntityId, recordClassification: ceiling });
    if (!access.allowed) throw new ForbiddenError(baseKey);
  }

  const service = {
    resolveAccess,

    /**
     * Generic case creation: validates the target legal entity, checks
     * `create`, allocates a server-generated case number, and creates the
     * case row plus its opening event atomically. `additionalWrites` lets
     * a type-specific service (e.g. probation's initial review period)
     * extend what commits in the SAME transaction — see docs/architecture/
     * hrms-employee-lifecycle.md "Transaction boundaries".
     */
    async createCase(
      actor: ActorContext,
      input: CreateLifecycleCaseInput,
      openingEvent: { data?: Record<string, unknown> | null; notes?: string | null },
      additionalWrites?: (repos: TxRepos, created: HrLifecycleCase) => Promise<void>,
    ): Promise<HrLifecycleCase> {
      if (!input.employeeId) throw new ValidationError("employeeId is required.");
      if (!input.legalEntityId) throw new ValidationError("legalEntityId is required.");
      if (!input.hrOwnerUserId) throw new ValidationError("hrOwnerUserId is required.");

      const legalEntity = await deps.organisation.findLegalEntityById(input.legalEntityId);
      if (!legalEntity) throw new ValidationError("legalEntityId does not refer to a known legal entity.");
      const ceiling = baseCeiling(legalEntity);
      const access = await checkAccess(deps.rbac, actor.userId, PERMISSIONS.CREATE, PERMISSIONS.CREATE_PRIVILEGED, { legalEntityId: input.legalEntityId, recordClassification: ceiling });
      if (!access.allowed) throw new ForbiddenError(PERMISSIONS.CREATE);

      const seq = await deps.cases.nextCaseNumberSeq();
      const caseNumber = formatCaseNumber(seq);

      const created = await deps.transactions.run(async (repos) => {
        const created = await repos.cases.create({ ...input, caseNumber, createdBy: actor.userId });
        await repos.events.append({ caseId: created.id, eventType: "case_opened", eventData: openingEvent.data ?? { lifecycleType: input.lifecycleType }, notes: openingEvent.notes ?? null, recordedBy: actor.userId });
        if (additionalWrites) await additionalWrites(repos, created);
        // Re-fetch rather than returning the pre-additionalWrites snapshot:
        // additionalWrites may itself update the case (e.g. onboarding/
        // probation/offboarding transitioning DRAFT -> IN_PROGRESS). The
        // in-memory repository mutates the same object in place, which
        // masked this against real Postgres (where updateStatus returns a
        // distinct row object) until covered by an HTTP integration test.
        return (await repos.cases.findById(created.id))!;
      });

      await deps.audit.record({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: "hrms.lifecycle.case_created",
        resourceType: "hr_lifecycle_case",
        resourceId: created.id,
        legalEntityId: input.legalEntityId,
        changeAfter: { lifecycleType: input.lifecycleType, caseSubtype: input.caseSubtype ?? null },
        sourceIp: actor.ip,
        sourceUserAgent: actor.userAgent,
      });
      return created;
    },

    async getCase(actor: ActorContext, id: string): Promise<LifecycleCaseView> {
      const hrCase = await deps.cases.findById(id);
      if (!hrCase) throw new NotFoundError("Lifecycle case");
      const { allowedBase, canReadRestricted, canReadDecision } = await resolveAccess(actor, hrCase);
      if (!allowedBase) {
        await deps.audit.record({
          actorUserId: actor.userId,
          actorEmail: actor.email,
          action: "hrms.lifecycle.access.denied",
          resourceType: "hr_lifecycle_case",
          resourceId: id,
          legalEntityId: hrCase.legalEntityId,
          sourceIp: actor.ip,
          sourceUserAgent: actor.userAgent,
        });
        throw new NotFoundError("Lifecycle case");
      }
      if (canReadRestricted) {
        await deps.audit.record({
          actorUserId: actor.userId,
          actorEmail: actor.email,
          action: "hrms.lifecycle.restricted_viewed",
          resourceType: "hr_lifecycle_case",
          resourceId: id,
          legalEntityId: hrCase.legalEntityId,
          sourceIp: actor.ip,
          sourceUserAgent: actor.userAgent,
        });
      }
      return { case: hrCase, canReadRestricted, canReadDecision };
    },

    async listCases(actor: ActorContext, filter: LifecycleCaseFilter): Promise<LifecycleCaseView[]> {
      const candidates = await deps.cases.list(filter);
      const views: LifecycleCaseView[] = [];
      for (const hrCase of candidates) {
        const { allowedBase, canReadRestricted, canReadDecision } = await resolveAccess(actor, hrCase);
        if (!allowedBase) continue;
        views.push({ case: hrCase, canReadRestricted, canReadDecision });
      }
      return views;
    },

    async listEvents(actor: ActorContext, caseId: string): Promise<{ events: HrLifecycleEvent[]; canReadRestricted: boolean; canReadDecision: boolean }> {
      const hrCase = await deps.cases.findById(caseId);
      if (!hrCase) throw new NotFoundError("Lifecycle case");
      const { allowedBase, canReadRestricted, canReadDecision } = await resolveAccess(actor, hrCase);
      if (!allowedBase) throw new NotFoundError("Lifecycle case");
      const events = await deps.events.listByCase(caseId);
      return { events, canReadRestricted, canReadDecision };
    },

    /**
     * The one, shared, permission-parameterised transition primitive:
     * validates the state-machine transition, checks the CALLER-SUPPLIED
     * permission (each lifecycle type's own manage_* permission governs
     * its own completion; the generic `complete` permission is used only
     * for manual/onboarding completion and cancellation — see
     * docs/architecture/hrms-employee-lifecycle.md "RBAC"), and commits
     * the status change + event (+ any additionalWrites) atomically.
     */
    async transitionCase(
      actor: ActorContext,
      caseId: string,
      permission: { base: string; privileged: string },
      target: { status: LifecycleStatus; currentStage?: string | null; outcome?: string | null; effectiveDate?: string | null; resultingAssignmentId?: string | null },
      event: { type: LifecycleEventType; data?: Record<string, unknown> | null; notes?: string | null },
      additionalWrites?: (repos: TxRepos, current: HrLifecycleCase) => Promise<void>,
    ): Promise<HrLifecycleCase> {
      const hrCase = await deps.cases.findById(caseId);
      if (!hrCase) throw new NotFoundError("Lifecycle case");
      assertValidTransition(hrCase.status, target.status);

      const legalEntity = await deps.organisation.findLegalEntityById(hrCase.legalEntityId);
      if (!legalEntity) throw new ValidationError("Case's legalEntityId does not refer to a known legal entity.");
      const ceiling = baseCeiling(legalEntity);
      const access = await checkAccess(deps.rbac, actor.userId, permission.base, permission.privileged, { legalEntityId: hrCase.legalEntityId, recordClassification: ceiling });
      if (!access.allowed) throw new ForbiddenError(permission.base);

      const updated = await deps.transactions.run(async (repos) => {
        const updated = await repos.cases.updateStatus(caseId, {
          status: target.status,
          currentStage: target.currentStage,
          outcome: target.outcome,
          effectiveDate: target.effectiveDate,
          resultingAssignmentId: target.resultingAssignmentId,
          updatedBy: actor.userId,
        });
        await repos.events.append({ caseId, eventType: event.type, eventData: event.data ?? null, notes: event.notes ?? null, recordedBy: actor.userId });
        if (additionalWrites) await additionalWrites(repos, hrCase);
        return updated;
      });

      await deps.audit.record({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        action: `hrms.lifecycle.${event.type}`,
        resourceType: "hr_lifecycle_case",
        resourceId: caseId,
        legalEntityId: hrCase.legalEntityId,
        changeBefore: { status: hrCase.status },
        changeAfter: { status: updated.status, outcome: updated.outcome },
        sourceIp: actor.ip,
        sourceUserAgent: actor.userAgent,
      });
      return updated;
    },

    /** Generic manual completion (e.g. onboarding: all milestones done, close the case) — gated by the generic `complete` permission, not a type-specific manage_* one. */
    async completeCase(actor: ActorContext, caseId: string, input: { outcome?: string | null; effectiveDate?: string | null } = {}): Promise<HrLifecycleCase> {
      return service.transitionCase(actor, caseId, { base: PERMISSIONS.COMPLETE, privileged: PERMISSIONS.COMPLETE_PRIVILEGED }, { status: "COMPLETED", outcome: input.outcome ?? null, effectiveDate: input.effectiveDate ?? null }, { type: "case_completed", data: { outcome: input.outcome ?? null } });
    },

    async cancelCase(actor: ActorContext, caseId: string, input: { reason?: string | null } = {}): Promise<HrLifecycleCase> {
      return service.transitionCase(actor, caseId, { base: PERMISSIONS.COMPLETE, privileged: PERMISSIONS.COMPLETE_PRIVILEGED }, { status: "CANCELLED" }, { type: "case_cancelled", notes: input.reason ?? null });
    },

    async addMilestone(actor: ActorContext, caseId: string, permission: { base: string; privileged: string }, input: CreateMilestoneInput): Promise<HrLifecycleMilestone> {
      if (!input.milestoneType?.trim()) throw new ValidationError("milestoneType is required.");
      const hrCase = await deps.cases.findById(caseId);
      if (!hrCase) throw new NotFoundError("Lifecycle case");
      await requireManagePermission(actor, hrCase.legalEntityId, permission.base, permission.privileged);
      return deps.milestones.create(caseId, input);
    },

    async listMilestones(actor: ActorContext, caseId: string): Promise<{ milestones: HrLifecycleMilestone[]; canReadRestricted: boolean }> {
      const hrCase = await deps.cases.findById(caseId);
      if (!hrCase) throw new NotFoundError("Lifecycle case");
      const { allowedBase, canReadRestricted } = await resolveAccess(actor, hrCase);
      if (!allowedBase) throw new NotFoundError("Lifecycle case");
      return { milestones: await deps.milestones.listByCase(caseId), canReadRestricted };
    },

    async updateMilestone(actor: ActorContext, caseId: string, milestoneId: string, permission: { base: string; privileged: string }, input: { status: MilestoneStatus; notes?: string | null }): Promise<HrLifecycleMilestone> {
      const hrCase = await deps.cases.findById(caseId);
      if (!hrCase) throw new NotFoundError("Lifecycle case");
      const milestone = await deps.milestones.findById(milestoneId);
      if (!milestone || milestone.caseId !== caseId) throw new NotFoundError("Milestone");
      await requireManagePermission(actor, hrCase.legalEntityId, permission.base, permission.privileged);
      const updated = await deps.milestones.updateStatus(milestoneId, { status: input.status, completedBy: input.status === "COMPLETED" ? actor.userId : null, notes: input.notes });
      if (input.status === "COMPLETED") {
        await deps.events.append({ caseId, eventType: "milestone_completed", eventData: { milestoneId, milestoneType: milestone.milestoneType }, recordedBy: actor.userId });
        await deps.audit.record({
          actorUserId: actor.userId,
          actorEmail: actor.email,
          action: "hrms.lifecycle.milestone_completed",
          resourceType: "hr_lifecycle_milestone",
          resourceId: milestoneId,
          legalEntityId: hrCase.legalEntityId,
          changeAfter: { milestoneType: milestone.milestoneType },
          sourceIp: actor.ip,
          sourceUserAgent: actor.userAgent,
        });
      }
      return updated;
    },
  };
  return service;
}

export type LifecycleCaseService = ReturnType<typeof createLifecycleCaseService>;
