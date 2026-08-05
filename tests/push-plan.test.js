import assert from "node:assert/strict";
import test from "node:test";

import { createPushPlan } from "../src/push-plan.js";

const committedWorkOrder = Object.freeze({
  status: "committed",
  workOrderId: "work-order-001",
  repositoryPath: "example-repository",
  branch: "main",
  commitSha:
    "0123456789abcdef0123456789abcdef01234567",
});

const cleanGitStatus = Object.freeze({
  clean: true,
  branch: "main",
  remoteUrl:
    "https://github.com/example/project.git",
});

test("erstellt einen normalen Push-Plan ohne Force", () => {
  const plan = createPushPlan(
    committedWorkOrder,
    cleanGitStatus,
  );

  assert.equal(
    plan.status,
    "ready-to-push",
  );

  assert.equal(plan.remoteName, "origin");
  assert.equal(plan.branch, "main");
  assert.equal(plan.force, false);

  assert.equal(
    plan.commitSha,
    committedWorkOrder.commitSha,
  );
});

test("lehnt ein unsauberes Repository ab", () => {
  assert.throws(
    () =>
      createPushPlan(
        committedWorkOrder,
        {
          ...cleanGitStatus,
          clean: false,
        },
      ),
    /sauberen Repository/,
  );
});

test("lehnt einen abweichenden Branch ab", () => {
  assert.throws(
    () =>
      createPushPlan(
        committedWorkOrder,
        {
          ...cleanGitStatus,
          branch: "feature/other",
        },
      ),
    /stimmt nicht/,
  );
});

test("lehnt ein fehlendes Remote ab", () => {
  assert.throws(
    () =>
      createPushPlan(
        committedWorkOrder,
        {
          ...cleanGitStatus,
          remoteUrl: null,
        },
      ),
    /kein origin-Remote/,
  );
});

test("lehnt eine ungültige Commit-ID ab", () => {
  assert.throws(
    () =>
      createPushPlan(
        {
          ...committedWorkOrder,
          commitSha: "invalid",
        },
        cleanGitStatus,
      ),
    /keine gültige Commit-ID/,
  );
});
