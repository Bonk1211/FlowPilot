# Flux-spray scenario review — 17 September 2026

The supplied [expert response](archive/expert-response.md) changes the process being modeled, not just terminology. The active scenario now follows declining coverage on the described S-932 / DJ-2200 bulk-feed flux-spray configuration.

| Finding | Decision and implementation |
| --- | --- |
| The old cartridge/epoxy-dot model describes a different process. | Replace active measurements, questions, fixtures, labels and illustrative geometry with spray coverage, BFS, DJ-2200 valve and coaxial air cap. Keep old cases read-only. |
| Restriction is plausible but not uniquely identified by falling weight or rising pressure demand. | Rank restriction, atomization, supply, alignment and material-condition causes. Explain score contributions; scores are demonstration heuristics, not expert-calibrated probabilities. |
| A clear nozzle does not establish a clear upstream path. | Record a nozzle-only observation. Reduce restriction support, then recommend air-cap, coaxial-air and pressure-supply checks before material and offset checks. |
| Calibration can pass despite unacceptable atomization. | Separate image quality from weight/pressure attestations. Require both plus setup and carrier inspection before simulated resolution. |
| The response lists potential data fields, not an export grammar. | Preserve the observed log parser. Do not fabricate pressure or weight events; use explicit technician reports and clearly simulated recovery results. |
| Safety and authorization depend on local controlled procedures. | Show role boundaries and prohibitions, but do not translate the response into a universal disassembly or isolation procedure. |
| The response cites internal documents without supplying them or a signed review. | Record feedback received; revised procedure approval remains pending. Do not claim reviewer identity, credentials, approval date or current controlled-document status. |

Nordson's public [DJ-2200 product page](https://www.nordson.com/en/products/electronics-solutions-products/asymtek-dispensejet-dj-2200-spray-valve) supports non-contact spray application of flux. It does not establish the specific site's BFS configuration, certification matrix, PPE, product limits or service settings. The generic product also supports other materials/configurations; the supplied response must not be generalized to every DJ-2200 installation.

## Details requiring controlled-document verification

The cited internal references are 121-1175 Rev. 196, 121-3018 Rev. 69 and 75-4706 Rev. 114. Their contents and current applicability have not been independently reviewed. Confirm the machine configuration, product/nozzle/flux selection, permitted wire and solvents, PPE, isolation sequence, torque, settings, purge counts, and recovery RFC with an authorized reviewer. The archived response remains an attributed source rather than an approved procedure.

The application retains the prohibitions against drilling/enlarging a nozzle, forcing or using incorrect cleaning wire, unapproved downstream compressed air, valve IPA flushing, air-cap/hose immersion, internal QD solvent cleaning, unauthorized micrometer adjustment, and bypassing interlocks or isolation. It does not supply physical service steps for those operations.

## Implemented boundary

One complete simulated nozzle-restriction recovery is supported. Other causes are ranked and receive further-check guidance, with no invented repair branches. Controlled masks demonstrate incomplete, coarse, shifted and overspray defects; they do not measure deposited mass, thickness or production optical quality.

Recovery uses a synthetic two-lane profile (A and B), explicit setup/calibration/weight/pressure checks, a limits reference, all-unit first-carrier acceptance in each lane, and an explicit decision about subsequent trays. If required, at least five subsequent trays must be accepted. Unknown checks block resolution. Two confirmed calibration failures block ordinary retries and require maintenance escalation. No ATRMS integration, numerical production limits, lot release or maintenance authorization is implied.

Version 1 payloads remain unchanged in storage and read-only through the API. Version 2 replaces the active demo and contract-review candidate; historical milestone and review records are retained as history.
