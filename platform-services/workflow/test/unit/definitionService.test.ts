import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ForbiddenError } from "../../../identity/src/domain/errors.ts";
import { ValidationError, InvalidStateError, NotFoundError } from "../../src/domain/errors.ts";
import { setup, grantRole, grantFullWorkflowAccess, actor } from "./testSetup.ts";

test("a caller with no workflow.definition.create permission is denied creating a definition", async () => {
  const deps = await setup();
  const nobody = randomUUID();
  await assert.rejects(() => deps.definitions.createDefinition(actor(nobody), { key: "test.def1", name: "Test" }), ForbiddenError);
});

test("System Administrator (Organisation permissions only, no Workflow permission) cannot create a definition", async () => {
  const deps = await setup();
  const sysAdmin = randomUUID();
  await grantRole(deps.rbacRepo, sysAdmin, [{ key: "employee_master.create.privileged", maxClassification: "RESTRICTED" }], { scopeType: "group" });
  await assert.rejects(() => deps.definitions.createDefinition(actor(sysAdmin), { key: "test.def2", name: "Test" }), ForbiddenError);
});

test("an authorised user can create a definition, which starts with one DRAFT version", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { definition, version } = await deps.definitions.createDefinition(actor(admin), { key: "test.def3", name: "Test Def 3" });
  assert.equal(version.status, "DRAFT");
  assert.equal(version.versionNumber, 1);
  const fetched = await deps.definitions.getDefinition(actor(admin), definition.id);
  assert.equal(fetched.key, "test.def3");
});

test("publishing a definition with zero steps is rejected", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.nosteps", name: "No steps" });
  await assert.rejects(() => deps.definitions.publish(actor(admin), version.id), ValidationError);
});

test("publishing a definition with a sequence gap is rejected", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.gap", name: "Gap" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Step 1", assignmentMode: "USER", permittedDecisions: ["APPROVE"] });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 3, stepType: "APPROVAL", name: "Step 3", assignmentMode: "USER", permittedDecisions: ["APPROVE"] });
  await assert.rejects(() => deps.definitions.publish(actor(admin), version.id), ValidationError);
});

test("publishing an APPROVAL step with no permitted decisions is rejected", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.nodecisions", name: "No decisions" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Step 1", assignmentMode: "USER", permittedDecisions: [] });
  await assert.rejects(() => deps.definitions.publish(actor(admin), version.id), ValidationError);
});

test("RETURN is not a valid permitted decision on the first step", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.returnfirst", name: "Return first" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Step 1", assignmentMode: "USER", permittedDecisions: ["APPROVE", "RETURN"] });
  await assert.rejects(() => deps.definitions.publish(actor(admin), version.id), ValidationError);
});

test("publishing a SYSTEM_ACTION step with an unregistered handler is rejected", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.unregistered", name: "Unregistered" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "SYSTEM_ACTION", name: "Do thing", systemActionHandlerKey: "nonexistent.handler" });
  await assert.rejects(() => deps.definitions.publish(actor(admin), version.id), ValidationError);
});

test("a SYSTEM_ACTION step publishes successfully once its handler is registered", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  deps.systemActions.register("test.echo", async () => {});
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.registered", name: "Registered" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "SYSTEM_ACTION", name: "Do thing", systemActionHandlerKey: "test.echo" });
  const published = await deps.definitions.publish(actor(admin), version.id);
  assert.equal(published.status, "PUBLISHED");
  assert.ok(published.publishedAt);
});

test("a valid definition publishes successfully", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.valid", name: "Valid" });
  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Step 1", assignmentMode: "USER", permittedDecisions: ["APPROVE", "REJECT"] });
  const published = await deps.definitions.publish(actor(admin), version.id);
  assert.equal(published.status, "PUBLISHED");
});

test("a PUBLISHED version can never be edited again — adding, updating, or deleting a step is rejected", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.immutable", name: "Immutable" });
  const step = await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Step 1", assignmentMode: "USER", permittedDecisions: ["APPROVE"] });
  const published = await deps.definitions.publish(actor(admin), version.id);

  await assert.rejects(() => deps.definitions.addStep(actor(admin), published.id, { sequenceNumber: 2, stepType: "TASK", name: "Step 2", assignmentMode: "USER" }), InvalidStateError);
  await assert.rejects(() => deps.definitions.updateStep(actor(admin), published.id, step.id, { name: "Renamed" }), InvalidStateError);
  await assert.rejects(() => deps.definitions.deleteStep(actor(admin), published.id, step.id), InvalidStateError);
});

test("createDraftVersion opens v2 for editing while v1 stays PUBLISHED and untouched", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { definition, version: v1 } = await deps.definitions.createDefinition(actor(admin), { key: "test.v2", name: "V2 test" });
  await deps.definitions.addStep(actor(admin), v1.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Step 1", assignmentMode: "USER", permittedDecisions: ["APPROVE"] });
  const publishedV1 = await deps.definitions.publish(actor(admin), v1.id);

  const v2 = await deps.definitions.createDraftVersion(actor(admin), definition.id);
  assert.equal(v2.versionNumber, 2);
  assert.equal(v2.status, "DRAFT");

  const { version: refetchedV1 } = await deps.definitions.getVersion(actor(admin), publishedV1.id);
  assert.equal(refetchedV1.status, "PUBLISHED", "v1 must remain PUBLISHED, unaffected by v2's creation");
});

test("only a PUBLISHED version can be retired; a DRAFT cannot", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  const { version } = await deps.definitions.createDefinition(actor(admin), { key: "test.retire", name: "Retire test" });
  await assert.rejects(() => deps.definitions.retire(actor(admin), version.id), InvalidStateError);

  await deps.definitions.addStep(actor(admin), version.id, { sequenceNumber: 1, stepType: "APPROVAL", name: "Step 1", assignmentMode: "USER", permittedDecisions: ["APPROVE"] });
  const published = await deps.definitions.publish(actor(admin), version.id);
  const retired = await deps.definitions.retire(actor(admin), published.id);
  assert.equal(retired.status, "RETIRED");
  assert.ok(retired.retiredAt);
});

test("a nonexistent definition/version returns NotFoundError", async () => {
  const deps = await setup();
  const admin = randomUUID();
  await grantFullWorkflowAccess(deps, admin);
  await assert.rejects(() => deps.definitions.getDefinition(actor(admin), randomUUID()), NotFoundError);
  await assert.rejects(() => deps.definitions.getVersion(actor(admin), randomUUID()), NotFoundError);
});

