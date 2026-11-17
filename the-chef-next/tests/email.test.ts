import { test } from "node:test";
import assert from "node:assert/strict";
import { renderInquiryAcknowledgment } from "../lib/email/templates";

test("inquiry acknowledgment is branded, bounded and safely escaped", () => {
  const message = renderInquiryAcknowledgment(
    "client@example.test",
    "inquiry:1",
    {
      first_name: "<Client>",
      event_type: "Wedding",
      requested_date: "2027-10-17",
      guest_count: 90,
      package_interest: "Gold",
    },
  );
  assert.equal(message.to, "client@example.test");
  assert.equal(message.idempotencyKey, "inquiry:1");
  assert.match(message.text, /confirms receipt only/);
  assert.match(message.html, /&lt;Client&gt;/);
  assert.ok(!message.html.includes("<Client>"));
});

test("invalid acknowledgment template data is rejected", () => {
  assert.throws(() =>
    renderInquiryAcknowledgment("client@example.test", "inquiry:2", {
      first_name: "",
      event_type: "Wedding",
      requested_date: "bad",
      guest_count: 0,
      package_interest: "Gold",
    }),
  );
});
