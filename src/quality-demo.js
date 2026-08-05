import { execFile } from "node:child_process";
import {
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  executeValidatedChanges,
} from "./quality-workflow.js";
import {
  formatQualityFailureReport,
  formatQualitySuccessReport,
} from "./quality-report.js";

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

async function main() {
  const repositoryPath = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-demo-"),
  );

  try {
    const scripts = {
      test:
        'node -e "console.log(' +
        "'Demo validation passed'" +
        ')"',
    };

    await runGit(repositoryPath, ["init"]);

    await runGit(
      repositoryPath,
      [
        "config",
        "user.name",
        "TerraControl Demo",
      ],
    );

    await runGit(
      repositoryPath,
      [
        "config",
        "user.email",
        "demo@example.invalid",
      ],
    );

    await writeFile(
      path.join(
        repositoryPath,
        "example.js",
      ),
      'export const message = "old";\n',
    );

    await writeFile(
      path.join(
        repositoryPath,
        "package.json",
      ),
      JSON.stringify(
        {
          name: "terracontrol-demo",
          private: true,
          type: "module",
          scripts,
        },
        null,
        2,
      ) + "\n",
    );

    await runGit(
      repositoryPath,
      ["add", "example.js", "package.json"],
    );

    await runGit(
      repositoryPath,
      ["commit", "-m", "Initial"],
    );

    const draftedWorkOrder = Object.freeze({
      id: "quality-demo-001",
      problem:
        "Den Demo-Text kontrolliert aktualisieren.",
      repositoryPath,
      status: "drafted",
      validationScripts:
        Object.freeze(["test"]),
      drafts: Object.freeze([
        Object.freeze({
          file: "example.js",
          originalContent:
            'export const message = "old";\n',
          proposedContent:
            'export const message = "new";\n',
        }),
      ]),
    });

    const project = Object.freeze({
      type: "node",
      packageManager: "npm",
      scripts: Object.freeze(scripts),
    });

    const result =
      await executeValidatedChanges(
        draftedWorkOrder,
        project,
      );

    console.log(
      formatQualitySuccessReport(
        result,
      ),
    );
  } catch (error) {
    console.error(
      formatQualityFailureReport(
        error,
      ),
    );

    process.exitCode = 1;
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
}

main();
