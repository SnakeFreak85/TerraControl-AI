const loopbackHostNames = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

function validateLocalBaseUrl(baseUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error(
      "Die Ollama-Adresse ist ungültig.",
    );
  }

  if (
    parsedUrl.protocol !== "http:" ||
    !loopbackHostNames.has(
      parsedUrl.hostname,
    ) ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error(
      "Ollama darf ausschließlich über eine lokale HTTP-Adresse angesprochen werden.",
    );
  }

  return parsedUrl;
}

function requireText(value, fieldName) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new TypeError(
      `${fieldName} muss eine nicht leere Zeichenkette sein.`,
    );
  }

  return value.trim();
}

export function createOllamaClient({
  baseUrl = "http://127.0.0.1:11434",
  model = "qwen2.5-coder:7b",
  fetchImplementation = globalThis.fetch,
  timeoutMs = 10 * 60 * 1000,
  contextSize = 4096,
} = {}) {
  const parsedBaseUrl =
    validateLocalBaseUrl(baseUrl);

  const normalizedModel = requireText(
    model,
    "Modellname",
  );

  if (
    typeof fetchImplementation !==
      "function"
  ) {
    throw new TypeError(
      "Eine Fetch-Implementierung wird benötigt.",
    );
  }

  async function generateStructured({
    system,
    prompt,
    schema,
    maximumOutputTokens = 1000,
  }) {
    const normalizedSystem = requireText(
      system,
      "Systemanweisung",
    );

    const normalizedPrompt = requireText(
      prompt,
      "Prompt",
    );

    if (
      !schema ||
      typeof schema !== "object" ||
      Array.isArray(schema)
    ) {
      throw new TypeError(
        "Ein JSON-Schema wird benötigt.",
      );
    }

    const abortController =
      new AbortController();

    const timeout = setTimeout(
      () => abortController.abort(),
      timeoutMs,
    );

    try {
      const response =
        await fetchImplementation(
          new URL(
            "/api/generate",
            parsedBaseUrl,
          ),
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              model: normalizedModel,
              stream: false,
              system: normalizedSystem,
              prompt: [
                normalizedPrompt,
                "",
                "Antworte ausschließlich entsprechend diesem JSON-Schema:",
                JSON.stringify(schema),
              ].join("\n"),
              format: schema,
              options: {
                temperature: 0,
                seed: 42,
                num_ctx: contextSize,
                num_predict:
                  maximumOutputTokens,
              },
              keep_alive: "5m",
            }),
            signal:
              abortController.signal,
          },
        );

      if (!response.ok) {
        const errorText =
          await response.text();

        throw new Error(
          `Ollama antwortete mit HTTP ${response.status}: ${errorText.slice(0, 1000)}`,
        );
      }

      const payload =
        await response.json();

      if (
        typeof payload.response !==
          "string"
      ) {
        throw new Error(
          "Ollama lieferte keine Textantwort.",
        );
      }

      let structuredData;

      try {
        structuredData = JSON.parse(
          payload.response,
        );
      } catch (error) {
        throw new Error(
          "Ollama lieferte kein gültiges JSON.",
          {
            cause: error,
          },
        );
      }

      const generatedTokens =
        Number(payload.eval_count) || 0;

      const evaluationDurationNs =
        Number(
          payload.eval_duration,
        ) || 0;

      const tokensPerSecond =
        evaluationDurationNs > 0
          ? generatedTokens /
            (
              evaluationDurationNs /
              1_000_000_000
            )
          : 0;

      return Object.freeze({
        data: structuredData,
        metrics: Object.freeze({
          model: normalizedModel,
          generatedTokens,
          totalDurationMs:
            Math.round(
              (
                Number(
                  payload.total_duration,
                ) || 0
              ) / 1_000_000,
            ),
          tokensPerSecond:
            Math.round(
              tokensPerSecond * 100,
            ) / 100,
        }),
      });
    } catch (error) {
      if (
        error.name === "AbortError"
      ) {
        throw new Error(
          `Die lokale Modellanfrage überschritt das Zeitlimit von ${timeoutMs} ms.`,
          {
            cause: error,
          },
        );
      }

      if (
        error instanceof TypeError &&
        error.message === "fetch failed"
      ) {
        const causeCode =
          error.cause?.code ??
          "unbekannt";

        const causeMessage =
          error.cause?.message ??
          error.message;

        throw new Error(
          `Die Verbindung zu Ollama wurde unterbrochen (${causeCode}): ${causeMessage}`,
          {
            cause: error,
          },
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return Object.freeze({
    baseUrl:
      parsedBaseUrl.toString(),
    model: normalizedModel,
    generateStructured,
  });
}
