import { describe, expect, it } from "vitest";
import type { IssueExecutionPolicy, IssueExecutionState } from "@paperclipai/shared";
import { preferredDeferredIssueWakeAgent, resolvedDependencyWakeAgent } from "../services/deferred-issue-wake-priority.js";

function fixture() {
  const executionPolicy: IssueExecutionPolicy = {
    mode: "auto", commentRequired: true,
    stages: [{ id: "stage-1", type: "review", approvalsNeeded: 1,
      participants: [{ id: "participant-1", type: "agent", agentId: "reviewer" }] }],
  };
  const executionState: IssueExecutionState = {
    status: "pending", currentStageId: "stage-1", currentStageIndex: 0,
    currentStageType: "review", currentParticipant: { type: "agent", agentId: "reviewer" },
    returnAssignee: { type: "agent", agentId: "developer" }, reviewRequest: null,
    completedStageIds: [], lastDecisionId: null, lastDecisionOutcome: null,
  };
  return { status: "in_review", assigneeAgentId: "reviewer", assigneeUserId: null as string | null,
    executionPolicy, executionState };
}

describe("deferred issue wake owner priority", () => {
  it("resolves dependency wakes to a typed reviewer without overwriting the saved assignee", () => {
    const issue = { ...fixture(), assigneeAgentId: "developer" };
    expect(resolvedDependencyWakeAgent(issue)).toBe("reviewer");
    expect(issue.assigneeAgentId).toBe("developer");
  });

  it.each(["blocked", "todo", "in_progress"])("dependency resolution retains the %s execution owner", (status) => {
    expect(resolvedDependencyWakeAgent({ ...fixture(), status, assigneeAgentId: "developer" })).toBe("developer");
  });

  it("preserves stage-less external review and excludes human or malformed native reviews", () => {
    expect(resolvedDependencyWakeAgent({ ...fixture(), executionPolicy: null, executionState: null })).toBe("reviewer");
    expect(resolvedDependencyWakeAgent({ ...fixture(), assigneeUserId: "board" })).toBeNull();
    const issue = fixture();
    issue.executionState.currentParticipant = { type: "user", userId: "board" };
    expect(resolvedDependencyWakeAgent(issue)).toBeNull();
    issue.executionState.currentParticipant = { type: "agent", agentId: "reviewer" };
    issue.executionState.currentStageId = "stale";
    expect(resolvedDependencyWakeAgent(issue)).toBeNull();
  });

  it.each(["backlog", "done", "cancelled"])("does not resume %s work after a dependency resolves", (status) => {
    expect(resolvedDependencyWakeAgent({ ...fixture(), status })).toBeNull();
  });

  it("prefers the pending typed reviewer", () => {
    expect(preferredDeferredIssueWakeAgent(fixture())).toBe("reviewer");
  });

  it("uses the typed participant even when the saved executor remains assignee", () => {
    expect(preferredDeferredIssueWakeAgent({ ...fixture(), assigneeAgentId: "developer" })).toBe("reviewer");
  });

  it.each(["todo", "in_progress"])("prefers the actual %s owner over retained review history", (status) => {
    const issue = fixture();
    issue.executionState.status = "changes_requested";
    expect(preferredDeferredIssueWakeAgent({ ...issue, status, assigneeAgentId: "developer" })).toBe("developer");
  });

  it.each(["backlog", "blocked", "done", "cancelled"])("leaves FIFO unchanged for %s", (status) => {
    expect(preferredDeferredIssueWakeAgent({ ...fixture(), status })).toBeNull();
  });

  it.each(["todo", "in_progress", "in_review"])("never prioritizes an agent for human-owned %s", (status) => {
    expect(preferredDeferredIssueWakeAgent({ ...fixture(), status, assigneeUserId: "board" })).toBeNull();
  });

  it("does not infer an owner for unassigned executable work", () => {
    expect(preferredDeferredIssueWakeAgent({ ...fixture(), status: "in_progress", assigneeAgentId: null })).toBeNull();
  });

  it("does not turn changes-requested history into a pending review", () => {
    const issue = fixture();
    issue.executionState.status = "changes_requested";
    expect(preferredDeferredIssueWakeAgent(issue)).toBeNull();
  });

  it("preserves ordinary external-review FIFO without a native stage", () => {
    expect(preferredDeferredIssueWakeAgent({ ...fixture(), executionState: null, executionPolicy: null })).toBeNull();
  });

  it("does not substitute an agent for a user review participant", () => {
    const issue = fixture();
    issue.executionState.currentParticipant = { type: "user", userId: "board" };
    expect(preferredDeferredIssueWakeAgent(issue)).toBeNull();
  });

  it.each(["missing", "wrong-id", "wrong-type", "wrong-participant"])("does not prioritize an inconsistent %s stage", (kind) => {
    const issue = fixture();
    if (kind === "missing") issue.executionState.currentStageIndex = 9;
    if (kind === "wrong-id") issue.executionState.currentStageId = "old-stage";
    if (kind === "wrong-type") issue.executionState.currentStageType = "approval";
    if (kind === "wrong-participant") issue.executionPolicy.stages[0].participants = [];
    expect(preferredDeferredIssueWakeAgent(issue)).toBeNull();
  });
});
