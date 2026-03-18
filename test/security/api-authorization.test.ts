import test from "node:test";
import assert from "node:assert/strict";

import {
  PRIVILEGED_ROUTE_POLICIES,
  evaluateRouteAccess,
  matchPrivilegedRouteId,
} from "../../src/lib/api-authorization-policy";

test("unauthenticated access is denied for every privileged route", () => {
  for (const routeId of Object.keys(PRIVILEGED_ROUTE_POLICIES)) {
    const decision = evaluateRouteAccess({
      actorRole: "anonymous",
      routeId: routeId as keyof typeof PRIVILEGED_ROUTE_POLICIES,
    });
    assert.equal(decision.allowed, false, routeId);
    assert.equal(decision.status, 401, routeId);
  }
});

test("non-admin users are denied for every admin route", () => {
  for (const [routeId, policy] of Object.entries(PRIVILEGED_ROUTE_POLICIES)) {
    if (policy !== "admin") continue;

    const decision = evaluateRouteAccess({
      actorRole: "user",
      actorUserId: "11111111-1111-1111-1111-111111111111",
      routeId: routeId as keyof typeof PRIVILEGED_ROUTE_POLICIES,
    });
    assert.equal(decision.allowed, false, routeId);
    assert.equal(decision.status, 403, routeId);
  }
});

test("owner-scoped routes deny authenticated users targeting another account", () => {
  for (const [routeId, policy] of Object.entries(PRIVILEGED_ROUTE_POLICIES)) {
    if (policy !== "self") continue;

    const decision = evaluateRouteAccess({
      actorRole: "user",
      actorUserId: "11111111-1111-1111-1111-111111111111",
      resourceUserId: "22222222-2222-2222-2222-222222222222",
      routeId: routeId as keyof typeof PRIVILEGED_ROUTE_POLICIES,
    });
    assert.equal(decision.allowed, false, routeId);
    assert.equal(decision.status, 403, routeId);
  }
});

test("authenticated users can access authenticated and self routes only for themselves", () => {
  for (const [routeId, policy] of Object.entries(PRIVILEGED_ROUTE_POLICIES)) {
    const actorUserId = "11111111-1111-1111-1111-111111111111";
    const decision = evaluateRouteAccess({
      actorRole: "user",
      actorUserId,
      resourceUserId: policy === "self" ? actorUserId : null,
      routeId: routeId as keyof typeof PRIVILEGED_ROUTE_POLICIES,
    });

    if (policy === "admin") {
      assert.equal(decision.allowed, false, routeId);
      assert.equal(decision.status, 403, routeId);
    } else {
      assert.equal(decision.allowed, true, routeId);
      assert.equal(decision.status, 200, routeId);
    }
  }
});

test("dynamic privileged routes are matched by method and pathname", () => {
  assert.equal(
    matchPrivilegedRouteId("DELETE", "/api/linket-profiles/123"),
    "DELETE /api/linket-profiles/[id]"
  );
  assert.equal(
    matchPrivilegedRouteId("GET", "/api/admin/mint/batch/abc"),
    "GET /api/admin/mint/batch/[batchId]"
  );
  assert.equal(matchPrivilegedRouteId("GET", "/api/lead-forms/public"), null);
  assert.equal(matchPrivilegedRouteId("POST", "/api/linkets"), null);
});
