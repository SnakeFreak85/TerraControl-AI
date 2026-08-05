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

import { getGitChangedFiles } from "../src/git.js";

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

async function createRepository() {
  const repositoryPath = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-status-"),
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
    path.join(repositoryPath, "tracked.txt"),
    "original\n",
  );

  await runGit(
    repositoryPath,
    ["add", "tracked.txt"],
  );

  await runGit(
    repositoryPath,
    ["commit", "-m", "Initial"],
  );

  return repositoryPath;
}

test("meldet einen sauberen Git-Status", async () => {
  const repositoryPath =
    await createRepository();

  try {
    const changedFiles =
      await getGitChangedFiles(
        repositoryPath,
      );

    assert.deepEqual(changedFiles, []);
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("erkennt geänderte und neue Dateien", async () => {
  const repositoryPath =
    await createRepository();

  try {
    await writeFile(
      path.join(repositoryPath, "tracked.txt"),
      "changed\n",
    );

    await writeFile(
      path.join(repositoryPath, "new.txt"),
      "new\n",
    );

    const changedFiles =
      await getGitChangedFiles(
        repositoryPath,
      );

    assert.deepEqual(
      changedFiles.map(
        ({ status, file }) => ({
          status,
          file,
        }),
      ),
      [
        {
          status: "??",
          file: "new.txt",
        },
        {
          status: " M",
          file: "tracked.txt",
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
