# Asymtek S-932 — Consolidated Technical and Troubleshooting Reference

**Edition:** 1.0 · **Compiled:** 30 September 2026  
**Purpose:** One organized reference for engineering review and development of an evidence-based AI troubleshooting system.  
**Inputs:** Four user-provided NYRA conversation exports. Repeated explanations are consolidated; unique technical details, exceptions and unresolved differences are retained.

> **Evidence status:** This document consolidates secondary AI-generated conversation summaries. The original manuals, controlled procedures, incident records, machine exports and drawings were not included in these four files. Machine-specific instructions, part numbers, limits and source-revision claims therefore remain **unverified**. This document is a development reference, not an approved operating or maintenance procedure. Actual work requires the applicable controlled document, configuration and site authorization.

## Contents

- [1. Source register and reading conventions](#1-source-register-and-reading-conventions)
- [2. Scope, configuration and equipment model](#2-scope-configuration-and-equipment-model)
- [3. Production setup, idle state and material control](#3-production-setup-idle-state-and-material-control)
- [4. Inspection, cleaning and material-path maintenance](#4-inspection-cleaning-and-material-path-maintenance)
- [5. Defect and hypothesis catalogue](#5-defect-and-hypothesis-catalogue)
- [6. Reported production recovery cases](#6-reported-production-recovery-cases)
- [7. Qualification and return to production](#7-qualification-and-return-to-production)
- [8. Preventive-maintenance programme](#8-preventive-maintenance-programme)
- [9. Repair and calibration topic index](#9-repair-and-calibration-topic-index)
- [10. Valve tracking, material identification and RFID](#10-valve-tracking-material-identification-and-rfid)
- [11. Reported numerical values and acceptance criteria](#11-reported-numerical-values-and-acceptance-criteria)
- [12. Safety, roles and task authorization](#12-safety-roles-and-task-authorization)
- [13. Evidence, data fields and software functions](#13-evidence-data-fields-and-software-functions)
- [14. Parts, tools and component identifiers](#14-parts-tools-and-component-identifiers)
- [15. Root-cause analysis and discriminating tests](#15-root-cause-analysis-and-discriminating-tests)
- [16. Workstation, records and conversion management](#16-workstation-records-and-conversion-management)
- [17. Separate ASM TCB bonder cases](#17-separate-asm-tcb-bonder-cases)
- [18. Unresolved differences and verification priorities](#18-unresolved-differences-and-verification-priorities)
- [19. Source coverage and consolidation notes](#19-source-coverage-and-consolidation-notes)

## 1. Source register and reading conventions

### 1.1 Included conversations

| ID | Uploaded filename | Content retained |
|---|---|---|
| C1 | ast_info2.md | Six S-932 recovery topics and four separate ASM TCB bonder topics, attributed to 121-1175 |
| C2 | nyra-chat-conversation.md | Hardware, material flow, operation, fault signatures, RCA, candidate data fields, PM overview and practical lessons |
| C3 | ast_spec_manual1.md | Reported PM-manual metadata; repair topics; facility, safety, PM, calibration, tracking and operational details |
| C4 | ast_spec_manual2.md | Additional safety context, annual PM A1–A33, BFS procedures, valve tracking, labels, Bundle8 and RFID |

The separate ast_info.md contains only an unsuccessful lookup and is excluded. The two competition PDFs are outside this four-conversation consolidation. Chat prompts, refusals, repeated offers and the unanswered BKM-search request at the end of C2 are omitted. That unanswered request does not establish a complete BKM inventory.

**Citation convention:** C2:R2 §14 means conversation C2, response 2, section 14. C1:R3 §8.2.2.1 refers to a section number quoted by that conversation. These are locators within the supplied text, not independently checked manual citations. Sources placed below a heading apply to its tables and bullets unless a narrower source is shown.

**Editorial convention:** Text explicitly marked “Editorial” organizes the material or identifies a gap; it is not a new machine specification. Candidate causes are hypotheses. Reported historical cases have no attached primary case records or frequency data.

### 1.2 Referenced documents and systems

| Referenced source | Reported identity or revision | Claimed role | Status here |
|---|---|---|---|
| 121-1175.pdf | TCB Link Operation Specification; Rev. 196 in C2 | Production setup, flux changes, inspection and recovery; C1 quotes §§8.2.2–8.2.3 | Original absent |
| 121-3018.pdf | TSX Link Operation Specification; Rev. 69 in C2 | S-932 operation and process-problem recovery | Original absent; product/module applicability must be checked |
| 75-4706.pdf | Asymtek S-932 Spray Flux Preventive Maintenance Specification; Rev. 114, 31 March 2026; 371 pages reported in C3 | CAM, TCB and SLAM PM, calibration, repairs and return to production | Original absent; “current” is the conversation's claim |
| 75-6809 | Detailed DJ2200 valve PM | Valve-station maintenance | Referenced in C4; original absent |
| Spectrum/Asymtek operating manual | No verified edition supplied | OEM operation and repair | Original absent |
| 75-0600 | Workstream Policies and Procedures for C4 OLGA | Tool-down, tool-up and status handling | Original absent |
| 75-0004 | Assembly/Test Manufacturing PM/Calibration Specification | PM/calibration governance | Original absent |
| 20-0354 | Current ESD acceptance requirements | Conveyor ESD acceptance | No numerical acceptance limit supplied |
| ATRMS / Station Controller | Product-specific controlled settings | Flux, nozzle, recipe, pressure, weight and material requirements | No live records supplied |
| RFC / XTREAMS RFC | Applicable recovery flow | Product disposition, escalation and recovery inspection | Exact flow and applicability absent |
| Site ECP / JHA / NPO assessment | Energy-control, task hazards and minor-servicing conditions | Safety and role restrictions | Exact site-controlled documents absent |
| AutoCE / 5M+E | Referenced change/recipe verification systems | Conversion and recipe-change checks | No records supplied |

C2 reports the internal location “ATM Tool Recovery → Shared Documents → ingest document → CD → 75-4706.pdf.” C3 describes the manual as Intel Confidential and marked “Do Not Reproduce.” Those are source assertions, not evidence of retrieval in this consolidation. C2 suggests the tool owner, MTE/GSC or Nordson support for the OEM manual and mentions the Nordson eManuals portal; no OEM manual was provided.

Repeated agreement among C2–C4 does not count as independent confirmation: they largely claim the same underlying PM specification.

## 2. Scope, configuration and equipment model

*Sources: C2:R1 §§1–2; C2:R2 §§1–4; C3:R5 §§1, 5.*

### 2.1 Process context

The conversations describe the Intel TCB/TSX S-932 configuration as a **non-contact atomized spray-flux system** that covers the substrate solder-bump area before thermal-compression bonding. The reported TCB link sequence is:

JLP destack/unloader → S-932 flux spray → input shuttle/FIS → TCB bonder(s) → output shuttle → JLP stacker.

The reported valve is the **DJ2200**, with a pressurized **Bulk Feed System (BFS)** containing a flux bottle, approximately 1 L in the described configuration. Product-specific 22- or 24-gauge nozzles and a coaxial-air air cap are mentioned. The internal needle meters liquid; the nozzle does not contact the substrate. This description should not be generalized to contact dispensing, piezoelectric jetting or every S-932 installation.

The PM summaries cover CAM, TCB and SLAM and also contain **syringe-specific** tasks. The production summary emphasizes BFS. Preserve these as different configuration branches rather than assuming every task applies to every tool. S1/S2 labels appear in camera and sensor procedures; their local meaning needs the original figures and configuration definitions.

### 2.2 Main assemblies

| Assembly | Reported function |
|---|---|
| Motion platform, conveyor and controller | Carrier transfer and programmed dispensing movement |
| DJ2200 valve and needle/seat | Start, stop and meter liquid flow |
| BFS bottle, pickup tube and lid | Hold material and provide pressurized delivery |
| Fluid tubing and quick disconnects (QDs) | Connect the supply to the valve |
| Nozzle | Product-specific fluid outlet |
| Air cap | Surround the nozzle with coaxial atomizing air |
| Fluid regulator | Control liquid-delivery pressure |
| Valve regulator and solenoid | Actuate the needle |
| Coaxial-air regulator and solenoid | Supply atomizing air |
| Needle/lower-body heater and controller | Maintain process temperature |
| Camera, lighting, beam splitter and vision processing | Recognize fiducials and establish offsets |
| Laser-height sensor (LHS) | Support nozzle-to-substrate height determination |
| Inline weigh station | Measure deposited flux mass |
| Purge cup, venturi and refuse bottle | Collect purge material and waste |
| Carrier and fluid-level sensors | Indicate material/carrier conditions |
| Tool PC and Fluidmove/FmXP | Recipes, motion, setup, calibration and logging |
| Interlocks and emergency machine-off (EMO) system | Control permitted motion and emergency stopping |

### 2.3 Material and pneumatic paths

**Liquid:** flux bottle → pickup tube → BFS lid/upper fitting/QD → flux tubing → valve fluid QD → DJ2200 chamber → needle/seat → nozzle → atomized plume → substrate bump area.

Three pneumatic functions must remain distinguishable:

1. BFS/fluid pressure for liquid delivery.
2. Valve-actuation pressure, switched through a solenoid.
3. Coaxial air delivered to the air cap for atomization.

The C2 “valve ON” explanation describes solenoid energization, needle lift, chamber filling, pressure-driven nozzle flow, timed coaxial air and coordinated X/Y spray passes. Its “OFF” explanation describes needle reseating and flow termination, with air timing affecting line-end droplets. This is a qualitative mechanism description; no timing waveform, CAD model or validated dynamic model is supplied.

### 2.4 Relationships useful for diagnosis

*Sources: C2:R2 §5; C2:R3; C2:R7 §§1–2, 7, 9.*

- C2 describes deposited weight as approximately increasing with fluid pressure. This is a qualitative, configuration-dependent relationship, not a calibrated simulation equation.
- Mass can pass while atomization, placement or coverage fails. Blobs, satellites, end droplets, staggering and shifted patterns require visual evidence.
- Increasing calibration pressure can compensate temporarily for restriction, viscosity change, a supply problem, leakage or regulator behaviour. It does not uniquely identify a blockage.
- A normal electronic-pressure record does not establish normal instantaneous airflow or valve timing.
- The notes report bad patterns without an effective machine alarm. “No alarm” is not equivalent to acceptable product.

## 3. Production setup, idle state and material control

*Sources: C2:R2 §§7–10, 20; C2:R7 §§3, 5–6; C3:R5 §§6, 18–19.*

### 3.1 Setup information to retain

The described setup sequence checks the lot, product, approved recipe and flux part number against Station Controller/ATRMS; verifies material dedication; checks the BFS, tubing, clamps, waste level and leaks; cleans applicable nozzle/air-cap and scale areas; completes Prompted Setup and flux-weight calibration; and obtains pattern/overspray acceptance before release.

The summaries also call for Continuous conveyor mode rather than pass-through, and temperature stabilization after material, valve or recipe-temperature changes. The reported times and settings are collected in Section 11 and are not universal recipes.

Material dedication covers the valve, BFS lid, flux tubing, tubing QD and nozzle set. C4 states matching colours are required for the assigned flux but **does not provide the authoritative flux-to-colour mapping**. Material Tracker, labels, RFID and ATRMS are candidate verification sources. Mixing residual flux types is described as a possible cause of contamination, crystallization or viscosity change.

### 3.2 Prompted Setup

Reported triggers include product setup/conversion; the periodic interval; nozzle or flux replacement; valve/nozzle/air-cap removal or adjustment; maintenance; computer shutdown/reset; camera adjustment; and uncertain tool condition.

Reported script functions include service positioning, calibration-area and scale cleaning, upper/lower valve checks, opening the lookup-camera cover, nozzle inspection, needle-to-camera XY offset, height-sensor XY offset, needle Z offset, purge-position teaching, dispense-to-camera XY offset, scale-position teaching, Auto Flux Weight Calibration and data collection.

C2 reports escalation after two failed calibration attempts. The applicable product RFC and site authorization must define the executable recovery branch.

### 3.3 Startup, short breaks and shutdown

C3 describes cold startup through facility connection/air checks, EMO release, the front-panel power control, PC boot and FMXP/Fluidmove launch. During short breaks, C2/C3 describe leaving the tool powered, with the nozzle/air cap/tubing installed and Idle Purge maintained. C2 attributes post-idle restriction-like defects to missed purging or dried material.

For extended shutdown, the summaries describe completing the current lot, approved valve/nozzle cleaning, orderly application/Windows exit and tool shutdown, followed by qualified restart/setup when required. C3 uses both FMXP/Fluidmove and FMNT/FM names; the installed software/version must resolve the actual interface.

The emergency-stop discussion is separate from maintenance isolation; see Section 12.

## 4. Inspection, cleaning and material-path maintenance

### 4.1 Nozzle and air-cap inspection

*Sources: C2:R1 §§5–8; C2:R2 §§9–12; C2:R7 §8.*

The notes associate incorrect air-cap orientation, off-centre installation, wrong nozzle gauge, bent nozzles, unsuitable tightening and damaged hoses with asymmetric spray, droplets, poor atomization, shift or collision.

The summarized method uses the approved service script, specified air-cap jig, gauge-specific tools and calibrated torque wrench. The nozzle and nozzle nut are treated separately from the air cap and plastic hose. The source permits specified IPA cleaning of metallic nozzle parts and wiping the air cap; it prohibits immersing the air-cap/hose assembly in IPA. Correct wire selection, gentle cleaning, inspection, reassembly, prescribed purging and setup/buy-off are emphasized.

Reported cleaning occasions include material replacement, relevant lot setup, the periodic/shift interval, abnormal coverage, component removal and suspected dried flux or foreign material. The purge cup is checked at the start of the shift.

| Finding | Candidate disposition described in C2 |
|---|---|
| Removable nozzle obstruction | Approved gauge-specific cleaning |
| Bent, chipped, cracked, enlarged or persistently restricted nozzle | Replacement |
| Internal valve obstruction/damage | Qualified valve exchange and valve-station PM |
| Tubing/QD restriction | Controlled replacement of affected parts |
| Contaminated or expired material | Controlled material replacement |

If obstruction is not established, the reported investigation proceeds through air-cap installation, coaxial air, fluid pressure/regulator behaviour, BFS delivery, valve actuation, material condition/idle history and recipe/offset/height checks. This is a candidate investigation sequence, not a universal authorized task list.

### 4.2 BFS tubing, fittings and leak testing

*Sources: C2:R6 §7; C4 §§2(A11), 3.*

The summarized inspection covers tank-holder security, three lid knobs, lid O-ring, cover penetrations, pickup tubing, routing, warning/empty sensors, bottle detection, the upper-fitting QD and pressure connection.

C4 reports new-ferrule use, controlled nut tightening and a retention/tug check, tubing kept within the metal guide length, and pressure disconnection before opening the BFS. It describes a leak test using an empty/non-flux bottle and DI water at the joint, with bubbles requiring replacement, followed by drying and securing the fitting. It also reports checking LOW FLUX WARN and LOW FLUX EMPTY I/O against the no-bottle condition.

**Unresolved boundary:** C2/C3 prohibit internal QD cleaning with IPA or DI water; C4 mentions spraying or submerging a joint in DI water for leak testing. The exact fixture, exposure boundary and procedure must be recovered from the original source. Do not combine these into an unrestricted instruction to immerse a QD.

Part numbers and dimensions are preserved in Sections 11 and 14. Sensor logic must be verified on the exact installation.

### 4.3 Purge and waste system

*Sources: C2:R6 §8; C3:R5 §§8, 16; C4 §2(A26).*

The PM summaries cover flux removal from the cup/lid, O-ring inspection, wiring and refuse-tube inspection, refuse-bottle lid/float/full-sensor cleaning, yellow fitting-seal inspection, venturi/hose/clamp cleaning, correct orientation and vacuum verification through service I/O. Damaged wiring or sharp sheet metal threatening wiring is a replacement/escalation condition.

C3 describes the cup lid's chamfered/raised edge as oriented left; C4 reports venturi red-dot setting #2 and a closed locking ring. These orientation references require the original figures. C4 additionally associates “BFS chamber and exhaust-bottom-box cleaning” with syringe configurations; that wording remains unresolved.

## 5. Defect and hypothesis catalogue

*Sources: C2:R2 §§14–17; C2:R3; C2:R7.*

The following IDs are editorial identifiers for retrieval. “Evidence” means observations to look for, not proof that a cause exists. No calibrated cause probabilities or actual incident data were supplied.

| ID | Observed symptom | Candidate causes in the conversations | Evidence that may help distinguish them |
|---|---|---|---|
| D01 | No flux | Empty BFS, disconnected line, complete restriction, stuck/broken needle, valve solenoid/control board | Purge output, measured mass, material level and delivery/actuation evidence |
| D02 | Progressively low flux | Partial restriction, drying/high viscosity, missing Idle Purge, BFS leak/pickup problem, regulator drift | Weight and requested-pressure trend; idle/material/maintenance history |
| D03 | Intermittently missing flux | Bubble, loose QD, marginal needle, solenoid timing, pickup issue | Random missing regions, intermittent purge, connections and timing |
| D04 | Low but uniform coverage | Low fluid pressure, E/P regulator fault, BFS pressure leak | Whole-pattern effect; measured versus commanded pressure |
| D05 | Local void or dry bump area | Restriction, omitted recipe path, bubble | Repeatable versus random position; image and programmed path |
| D06 | Shifted pattern | Camera/nozzle offset, fiducial teaching, bent nozzle, wrong recipe | Mass may pass; consistent spatial shift; recent camera/collision history |
| D07 | Staggered pattern | Motion/recipe timing, loose nozzle/air cap, mechanical instability | Alternating line displacement and motion/setup history |
| D08 | Blobs, satellites or end droplets | Coaxial solenoid/air deficiency, air-cap installation, closing delay/leakage | Mass may pass; poor atomization or droplets near pass ends |
| D09 | Dripping while idle | Needle/seat leakage, valve damage, accumulated flux at air-cap bottom | Material appearing after commanded closure; residual buildup |
| D10 | Excessive flux | High pressure, regulator error, valve not closing, wrong recipe | High mass and heavy coverage versus pattern-only defect |
| D11 | Calibration failure | Dirty/incorrect scale, restriction, unstable pressure, leakage, wrong material | Scale verification, calibration attempts, pressure and purge evidence |
| D12 | Electronic-pressure message | E/P regulator, pneumatic leak, control/board delay | Stabilization events, physical measurement and connections |
| D13 | Pattern change after camera work | Offsets/setup not repeated, focus/teaching issue | Camera intervention followed by shift despite fiducial recognition |
| D14 | Pattern change after PM | Wrong nozzle/valve, air-cap installation, pressure setting, incomplete setup | First abnormal result relative to PM and component replacements |
| D15 | Entire tray without flux | Reload/load-sensor sequence | Tray-transfer events and Enter/Load Sensor sequence |
| D16 | Low-fluid alarm despite material present | Stuck float, tubing interfering with sensor | Physical level versus I/O and tube routing |
| D17 | BFS leakage | O-ring, QD, ferrule or tubing connection | External findings and approved leak-test result |
| D18 | Air-cap collision / SOOP | Warped tray, unsafe Z condition, manual movement | Collision evidence, bent parts and immediate pattern change |

### 5.1 Common diagnostic separations

- **Low mass with rising pressure demand:** restriction, viscosity or delivery problems remain competing causes.
- **Low mass with low/unstable actual pressure:** investigate supply, leakage and regulation.
- **Normal mass with poor coverage:** investigate atomization, alignment or recipe geometry.
- **Fixed spatial defect:** investigate offsets, nozzle geometry, Z height and programmed path.
- **Random defect location:** investigate intermittent delivery, bubbles, connections and actuation.
- **Worst immediately after downtime:** investigate Idle Purge, dried material and stabilization.
- **Starts immediately after an intervention:** compare replaced parts, settings and qualification evidence.

### 5.2 Other candidate failure mechanisms

C2 additionally mentions broken needle shaft/sleeve, black foreign material sticking the needle, damaged O-rings, unsecured micrometer, low main air affecting lift/mechanical stability, wrong material, missing material dedication, software/control delay and incorrect fiducials. These are reported mechanisms without attached investigation records; the file supplies no basis for ranking them by frequency.

### 5.3 Downstream defects and false image calls

*Source: C2:R7 §§4, 10.*

A downstream non-wet defect may also involve bond-head heater degradation, pedestal damage, die/substrate contamination, CTV/BTV variation, bond force/temperature or bond-head tilt. The notes recommend comparing flux evidence with TCB KPPs and failure-analysis/3D X-ray location commonality. Acronym definitions and limits were not supplied.

A low-coverage FIS call may represent a real flux issue or an imaging/handling effect involving tray movement, vibration, lighting or shuttle preload-cylinder behaviour. Physical inspection is proposed as distinguishing evidence. Do not automatically equate an image alarm with a confirmed S-932 root cause.

## 6. Reported production recovery cases

*Source: C1:R3 §8.2.2; related context in C2.*

These are condensed accounts of what C1 claims the operation specification says. They are not executable SOPs. Product disposition, permissions, machine state and missing branches require the original recovery flow.

| ID / quoted section | Event | Reported recovery logic | Gap or condition to retain |
|---|---|---|---|
| AST01 / 8.2.2.1 | Machine-malfunction process stop | Inspect the tray's flux state; partially sprayed units are rejected under the applicable loss code; no-flux tray uses the reload procedure; shutdown requires normal setup | Fully sprayed and uncertain-coverage branches are not stated |
| AST02 / 8.2.2.2 | Carrier jam | Sprayed carrier is described as jogged out; unsprayed carrier uses reload; half-sprayed units are rejected; check warpage; escalate sensor/rail/belt checks to MTE | “Sprayed” overlaps “half-sprayed”; exact decision boundaries and safe recovery state are missing |
| AST03 / 8.2.2.3 | Low-level-fluid stop | Visual confirmation; Set Up → Set Up Scripts → Syringe Change; confirm alarm clears in Run Production | Syringe-labelled menu versus BFS configuration must be resolved |
| AST04 / 8.2.2.4 | No-flux tray reload | Describes jogging to Enter Sensor and avoiding Load Sensor triggering; mentions manual handling if jog fails | Manual handling requires an approved machine state; sensor sequence must be verified |
| AST05 / 8.2.2.5 | “Z-axis integral limit reached” | Title/screenshot reported | No recovery steps extracted; do not infer them from generic Z-head repair notes |
| AST06 / 8.2.2.6 | “No fluid was dispensed during the mass flow calibration procedure. Check the valve and scale” | Describes homing, nozzle/air-cap inspection, damaged-nozzle replacement, reassembly and prompted setup, with ES/MTE escalation for air tube / FM / valve | Abbreviation FM is unresolved; scale PM content elsewhere does not authenticate this alarm's exact recovery sequence |

## 7. Qualification and return to production

*Sources: C2:R1 §9; C2:R2 §§13, 22; C2:R4; C2:R6 §14; C3:R5 §14; C4 §2(A29–A33).*

### 7.1 Evidence groups

| Group | Reported evidence to retain |
|---|---|
| Equipment restoration | Required guards/covers, correct connections, no remaining tools/materials, controlled energy-restoration sequence |
| Configuration | Correct flux, valve, nozzle and recipe; dedication and tracking updated; modified recipes reviewed through the applicable change system |
| Equipment checks | Applicable pressure, scale, interlock, EMO, sensor, door-strut and leak checks passed |
| Setup | Prompted Setup completed; Auto Flux Weight Calibration passed; offsets and valve mounting/function checked |
| Pattern | Centred, symmetrical, complete coverage; no dry bumps, voids, blobs, line-end droplets, staggering or shift |
| Overspray | Within the product-defined red KOZ/overspray boundary |
| Documentation | PM/replaced parts/corrective action and buy-off evidence retained; appropriate Workstream/SC status |

Mass and visual pattern are separate acceptance dimensions. The sources do not provide universal product mass, pressure, coverage-area or image thresholds.

### 7.2 Inspection populations are distinct

- C3/C4 describe **two dummy/buy-off carriers** in the PM return-to-production flow.
- C2 describes the **first production carrier/tray**, one per lane, with **all units** inspected.
- C2 describes **at least five subsequent trays** for particular recovery/RFC events, including specified air-cap/SOOP circumstances.

These populations must not be merged into one universal sampling plan. The source and event applicability are part of each requirement.

C4 labels A29 “Return to production” before later checklist items A30–A33. **Editorial:** Preserve the checklist numbering, but do not interpret A29 as permission to release the tool before remaining applicable checks are complete.

### 7.3 Escalation conditions reported in C2

Repeated calibration failure; persistent abnormal pattern after cleaning/setup; unstable pressure; continued valve leakage/dripping; bent/chipped/cracked nozzle; collision; wrong flux/nozzle/valve; missing traceability; or work beyond the person's certification. Numerical retry rules and role permissions require source verification.

## 8. Preventive-maintenance programme

*Sources: C2:R6 §§4–13; C3:R5 §§7–12; C4 §2.*

### 8.1 Frequencies and reported standard duration

| Cycle | Reported duration | Scope distinction |
|---|---:|---|
| Biweekly extended setup | 1.5 hours | Cleaning, inspection, valve exchange and qualification |
| Monthly / PM3 | 2 hours | 28-item summary in C3 |
| Quarterly / PM4 | 3 hours | Monthly-level work plus backup, ESD and deeper checks |
| Semiannual / PM5 | 4 hours | 31 tasks reported; more replacements and calibration |
| Annual / PM6 | 7 hours | A1–A33 detailed in C4 |

These are reported planning durations, not guaranteed repair times. C4 separately states a **324-hour initial DJ2200 PM interval**. Its relationship to calendar-based PM is not resolved in the conversations.

### 8.2 Biweekly extended setup

C3 describes logging the tool into PM; cleaning the service station, tactile sensor, scale, purge cup, push blocks and interior; inspecting/cleaning the heated purge system; cleaning carrier sensors and replacing damaged ones; cleaning the camera filter; exchanging the installed valve for a qualified valve; completing return-to-production qualification; applicable CAM/SLAM scale validation; syringe low-fluid checks where relevant; and Workstream closure.

C2 adds accessible conveyor residue, nozzle/air-cap condition, QDs/tubing, BFS installation and valve/material tracking to its more general biweekly description. The two summaries should not be treated as an authenticated complete checklist.

### 8.3 Monthly PM3 — 28 summarized items

*Source: C3:R5 §9.*

| Item | Reported task |
|---:|---|
| 1 | Record PM start |
| 2 | Clean service station |
| 3 | Clean X/Y encoder strips and X-axis drive pulley |
| 4 | Maintain heated purge system |
| 5 | Clean conveyor belts and service-station area |
| 6 | Inspect/clean syringe cap, where applicable |
| 7 | Inspect belt condition |
| 8 | Inspect pulley condition |
| 9 | Clean and verify carrier sensors |
| 10 | Inspect pressure QDs and tubing |
| 11 | Inspect valve-bracket assembly |
| 12 | Replace air-cap tube |
| 13 | Verify service-station level |
| 14 | Clean camera filter and exchange valve for a qualified valve |
| 15 | Check belt tension |
| 16 | Inspect BFS assembly |
| 17 | Check moving-assembly bolts and screws |
| 18 | Check lookup-camera focus |
| 19 | Clean LHS and perform repeatability test |
| 20 | Clean camera beam splitter |
| 21 | Verify coaxial, valve and fluid pressures |
| 22 | Test interlocks |
| 23 | Verify service-password configuration |
| 24 | Complete applicable return-to-production work |
| 25 | Inspect front-door strut |
| 26 | Validate inline scale where applicable |
| 27 | Test syringe low-fluid sensor where applicable |
| 28 | Clean exterior and close the tool's PM state |

Additional C3 details include cleanroom-approved encoder materials, vacuuming pulley residue, checking air lines for wear/pinching and damaged clamps, inspection of Z-head/camera/valve/conveyor fasteners, removable Loctite where specified, and possible recipe/vision reteaching if camera Z-axis fasteners were loose.

### 8.4 Quarterly PM4

The summaries describe monthly-level work plus hard-drive backup and installation of the imaged backup drive; more extensive encoder/pulley cleaning; detailed air-tube, QD, valve-bracket and BFS inspection; conveyor ESD testing; belt-force measurement; service-station levelling; pressure verification; LHS testing; beam-splitter cleaning and vision calibration; service-access and interlock checks; strut assessment; applicable scale/low-fluid verification; and final closure.

ESD acceptance is referred to **20-0354**. Historical copied limits are not retained as current criteria. C2 additionally lists a BFS leak test in its quarterly overview; the exact condition requiring it needs the controlled checklist.

### 8.5 Semiannual PM5

C3 reports 31 tasks but does not reproduce a fully numbered 31-item list. Its unique additions include drive imaging, pressure-QD replacement, worn tubing/clamp replacement, air-cap tubing replacement, syringe-cap seal inspection, inspection of four conveyor rails with five pulleys per rail, BFS bottle/line/sensor inspection, rail alignment, clamping-block height, ESD testing, scale calibration, belt tension, LHS repeatability, vision recalibration, pressure verification, EMO/interlock tests, service access, strut checks, scale/low-fluid validation and closeout.

Reported pressure targets and replacement-part IDs appear in Sections 11 and 14. QD internal cleaning with IPA or water is prohibited in these summaries because of possible O-ring damage or jamming.

### 8.6 Annual PM6 — reported A1–A33

*Source: C4 §2, with C3:R5 §12 context.*

This table preserves C4's item identities for later reconciliation. It is a topic checklist, not a substitute for diagrams, methods, role requirements or release authorization.

| ID | Reported task and distinctive detail |
|---|---|
| A1 | Log tool into PM using 75-0600 |
| A2 | Back up/image the hard drive using the site method |
| A3 | Clean encoder strips/pulleys; inspect X/Y/Z encoder lights and cables; source describes steady green as normal and intermittent red/cable wear as a replacement trigger under LOTO |
| A4 | Replace valve/coax/fluid QDs; inspect relevant pressure conditions while conveyor lifters are cycled; no IPA/DI-water QD cleaning |
| A5 | Inspect/adjust Z-head counterbalance after valve removal using the referenced §4.3.2; replace spring if acceptable tension cannot be obtained |
| A6 | Inspect valve-bracket connectors, screws, bolts, wiring, tubing, oxidation and flux corrosion |
| A7 | Replace air-cap tubing to the specified finished length |
| A8 | Replace syringe-cap retainer gasket, where applicable |
| A9 | Clean service-station components, belts and pulleys; inspect five pulleys on each of four rails |
| A10 | Inspect Z-head/camera/valve/conveyor fasteners; specified removable Loctite; reteach affected programs after loose camera Z-axis fastener |
| A11 | Inspect BFS holder, O-ring and cover penetrations; QD leak test when tubing is replaced |
| A12 | Clean/lubricate X/Y cables and linear-motion guides using specified grease/PPE |
| A13 | Reinstall imaged drive, label with tool ID/date and verify startup |
| A14 | Verify rail alignment using referenced §4.3.6 |
| A15 | Verify clamping-block height using referenced §4.3.12 |
| A16 | Clean/test carrier sensors S1/S2; reteach present/absent states if unstable or blinking |
| A17 | Measure conveyor-belt point-to-ground resistance against current 20-0354 |
| A18 | Verify service-station level/focus; source mentions three mounting screws for adjustment |
| A19 | Level/calibrate scale using the reported calibration weight/setting |
| A20 | Clean camera filter/look-up lens and exchange valve through the valve-PM flow |
| A21 | Check all conveyor belts with the stated force-gauge method |
| A22 | Clean LHS protective cover and run repeatability test |
| A23 | Clean removed camera beam splitter with a clean cloth and DI water, reinstall and recalibrate vision as summarized |
| A24 | Check/adjust lookup-camera focus above reticle glass |
| A25 | Verify coaxial, valve and fluid pressures; electronic-offset comparison wording differs from C3 |
| A26 | Clean purge cup/O-ring/refuse bottle/venturi/hoses/fittings; verify orientation/settings; configuration wording needs checking |
| A27 | Test hood/BFS interlocks and perform EMO health check; source includes a servo-power-removal verification |
| A28 | Verify blank-password entry cannot obtain Service access; correct through site-authorized administration |
| A29 | Reported RTP setup work: controlled restoration, parameter/valve/recipe checks and dummy/buy-off carriers |
| A30 | Check door strut; inability to sustain the specified position prevents release |
| A31 | CAM/SLAM inline-scale validation at the four stated test masses, twice each; confirmed repeat failure leads to recalibration/escalation |
| A32 | Syringe low-fluid test using full/new and previously empty syringes; source describes rotation in both directions and stable enabled/disabled indications |
| A33 | Wipe exterior and complete Workstream production return |

C4 says Rev. 110 added A33 while some extracted tables stop at A32. No revision-history pages are attached, so neither that history nor checklist completeness is independently verified.

## 9. Repair and calibration topic index

*Sources: C3:R4; C2:R6 §4; C3:R5 §13.*

| Topic | Content reported by the summaries | Validation needs |
|---|---|---|
| Z-head/motor | Removal/reinstallation involving valve bulkhead, camera, clamp, LHS connection, encoder head and covers; LHS cable freedom, encoder indication and RTP checks | Exact assembly procedure and isolation; not a recovery for AST05 by inference |
| Z counterbalance | Lower-spring tension adjustment and an interlocked drop criterion | Original force/drop method and configuration |
| Camera focus/calibration | Carrier fiducial/live-video focus, S1/S2 height references, brightness/camera/production vision recalibration | Camera designation, datum and height-jig procedure |
| Sonic cleaning | DI-water coverage, temperature, cleaning/degas times, compressed-air drying and repeat if residue remains | Eligible parts and exact equipment sequence |
| Conveyor alignment | Lane pitch, rail width, parallelism and rail-height criteria | Fixture, datum, product configuration and safe adjustment method |
| Pressure verification | Calibrated Accu-Meter comparison for coaxial/valve/fluid pressure and electronic offsets | Actual-versus-set/display wording; precise test points |
| Scale calibration | Initialization, zeroing and centred calibration standard; protect from air currents | Correct scale model and calibration mode |
| LHS repeatability | Repeated readings and standard-deviation criterion | Measurement setup and export format |
| LHS failed test | Source lists sensor power/plug, main-board resistor, SW1 DIP switch 6, dirty lens, PC/I/O communication, loose/worn cables and sensor condition | Trained-maintenance diagnostics; no inferred resistor/switch setting |
| Clamping block | Raised/lowered-height criteria and secure carrier holding | Reference surfaces and tooling |
| Protective-cover clearance | LHS-cover-to-Z-carriage gap | Original geometry/figure |
| Scale dispense-position teaching | Test position; reteach three fiducials if incorrect; confidence criterion | Original script and vision confidence meaning |
| EMO health check | Retaining tabs, location keys, plunger and wire housing; terminal-colour mapping reported | Correct switch/variant and electrical procedure |
| Heated purge cup | Isolation/cooling, wiring/fuse/ground/hose checks, mounting position and reteaching | Exact replacement assembly and position datum |
| S1 camera-cover/valve gap | Clearance to valve lower-body heater | S1 configuration definition |
| Software/heater files | FmXP upgrades, heater-file verification and conversion management appear in the topic lists | Actual versions and controlled change procedure absent |
| Low-fluid sensor | Installation and full/empty checks | BFS versus syringe and active-state definitions |

The conversations explicitly refer process-specific flux-coverage, pattern-shift and weight failures to operation specifications and applicable RFCs. A PM repair topic alone does not establish the appropriate production recovery.

## 10. Valve tracking, material identification and RFID

*Sources: C2:R6 §13; C3:R5 §15; C4 §§4–5.*

### 10.1 Reported MT and valve-technician workflows

| Role/stage | Reported record transition or action |
|---|---|
| MT: fault identification | Open MITTS with a detailed problem statement; retain its number |
| MT: valve removal | Equipment UI → Wait Tech; Material/Metra UI from OnTool to OutofTool/In Repair; place valve on the repair rack |
| MT: replacement selection | Select ready valve, verify UTP, change replacement to OnTool before installation and confirm timer reset |
| Valve technician: begin work | Start biweekly valve-PM checklist; verify Wait Tech → In Repair |
| Valve technician: repair record | Inspect/replace label; repair valve; close MITTS with findings, micrometer information and parts replaced |
| Valve technician: release | Mark UTP in Equipment UI; reported Metra sequence In Repair → OutofTool → PM → OutofTool; place on ready rack |

C4 prohibits MT creation of new valves in Metra UI and MT micrometer adjustment. Local role definitions must be verified. Equipment UI, Material/Metra UI, MIDS and Material Tracker names are not proven to be interchangeable systems or identical status schemas.

C4 lists MIDS statuses OnTool, OutofTool, In Repair and PM, and the initial 324-hour DJ2200 interval. The exact UTP definition and timer basis are not expanded in the provided text.

### 10.2 Labels and dedication

The summaries specify black barcode and text, replacing dirty/worn/damaged labels, and matching the valve/tubing-QD/BFS-lid colour for the assigned flux. They report Arial 25.1 font and 18 or 12 mm tape. Available tape colours include white, orange, green, yellow, red, blue, fluorescent green, pastel purple and pastel pink with black printing. These are available colours, **not a flux-to-colour mapping**.

### 10.3 Bundle8 and RFID

C4 supplies Bundle8-related component identifiers and a P-clip-to-valve tubing-length range; these are retained in Sections 11 and 14 without inferring component functions from identifiers alone.

The RFID summary covers bottle unique ID/UI, Intel part number, SLI and expiration information, with reader/interlock/electrical hardware at the BFS. For enabled sites, the source describes bottle seating/tag/reader checks and Station Controller retry after failed reads, with no manual bypass of validation. These descriptions do not establish a working connector/API or the installed tool's RFID capability.

## 11. Reported numerical values and acceptance criteria

**All values in this section are unverified conversation claims.** Store the applicable configuration, procedure and original-source locator alongside any value before using it as an operational threshold. “Reported” does not mean “approved.”

### 11.1 Facility, process and service values

| Parameter | Reported value | Context / source |
|---|---|---|
| Electrical supply | 208 V, three-phase, 35 A **or** 220 V, three-phase, 30 A | Alternatives, not combined requirements; C3:R5 §4 |
| Main oil-free air | 100 ±10 psi | C2:R2 §6; C3:R5 §4 |
| PM regulator nominal setting | 100 psi | C3:R5 §11; C4 A4; distinguish nominal from facility range |
| Tooling pressure | 40 ±3 psi | Applicable PM/lifter check; C3:R5 §11; C4 A4 |
| Lifter cycles during cited PM check | Three per lifter | C4 A4 |
| Exhaust | 100 ±10 CFM; also expressed as 100 CFM ±10% | C3:R5 §§2, 4 |
| Exhaust collar | 6-inch GEX connection | C3:R5 §2 |
| BFS capacity | Approximately 1 L | Described TCB configuration; C2:R2 §2 |
| Nozzle gauge | Commonly 22 or 24 | Product-specific; C2:R1 §1 |
| Fluid-pressure range | 10–60 psi | General reported range, not a universal recipe; C2:R2 §6 |
| DJ2200 micrometer | Setting 40 | Units/reference scale absent; maintenance-only correction in C2 |
| Nozzle-nut torque wrench | 19 lb-in | Exact procedure/configuration must be checked; C2:R2 §6 |
| Air-cap tube | 14.6 ±0.6 cm; C4 also gives 5¾ ±¼ inch | Reported rounded equivalents; C2:R2 §6; C4 A7 |
| Idle Purge | Approximately 3 seconds every 480 seconds | C2:R2 §§6, 20 |
| Temperature stabilization | Approximately 15 minutes | Certain material/valve/temperature changes; C2:R2 §7 |
| Prompted Setup periodicity | At least every 12 hours | Plus event triggers; C2:R2 §8 |
| Cleaning periodicity | Every 12 hours/start of shift, plus event triggers | C2:R2 §10; do not equate every site's shift with 12 hours |
| Wire for reported 24-gauge nozzle | 0.011 inch tungsten wire | Other gauges need their own specified wire; C2:R2 §11 |
| Post-reassembly purge count | Five where directed | C2:R1 §9; C2:R2 §11 |
| Calibration retry escalation | Two failed attempts | C2:R1 §9; C2:R2 §8 |
| Heated purge system | 50–70 °C | C3:R5 §8 |
| Purge-cup replacement cooling time | Approximately 30 minutes | C3:R4 item 14 |
| Refuse-bottle level at setup | Below half full | C2:R2 §7 |
| BFS tubing size | 1/8 × 1/4 inch | C4 §3; diameter ordering not explicitly defined |
| BFS nut tightening | Finger-tight, then ¼ turn; one further ¼ turn if the retention check fails, then escalation if still loose | C4 §3; procedure context incomplete |
| P-clip-to-valve tubing | 105–110 cm | Bundle8-related configuration; C4 §5 |
| BFS no-bottle I/O | LOW FLUX WARN and LOW FLUX EMPTY reported as 0 | C4 §3; verify exact active-state semantics |
| Initial DJ2200 PM interval | 324 hours | C4 §4; calendar/timer basis unresolved |

### 11.2 Calibration, mechanics and inspection

| Parameter | Reported value | Context / source |
|---|---|---|
| Scale **calibration** standard | 50 g | C3:R4 item 8; C3:R5 §13; C4 A19 |
| Scale **validation** standards | 20, 50, 100 and 500 mg | CAM/SLAM where applicable; C3:R5 §13; C4 A31 |
| Scale validation repetitions/tolerance | Each twice: eight readings; within ±5% of each standard | Distinct from calibration; C3:R5 §13 |
| LHS test population | 100 readings | C3:R4 item 9 |
| LHS repeatability | Standard deviation <0.0080 mm | Test setup not supplied; C3:R4 item 9 |
| Belt-force reading | 2.5 ±0.5 “kg” | Source uses kg with a force gauge; do not silently convert to kgf or N |
| Belt-force method detail | Extech force gauge, five-inch extension rod; record when belt contacts lower metal surface | C3:R5 §13; original geometry needed |
| Electronic pressure discrepancy | More than ±0.3 psi | C3 says displayed versus actual; C4 A25 says displayed versus set pressure |
| Z-head drop | Not more than 25.4 mm with interlock active | C3:R4 item 2; exact test method absent |
| Camera S1 height | 2.0 ±0.1 inches | C3:R4 item 3; datum/configuration unresolved |
| Camera S2 height | 1.0 ±0.1 inches | C3:R4 item 3 |
| Sonic-cleaner temperature | 40 °C | C3:R4 item 4 |
| Sonic-cleaner times | Run 5 minutes; degas 5 minutes | C3 wording; exact sequence and eligible parts need checking |
| Conveyor lane pitch | 203.8 mm | C3:R4 item 5 |
| Rail width used in cited procedure | 138 ±0.1 mm | Not a universal product width; C3:R4 item 5 |
| Parallelism variation | Maximum 0.1 mm | C3:R4 item 5 |
| Side-to-side rail-height difference | Reported as maximum ±0.1 mm | C3:R4 item 6; preserve original tolerance wording |
| Raised clamping-block edge | Level with rail within ±0.1 mm | C3:R4 item 10 |
| Lowered clamping-block edge | At least 0.5 mm below belt | C3:R4 item 10 |
| LHS-cover/Z-carriage gap | Minimum 0.2 mm | C3:R4 item 11 |
| S1 camera-cover/lower-body-heater gap | Minimum 0.2 mm | C3:R4 item 15; separate clearance from preceding row |
| Scale-position teaching | Three fiducials; confidence >97% | Vision threshold, not diagnostic confidence; C3:R4 item 12 |
| Replacement purge-cup position | 146 mm from conveyor-rail end | C3:R4 item 14; datum must be verified |
| Door-strut check | Hold or lift at approximately 45°; falling at 45° or from fully open prevents release | C3:R5 §13; C4 A30 |
| Carrier qualification | Two dummy/buy-off carriers | PM context; C3:R5 §14; C4 A29 |
| First-production inspection | One tray/carrier per lane, all units | C2:R1 §9 |
| Additional recovery inspection | At least five subsequent trays where required | Specific RFC/event context; C2:R1 §9 |
| LHS laser | Class 2, <1 mW, 670 nm | C4 §1; verify installed sensor |
| Reported EMO stopping time | Approximately two seconds | C3:R5 §2; not a validated safety performance rating |
| IPA concentration references | 6% and 99–100% | C3:R5 §2 PPE descriptions; not interchangeable cleaning recipes |
| Chemical-glove time boundary | Under/over 30 minutes in source | Exact 30-minute boundary and chemical compatibility unresolved |
| Label specification | Arial 25.1; black text/barcode; 18 or 12 mm tape | C4 §4 |

Grounding is required in the facility summary, and the supply plug is site-specific. No universal product pressure target, flux-mass window, pot-life limit, spray speed, pass count, heater target, KOZ dimensions or ESD resistance limit is supplied.

## 12. Safety, roles and task authorization

*Sources: C2:R1 §§5–7; C2:R2 §§12, 18–19; C3:R5 §§2–3; C4 §§1, 6.*

This section records safety-related claims for source review. It does not establish a site energy-control procedure, an energized-work permission or personal qualification. The original ECP/JHA, certification matrix and task-specific procedure must determine the allowed action.

### 12.1 Reported roles

| Role/context | Activities described in the notes |
|---|---|
| Certified operator/MT, where locally authorized | Review alarms/material status, inspect patterns, inspect external connections, run approved setup/calibration scripts, perform approved nozzle/air-cap cleaning or flux change, inspect setup carriers |
| L2/MTE/trained maintenance | Internal valve work/exchange as assigned, micrometer correction, pressure hardware/solenoid/QD work, restricted BFS tubing tasks, leak testing, pressure calibration, camera/beam-splitter adjustment, panel/electrical/LOTO work |
| Qualified valve technician | Detailed DJ2200 valve PM, repair records, tracking transitions and release to the ready rack |
| Engineering / appropriate site owner | Resolve recipe/configuration changes, ambiguous disposition, persistent failures, missing evidence and tasks outside authorization |

The notes require appropriate Level-2 PM qualification and training in cleanroom protocol, Hazcom, basic/electrical safety, hazardous-energy control, multimeter use and Spray Flux Level-1 certification. Personnel are to prepare tools/materials, arrange downtime, notify operations and remove production material before PM.

### 12.2 Energy and interlock claims

| Topic | Reported content | Boundary to preserve |
|---|---|---|
| EMO | Front/rear controls stop operation, normal tool power indications, motion and laser output | EMO is explicitly not zero-energy isolation |
| Hood and BFS-rack interlocks | Remove servo power for dispense-head/conveyor motion; recovery requires closure and interlock clearance | Not a substitute for all hazardous-energy isolation |
| Electrical isolation | C4 describes facility-plug/clamshell isolation, attempted starts and a three-point voltage check for exposed circuitry | Requires site ECP and qualified electrical work |
| Pneumatic/vacuum isolation | C4 describes facility/chase isolation, rear-regulator closure, bleeding and gauge verification at 0 psi | Test points, trapped volumes and verification method need original procedure |
| Mechanical and stored Z energy | C4 describes checks involving free movement and counterbalance return | Not an instruction for an operator to manually move a head; force/spring test needs controlled method |
| Laser and thermal sources | LHS laser; needle/LBH heaters, purge cup and heated waste line | Electrical removal alone does not establish cool surfaces; task-specific verification required |

The summarized LOTO task list includes solenoids, vacuum generators, regulators/QDs, E-pan boards, conveyor/heater modules, stop pins/lifters, motors/wiring, LHS/dispense head, sensors/drivers, power distribution and tool computer/laptop. C3 gives a generic notify–isolate–lock/tag–release stored energy–verify–work sequence; it omits the site diagrams and detailed energy-control points.

C4's plug inspection concerns burning, melting, arcing, discoloration, deformation and full seating with no visible gap. Damaged equipment is escalated rather than reconnected. Site Visual LOTO remains configuration-specific.

### 12.3 Minor servicing, laser and confined-space context

The sources describe limited energized minor servicing only when covered by the approved NPO assessment, performed by qualified personnel with functioning interlocks and approved scripts/tools. C4 mentions nozzle assembly/disassembly, tray recovery, pattern troubleshooting, certain process stops and scale validation as assessed topics. It states the exception must be routine, repetitive, integral and limited, must have documented alternative protection/EHS approval, and cannot cover electrical hazardous energy.

C4 says no laser-eyewear optical density is specified for normal maintenance in its summary; open-beam servicing requires site LSO review. This is not a blanket statement that eyewear is unnecessary for every task.

C4 reports the S-932 confined-space section as **N/A**. A generic reclassification form in an appendix does not authorize entry or create a site-specific classification.

### 12.4 PPE, chemical and housekeeping context

| Task/material | PPE described in the sources |
|---|---|
| Product/RTI handling, disassembly and grease work | Cleanroom nitrile gloves; safety glasses for grease work |
| 6% IPA | Safety glasses and cleanroom nitrile gloves |
| 99–100% IPA or flux for shorter tasks | Safety glasses and double nitrile gloves under the reported time boundary |
| Longer chemical tasks | MAPA chemical-resistant gloves; exact model and chemical compatibility not supplied |
| Nozzle wire work | Cut-resistant/Kevlar protection for puncture risk |
| Heated purge/heater work | Heat-resistant gloves |
| Head inside/under tool | Bump cap as applicable |
| Electrical work | PPE governed by the site/arc-flash requirements |

C3 lists IPA, MOLY-GRAPH grease, Multemp PS2 grease, PLF42, SE-CURE 9752/Kester 160B, Senju SPK350i, SPK400i, SPK6388i, SPK432i, SPK18HRi, SPK6352i and Kester TSF6852. The noted hazards include flammability, skin/eye irritation, serious eye damage, inhalation/ingestion harm, pulmonary irritation and environmental toxicity. The sources are not substitutes for material-specific SDS and approved PPE selection.

Emergency preparation includes knowing the site emergency contact, exits, assembly area, eyewash/shower, fire extinguishers and lone-worker station where applicable. C4 mentions securing the belt to one pulley during replacement, floor ergonomic pads for bottle changes and low-fluid-sensor cable management. Chemical waste goes to the site-designated stream. Unsafe unattended equipment needs site-controlled barricading/signage, and trolley aisles must remain clear.

### 12.5 Prohibitions reported across the sources

- No defeated interlocks or bypassed RFID/material validation.
- No opening a pressurized BFS.
- No unapproved powered maintenance or bypass of required isolation.
- No drilling/reaming/enlarging nozzles, forcing wire or using unknown-size steel pins.
- No IPA flushing of the DJ2200 valve or immersion of the air-cap/plastic hose in IPA.
- No internal IPA/DI-water cleaning of QDs; preserve the leak-test ambiguity in Section 4.2.
- No reuse of BFS nylon ferrules.
- No unauthorized micrometer adjustment to compensate for mass problems.
- No unapproved compressed-air obstruction clearing/backflushing.
- No uncontrolled cycling with production material introduced; C2 calls for abort/containment under the applicable procedure.
- No cleaning and respraying incorrectly fluxed production strips or reprocessing partial spray without authorized disposition.
- No release based only on a mass pass or continuation beyond applicable repeated-failure escalation rules.

## 13. Evidence, data fields and software functions

*Sources: C2:R1 §10; C2:R2 §21; C2:R4 §§1–5; C2:R7 §11; C3:R5 §§13, 17, 19; C4 §§4–5.*

### 13.1 Candidate data dictionary

These are labels and concepts reported by the conversations, not a verified export schema. Availability, sampling rate, clock alignment, permissions and machine/software applicability must be established from actual files or interfaces. “Actual pressure” may be a separate instrument reading rather than a logged sensor channel.

| Data group | Candidate fields/labels | Reported unit or type |
|---|---|---|
| Time | Timestamp, setup time, start time, cycle time | Date/time; duration; milliseconds mentioned as possible resolution |
| Event | Event/Message, alarm text, popup and operator selection | Text/event |
| Identity | Tool/Entity ID, dispenser, lot, product | Identifier |
| Recipe | Program/Recipe name, revision where available, script loaded/completed | Text/event |
| Setup | Prompted Setup loaded/completed; relevant offset/calibration events | Status/event |
| Mass | Flux Weight / Weight | mg |
| Pressure | Fluid Pressure, Coaxial Air Pressure, Valve Pressure, setpoint and actual reading | psi; channel provenance required |
| Calibration | Auto Flux Weight Calibration result and attempt | Pass/fail/count |
| Scale verification | “Read Scale” entries in dated FmXP log | Standard/test result; distinguish from production mass |
| Valve | VALVE_ID, installed/replaced valve, maintenance state | Identifier/status |
| Material | FLUX PART #, vendor/material, flux lot | Text/identifier |
| Material age | Thaw date/time, Remaining Pot Life | Date/time/duration |
| Tracking | OnTool, OutofTool, In Repair, PM and system-specific transitions | Status/event |
| Digital I/O | Low Flux Warn Level, Low Flux Empty Level, Flux Bottle Detect, Refuse Bottle Full | 0/1; active-state interpretation unverified |
| Production | Run count, tray/lane/row/pocket context where available | Count/identifier |
| Images | Flux/FIS/RTI, setup/buy-off and last-good/first-bad images | Image plus timestamp and production identity |
| Maintenance | PM type/date, replaced parts, adjustment/repair record, checklist and buy-off result | Record/event, potentially in separate systems |
| RFID | Bottle unique ID/UI, part number, SLI, expiration | Tag-derived data on enabled installations |

The exact messages “Waiting for Electronic Pressure Regulators…” and “No fluid was dispensed during the mass flow calibration procedure. Check the valve and scale” appear in the conversations. Preserve the original exported wording when a real log is available.

### 13.2 Observability limits

C2 says production logs usually do not contain actual droplet diameter, instantaneous nozzle flow, nozzle differential pressure, needle travel, solenoid response time/current or reliable continuous/high-frequency main-air history. No example export is attached to confirm that list for this tool.

**Editorial implication:** A reconstructed timeline may establish recorded events without uniquely establishing a hidden component failure. For later AI/3D use, keep recorded observations, hypotheses and simulated behaviour distinct. The four conversations supply neither CAD geometry nor a validated physical model.

### 13.3 Reported software capabilities

C3 lists, for applicable FMXP versions: dry/pass-through warnings; logged popups and operator selections; heater-file correction during initialization; flux-weight upload to Station Controller; flux-pattern image capture; flux-monitor data capture; and interlock-adapter support. These are capability claims, not confirmation that every function is enabled or externally accessible.

Workstream/CEPT Lite is described as recording downtime, availability, repairs, checklist completion and return to production. Valve tracking may involve additional systems. Do not assume the control-link PC already exposes all records through one interface.

## 14. Parts, tools and component identifiers

*Sources: C3:R5 §§3, 9, 11; C4 §§2–5.*

All identifiers below are copied from the conversation summaries. OEM equivalence, current replacement status and compatibility are unverified. Do not infer an ordering authorization or fit from a matching number alone.

| Reported item | Identifier or description | Source |
|---|---|---|
| Valve pressure QD | 500050535 | C3 §11; C4 A4 |
| Coaxial QD | 500117541 | C3 §11; C4 A4 |
| Fluid QD | 500118740 | C3 §11; C4 A4 |
| Carrier sensor | 500122822 | C3 §9; C4 A16 |
| Sensor amplifier | 500120126 | C3 §9; C4 A16 |
| Conveyor belt | 500110416 | C3 §9; C4 A9 |
| Pulley | 500113406 | C3 §11; C4 A9 |
| Syringe-cap seal/retainer gasket | 433033009 | C3 §11; C4 A8 |
| Beam splitter/filter | 500050530 | C4 A20; precise part naming needs verification |
| BFS tubing | 500809717 | C4 §§3, 5 |
| New BFS ferrule | 500175684 | C4 §3 |
| Double-ear clamp | 500120034 | C4 §3 |
| Open-end P-clip | 500833314 | C4 §5 |
| Bundle8-associated item | 7213500 | C4 §5; exact function not stated |
| Bundle8-associated item | SS-QC4-B-400 | C4 §5 |
| Bundle8-associated item | SS-QC4-D-400NR | C4 §5 |
| Bundle8-associated item | SS-4TA-1-5ST | C4 §5 |
| Bundle8-associated item | SS-QC4-B-4PM | C4 §5 |
| Approved-grease references reported by C3 | 433029254; 500297117; 500099644; 500353155 | C3:R5 §3; application mapping absent |

The tool list includes standard wrenches/hex keys, grease gun/adapter, feeler gauges, a Fluke 1000-V CAT III multimeter or equivalent, DJ2200 valve-maintenance kit, calibrated pressure meter/Accu-Meter, Extech digital force gauge, calibration weights, specified air-cap jig/torque wrench and cleanroom-compatible tools. Materials include wipes, swabs, gloves, IPA, DI water and the application-specific approved grease.

C3:R4 item 13 gives an EMO terminal-colour mapping: **22 → green; 12 → red; 11 → black; 21 → white**. This is retained solely for reconciliation against the exact switch, wiring diagram and controlled electrical procedure; it is not a general S-932 wiring instruction.

## 15. Root-cause analysis and discriminating tests

*Sources: C2:R3; C2:R4; C2:R7 §§11–13.*

### 15.1 Evidence-based incident sequence

1. **Contain and preserve:** identify last-good and first-bad unit/tray, affected material, images, logs, setup carriers and removed parts before changes erase evidence.
2. **Define the problem:** exact defect, tool/lane/row/pocket, time/shift/lot, product/recipe/valve/material, quantity affected, detection method and impact.
3. **Build the timeline:** last good; PM/conversion/part or material change; setup/calibration; first abnormal image; first alarm/SPC change; detection; attempted corrections.
4. **Characterize the pattern:** continuous/intermittent, progressive/sudden, fixed/random position, lane/tool/valve/product commonality, mass-related/pattern-only and dependence on idle/setup/production.
5. **Separate facts from assumptions:** measurements, images and confirmed records are facts; an unobserved blockage or delayed solenoid remains a hypothesis.
6. **Map functions and competing causes:** liquid delivery, valve action, atomization, motion, vision, height, recipe, material and measurement system.
7. **Select a discriminating check:** record supporting and conflicting evidence, expected results and task prerequisites.
8. **Evaluate the result:** retain uncertainty when a test is inconclusive; avoid attributing recovery to one part after multiple simultaneous changes.
9. **Verify recovery and release:** use the applicable acceptance evidence in Section 7.
10. **Document occurrence, escape and systemic causes:** retain the evidence chain and corrective-action effectiveness.

C2 calls its problem-definition prompts “5W2H,” but lists What, Where, When, Which, How many, How detected and Impact. This consolidation preserves the actual prompts rather than claiming the list is a verbatim standard definition.

### 15.2 Hypothesis record

| Field | Content |
|---|---|
| Hypothesis | Specific component/function and proposed mechanism |
| Supporting evidence | Actual observations with timestamps/source records |
| Conflicting evidence | Findings that weaken the explanation |
| Missing evidence | Required observation that has not been collected |
| Proposed check/test | Approved method, prerequisites and responsible role |
| Expected outcomes | How each outcome changes the competing hypotheses |
| Result | Observation and test conditions, including inconclusive outcomes |
| Status | Proposed, supported, contradicted or confirmed through the applicable review |

The “missing evidence,” “expected outcomes” and explicit status fields are **editorial organization** of the source's hypothesis table. They do not add a machine procedure.

### 15.3 Comparisons described in the conversations

The sources propose good/bad comparisons involving nozzle, valve, machine, solenoid, material and recipe. Examples include a known-good nozzle on a suspect valve, a qualified valve on the suspect machine, fresh versus suspect material, actual pressure versus a calibrated meter, and current versus verified recipe/offset conditions.

These are experiment ideas, not blanket authorization to transfer suspect parts onto production equipment. A usable test definition needs the applicable approved method, material dedication, controlled test conditions, measured response and stopping criteria. The source's suggestion to reintroduce a fault is conditional on safety; reproducing a harmful failure is not a mandatory completion requirement.

The conversations prioritize physical findings, temporal/commonality evidence, known mechanisms, non-destructive checks and one-variable comparisons. A small comparison is not automatically a formal design of experiments; factors, levels, repetitions and responses would need an explicit design.

### 15.4 Occurrence, escape and systemic causes

| Layer | Source example |
|---|---|
| Occurrence | Insufficient coaxial air produces poor atomization |
| Escape | Mass passes while line-end droplets are missed during inspection |
| Systemic | Qualification or post-PM checking does not adequately test the relevant behaviour |

C2's illustrative Five-Why chain goes from droplets to poor atomization, inadequate air during closure, abnormal solenoid response, a qualification gap and an inspection gap. It is an example, not a confirmed incident in the supplied evidence.

The source's corrective-action preference order is design/hardware elimination, interlock, automatic detection, parameter alarm, preventive replacement, procedure/checklist, then training alone. Its conclusion template links the defect to a cause, corrective action and verification; do not claim reproduction or permanent prevention unless the evidence actually establishes it.

## 16. Workstation, records and conversion management

*Source: C3:R5 §§16–19; C2:R6 §14.*

### 16.1 Housekeeping and passdown

Reported storage locations are toolboxes for tools, cabinets/technician shop for parts and solvent cabinets for chemicals. Waste uses the appropriate site stream; rejected units found during PM go to the responsible UI representative; unsafe unattended equipment is controlled; aisles remain clear.

| Frequency | Reported cleaning content |
|---|---|
| Shift/setup | C3 describes valve DI-water rinsing and air purging, plus flux-residue removal |
| Daily | Purge container, dampers, station bottom, ceramic tile, interior residue and purge tubing |
| Weekly | Purge station, emptied/rinsed waste reservoir and conveyor flux residue |

The shift/setup valve-rinse wording lacks the detailed approved method and must be reconciled with the part-specific cleaning restrictions in Section 4. IPA used on a ceramic tile or conveyor is not authorization to flush a valve or immerse an air-cap hose.

Passdown content includes safety status, quality concerns, equipment status, repairs completed/outstanding, parts consumed and parts to order, submitted before shift end.

### 16.2 Ordering and status records

C3 describes parts ordering through WILNGS/Factory Portal by Intel part number, stock confirmation, quantity selection and cleanroom pass-through collection. Workstream/CEPT Lite records tool-down, availability, repair completion, checklist closure and production return; details are referred to 75-0600.

### 16.3 Conversion

The conversion summary covers tool-down, applicable conversion checklist, recipe/program-name verification, heater-file management for flux changes, calibration/setup and return-to-production work. C3 says the generic conversion tables are limited and product/module requirements are controlled by operation specifications and 5M+E. No universal conversion recipe can be reconstructed from these chats.

## 17. Separate ASM TCB bonder cases

*Source: C1:R3 §8.2.3.*

These cases concern the **ASM TCB bonder and linked handling equipment**, not the S-932 dispenser. They are retained because they were present in one of the four source conversations. Retrieval and recommendations must keep the equipment identities distinct.

| ID / quoted section | Topic | Reported content | Remaining qualification |
|---|---|---|---|
| TCB01 / 8.2.3.1 | Software crash/hang | Escalation to MTE/Engineering; restart may be required; if input/output shuttle hang causes the bonder hang, the source says restart shuttle first and wait for recovery | Exact state and restart procedure absent |
| TCB02 / 8.2.3.2 | Units moved around Bond Window | Source describes BS Inert Parking to Safe Parking Zone; conditional continuation for remaining units; rejection of remaining unbonded units if moved completely outside the Bond Window or if inert doors open while units are under the window/in safe parking; units not yet under window described as unaffected | Precise spatial/state definitions and disposition authority needed; safe parking versus outside-window wording cannot be flattened into one rule |
| TCB03 / 8.2.3.3 | Die on hot bond head | Source says a die exposed when source changes to compressed air during troubleshooting must be blown off before AutoBond resumes | Requires exact bonder procedure; not a dispenser cleaning instruction |
| TCB04 / 8.2.3.4 | Coplanarity Learn | Listed after bond-head motion error, cleaning, manual manipulation, pedestal placed on bond stage or unknown tool status | Exact learn method and authorized role absent |

C1 additionally states an **ATD-only** exception: normal error-free nozzle changes during production are not considered tool stoppage. The meaning and applicability of ATD must be checked in the original operation specification.

## 18. Unresolved differences and verification priorities

This register prevents a later reader or AI system from silently converting conversation text into established machine facts.

| ID | Issue | Treatment in this consolidation | Evidence needed |
|---|---|---|---|
| U01 | Claimed originals and revisions | All machine claims remain secondary/unverified | Controlled originals and applicable revisions |
| U02 | BFS versus syringe | Separate configuration branches; no invented menu equivalence | Exact tool configuration and UI/script documentation |
| U03 | CAM/TCB/SLAM/TSX and S1/S2 scope | Preserve source labels; avoid universal applicability | Module/product/site definitions and figures |
| U04 | Scale 50 g versus milligram weights | Separate calibration from validation | Scale procedure, model and configuration |
| U05 | Pressure “actual” versus “set” | Preserve inconsistent wording; no automated offset rule | Original pressure-verification method and instrument points |
| U06 | Belt force expressed in kg | Retain quoted unit; no silent conversion | Gauge display and original dimensional definition |
| U07 | QD water prohibition versus leak-test immersion | Internal cleaning and leak-test boundaries unresolved | Original fixture/steps and allowed water exposure |
| U08 | General valve rinsing versus part-specific cleaning | Do not infer solvent/air use for unlisted components | Approved cleaning procedure and eligible parts |
| U09 | “Sprayed” versus “half-sprayed” jam branch | Preserve ambiguity; no automatic disposition | Original RFC and complete decision diagram |
| U10 | Missing process-stop branches | No invented fully sprayed/uncertain-coverage action | Complete recovery procedure |
| U11 | Z-axis integral-limit alarm | No extracted recovery | Original alarm page and machine state requirements |
| U12 | Two buy-off carriers versus first tray/five trays | Distinct event-specific inspection populations | Applicable PM and recovery sampling rules |
| U13 | A29 RTP before A30–A33 | Numbering retained; final release not inferred early | Original checklist, completion and release gates |
| U14 | Annual A32/A33 revision-history claim | C4 claim retained without verification | Revision history and complete annual checklist |
| U15 | NPO exception versus LOTO | No generic energized-work permission | Site task assessment, ECP/JHA and certification |
| U16 | Confined-space generic appendix | Reported tool section N/A; no permission inferred | Site assessment if relevant |
| U17 | Chemical PPE and 30-minute boundary | Source wording retained, not generalized | SDS, glove model/compatibility and site procedure |
| U18 | Flux colour mapping | Colours listed, mapping absent | Current material-dedication matrix/ATRMS |
| U19 | 324-hour valve interval versus calendar PM | Both retained without equating schedules | Valve timer basis, policy and equipment-state semantics |
| U20 | Tracking-system names/statuses | Separate labels and transitions retained | Actual system schemas and identifiers |
| U21 | Numeric thresholds and part compatibility | Reported values only | Exact source page, hardware/software configuration and calibration records |
| U22 | Log availability and “actual pressure” | Candidate dictionary, not confirmed interface | Real exports, instrumentation and timestamp definitions |
| U23 | “Post-maintenance is highest risk” in C2 | Association retained; quantitative ranking not adopted | Incident population, denominator and reviewed failure data |
| U24 | “Known historical failures” | Hypothesis examples, not authenticated cases | Original investigations and outcomes |
| U25 | Material pressure/weight relationship | Qualitative claim; no universal linear physics model | Measured response curves and operating conditions |
| U26 | Complete BKM inventory | Not claimed; C2 ends without completing its search | Controlled BKM list and accessible documents |
| U27 | FM, SOOP, CTV/BTV, KPP, UTP and site acronyms | Retain labels without inventing expansions | Site glossary and source context |
| U28 | FmXP/FMXP/Fluidmove versus FMNT/FM | Preserve software-name variation | Installed software and revision |
| U29 | C4 syringe-specific “BFS chamber” cleaning | Wording flagged rather than reconciled | Original configuration-specific checklist/figure |

### 18.1 Minimum evidence to approve a knowledge-base instruction

**Editorial development structure:** Attach the original document ID/revision/section or page; applicable tool/site/product/software; symptom and prerequisites; permitted role and machine state; approved action; expected measurement and acceptance criteria; stop/escalation conditions; material disposition; and reviewer/approval status.

Conversation-only records should remain distinguishable from reviewed operating instructions. A new successful troubleshooting outcome is evidence for review, not automatic authority to publish a new procedure.

## 19. Source coverage and consolidation notes

| Source region | Consolidated location |
|---|---|
| C1:R2 and R3 S-932 recovery | Section 6; repeated R2 summary deduplicated against R3 |
| C1:R3 ASM TCB cases | Section 17 |
| C2:R1 hardware, safety, diagnostics and data | Sections 2, 4–5, 7, 11–13 |
| C2:R2 operating guide | Sections 2–7, 11–13 |
| C2:R3 overlapping defect causes | Section 5 and Section 15 |
| C2:R4 RCA | Section 15, with evidence/timeline fields in Section 13 |
| C2:R5 manual-location guidance | Section 1.2 |
| C2:R6 PM | Sections 8–12 and 16 |
| C2:R7 practical lessons | Sections 3–5, 7, 13 and 15; unsupported “highest risk” ranking flagged in U23 |
| C2:R8–R9 refusals/promises and unanswered questions | Nontechnical dialogue omitted; incomplete BKM inventory recorded |
| C3:R2–R3 manual metadata | Section 1.2; refusal dialogue omitted |
| C3:R4 repair topics | Sections 9, 11 and 14 |
| C3:R5 non-troubleshooting content | Sections 2–4 and 7–16 |
| C4 §1 safety | Sections 11–12 |
| C4 §2 annual PM A1–A33 | Section 8.6; values/parts in Sections 11 and 14 |
| C4 §3 BFS | Section 4.2; values/parts in Sections 11 and 14 |
| C4 §4 valve tracking/labels | Section 10 |
| C4 §5 Bundle8/RFID | Sections 10–11 and 14 |
| C4 §6 appendices | Section 12.3 |

Organization changes are limited to grouping, deduplication, consistent identifiers, source attribution and explicit treatment of missing/conflicting information. No external technical source was added to this four-file merge, and no machine procedure was validated by the act of consolidation.
