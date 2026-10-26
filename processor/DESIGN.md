# Isolated submission processor

Use an operator-invoked `processor run --once` command. Its credentialed parent claims one immutable submission, downloads and hashes bounded inputs, runs isolated commands, verifies captured outputs after terminating every untrusted process, and submits a bound result. It installs no daemon and exposes no inbound listener. Offline operators leave jobs pending; no continuous availability is promised.

## Existing tools and limits

`scripts/recipe-check.ts` and `recipe-package-core.ts` already validate the exact stored ZIP representation, member paths, manifest digests, import closure, approved dependency lock, fixed build/runner templates and notices. Run their parsing and extraction inside the sandbox, including malformed archive handling. Reject compressed entries, absolute/traversal paths, duplicate members, symlink metadata, inconsistent central/local records and excessive member/count/expanded-size bounds before execution. Do not extract into a host directory.

`scripts/recipe-verify.ts` assumes a full repository, tests, baseline evidence and browser tooling. `verification-process.ts` inherits the environment and limits time but not memory, network or filesystem access. `recipe-verify-package.ts` explicitly reports `executed:false`. None currently establishes safe hosted execution.

A pinned trusted driver can reuse the package checker, compiler, production replay/export interfaces and trusted GLB validation. Its initial execution profile must name the actual checks: source/package integrity, compilation, canonical configuration binding, required-case execution, structural GLB/schema/geometry checks, and deterministic repeated outputs. If the sealed coverage cannot be reconstructed exactly, return unsupported. Package replay does not supply missing repository behavior tests or become the existing eight-stage full recipe verification. Visual quality, licensing/provenance judgments and portability review remain separate required decisions.

## Isolation and supervisor

The trusted parent retains the scoped service credential and lease. They are absent from child arguments, environment, inherited file descriptors and mounts. It invokes fixed commands without a shell and never imports submitted modules itself.

Use a unique transient user systemd unit with cgroup v2 limits around Bubblewrap. Require separate user, mount, PID, network and IPC namespaces, dropped capabilities, no-new-privileges, disabled nested user namespaces, a new session and parent-death cleanup. The final profile also requires a pinned seccomp filter denying namespace/mount/ptrace and other unnecessary privileged interfaces. Missing prerequisites fail closed.

Mount only manifest-verified runtime binaries/libraries, approved dependency closure, the trusted harness and exact job inputs read-only. Expose no host home, repository, credentials, user bus, Docker socket, display or other host sockets. Writable scratch and outputs use size-limited sandbox tmpfs, not a shared host directory. There is no package installation, registry access or network in the child.

Current profile ceilings: 2 GiB memory, zero swap, 64 tasks, CPU quota of one core, 120-second execution wall deadline, 256 MiB scratch, 16 MiB output tmpfs, 2 MiB per exported file, and 256 KiB per diagnostic stream. The original 19-case source package passed under these bounds. Stdout capture is bounded to 8 MiB. The parent bounds download, pipe/frame sizes, artifact counts and upload time independently. V8 virtual address reservations make a small address-space limit unsuitable as the primary memory control.

Treat every byte from the execution sandbox as untrusted, including reports and stdout. Transfer only bounded framed artifact data into a fresh parent-owned snapshot. The parent owns command/stage status through OS supervision, kills the entire unit including detached descendants, and confirms teardown before checking that snapshot. No child-claimed success grants an attestation.

Run trusted post-run validators in a separate fresh sandbox with the captured snapshot and pinned tools read-only, without submitted executable source. Recompute hashes and configuration/coverage bindings independently. Only the parent builds the final technical evidence from actual exits, required check results, toolchain/policy identities and validated artifact hashes. A forged report, `process.exit(0)`, missing artifact or incomplete coverage fails.

## Service contract

Core owns authorization and atomic state transitions. The implemented outbound adapter uses these endpoints.

