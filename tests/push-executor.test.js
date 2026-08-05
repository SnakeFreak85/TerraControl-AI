import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { executePushPlan } from "../src/push-executor.js";
import {
  getGitStatus,
  getHeadCommitSha,
  getRemoteBranchSha,
} from "../src/git.js";

const execFileAsync = promisify(execFile);

async function runGit(
  repositoryPath,
  argumentsList,
) {
  await execFileAsync(
    "git",
    [
      "-C",
      repositoryPath,
      ...argumentsList,
    ],
    {
      windowsHide: true,
    },
  );
}

async function createPushEnvironment() {
  const rootPath = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-push-"),
  );

  const remotePath = path.join(
    rootPath,
    "remote.git",
  );

  const repositoryPath = path.join(
    rootPath,
    "repository",
  );

  await runGit(rootPath, [
    "init",
    "--bare",
    remotePath,
  ]);

  await runGit(rootPath, [
    "init",
    repositoryPath,
  ]);

  await runGit(
    repositoryPath,
    [
      "config",
      "user.name",
      "TerraControl Test",
    ],
  );

  await runGit(
    repositoryPath,
    [
      "config",
      "user.email",
      "test@example.invalid",
    ],
  );

  await runGit(
    repositoryPath,
    [
      "remote",
      "add",
      "origin",
      remotePath,
    ],
  );

  await writeFile(
    path.join(repositoryPath, "example.txt"),
    "content\n",
  );

  await runGit(
    repositoryPath,
    ["add", "example.txt"],
  );

  await runGit(
    repositoryPath,
    ["commit", "-m", "Initial"],
  );

  await runGit(
    repositoryPath,
    ["branch", "-M", "main"],
  );

  const gitStatus = await getGitStatus(
    repositoryPath,
  );

  const commitSha = await getHeadCommitSha(
    repositoryPath,
  );

  return {
    rootPath,
    repositoryPath,
    gitStatus,
    commitSha,
  };
}

function createPushPlan(
  repositoryPath,
  gitStatus,
  commitSha,
) {
  return Object.freeze({
    status: "ready-to-push",
    workOrderId: "work-order-001",
    repositoryPath,
    remoteName: "origin",
    remoteUrl: gitStatus.remoteUrl,
    branch: "main",
    commitSha,
    force: false,
  });
}

test("pusht und verifiziert denselben Commit auf dem Remote", async () => {
  const environment =
    await createPushEnvironment();

  try {
    const result =
      await executePushPlan(
        createPushPlan(
          environment.repositoryPath,
          environment.gitStatus,
          environment.commitSha,
        ),
      );

    assert.equal(
      result.status,
      "pushed",
    );

    assert.equal(
      result.localCommitSha,
      environment.commitSha,
    );

    assert.equal(
      result.remoteCommitSha,
      environment.commitSha,
    );

    assert.equal(result.force, false);

    assert.equal(
      await getRemoteBranchSha(
        environment.repositoryPath,
        "origin",
        "main",
      ),
      environment.commitSha,
    );
  } finally {
    await rm(environment.rootPath, {
      recursive: true,
      force: true,
    });
  }
});

test("lehnt einen abweichenden HEAD-Commit ab", async () => {
  const environment =
    await createPushEnvironment();

  try {
    await assert.rejects(
      executePushPlan(
        createPushPlan(
          environment.repositoryPath,
          environment.gitStatus,
          "0123456789abcdef0123456789abcdef01234567",
        ),
      ),
      /HEAD stimmt nicht/,
    );
  } finally {
    await rm(environment.rootPath, {
      recursive: true,
      force: true,
    });
  }
});

test("lehnt ein unsauberes Repository vor dem Push ab", async () => {
  const environment =
    await createPushEnvironment();

  try {
    await writeFile(
      path.join(
        environment.repositoryPath,
        "unexpected.txt",
      ),
      "unexpected\n",
    );

    await assert.rejects(
      executePushPlan(
        createPushPlan(
          environment.repositoryPath,
          environment.gitStatus,
          environment.commitSha,
        ),
      ),
      /vor dem Push nicht sauber/,
    );
  } finally {
    await rm(environment.rootPath, {
      recursive: true,
      force: true,
    });
  }
});
