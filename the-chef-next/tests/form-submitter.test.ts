import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

// F-6 (hosted re-check 2026-11-10): Approve / Cancel on scheduled actions and
// Enable / Disable on automation rules always failed validation. Those forms carry
// a hidden <input name="id">, which makes `form.id` return that element instead of
// a string. React builds a server action's FormData by inserting a temporary input
// for the clicked button and, when `form.id` is truthy, sets
// form="[object HTMLInputElement]" on it, so the button's name/value is never
// submitted. Reproduced locally in a clean browser; a form without a control
// named "id" (e.g. the client proposal page's `token` form) is unaffected.
// Rule: a form with a control named "id" must not rely on its submit button's value.

const root = fileURLToPath(new URL("..", import.meta.url));
const FORM = /<form\b[\s\S]*?<\/form>/g;
const ID_CONTROL = /<(?:input|select|textarea|button)\b[^>]*\bname=["']id["']/;
const NAMED_BUTTON = /<button\b[^>]*\bname=/;

const loosesSubmitterValue = (form: string) => ID_CONTROL.test(form) && NAMED_BUTTON.test(form);

function* tsxFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* tsxFiles(path);
    else if (path.endsWith(".tsx")) yield path;
  }
}

test("the detector recognises the F-6 markup and accepts the fix", () => {
  assert.ok(loosesSubmitterValue(
    `<form action={decideScheduledAction}><input type="hidden" name="id" value={action.id} /><button name="approved" value="true">Approve</button></form>`,
  ));
  assert.ok(!loosesSubmitterValue(
    `<form action={decideScheduledAction}><input type="hidden" name="id" value={action.id} /><input type="hidden" name="approved" value="true" /><button>Approve</button></form>`,
  ));
  assert.ok(!loosesSubmitterValue(
    `<form action={respondToProposal}><input type="hidden" name="token" value={token} /><button name="response" value="declined">Decline</button></form>`,
  ));
});

test("no form with a control named id depends on its submit button's value", () => {
  const offenders: string[] = [];
  let forms = 0;
  for (const dir of ["app", "components"])
    for (const file of tsxFiles(join(root, dir)))
      for (const match of readFileSync(file, "utf8").matchAll(FORM)) {
        forms++;
        if (loosesSubmitterValue(match[0])) offenders.push(`${relative(root, file)}: ${match[0].slice(0, 120)}`);
      }
  assert.ok(forms > 20, `scanned ${forms} forms`);
  assert.deepEqual(offenders, []);
});
