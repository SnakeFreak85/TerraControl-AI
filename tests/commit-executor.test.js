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

import { executeCommitPlan } from "../src/commit-executor.js";
import {
  getGitChangedFiles,
  getStagedGitFiles,
} from "../src/git.js";

const execFileAsync = promisify(execFile);

async function runGit(
  repositoryPath,
  argumentsList,
) {
  const result = await execFileAsync(
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

  return result.stdout.trim();
}

async function createRepository() {
  const repositoryPath = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-commit-"),
  );

  await runGit(repositoryPath, ["init"]);

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

  await writeFile(
    path.join(repositoryPath, "example.txt"),
    "original\n",
  );

  await runGit(
    repositoryPath,
    ["add", "example.txt"],
  );

  await runGit(
    repositoryPath,
    ["commit", "-m", "Initial"],
  );

  await writeFile(
    path.join(repositoryPath, "example.txt"),
    "changed\n",
  );

  return repositoryPath;
}

function createCommitPlan(repositoryPath) {
  return Object.freeze({
    status: "ready-to-commit",
    workOrderId: "work-order-001",
    repositoryPath,
    branch: "main",
    remoteUrl: null,
    message: "fix: update example content",
    files: Object.freeze([
      "example.txt",
    ]),
  });
}

test("erstellt einen Commit nur aus freigegebenen Dateien", async () => {
  const repositoryPath =
    await createRepository();

  try {
    const result =
      await executeCommitPlan(
        createCommitPlan(
          repositoryPath,
        ),
      );

    assert.equal(
      result.status,
      "committed",
    );

    assert.equal(
      result.commitSubject,
      "fix: update example content",
    );

    assert.match(
      result.commitSha,
      /^[0-9a-f]{40}$/,
    );

    assert.deepEqual(
      await getStagedGitFiles(
        repositoryPath,
      ),
      [],
    );

    assert.deepEqual(
      await getGitChangedFiles(
        repositoryPath,
      ),
      [],
    );
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("hebt eine abweichende Vormerkung auf", async () => {
  const repositoryPath =
    await createRepository();

  try {
    await assert.rejects(
      executeCommitPlan(
        createCommitPlan(
          repositoryPath,
        ),
        {
          stagedFilesReader:
            async () => [
              "example.txt",
              "unexpected.txt",
            ],
        },
      ),
      /nicht exakt dem Commit-Plan/,
    );

    assert.deepEqual(
      await getStagedGitFiles(
        repositoryPath,
      ),
      [],
    );

    assert.deepEqual(
      await getGitChangedFiles(
        repositoryPath,
      ),
      [
        {
          status: " M",
          file: "example.txt",
          originalFile: null,
        },
      ],
    );
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("hebt die Vormerkung bei einem Commit-Fehler auf", async () => {
  const repositoryPath =
    await createRepository();

  try {
    await assert.rejects(
      executeCommitPlan(
        createCommitPlan(
          repositoryPath,
        ),
        {
          commitCreator: async () => {
            throw new Error(
              "Simulierter Commit-Fehler",
            );
          },
        },
      ),
      /Simulierter Commit-Fehler/,
    );

    assert.deepEqual(
      await getStagedGitFiles(
        repositoryPath,
      ),
      [],
    );

    assert.equal(
      (
        await getGitChangedFiles(
          repositoryPath,
        )
      )[0].status,
      " M",
    );
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});
