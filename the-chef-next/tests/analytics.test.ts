import { test } from "node:test";
import assert from "node:assert/strict";
import { CONSENT_DENIED_REGIONS, consentBootstrap, isUntrackedPath } from "../lib/analytics";

test("region consent: GPC-aware global default, EEA/UK/CH denied, redaction last", () => {
  const js = consentBootstrap("region");
  assert.equal(CONSENT_DENIED_REGIONS.length, 32);
  assert.equal(new Set(CONSENT_DENIED_REGIONS).size, 32);
  for (const r of ["DE", "FR", "IE", "IS", "LI", "NO", "GB", "CH"]) assert.ok(CONSENT_DENIED_REGIONS.includes(r), r);
  assert.match(js, /navigator\.globalPrivacyControl===true\?'denied':'granted'/);
  assert.match(js, /\{ad_storage:gpc,ad_user_data:gpc,ad_personalization:gpc,analytics_storage:'granted'\}/);
  assert.match(js, /analytics_storage:'denied',region:\["AT",.*"CH"\],wait_for_update:500/);
  assert.ok(js.endsWith("gtag('set','ads_data_redaction',true);"));
  // Executes cleanly and produces the expected dataLayer commands.
  for (const gpc of [false, true]) {
    const calls: unknown[][] = [];
    const run = new Function("gtag", "navigator", js);
    run((...a: unknown[]) => calls.push(a), { globalPrivacyControl: gpc });
    const globalDefault = calls[0][2] as Record<string, string>;
    assert.equal(globalDefault.ad_storage, gpc ? "denied" : "granted");
    assert.equal(globalDefault.analytics_storage, "granted");
    assert.deepEqual((calls[1][2] as { region: string[] }).region, CONSENT_DENIED_REGIONS);
    assert.deepEqual(calls[2], ["set", "ads_data_redaction", true]);
  }
});

test("fixed consent modes", () => {
  assert.match(consentBootstrap("denied"), /ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'/);
  assert.match(consentBootstrap("granted"), /ad_storage:'granted'.*analytics_storage:'granted'/);
  assert.doesNotMatch(consentBootstrap("denied"), /region/);
});

test("tracking never runs on operator, proposal or API paths", () => {
  for (const p of ["/crm", "/crm/leads/1", "/proposal/abc123", "/payment/success", "/payment/cancelled", "/api/catering/inquiries"]) assert.equal(isUntrackedPath(p), true, p);
  for (const p of ["/", "/thanksgiving", "/catering/inquiry", "/crmx", "/proposals-info", "/payments-info"]) assert.equal(isUntrackedPath(p), false, p);
});
