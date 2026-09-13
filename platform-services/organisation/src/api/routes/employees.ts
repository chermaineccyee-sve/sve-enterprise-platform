/**
 * /api/v1/employees/* — Employee Master API. Directory-level fields are
 * included whenever the base read check passes; restricted-HR fields
 * (status, employment dates, probation, termination, reporting) are
 * included only when EmployeeView.canReadRestricted is true — see
 * docs/architecture/organisation-employee-master.md "Data sensitivity".
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { OrganisationContainer } from "../../composition/container.ts";
import { sendSuccess, sendError, readJsonBody } from "../../../../identity/src/api/middleware/envelope.ts";
import { requireActor, clientIp } from "../middleware/actor.ts";
import { SessionInvalidError, AccountDisabledError, ForbiddenError, IdentityNotProvisionedError } from "../../../../identity/src/domain/errors.ts";
import { NotFoundError, ValidationError, CsrfOriginRejectedError } from "../../domain/errors.ts";
import type { EmployeeView } from "../../services/employeeService.ts";
import type { Employee, EmploymentAssignment, EmploymentStatus } from "../../domain/employee.ts";

interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  container: OrganisationContainer;
  correlationId: string;
}

function respondError(res: ServerResponse, correlationId: string, error: unknown): void {
  if (error instanceof SessionInvalidError) return sendError(res, 401, "SESSION_INVALID", "Not authenticated.", correlationId);
  if (error instanceof IdentityNotProvisionedError) return sendError(res, 403, "IDENTITY_NOT_PROVISIONED", error.message, correlationId);
  if (error instanceof CsrfOriginRejectedError) return sendError(res, 403, "CSRF_ORIGIN_REJECTED", error.message, correlationId);
  if (error instanceof AccountDisabledError) return sendError(res, 403, "ACCOUNT_DISABLED", "Account is disabled.", correlationId);
  if (error instanceof NotFoundError) return sendError(res, 404, "NOT_FOUND", "Employee not found.", correlationId);
  if (error instanceof ForbiddenError) return sendError(res, 403, "FORBIDDEN", "Not authorised for this action.", correlationId);
  if (error instanceof ValidationError) return sendError(res, 400, "VALIDATION_ERROR", error.message, correlationId);
  throw error;
}

function toActorContext(actor: { userId: string; email: string }, req: IncomingMessage) {
  return { userId: actor.userId, email: actor.email, ip: clientIp(req), userAgent: (req.headers["user-agent"] as string | undefined) ?? null };
}

function serializeDirectory(employee: Employee, assignment: EmploymentAssignment | null) {
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    legalName: employee.legalName,
    preferredName: employee.preferredName,
    workEmail: employee.workEmail,
    employmentCountry: employee.employmentCountry,
    currentAssignment: assignment
      ? { legalEntityId: assignment.legalEntityId, businessUnitId: assignment.businessUnitId, departmentId: assignment.departmentId, positionId: assignment.positionId, workLocation: assignment.workLocation, workArrangement: assignment.workArrangement }
      : null,
  };
}

function serializeRestricted(employee: Employee, assignment: EmploymentAssignment | null, managerDisplay: { name: string; title: string | null } | null) {
  return {
    personalEmail: employee.personalEmail,
    status: employee.status,
    currentAssignment: assignment
      ? {
          employmentType: assignment.employmentType,
          status: assignment.status,
          startDate: assignment.startDate,
          confirmationDate: assignment.confirmationDate,
          probationEndDate: assignment.probationEndDate,
          endDate: assignment.endDate,
          effectiveFrom: assignment.effectiveFrom,
          effectiveTo: assignment.effectiveTo,
          // reportsToAssignmentId is deliberately NOT serialized — an
          // internal assignment id is never sent to a frontend; managerDisplay
          // below is the one supported representation of this edge.
          changeReason: assignment.changeReason,
        }
      : null,
    // PR #12: "Reports To" as a human-readable name/title, never a raw id
    // — see employeeService.ts's resolveManagerDisplay for the
    // cross-entity classification guard behind this. null means either
    // "no manager" or "not visible to you"; the caller shows "Not
    // assigned" for both, by design (see docs/architecture/organisation-
    // employee-master.md "Manager display resolution").
    managerDisplay,
  };
}

function serializeView(view: EmployeeView) {
  return {
    ...serializeDirectory(view.employee, view.currentAssignment),
    restricted: view.canReadRestricted ? serializeRestricted(view.employee, view.currentAssignment, view.managerDisplay) : null,
  };
}

export async function handleListEmployees(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const url = new URL(ctx.req.url ?? "/", "http://localhost");
    const status = url.searchParams.get("status");
    const views = await ctx.container.employees.listEmployees(toActorContext(actor, ctx.req), {
      status: (status as EmploymentStatus | null) ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    });
    sendSuccess(ctx.res, 200, { employees: views.map(serializeView) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

/**
 * PR #11: resolves the CALLING actor's own Employee Master record — the
 * one legitimate source for a header/My Profile display name, since
 * Identity's own /users/me deliberately stays domain-blind to
 * Organisation. Returns `{ employee: null }` (200, not 404/403) when the
 * caller has no active Employee Master link — an honest "not linked"
 * state (e.g. a service/system principal, or an employee not yet
 * onboarded into Employee Master), not an error condition.
 */
