import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import prPreviewRoutes from "../src/routes/pr-preview.routes.js";

async function setup(fetcher, token = "test-token") {
  const app = Fastify();
  await app.register(prPreviewRoutes, { fetcher, token });
  return app;
}

test("returns only production and open PR URLs, including all pages", async (t) => {
  const calls = [];
  const app = await setup(async (url, options) => {
    calls.push({ url, options });
    const prs =
      calls.length === 1
        ? Array.from({ length: 100 }, (_, i) => ({ number: i + 1, title: "private" }))
        : [{ number: 101, title: "private" }];
    return Response.json(prs);
  });
  t.after(() => app.close());

  const response = await app.inject("/api/pr-preview-links");
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.json().length, 102);
  assert.equal(response.json()[0], "https://tp.dstw.dev");
  assert.equal(response.json()[1], "https://pr-1.tp.dstw.dev");
  assert.equal(response.json()[101], "https://pr-101.tp.dstw.dev");
  assert.match(calls[0].url, /state=open&per_page=100&page=1$/);
  assert.match(calls[1].url, /page=2$/);
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-token");
  assert.ok(!response.body.includes("test-token"));
  assert.ok(!response.body.includes("private"));
});

test("returns the production URL when there are no open PRs", async (t) => {
  const app = await setup(async () => Response.json([]));
  t.after(() => app.close());
  const response = await app.inject("/api/pr-preview-links");
  assert.deepEqual(response.json(), ["https://tp.dstw.dev"]);
});

test("fails explicitly if the token is missing", async (t) => {
  const app = await setup(() => assert.fail("must not call GitHub"), "");
  t.after(() => app.close());
  const response = await app.inject("/api/pr-preview-links");
  assert.equal(response.statusCode, 503);
});

for (const status of [401, 403, 404, 429, 500]) {
  test(`reports GitHub HTTP ${status} without exposing its response`, async (t) => {
    const app = await setup(async () => Response.json({ secret: "private" }, { status }));
    t.after(() => app.close());
    const response = await app.inject("/api/pr-preview-links");
    assert.equal(response.statusCode, 502);
    assert.match(response.json().error, new RegExp(`HTTP ${status}`));
    assert.ok(!response.body.includes("private"));
    assert.ok(!response.body.includes("test-token"));
  });
}

test("does not return a partial list when a later page fails", async (t) => {
  let count = 0;
  const app = await setup(async () => {
    count++;
    return count === 1
      ? Response.json(Array.from({ length: 100 }, (_, i) => ({ number: i + 1 })))
      : Response.json({}, { status: 500 });
  });
  t.after(() => app.close());
  const response = await app.inject("/api/pr-preview-links");
  assert.equal(response.statusCode, 502);
  assert.equal(Array.isArray(response.json()), false);
});

test("rejects malformed data and handles network failures", async (t) => {
  for (const fetcher of [
    async () => Response.json([{ number: -1 }]),
    async () => Response.json({ message: "invalid" }),
    async () => { throw new Error("test-token"); },
  ]) {
    const app = await setup(fetcher);
    t.after(() => app.close());
    const response = await app.inject("/api/pr-preview-links");
    assert.equal(response.statusCode, 502);
    assert.ok(!response.body.includes("test-token"));
  }
});
