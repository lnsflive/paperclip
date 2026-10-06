import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Audited upstream snapshot imported by the October 2026 fork reconciliation.
// This is a content/ancestry exception, not a blanket exemption for sync branches.
const UPSTREAM_SNAPSHOT = "22a3ea3414e9039a538fbb0374b3cfa7fc4371eb";

export function checkLockfilePolicy({ repository, base, head, git, upstream = UPSTREAM_SNAPSHOT }) {
  if (!/^[a-f0-9]{40}$/.test(base ?? "") || !/^[a-f0-9]{40}$/.test(head ?? "")) {
    throw new Error("Expected immutable PR base and head commits");
  }
  const changed = git(["diff", "--name-only", `${base}...${head}`, "--", "pnpm-lock.yaml"]).trim();
  if (!changed) return "Lockfile unchanged";
  if (repository === "lnsflive/paperclip") {
    git(["merge-base", "--is-ancestor", upstream, head]);
    const inherited = git(["rev-parse", `${upstream}:pnpm-lock.yaml`]).trim();
    const proposed = git(["rev-parse", `${head}:pnpm-lock.yaml`]).trim();
    if (inherited === proposed) return `Lockfile inherited unchanged from upstream ${upstream}`;
  }
  throw new Error("Do not manually edit pnpm-lock.yaml. CI owns updates; fork syncs may only inherit the audited upstream blob unchanged.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(checkLockfilePolicy({
    repository: process.env.GITHUB_REPOSITORY,
    base: process.env.PR_BASE_SHA,
    head: process.env.PR_HEAD_SHA,
    git: (args) => execFileSync("git", args, { encoding: "utf8" }),
  }));
}
