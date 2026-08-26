# Multi-Chat Full-Autonomy Working Envelope

Status: implementation baseline for AEGIS MINI Public MCP Contract v1.

## Authority model

- ChatGPT is the planner and reasoning surface. AEGIS is the execution bridge.
- A locally approved Working Envelope grants routine autonomy inside one immutable canonical root.
- One local approval covers the envelope lifetime. Preference decisions remain in ChatGPT.
- The Local Approval Window is the production approval authority. CLI approval is diagnostic/development-only.
- This iteration does not add OAuth. Production responses never expose a real approval or session secret.
- The non-secret literal `context` is a selector marker, not a credential. Authorization is resolved from the high-entropy `sessionId`, exact `workingEnvelopeId`, ACTIVE state, immutable grant, capability set, expiry, and revocation state.

## Isolation and ownership

- There is no trusted conversation identifier and no global current workspace.
- Multiple sessions and chats may be active concurrently.
- Mutation and execution authority is selected by the exact pair `sessionId + workingEnvelopeId`.
- A read from another trusted root does not change a session's mutation root.
- Every execution record is bound to its session, envelope, action, job, and process identifiers.
- Cross-session token, envelope, approval, process, and write authority is denied.

## Routine and elevated effects

- Routine child-file and child-directory create, modify, patch, rename, move, overwrite, and delete operations are autonomous inside the envelope.
- Normal local project tooling is routine. External publication, global/system mutation, destructive repository history changes, and effects outside the envelope require a separate exact local approval or remain blocked.
- The envelope root, AEGIS data root, path escapes, reparse escapes, and protected repository internals remain blocked.
- Writes use optimistic concurrency. A stale `expectedHash` returns `CONCURRENT_MODIFICATION_DETECTED`.

## Approval and cancellation lifecycle

- Session start creates a durable pending grant and opens a Windows Local Approval Window.
- Approve transitions the same request to ACTIVE and returns `sessionToken: "context"`; reject fails closed.
- A bounded wait may return `approval_required` without exposing a secret. The pending local window may still resolve the grant, and status may be queried by its high-entropy session identifier.
- Boundary/high-impact run approvals retain exact-request, one-time claim/consume storage. Production approval is brokered locally and may execute in the same call after approval.
- HTTP request abort/close is propagated to an owned process tree when the MCP transport delivers it. Host/tunnel cancellation delivery is not assumed when the upstream transport does not forward disconnects.

## Public contract

The nine Public MCP Contract v1 tool names, order, input schemas, and output schemas remain frozen. No Control, Transfer, Verify, or Checkpoint capability is enabled by this work.

## CHATGPT-TRUSTED INTENT MODEL

Production authorization source is **CHATGPT-TRUSTED USER INTENT**. AEGIS trusts ChatGPT to request a Working Envelope only after the user has authorized the work in the conversation. A valid production start creates an immutable grant, activates it immediately, and returns the non-secret `context` marker. AEGIS does not repeat the human-approval ceremony and does not decide user preferences.

AEGIS mechanically checks that the session exists, the exact `sessionId + workingEnvelopeId` pair matches, state is ACTIVE, the immutable canonical root and capabilities permit the request, the grant has not expired or been revoked, mutation remains contained, and process ownership remains isolated.

## C: MUTATION SHIELD

`C:\` is globally protected from GPT-workload mutation. A mutation-capable Working Envelope cannot use a C: root, and direct or recognized explicit process mutation targets on C: fail with `SYSTEM_DRIVE_MUTATION_BLOCKED`. There is no per-session or chat approval override.

Reading C: remains governed by the independent Read Plane. Executables installed on C: may be launched with a non-C: Working Envelope because executable location is not a mutation target. AEGIS internal state under `AEGIS_INTERNAL_DATA_ROOT`, including the configured Local AppData data root, is an internal-operation exception and remains inaccessible to GPT mutation APIs.

The shield strongly covers direct AEGIS mutation APIs and recognized explicit command targets. Arbitrary executable side effects are not an OS-level filesystem sandbox guarantee.

## ARBITRARY-N SESSION MODEL

The implementation supports an arbitrary number of concurrent sessions and arbitrary user-selected filesystem roots. It has no conversation identifier, global current workspace, fixed chat count, or production Chat A/Chat B labels. One conversation may orchestrate multiple envelopes by selecting the exact identifiers for each action.

Real Chat A and Real Chat B are illustrative acceptance scenarios only. The implementation MUST support an arbitrary number of concurrent sessions and arbitrary user-selected filesystem roots. No folder name, drive letter except the global protected C: mutation rule, chat label, or fixed session count may be hard-coded.

## CROSS-FOLDER READ INVARIANT

**READ SCOPE != MUTATION SCOPE.** Sessionless Trusted Read Root access may inspect, read, or search another folder or C: reference without changing any Working Envelope. A later mutation still requires the exact session/envelope pair whose immutable canonical root contains the target.
