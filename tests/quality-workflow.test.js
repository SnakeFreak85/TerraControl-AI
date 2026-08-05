import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { getGitStatus } from "../src/git.js";
import {
  executeValidatedChanges,
} from "../src/quality-workflow.js";

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

async function createTestRepository() {
  const repositoryPath = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-quality-"),
  );

  const scripts = {
    pass:
      'node -e "console.log(' +
      "'quality-ok'" +
      ')"',
    fail:
      'node -e "process.exit(1)"',
    unexpected:
      'node -e "require(' +
      "'fs'" +
      ').writeFileSync(' +
      "'unexpected.txt','generated'" +
      ')"',
  };

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

  await writeFile(
    path.join(repositoryPath, "package.json"),
    JSON.stringify({
      name: "quality-test",
      private: true,
      scripts,
    }),
  );

  await runGit(
    repositoryPath,
    ["add", "example.txt", "package.json"],
  );

  await runGit(
    repositoryPath,
    ["commit", "-m", "Initial"],
  );

  return {
    repositoryPath,
    scripts,
  };
}

function createDraftedWorkOrder(
  repositoryPath,
  validationScript,
) {
  return Object.freeze({
    id: "work-order-001",
    repositoryPath,
    status: "drafted",
    validationScripts:
      Object.freeze([
        validationScript,
      ]),
    drafts: Object.freeze([
      Object.freeze({
        file: "example.txt",
        originalContent: "original\n",
        proposedContent: "changed\n",
      }),
    ]),
  });
}

function createProject(scripts) {
  return Object.freeze({
    type: "node",
    packageManager: "npm",
    scripts: Object.freeze(scripts),
  });
}

test("behält Änderungen nach erfolgreicher Validierung", async () => {
  const {
    repositoryPath,
    scripts,
  } = await createTestRepository();

  try {
    const result =
      await executeValidatedChanges(
        createDraftedWorkOrder(
          repositoryPath,
          "pass",
        ),
        createProject(scripts),
      );

    assert.equal(
      result.status,
      "validated",
    );

    assert.equal(
      result.validation.success,
      true,
    );

    assert.equal(
      await readFile(
        path.join(
          repositoryPath,
          "example.txt",
        ),
        "utf8",
      ),
      "changed\n",
    );

    assert.match(
      result.diff.text,
      /\+changed/,
    );
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("setzt geplante Änderungen bei fehlgeschlagenem Test zurück", async () => {
  const {
    repositoryPath,
    scripts,
  } = await createTestRepository();

  try {
    await assert.rejects(
      executeValidatedChanges(
        createDraftedWorkOrder(
          repositoryPath,
          "fail",
        ),
        createProject(scripts),
      ),
      /geplante Änderungen wurden zurückgesetzt/,
    );

    assert.equal(
      await readFile(
        path.join(
          repositoryPath,
          "example.txt",
        ),
        "utf8",
      ),
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

test("erkennt unerwartete Dateien der Validierung", async () => {
  const {
    repositoryPath,
    scripts,
  } = await createTestRepository();

  try {
    await assert.rejects(
      executeValidatedChanges(
        createDraftedWorkOrder(
          repositoryPath,
          "unexpected",
        ),
        createProject(scripts),
      ),
      /geplante Änderungen wurden zurückgesetzt/,
    );

    assert.equal(
      await readFile(
        path.join(
          repositoryPath,
          "example.txt",
        ),
        "utf8",
      ),
      "original\n",
    );

    await access(
      path.join(
        repositoryPath,
        "unexpected.txt",
      ),
    );

    const gitStatus = await getGitStatus(
      repositoryPath,
    );

    assert.equal(gitStatus.clean, false);
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});
