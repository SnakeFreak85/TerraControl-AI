import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { executeChangeDrafts } from "../src/change-executor.js";
import { getGitStatus } from "../src/git.js";

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

async function createTemporaryRepository() {
  const repositoryPath = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-execute-"),
  );

  const filePath = path.join(
    repositoryPath,
    "example.txt",
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
    filePath,
    "original\n",
    "utf8",
  );

  await runGit(
    repositoryPath,
    ["add", "example.txt"],
  );

  await runGit(
    repositoryPath,
    ["commit", "-m", "Initial"],
  );

  return {
    repositoryPath,
    filePath,
  };
}

function createDraftedWorkOrder(
  repositoryPath,
) {
  return Object.freeze({
    id: "work-order-001",
    repositoryPath,
    status: "drafted",
    drafts: Object.freeze([
      Object.freeze({
        file: "example.txt",
        originalContent: "original\n",
        proposedContent: "changed\n",
      }),
    ]),
  });
}

test("schreibt und bestätigt den echten Git-Diff", async () => {
  const {
    repositoryPath,
    filePath,
  } = await createTemporaryRepository();

  try {
    const result = await executeChangeDrafts(
      createDraftedWorkOrder(
        repositoryPath,
      ),
    );

    assert.equal(
      result.status,
      "diff-verified",
    );

    assert.deepEqual(
      result.appliedFiles,
      ["example.txt"],
    );

    assert.equal(result.diff.empty, false);
    assert.match(result.diff.text, /-original/);
    assert.match(result.diff.text, /\+changed/);

    assert.equal(
      await readFile(filePath, "utf8"),
      "changed\n",
    );
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("setzt Änderungen bei leerem Diff zurück", async () => {
  const {
    repositoryPath,
    filePath,
  } = await createTemporaryRepository();

  try {
    await assert.rejects(
      executeChangeDrafts(
        createDraftedWorkOrder(
          repositoryPath,
        ),
        {
          gitDiffReader: async (
            _repositoryPath,
            files,
          ) => ({
            files,
            text: "",
            empty: true,
            sizeBytes: 0,
          }),
        },
      ),
      /zurückgesetzt/,
    );

    assert.equal(
      await readFile(filePath, "utf8"),
      "original\n",
    );

    const gitStatus = await getGitStatus(
      repositoryPath,
    );

    assert.equal(gitStatus.clean, true);
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("setzt Änderungen bei falschen Diff-Dateien zurück", async () => {
  const {
    repositoryPath,
    filePath,
  } = await createTemporaryRepository();

  try {
    await assert.rejects(
      executeChangeDrafts(
        createDraftedWorkOrder(
          repositoryPath,
        ),
        {
          gitDiffReader: async () => ({
            files: ["unexpected.txt"],
            text: "unexpected diff",
            empty: false,
            sizeBytes: 15,
          }),
        },
      ),
      /zurückgesetzt/,
    );

    assert.equal(
      await readFile(filePath, "utf8"),
      "original\n",
    );
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});
