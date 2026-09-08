import type { IssueExecutionPolicy, IssueExecutionState } from "@paperclipai/shared";

type DeferredIssueOwnership = {
  status: string;
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
  executionPolicy: IssueExecutionPolicy | null;
  executionState: IssueExecutionState | null;
};

/**
 * Prefer the recorded next owner, never infer a new owner from a wake/comment.
 * This is ordering only: other deferred input remains eligible and all existing
 * dispatch authorization, pause, dependency and budget checks still apply.
 */
export function preferredDeferredIssueWakeAgent(issue: DeferredIssueOwnership): string | null {
  if (issue.assigneeUserId) return null;
  if (issue.status === "todo" || issue.status === "in_progress") {
    return issue.assigneeAgentId;
  }
  if (issue.status !== "in_review") return null;

  const state = issue.executionState;
  if (state?.status !== "pending" || state.currentParticipant?.type !== "agent") return null;
  const participantId = state.currentParticipant.agentId;
  if (!participantId || state.currentStageIndex == null) return null;
  const stage = issue.executionPolicy?.stages[state.currentStageIndex];
  if (!stage || stage.id !== state.currentStageId || stage.type !== state.currentStageType) return null;
  if (!stage.participants.some((participant) => participant.type === "agent" && participant.agentId === participantId)) {
    return null;
  }
  return participantId;
}

/** Select a dependency-unblock recipient without changing the issue's assignee.
 * Native reviews must resume the current typed participant, never the saved
 * executor. Legacy external reviews without a native stage retain their owner.
 * Callers still enforce company membership, readiness, pause and dispatch gates.
 */
export function recordedIssueExecutionAgent(issue: DeferredIssueOwnership): string | null {
  if (issue.assigneeUserId) return null;
  if (issue.status === "in_review" && (
    issue.executionPolicy?.stages.length
    || issue.executionState?.currentStageId
    || issue.executionState?.currentParticipant
  )) return preferredDeferredIssueWakeAgent(issue);
  return issue.assigneeAgentId;
}

export function resolvedDependencyWakeAgent(issue: DeferredIssueOwnership): string | null {
  return ["blocked", "todo", "in_progress", "in_review"].includes(issue.status)
    ? recordedIssueExecutionAgent(issue) : null;
}