export async function handleGetMyEmployee(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const view = await ctx.container.employees.getMyEmployee(toActorContext(actor, ctx.req));
    sendSuccess(ctx.res, 200, { employee: view ? serializeView(view) : null }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleGetEmployee(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const view = await ctx.container.employees.getEmployee(toActorContext(actor, ctx.req), id);
    sendSuccess(ctx.res, 200, { employee: serializeView(view) }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleCreateEmployee(ctx: RouteContext): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const initial = (body.initialAssignment ?? {}) as Record<string, unknown>;
    // Explicit allowlist — mass-assignment defence: id/employeeNumber/status/
    // createdBy/updatedBy are always server-assigned, never read from the body.
    const employee = await ctx.container.employees.createEmployee(toActorContext(actor, ctx.req), {
      legalName: String(body.legalName ?? ""),
      preferredName: typeof body.preferredName === "string" ? body.preferredName : null,
      workEmail: typeof body.workEmail === "string" ? body.workEmail : null,
      personalEmail: typeof body.personalEmail === "string" ? body.personalEmail : null,
      employmentCountry: String(body.employmentCountry ?? ""),
      initialAssignment: {
        legalEntityId: String(initial.legalEntityId ?? ""),
        businessUnitId: typeof initial.businessUnitId === "string" ? initial.businessUnitId : null,
        departmentId: typeof initial.departmentId === "string" ? initial.departmentId : null,
        positionId: typeof initial.positionId === "string" ? initial.positionId : null,
        employmentType: String(initial.employmentType ?? ""),
        status: typeof initial.status === "string" ? (initial.status as EmploymentStatus) : undefined,
        startDate: String(initial.startDate ?? ""),
        effectiveFrom: typeof initial.effectiveFrom === "string" ? initial.effectiveFrom : String(initial.startDate ?? ""),
        confirmationDate: typeof initial.confirmationDate === "string" ? initial.confirmationDate : null,
        probationEndDate: typeof initial.probationEndDate === "string" ? initial.probationEndDate : null,
        workLocation: typeof initial.workLocation === "string" ? initial.workLocation : null,
        workArrangement: typeof initial.workArrangement === "string" ? initial.workArrangement : null,
      },
    });
    sendSuccess(ctx.res, 201, { employee }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleUpdateEmployee(ctx: RouteContext, id: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const input: Record<string, unknown> = {};
    if (typeof body.legalName === "string") input.legalName = body.legalName;
    if (typeof body.preferredName === "string" || body.preferredName === null) input.preferredName = body.preferredName;
    if (typeof body.workEmail === "string" || body.workEmail === null) input.workEmail = body.workEmail;
    if (typeof body.personalEmail === "string" || body.personalEmail === null) input.personalEmail = body.personalEmail;
    if (typeof body.employmentCountry === "string") input.employmentCountry = body.employmentCountry;
    const employee = await ctx.container.employees.updateEmployee(toActorContext(actor, ctx.req), id, input);
    sendSuccess(ctx.res, 200, { employee }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleListAssignments(ctx: RouteContext, employeeId: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const assignments = await ctx.container.assignments.listAssignments(toActorContext(actor, ctx.req), employeeId);
    sendSuccess(ctx.res, 200, { assignments }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleCreateAssignment(ctx: RouteContext, employeeId: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const assignment = await ctx.container.assignments.createAssignment(toActorContext(actor, ctx.req), employeeId, {
      legalEntityId: String(body.legalEntityId ?? ""),
      businessUnitId: typeof body.businessUnitId === "string" ? body.businessUnitId : null,
      departmentId: typeof body.departmentId === "string" ? body.departmentId : null,
      positionId: typeof body.positionId === "string" ? body.positionId : null,
      employmentType: String(body.employmentType ?? ""),
      status: String(body.status ?? "ACTIVE") as EmploymentStatus,
      isPrimary: body.isPrimary === false ? false : true,
      startDate: String(body.startDate ?? ""),
      effectiveFrom: String(body.effectiveFrom ?? body.startDate ?? ""),
      confirmationDate: typeof body.confirmationDate === "string" ? body.confirmationDate : null,
      probationEndDate: typeof body.probationEndDate === "string" ? body.probationEndDate : null,
      workLocation: typeof body.workLocation === "string" ? body.workLocation : null,
      workArrangement: typeof body.workArrangement === "string" ? body.workArrangement : null,
      reportsToAssignmentId: typeof body.reportsToAssignmentId === "string" ? body.reportsToAssignmentId : null,
      changeReason: typeof body.changeReason === "string" ? body.changeReason : null,
    });
    sendSuccess(ctx.res, 201, { assignment }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleEndAssignment(ctx: RouteContext, employeeId: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    const status = body.status === "RESIGNED" ? "RESIGNED" : "TERMINATED";
    const assignment = await ctx.container.assignments.endAssignment(toActorContext(actor, ctx.req), employeeId, {
      endDate: String(body.endDate ?? ""),
      status,
      changeReason: typeof body.changeReason === "string" ? body.changeReason : undefined,
    });
    sendSuccess(ctx.res, 200, { assignment }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleLinkIdentity(ctx: RouteContext, employeeId: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    const body = await readJsonBody<Record<string, unknown>>(ctx.req);
    await ctx.container.employees.linkIdentity(toActorContext(actor, ctx.req), employeeId, String(body.userId ?? ""));
    sendSuccess(ctx.res, 200, { linked: true }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}

export async function handleUnlinkIdentity(ctx: RouteContext, employeeId: string): Promise<void> {
  try {
    const actor = await requireActor(ctx.req, ctx.container);
    await ctx.container.employees.unlinkIdentity(toActorContext(actor, ctx.req), employeeId);
    sendSuccess(ctx.res, 200, { unlinked: true }, ctx.correlationId);
  } catch (error) {
    respondError(ctx.res, ctx.correlationId, error);
  }
}
