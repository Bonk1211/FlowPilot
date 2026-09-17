# M0 joint contract review package

This package prepares the remaining M0 review. **It is not reviewer acceptance.**
Both developers' acceptance remains Pending in [the milestone log](MILESTONES.md#pending-joint-contract-review-and-freeze).

The exact candidate is identified by `candidate_sha256` and file hashes in
[contract-review-candidate.json](contract-review-candidate.json). `base_commit`
identifies the checkout's committed base, not a claim that working-tree changes
are committed. Record the final reviewed commit when the candidate is committed.

## Review boundary

| Area | Candidate to review | Required agreement |
| --- | --- | --- |
| Evidence | `investigations/models.py`, generated contracts | Source, timestamp, units (including per-field maps), provisional/verified/rejected meanings |
| Findings | `diagnosis/models.py`, `diagnosis/reasoning.py` | Five named hypotheses, two specialist roles, critic, citation validation, explicit known uncertainty, whole-run fallback |
| Workflow | `cases.py`, `golden.py`, scoring rules | Scores are points, not probabilities; both outcomes require confirmation; negative inspection completion precedes reassessment; verification gates resolution |
| Corrections | `cases.py`, generated `CorrectEvidence` | Preserve history, retire dependent answers, reject immutable machine/image values, clear pending observation, lock after either confirmed outcome |
| Procedure | `procedures/models.py`, frontend `prototype/model.ts` | Flux-spray semantic nodes, shared camera presets, illustrative text/2D fallback; no approved removal procedure is claimed |
| Golden fixture | `fixtures/v2/golden-scenario.json` | Version 2.0, shared API/frontend source, branch evidence isolation, parity with deterministic initial scores |
| Ownership | PRD section 16 | A owns contracts/execution; B owns presentation; both own fixture changes and integration |

The M2 case/reasoning additions are included because implementation proceeded before
M0 sign-off. Review the current boundary rather than retroactively accepting only
the earlier M0 snapshot. Golden schema/fixture versions are now 2.0; case API additions
are represented in the regenerated OpenAPI and TypeScript contracts.

## Verification and acceptance

1. Run `npm run contracts:check` and `node scripts/contract-review.mjs --check`.
2. Review `npm run check` and `npm run test:e2e -- --workers=4` results, plus both
   prototype outcomes and the current case workflow. Automated results support
   technical review but do not establish joint agreement.
3. Each developer records their name, acceptance date, candidate hash, and any
   unresolved concern in the milestone log's acceptance table. Obtain explicit
   agreement on the checklist there; do not infer acceptance from authorship.
4. Record the commit containing the reviewed candidate. Mark M0 Complete only once
   both acceptances and the reviewed revision are recorded. Keep expert procedure
   approval separate; that remains an M3 requirement.

If covered files change, run `node scripts/contract-review.mjs`, review the diff,
and obtain acceptance for the new hash. Prior acceptance does not transfer silently.

Version 2 requires fresh review of spray measurements, nozzle-only inspection, structured recovery and legacy read-only behavior. Expert feedback received; revised procedure approval remains pending. Historical acceptance does not transfer.