- `POST /api/processor/claims`: accept an idempotency key and supported profile identifier. Return no job, or a server-selected job ID, opaque expiring lease, immutable version/subject/manifest/report identities, exact recipe and source-package descriptors, required coverage and policy identifier. Claim only receipt-complete submitted versions atomically. Expired claims become retryable with bounded attempts.
- Permit the claimed processor principal to read only that version's existing protected file endpoint. Do not grant catalog-wide or human-review authority. The credential and lease stay in the parent. Claimed calls require `Authorization: Bearer pc_...`, `X-Processor-Lease` and `X-Processor-Attempt` headers.
- Permit bounded, immutable upload of result artifacts with server readback receipts. Reuse the existing evidence storage/receipt mechanism where possible. The final manifest binds every accepted result file by path, SHA-256 and bytes.
- `POST /api/processor/jobs/:id/result`: accept the lease and idempotent attempt ID, exact claimed identities, terminal status, profile/toolchain digests, configured limits, observed OS outcome, actual case coverage, check results, first failure and receipt-backed artifact manifest. Reject expired/stale leases, changed subject/policy, missing receipts or unsupported coverage. The server assigns the processing identity. It creates technical authority only for the exact approved profile after all required trusted checks succeed; no visual/source-review or publication authority follows automatically.

Claim envelopes use `leaseExpiresAt` in Unix milliseconds and `version.id`. The profile fixes exactly three result artifacts: `outputs.zip`, `validation.json` and `execution.json`. The final result body matches `result.schema.json`; lease and attempt identifiers stay in headers.

A single 600-second claim lease can cover bounded download, execution and upload without a background heartbeat. If it cannot, the parent reports failure or lease expiry; it must not silently retain authority.

## Required implementation acceptance

1. Real host-filesystem/proc escape, network/host-loopback, environment and descriptor-canary attempts fail inside the final mount/seccomp profile.
2. Actual memory pressure, process spawning, CPU/wall exhaustion, output-volume and per-file-size probes hit the configured OS limits, and no descendants survive.
3. Traversal, symlink, duplicate, corrupt/oversized/compressed ZIP inputs fail before execution.
4. A validly sealed malicious recipe that exits zero and prints forged success produces no technical pass. Reports cannot replace missing or invalid GLBs. Writable-output/report forgery cannot affect pinned post-run checks.
5. An original source package executes successfully with its exact design and required supported cases. Independent validation and repeated output comparison bind the retained technical evidence to source, input, toolchain and policy digests.
6. Expired leases, interrupted uploads and offline periods remain truthful pending/failed states. A local pilot requires only outbound service access and the operator's existing host; it has no paid fallback or always-on claim.

## Verification evidence

`verification/design-feasibility.json` records the initial small trusted probes. Bubblewrap 0.11.1 isolated filesystem, environment, capabilities and network/PID namespaces. Transient cgroup limits enforced memory, tasks, CPU rate and time. Tmpfs and file-size limits rejected excess output. `verification/package-replay-v1/summary.json` records the final minimal capsule, seccomp profile, resource and hostile-input tests, stable failure codes and live-payload owner-death cleanup. `verification/package-replay-v1-api/summary.json` records actual claim, 194 sealed downloads, 19-case execution, three receipt-backed uploads and accepted result submission. A second invocation left all execution outputs unchanged.

Bubblewrap protection depends on the supplied mount, namespace and syscall policy, as documented in its [upstream security guidance](https://github.com/containers/bubblewrap#sandboxing). Resource ceilings use the kernel controllers described in [systemd resource control](https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html).

## Owner lifetime and stable failures

A trusted launcher watches pidfds for the actual CLI owner and payload. Owner death kills the payload within five seconds while the enclosing admitted job remains alive. Service and stage diagnostics never determine infrastructure authority. Trusted checker identifiers and parent-observed OS outcomes determine stable failure codes; arbitrary recipe stderr remains bounded diagnostics. Resource exhaustion is a semantic failed attempt.

The outbound entry point is `python3 processor/service.py run --once`. It accepts an origin, a private mode0600 credential file, a reviewed runtime and a private work directory. It uses one origin, refuses redirects, bounds responses and verifies every sealed download. The same trusted parent holds credentials and runs the local supervisor. Its sandbox launcher receives only the fixed sanitized environment. Claim state permits idempotent retries without reexecuting a finished local result. Upload responses must confirm server readback hashes and lengths before the exact result is posted. No daemon or inbound service is installed.
