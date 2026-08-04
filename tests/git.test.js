import assert from "node:assert/strict";
import test from "node:test";

import { getGitStatus } from "../src/git.js";

test("liest den Status des aktuellen Git-Repositorys", async () => {
  const status = await getGitStatus(process.cwd());

  assert.equal(typeof status.branch, "string");
  assert.ok(status.branch.length > 0);
  assert.equal(typeof status.clean, "boolean");
  assert.ok(Array.isArray(status.changes));
});
