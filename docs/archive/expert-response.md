# NYRA Chat Conversation

## Question 1

1. What exact dispenser, valve/head, and material-delivery setup does production use? Is it non-contact jetting or needle dispensing?

2. What are the correct names and order of the components between the material reservoir and deposited dot?

3. Is a partial nozzle or cartridge restriction a realistic cause of progressively undersized dots? What symptoms normally accompany it?

4. What other two or three causes should be considered, and how would their visible or logged symptoms differ?

5. What is the safe inspection sequence? Include required machine state, isolation, PPE, and warnings.

6. Which inspection or maintenance actions may an operator perform, and which require trained maintenance personnel?

7. If an obstruction is found, is cleaning permitted or should the cartridge/nozzle be replaced? What actions must never be recommended?

8. If no obstruction is found, what should the technician check next?

9. After corrective action, what test and acceptance criteria demonstrate recovery?

10. Which machine-log fields are realistically available and diagnostically useful? Please include field names and units if possible.
 
here is some question on asymtek flux dispenser

## Response 1

Below applies to the **Intel TCB/TSX Asymtek S-932 configuration**. Product-specific nozzle, flux and limits must be verified in ATRMS/Station Controller.

1. **Production hardware and dispense method**

- **Dispenser:** Nordson ASYMTEK **S-932 Spray Flux** system.
- **Valve:** **DJ2200 flux valve**.
- **Material supply:** pressurized **Bulk Feed System (BFS)** containing a flux bottle, not normally a disposable cartridge.
- **Applicator:** product-specific 22- or 24-gauge nozzle surrounded by a coaxial-air **air cap**.
- **Method:** **non-contact atomized spraying**. It is neither jetting nor contact needle dispensing. The valve needle meters the flux, while coaxial air atomizes it into spray lines/passes.

2. **Correct component names and order**

Fluid path:

**Flux bottle/SLI → BFS pickup tube and lid → BFS upper fitting/QD → BFS flux tubing → valve fluid QD → DJ2200 fluid chamber → needle-and-seat → dispense nozzle → atomized spray plume → substrate bump area**

Separate pneumatic branches provide:

- BFS/fluid pressure
- Valve actuation pressure through the solenoid
- Coaxial atomizing air to the air cap

“Needle” refers to the internal valve needle; the deposited material does not require nozzle contact.

3. **Can restriction cause progressive undersize?**

Yes. A partial nozzle or upstream fluid-path restriction is realistic. In this application it appears as progressively lower **flux weight or spray coverage**, rather than simply smaller dots.

Typical signs:

- Flux weight trends downward.
- Auto-calibration compensates by requesting progressively higher fluid pressure.
- Eventually calibration reaches a limit or fails.
- Spray becomes narrow, weak, incomplete or intermittent.
- Dry/non-wet bump areas appear.
- Purge output may be weak, delayed or asymmetric.

A restriction is less likely if flux weight remains stable but the pattern develops blobs or end-of-line droplets; that points more strongly to atomization/coaxial-air trouble.

4. **Other likely causes and signatures**

| Cause | Typical signature |
|---|---|
| **Coaxial-air/air-cap/solenoid problem** | Coarse mist, blobs, satellites or droplets at line ends; weight may still pass because liquid quantity is present but poorly atomized. |
| **Fluid-pressure/E-P regulator, BFS leak or loose QD** | Low or unstable weight across the whole pattern; pressure fails to stabilize, rises to compensate, or generates an electronic-pressure message. |
| **Bent nozzle, camera/nozzle offset or recipe teaching error** | Pattern shifted or staggered while total weight and pressure remain normal. Often follows a collision, camera adjustment or incomplete prompted setup. |
| **Expired/cold material or missing idle purge** | Gradual instability following downtime; repeated purging or pressure adjustment; improvement after material stabilization/change. |

5. **Safe inspection sequence**

1. Stop processing and contain the affected lot. Reject/segregate partially sprayed units per the applicable RFC.
2. Do not perform tool/dry cycling with a production lot introduced; abort first if required.
3. Use the approved nozzle-cleaning or Prompted Setup script. Ensure motors are homed and the valve is moved to the specified service position.
4. For approved minor servicing, open the door only after the hardware interlock has stopped motion. Never defeat an interlock.
5. Wear:
   - Safety glasses
   - Double cleanroom nitrile gloves for flux/IPA work under 30 minutes
   - Chemical-resistant MAPA gloves for longer chemical work
   - Cut-resistant/Kevlar gloves for nozzle-wire cleaning
6. Inspect externally first: hoses, clamps, QDs, leaks, air-cap orientation, nozzle centering and pressure/log results.
7. Before opening the BFS, **disconnect its fluid-pressure quick disconnect** and confirm pressure is released.
8. Any solenoid, regulator, QD, valve-body, dispense-head or electrical servicing requires the applicable **LOTO**, including electrical and OFA isolation and verification of zero residual pressure.
9. After inspection, restore guards, remove tools, close doors and return the tool to Idle Purge.

**Warnings:** EMO is not zero-energy isolation. Do not open a pressurized BFS. The heated purge station may be 50–70°C.

6. **Operator versus maintenance actions**

**Certified operator/MT, where authorized:**

