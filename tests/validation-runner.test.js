import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createValidationPlan } from "../src/validation-plan.js";
import { runValidationPlan } from "../src/validation-runner.js";

async function createTemporaryNodeProject() {
  const repositoryPath = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-validation-"),
  );

  const scripts = {
    pass:
      'node -e "console.log(' +
      "'validation-ok'" +
      ')"',
    fail:
      'node -e "console.error(' +
      "'validation-failed'" +
      '); process.exit(3)"',
    loud:
      'node -e "process.stdout.write(' +
      "'x'.repeat(5000)" +
      ')"',
  };

  await writeFile(
    path.join(repositoryPath, "package.json"),
    JSON.stringify({
      name: "validation-test",
      private: true,
      scripts,
    }),
    "utf8",
  );

  return {
    repositoryPath,
    project: {
      type: "node",
      packageManager: "npm",
      scripts,
    },
  };
}

function createVerifiedWorkOrder(
  repositoryPath,
  validationScripts,
) {
  return {
    repositoryPath,
    status: "diff-verified",
    validationScripts,
  };
}

test("führt ein erfolgreiches npm-Skript aus", async () => {
  const {
    repositoryPath,
    project,
  } = await createTemporaryNodeProject();

  try {
    const plan = createValidationPlan(
      createVerifiedWorkOrder(
        repositoryPath,
        ["pass"],
      ),
      project,
    );

    const result = await runValidationPlan(
      plan,
    );

    assert.equal(result.success, true);
    assert.equal(result.results.length, 1);
    assert.equal(
      result.results[0].scriptName,
      "pass",
    );

    assert.match(
      result.results[0].standardOutput,
      /validation-ok/,
    );
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("meldet ein fehlgeschlagenes npm-Skript", async () => {
  const {
    repositoryPath,
    project,
  } = await createTemporaryNodeProject();

  try {
    const plan = createValidationPlan(
      createVerifiedWorkOrder(
        repositoryPath,
        ["fail"],
      ),
      project,
    );

    await assert.rejects(
      runValidationPlan(plan),
      (error) => {
        assert.match(
          error.message,
          /Validierung fehlgeschlagen/,
        );

        assert.match(
          error.cause.errorOutput,
          /validation-failed/,
        );

        return true;
      },
    );
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("beendet Validierungen oberhalb des Ausgabelimits", async () => {
  const {
    repositoryPath,
    project,
  } = await createTemporaryNodeProject();

  try {
    const plan = createValidationPlan(
      createVerifiedWorkOrder(
        repositoryPath,
        ["loud"],
      ),
      project,
    );

    await assert.rejects(
      runValidationPlan(
        plan,
        {
          maximumOutputBytes: 100,
        },
      ),
      /Ausgabelimit/,
    );
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("lehnt frei gewählte Programme ab", async () => {
  await assert.rejects(
    runValidationPlan({
      repositoryPath: ".",
      commands: [
        {
          scriptName: "unsafe",
          executable: "powershell.exe",
          arguments: [
            "run",
            "unsafe",
          ],
          displayCommand:
            "powershell.exe unsafe",
        },
      ],
    }),
    /Nicht erlaubtes Validierungsprogramm/,
  );
});
