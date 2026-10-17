import test from "node:test";
import assert from "node:assert/strict";
import { documentError } from "./src/utils/documentErrors.js";

test("document error categories preserve authentication and network distinctions in EN/FR", () => {
  for (const fr of [false, true]) {
    const messages = [undefined, 401, 403, 404, 503].map(status => documentError(status ? { response: { status } } : { code: "ERR_NETWORK" }, "list", fr));
    assert.equal(new Set(messages).size, 5);
    assert.notEqual(documentError({}, "context", fr), documentError({}, "list", fr));
    assert.match(messages[1], fr ? /session a expiré/ : /session expired/);
    assert.notEqual(documentError(new TypeError("Invalid server payload"), "list", fr), messages[0]);
  }
});

test("document errors do not reveal untrusted server payload or request secrets", () => {
  const error = { response: { status: 503, data: { detail: "DO-NOT-DISPLAY" } }, config: { headers: { Authorization: "DO-NOT-DISPLAY" } } };
  for (const fr of [false, true]) assert.ok(!documentError(error, "list", fr).includes("DO-NOT-DISPLAY"));
});