- Review alarms, pressure displays and material status.
- Inspect flux pattern and overspray.
- Verify hoses/QDs are seated and clamps are present.
- Run Prompted Setup and Auto Flux Weight Calibration.
- Perform the approved nozzle/air-cap cleaning procedure.
- Perform an approved flux change.
- Purge the valve as directed and inspect the setup carrier.

**L2/MTE/trained maintenance:**

- Replace or internally service the DJ2200 valve.
- Correct the micrometer setting.
- Replace/service solenoids, regulators, QDs or pressure hardware.
- Install/remove BFS tubing where locally restricted.
- Perform leak tests and electronic-pressure calibration.
- Clean/adjust the lookup camera or beam splitter.
- Perform any panel removal, electrical work or activity requiring LOTO.

The site certification matrix overrides this general division.

7. **Clean or replace an obstruction?**

- **Nozzle obstruction:** approved cleaning is permitted using the correct gauge-specific tungsten wire, IPA, lint-free wipes and specified tools.
- **Damaged, bent, chipped or still-restricted nozzle:** replace the nozzle/nozzle set.
- **Internal valve obstruction:** exchange the valve and send it to the valve PM station; do not field-disassemble it as an operator.
- **Tubing/QD obstruction or contaminated/expired material:** replace the affected tubing/QD/material per the controlled procedure.

Never recommend:

- Drilling, reaming or enlarging a nozzle.
- Using an incorrect wire or forcing the wire.
- Flushing the valve with IPA.
- Immersing the air cap/hose in IPA.
- Cleaning QDs internally with IPA or DI water.
- Adjusting the DJ2200 micrometer from its required setting of 40.
- Bypassing interlocks or defeating LOTO.
- Blowing an obstruction downstream with unapproved compressed air.

8. **If no obstruction is found**

Check, in this order:

1. Air-cap installation, centering, hose connection and orientation.
2. Coaxial-air pressure and coaxial solenoid function.
3. Fluid-pressure setpoint versus actual pressure and E-P regulator stability.
4. BFS pressure, QDs, clamps, tubing kinks, leaks and low-fluid status.
5. Valve actuation, needle condition and micrometer setting.
6. Flux part number, lot, pot life, temperature stabilization and Idle Purge history.
7. Nozzle-to-camera offsets, nozzle Z offset, recipe/fiducial teaching and physical nozzle straightness.

9. **Recovery test and acceptance**

- Reassemble using the torque wrench and air-cap jig.
- Purge five times where directed.
- Complete **Prompted Setup**.
- Pass **Auto Flux Weight Calibration**. Two failed attempts require escalation.
- Confirm flux weight and fluid pressure are within the product’s ATRMS/SPC limits.
- Inspect the first production carrier/tray—one per lane, all units:
  - Complete bump-area coverage
  - Centered and symmetrical
  - No dry bumps, voids, blobs, staggering or line-end droplets
  - Overspray contained within the defined red KOZ box
- Where the applicable recovery RFC requires it, inspect at least five subsequent trays before release.

10. **Useful available log/data fields**

Names vary by software revision, but these are realistically available:

| Field/data | Units/type |
|---|---|
| Timestamp | Date/time, often milliseconds |
| Event/Message | Text |
| Script or Program/Recipe name | Text |
| Prompted Setup loaded/completed | Event/status |
| Flux Weight / Weight | mg |
| Fluid Pressure | psi |
| Coaxial Air Pressure | psi |
| Valve Pressure | psi |
| Pressure setpoint and actual reading | psi |
| Auto Flux Weight Calibration result/attempt | Pass/fail/count |
| Tool/Entity ID, lot and product | Text |
| `VALVE_ID` | Identifier |
| `FLUX PART #`, material/vendor and flux lot | Text |
| Thaw date/time and Remaining Pot Life | Date/time or duration |
| Material Tracker status | OnTool/OutOfTool/PM |
| Low Flux Warn Level | Digital 0/1 |
| Low Flux Empty Level | Digital 0/1 |
| Flux Bottle Detect / Refuse Bottle Full | Digital 0/1 |
| Run count, start time and cycle time | Count/time |
| Alarm text, including pressure-stabilization or low-fluid alarms | Text/event |

Usually **not** available as production log fields: actual droplet diameter, instantaneous fluid flow through the nozzle, nozzle differential pressure, needle travel, solenoid response time/current, or a reliable continuous main-air trend. Consequently, a bad atomization pattern can sometimes pass weight calibration and produce no alarm.

**Primary internal references:** 121-1175 Rev. 196, 121-3018 Rev. 69 and 75-4706 Rev. 114.

---

## Critical review and implementation follow-up - 17 September 2026

The response above is preserved as supplied. It changes the modeled process from epoxy-dot/cartridge dispensing to the described S-932/DJ-2200 bulk-feed flux-spray configuration. [EXPERT_REVIEW.md](../EXPERT_REVIEW.md) records critical assessment, implementation mapping, public corroboration and outstanding controlled-document verification.

Corrections: measure coverage rather than dot diameter; compare five cause families; do not treat rising pressure as proof; limit clear-nozzle findings to the inspected scope; check air cap and supply before assuming viscosity; require both acceptable spray and complete recovery checks. Preserve old cases as read-only.

Status: expert feedback received; revised procedure approval pending. Internal references, product limits and reviewer identity/authorization were not independently supplied or verified. This entry records no expert sign-off or production approval.
