import { describe, it, expect } from "vitest";
import type { IncomingMessage, ServerResponse } from "http";
import { handleApiRequest } from "./routes.js";

/** Minimal req/res doubles for exercising the routing layer. */
function fakeReq(method: string, url: string): IncomingMessage {
  return {
    method,
    url,
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
  } as unknown as IncomingMessage;
}

function fakeRes(): { res: ServerResponse; status: () => number; body: () => string } {
  let status = 0;
  let body = "";
  const res = {
    writeHead(code: number) {
      status = code;
      return res;
    },
    end(chunk?: string) {
      if (chunk) body = chunk;
      return res;
    },
  } as unknown as ServerResponse;
  return { res, status: () => status, body: () => body };
}

describe("handleApiRequest environment gate", () => {
  // The test environment leaves ENVIRONMENTS_ENABLED unset, so the feature is
  // disabled by default — every /api/env/* route must 404.
  it("returns 404 for env routes when environments are disabled", async () => {
    const { res, status, body } = fakeRes();
    const handled = await handleApiRequest(fakeReq("GET", "/api/env/proj-1"), res);
    expect(handled).toBe(true);
    expect(status()).toBe(404);
    expect(JSON.parse(body())).toMatchObject({ error: "environments disabled" });
  });

  it("gates env action routes too", async () => {
    const { res, status } = fakeRes();
    await handleApiRequest(fakeReq("POST", "/api/env/proj-1/start"), res);
    expect(status()).toBe(404);
  });
});
