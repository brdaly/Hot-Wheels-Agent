import { describe, expect, it } from "vitest";
import { readLimitedJsonBody } from "../lib/security/request-body";

describe("limited JSON request bodies", () => {
  it("parses JSON within the byte limit", async () => {
    const request = new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ name: "Twin Mill" }),
    });

    await expect(readLimitedJsonBody(request, 1_024)).resolves.toEqual({
      ok: true,
      value: { name: "Twin Mill" },
    });
  });

  it("rejects a streamed body that omits content-length and exceeds the limit", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"name":"'));
        controller.enqueue(new TextEncoder().encode("Twin Mill".repeat(100)));
        controller.enqueue(new TextEncoder().encode('"}'));
        controller.close();
      },
    });
    const request = new Request("https://example.test", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readLimitedJsonBody(request, 32)).resolves.toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects malformed JSON and invalid UTF-8", async () => {
    const malformed = new Request("https://example.test", { method: "POST", body: "{" });
    const invalidUtf8 = new Request("https://example.test", {
      method: "POST",
      body: new Uint8Array([0xff]),
    });

    await expect(readLimitedJsonBody(malformed, 32)).resolves.toEqual({ ok: false, reason: "invalid" });
    await expect(readLimitedJsonBody(invalidUtf8, 32)).resolves.toEqual({ ok: false, reason: "invalid" });
  });
});
