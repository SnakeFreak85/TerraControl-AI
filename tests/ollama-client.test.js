import assert from "node:assert/strict";
import test from "node:test";

import {
  createOllamaClient,
} from "../src/ollama-client.js";

const schema = {
  type: "object",
  properties: {
    result: {
      type: "string",
    },
  },
  required: ["result"],
};

test("sendet eine strukturierte Anfrage ausschließlich an die lokale API", async () => {
  let capturedUrl;
  let capturedRequest;

  const client = createOllamaClient({
    fetchImplementation: async (
      url,
      request,
    ) => {
      capturedUrl = url;
      capturedRequest = request;

      return {
        ok: true,
        status: 200,
        json: async () => ({
          response: JSON.stringify({
            result: "success",
          }),
          eval_count: 4,
          eval_duration:
            2_000_000_000,
          total_duration:
            3_000_000_000,
        }),
      };
    },
  });

  const response =
    await client.generateStructured({
      system: "Local system instruction",
      prompt: "Local prompt",
      schema,
      maximumOutputTokens: 250,
    });

  assert.equal(
    capturedUrl.toString(),
    "http://127.0.0.1:11434/api/generate",
  );

  assert.equal(
    capturedRequest.method,
    "POST",
  );

  const body = JSON.parse(
    capturedRequest.body,
  );

  assert.equal(
    body.model,
    "qwen2.5-coder:7b",
  );

  assert.equal(body.stream, false);
  assert.deepEqual(body.format, schema);
  assert.equal(body.options.num_ctx, 4096);
  assert.equal(body.options.num_predict, 250);
  assert.equal(body.options.temperature, 0);

  assert.deepEqual(
    response.data,
    {
      result: "success",
    },
  );

  assert.deepEqual(
    response.metrics,
    {
      model: "qwen2.5-coder:7b",
      generatedTokens: 4,
      totalDurationMs: 3000,
      tokensPerSecond: 2,
    },
  );
});

test("lehnt externe Modelladressen ab", () => {
  assert.throws(
    () =>
      createOllamaClient({
        baseUrl:
          "https://external.example.com",
      }),
    /ausschließlich über eine lokale HTTP-Adresse/,
  );
});

test("meldet lokale HTTP-Fehler begrenzt", async () => {
  const client = createOllamaClient({
    fetchImplementation:
      async () => ({
        ok: false,
        status: 500,
        text: async () =>
          "local model error",
      }),
  });

  await assert.rejects(
    client.generateStructured({
      system: "System",
      prompt: "Prompt",
      schema,
    }),
    /HTTP 500: local model error/,
  );
});

test("lehnt ungültiges Modell-JSON ab", async () => {
  const client = createOllamaClient({
    fetchImplementation:
      async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          response: "not-json",
        }),
      }),
  });

  await assert.rejects(
    client.generateStructured({
      system: "System",
      prompt: "Prompt",
      schema,
    }),
    /kein gültiges JSON/,
  );
});
