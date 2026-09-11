import { issues } from "@paperclipai/db";
import { conflict } from "../errors.js";

export type IssueUpdateCasOptions = {
  expectedUpdatedAt?: Date | string | null;
  expectedRoutingState?: {
    status?: string | null;
    assigneeAgentId?: string | null;
    assigneeUserId?: string | null;
    executionState?: (typeof issues.$inferSelect)["executionState"];
  };
};

function timestampMillis(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function canonicalizeSnapshot(value: unknown): unknown {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(canonicalizeSnapshot);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const inner = (value as Record<string, unknown>)[key];
      if (inner === undefined || inner === null) continue;
      out[key] = canonicalizeSnapshot(inner);
    }
    return out;
  }
  return value;
}

function sameExecutionStateSnapshot(actual: unknown, expected: unknown): boolean {
  if (actual == null && expected == null) return true;
  if (actual == null || expected == null) return false;
  return JSON.stringify(canonicalizeSnapshot(actual)) === JSON.stringify(canonicalizeSnapshot(expected));
}

export function assertIssueUpdateSnapshot(
  current: typeof issues.$inferSelect,
  options?: IssueUpdateCasOptions,
) {
  if (!options) return;
  if (options.expectedUpdatedAt != null) {
    if (timestampMillis(current.updatedAt) !== timestampMillis(options.expectedUpdatedAt)) {
      throw conflict("Issue update conflict", {
        issueId: current.id,
        reason: "stale_snapshot",
      });
    }
  }
  const expected = options.expectedRoutingState;
  if (!expected) return;
  if (expected.status !== undefined && current.status !== (expected.status ?? current.status)) {
    throw conflict("Issue update conflict", {
      issueId: current.id,
      reason: "stale_snapshot",
    });
  }
  if (expected.assigneeAgentId !== undefined && current.assigneeAgentId !== expected.assigneeAgentId) {
    throw conflict("Issue update conflict", {
      issueId: current.id,
      reason: "stale_snapshot",
    });
  }
  if (expected.assigneeUserId !== undefined && current.assigneeUserId !== expected.assigneeUserId) {
    throw conflict("Issue update conflict", {
      issueId: current.id,
      reason: "stale_snapshot",
    });
  }
  if (
    expected.executionState !== undefined &&
    !sameExecutionStateSnapshot(current.executionState, expected.executionState)
  ) {
    throw conflict("Issue update conflict", {
      issueId: current.id,
      reason: "stale_snapshot",
    });
  }
}
