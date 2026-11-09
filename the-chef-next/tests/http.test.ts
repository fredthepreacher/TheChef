import { test } from "node:test";
import assert from "node:assert/strict";
const origin = process.env.TEST_BASE_URL;
test(
  "production HTTP boundaries without configured credentials",
  { skip: !origin },
  async (t) => {
    for (const path of [
      "/crm",
      "/crm/leads",
      "/crm/clients",
      "/crm/events",
      "/crm/leads/00000000-0000-4000-8000-000000000001",
    ]) {
      await t.test(`${path} redirects unauthenticated access`, async () => {
        const response = await fetch(`${origin}${path}`, {
          redirect: "manual",
        });
        assert.equal(response.status, 307);
        assert.equal(response.headers.get("location"), "/crm/login");
        assert.match(response.headers.get("cache-control") ?? "", /no-store/);
        assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
      });
    }
    await t.test(
      "public site and inquiry page load; no admin navigation",
      async () => {
        const response = await fetch(`${origin}/`);
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.ok(html.includes("/catering/inquiry"));
        assert.ok(html.includes("mailto:cheftherapperr@email.com"));
        assert.ok(!html.includes('href="/crm'));
        const inquiry = await fetch(`${origin}/catering/inquiry?package=Gold`);
        assert.equal(inquiry.status, 200);
        assert.match(await inquiry.text(), /Send My Event Request/);
      },
    );
    await t.test("robots excludes private routes", async () => {
      const response = await fetch(`${origin}/robots.txt`);
      // Indexable production lists /crm and /api/; every other host disallows all.
      assert.match(await response.text(), /Disallow: \/(crm)?$/m);
    });
    await t.test("intake fails closed before configured", async () => {
      const response = await fetch(`${origin}/api/catering/inquiries`, {
        method: "POST",
        headers: { Origin: origin!, "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(response.status, 503);
      assert.ok(!(await response.text()).includes("SUPABASE"));
    });
  },
);
