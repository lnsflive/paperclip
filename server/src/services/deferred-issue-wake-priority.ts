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
