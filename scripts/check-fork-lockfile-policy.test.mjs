import assert from "node:assert/strict";
import { test } from "node:test";
import { checkLockfilePolicy } from "./check-fork-lockfile-policy.mjs";

const base = "1".repeat(40);
const head = "2".repeat(40);
const upstream = "3".repeat(40);
function input({ changed = true, inherited = true, ancestor = true, repository = "lnsflive/paperclip" } = {}) {
  const blobs = new Map([[`${upstream}:pnpm-lock.yaml`, "upstream-blob"], [`${head}:pnpm-lock.yaml`, inherited ? "upstream-blob" : "edited-blob"]]);
  return {
    repository, base, head, upstream,
    git: (args) => {
      if (args[0] === "diff") return changed ? "pnpm-lock.yaml\n" : "";
      if (args[0] === "merge-base") {
        if (!ancestor) throw new Error("Upstream is not an ancestor");
        return "";
      }
      assert.equal(args[0], "rev-parse");
      assert.ok(blobs.has(args[1]));
      return blobs.get(args[1]);
    },
  };
}
test("ordinary changes without a lockfile diff pass", () => {
  assert.equal(checkLockfilePolicy(input({ changed: false })), "Lockfile unchanged");
});
test("fork sync may inherit only the exact audited upstream lockfile", () => {
  assert.match(checkLockfilePolicy(input()), /inherited unchanged/);
});
test("manual changes on top of the upstream lockfile fail", () => {
  assert.throws(() => checkLockfilePolicy(input({ inherited: false })), /Do not manually edit/);
});
test("upstream ancestry is required even if the blob matches", () => {
  assert.throws(() => checkLockfilePolicy(input({ ancestor: false })), /not an ancestor/);
});
test("the exception does not apply to other repositories", () => {
  assert.throws(() => checkLockfilePolicy(input({ repository: "paperclipai/paperclip" })), /Do not manually edit/);
});
test("symbolic or missing refs fail closed", () => {
  assert.throws(() => checkLockfilePolicy({ ...input(), head: "main" }), /immutable/);
});
