import test from "ava";
import ky from "ky";
import { createServer } from "node:http";
import { BadRequestError, deserializeApiError, NotFoundError, serializeApiError } from "../src/api-errors.js";

function createTestServer(handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void) {
  return new Promise<{ server: import("node:http").Server; url: string }>((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

test("ky: server returns serialized BadRequestError, client deserializes", async (t) => {
  const err = new BadRequestError("Invalid input", [{ path: ["email"], message: "required" }]);
  const body = serializeApiError(err);

  const { server, url } = await createTestServer((_req, res) => {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  });

  try {
    const response = await ky.get(url, { throwHttpErrors: false });
    t.is(response.status, 400);
    const data = await response.json();
    const restored = deserializeApiError(data) as BadRequestError;
    t.assert(restored !== null);
    t.assert(restored instanceof BadRequestError);
    t.is(restored!.message, "Invalid input");
    t.is(restored!.status, 400);
    t.deepEqual(restored!.details, [{ path: ["email"], message: "required" }]);
  } finally {
    server.close();
  }
});

test("ky: server returns serialized NotFoundError, client deserializes", async (t) => {
  const err = new NotFoundError("Order");
  const body = serializeApiError(err);

  const { server, url } = await createTestServer((_req, res) => {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  });

  try {
    const response = await ky.get(url, { throwHttpErrors: false });
    t.is(response.status, 404);
    const data = await response.json();
    const restored = deserializeApiError(data) as NotFoundError;
    t.assert(restored !== null);
    t.assert(restored instanceof NotFoundError);
    t.is(restored!.message, "Order not found");
    t.is(restored!.resource, "Order");
  } finally {
    server.close();
  }
});

test("ky: server returns bad/malformed JSON body, deserialize returns null", async (t) => {
  const { server, url } = await createTestServer((_req, res) => {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Something broke" }));
  });

  try {
    const response = await ky.get(url, { throwHttpErrors: false });
    t.is(response.status, 500);
    const data = await response.json();
    const restored = deserializeApiError(data);
    t.is(restored, null);
  } finally {
    server.close();
  }
});

test("ky: server returns valid serialized error shape, client can rethrow", async (t) => {
  const err = new BadRequestError("Validation failed");
  const body = serializeApiError(err);

  const { server, url } = await createTestServer((_req, res) => {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  });

  try {
    const response = await ky.get(url, { throwHttpErrors: false });
    const data = await response.json();
    const restored = deserializeApiError(data);
    t.assert(restored !== null);
    await t.throwsAsync(
      async () => {
        if (restored) throw restored;
      },
      { instanceOf: BadRequestError, message: "Validation failed" }
    );
  } finally {
    server.close();
  }
});
