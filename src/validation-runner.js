import { spawn } from "node:child_process";

export const validationLimits = Object.freeze({
  maximumCommandDurationMs: 5 * 60 * 1000,
  maximumOutputBytes: 1024 * 1024,
});

const allowedExecutables = new Set([
  "npm",
  "npm.cmd",
  "pnpm",
  "pnpm.cmd",
  "yarn",
  "yarn.cmd",
]);

function validateCommand(command) {
  if (
    !command ||
    typeof command !== "object"
  ) {
    throw new TypeError(
      "Der Validierungsbefehl ist ungültig.",
    );
  }

  if (
    !allowedExecutables.has(
      command.executable,
    )
  ) {
    throw new Error(
      `Nicht erlaubtes Validierungsprogramm: ${command.executable}`,
    );
  }

  if (
    typeof command.scriptName !== "string" ||
    !/^[a-zA-Z0-9:_-]+$/.test(
      command.scriptName,
    )
  ) {
    throw new Error(
      `Ungültiger Skriptname: ${command.scriptName}`,
    );
  }

  const expectedArguments = [
    "run",
    command.scriptName,
  ];

  if (
    !Array.isArray(command.arguments) ||
    command.arguments.length !== 2 ||
    command.arguments[0] !==
      expectedArguments[0] ||
    command.arguments[1] !==
      expectedArguments[1]
  ) {
    throw new Error(
      `Unerwartete Argumente für ${command.scriptName}`,
    );
  }
}

function runCommand(
  repositoryPath,
  command,
  {
    maximumCommandDurationMs,
    maximumOutputBytes,
  },
) {
  validateCommand(command);

  return new Promise((resolve, reject) => {
    const useWindowsCommandWrapper =
      process.platform === "win32" &&
      command.executable.endsWith(".cmd");

    const executable =
      useWindowsCommandWrapper
        ? process.env.ComSpec || "cmd.exe"
        : command.executable;

    const argumentsList =
      useWindowsCommandWrapper
        ? [
            "/d",
            "/s",
            "/c",
            `${command.executable} run ${command.scriptName}`,
          ]
        : command.arguments;

    const startedAt = Date.now();

    const childProcess = spawn(
      executable,
      argumentsList,
      {
        cwd: repositoryPath,
        windowsHide: true,
        shell: false,
        env: {
          ...process.env,
          CI: "true",
          NO_COLOR: "1",
        },
      },
    );

    let standardOutput = "";
    let errorOutput = "";
    let outputBytes = 0;
    let terminationReason = null;
    let settled = false;

    const timeout = setTimeout(() => {
      terminationReason = "timeout";
      childProcess.kill();
    }, maximumCommandDurationMs);

    function collectOutput(target, data) {
      const text = data.toString("utf8");

      outputBytes += Buffer.byteLength(
        text,
        "utf8",
      );

      if (target === "stdout") {
        standardOutput += text;
      } else {
        errorOutput += text;
      }

      if (
        outputBytes > maximumOutputBytes &&
        terminationReason === null
      ) {
        terminationReason = "output-limit";
        childProcess.kill();
      }
    }

    childProcess.stdout.on(
      "data",
      (data) => collectOutput("stdout", data),
    );

    childProcess.stderr.on(
      "data",
      (data) => collectOutput("stderr", data),
    );

    childProcess.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      reject(
        new Error(
          `Validierung konnte nicht gestartet werden: ${error.message}`,
          {
            cause: error,
          },
        ),
      );
    });

    childProcess.on(
      "close",
      (exitCode, signal) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);

        const result = Object.freeze({
          scriptName: command.scriptName,
          displayCommand:
            command.displayCommand,
          exitCode,
          signal,
          standardOutput:
            standardOutput.trimEnd(),
          errorOutput:
            errorOutput.trimEnd(),
          outputBytes,
          durationMs:
            Date.now() - startedAt,
          success:
            exitCode === 0 &&
            terminationReason === null,
        });

        if (terminationReason === "timeout") {
          reject(
            new Error(
              `Validierung überschritt das Zeitlimit: ${command.displayCommand}`,
              {
                cause: result,
              },
            ),
          );
          return;
        }

        if (
          terminationReason ===
          "output-limit"
        ) {
          reject(
            new Error(
              `Validierung überschritt das Ausgabelimit: ${command.displayCommand}`,
              {
                cause: result,
              },
            ),
          );
          return;
        }

        if (exitCode !== 0) {
          reject(
            new Error(
              `Validierung fehlgeschlagen: ${command.displayCommand}`,
              {
                cause: result,
              },
            ),
          );
          return;
        }

        resolve(result);
      },
    );
  });
}

export async function runValidationPlan(
  validationPlan,
  {
    maximumCommandDurationMs =
      validationLimits.maximumCommandDurationMs,
    maximumOutputBytes =
      validationLimits.maximumOutputBytes,
  } = {},
) {
  if (
    !validationPlan ||
    typeof validationPlan.repositoryPath !==
      "string" ||
    !Array.isArray(validationPlan.commands) ||
    validationPlan.commands.length === 0
  ) {
    throw new Error(
      "Ein gültiger Validierungsplan wird benötigt.",
    );
  }

  const results = [];

  for (const command of validationPlan.commands) {
    const result = await runCommand(
      validationPlan.repositoryPath,
      command,
      {
        maximumCommandDurationMs,
        maximumOutputBytes,
      },
    );

    results.push(result);
  }

  return Object.freeze({
    success: true,
    results: Object.freeze(results),
  });
}
