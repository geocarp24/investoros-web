import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  fetchWithRetry,
  checkRobotsAllowed,
  extractFirst,
  extractAll,
  __setFetch,
} from "../src/scraper_client.mjs";

describe("fetchWithRetry", () => {
  test("rejects empty url", async () => {
    await assert.rejects(() => fetchWithRetry(""), /url required/);
    await assert.rejects(() => fetchWithRetry(null), /url required/);
  });

  test("returns body on 200 OK", async () => {
    __setFetch(async () => ({
      status: 200,
      headers: { forEach: () => {} },
      text: async () => "<html>hello</html>",
    }));
    const r = await fetchWithRetry("https://example.com");
    assert.equal(r.status, 200);
    assert.equal(r.body, "<html>hello</html>");
  });

  test("retries on 429 with Retry-After", async () => {
    let calls = 0;
    __setFetch(async () => {
      calls++;
      if (calls === 1) {
        return {
          status: 429,
          headers: { get: (k) => (k === "retry-after" ? "1" : null), forEach: () => {} },
          text: async () => "rate limited",
        };
      }
      return { status: 200, headers: { forEach: () => {} }, text: async () => "ok" };
    });
    const r = await fetchWithRetry("https://example.com", { attempts: 3, baseDelayMs: 10 });
    assert.equal(r.status, 200);
    assert.equal(calls, 2);
  });

  test("retries on network error", async () => {
    let calls = 0;
    __setFetch(async () => {
      calls++;
      if (calls < 3) throw new Error("network down");
      return { status: 200, headers: { forEach: () => {} }, text: async () => "ok" };
    });
    const r = await fetchWithRetry("https://example.com", { attempts: 3, baseDelayMs: 10 });
    assert.equal(r.status, 200);
    assert.equal(calls, 3);
  });

  test("throws after max attempts", async () => {
    __setFetch(async () => { throw new Error("always fails"); });
    await assert.rejects(
      () => fetchWithRetry("https://example.com", { attempts: 2, baseDelayMs: 10 }),
      /fetch failed after 2 attempts/
    );
  });
});

describe("checkRobotsAllowed", () => {
  test("allows when robots.txt 404", async () => {
    __setFetch(async () => ({ status: 404, headers: { forEach: () => {} }, text: async () => "" }));
    const r = await checkRobotsAllowed("https://example.com/page");
    assert.equal(r.allowed, true);
  });

  test("blocks based on User-agent: * Disallow rule", async () => {
    __setFetch(async () => ({
      status: 200,
      headers: { forEach: () => {} },
      text: async () => "User-agent: *\nDisallow: /private/\n",
    }));
    const r = await checkRobotsAllowed("https://example.com/private/secret");
    assert.equal(r.allowed, false);
    assert.match(r.reason, /disallows/);
  });

  test("allows when path not in Disallow", async () => {
    __setFetch(async () => ({
      status: 200,
      headers: { forEach: () => {} },
      text: async () => "User-agent: *\nDisallow: /admin/\n",
    }));
    const r = await checkRobotsAllowed("https://example.com/public/page");
    assert.equal(r.allowed, true);
  });

  test("ignores rules for other user-agents", async () => {
    __setFetch(async () => ({
      status: 200,
      headers: { forEach: () => {} },
      text: async () => "User-agent: BadBot\nDisallow: /\nUser-agent: *\nAllow: /\n",
    }));
    const r = await checkRobotsAllowed("https://example.com/anything");
    assert.equal(r.allowed, true);
  });
});

describe("extractFirst", () => {
  test("returns capture group when present", () => {
    assert.equal(extractFirst("price: $1,500", /price:\s*\$([\d,]+)/), "1,500");
  });
  test("returns full match when no capture group", () => {
    assert.equal(extractFirst("hello world", /world/), "world");
  });
  test("returns null when no match", () => {
    assert.equal(extractFirst("hello", /xyz/), null);
  });
  test("null/empty inputs", () => {
    assert.equal(extractFirst(null, /x/), null);
    assert.equal(extractFirst("text", null), null);
  });
});

describe("extractAll", () => {
  test("returns all matches with capture", () => {
    const r = extractAll("a=1, b=2, c=3", /(\w)=(\d)/g);
    assert.equal(r.length, 3);
  });
  test("auto-adds g flag", () => {
    const r = extractAll("foo bar foo", /foo/);
    assert.equal(r.length, 2);
  });
  test("empty array on no match", () => {
    const r = extractAll("hello", /xyz/);
    assert.deepEqual(r, []);
  });
});
