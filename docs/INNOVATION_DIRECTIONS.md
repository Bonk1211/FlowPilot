# FlowPilot: Uncommon Innovation Directions

Date: 29 September 2026  
Status: Proposed directions for discussion; not implemented features or an approved scope change.

The central opportunity is to make FlowPilot **create the evidence needed to diagnose a fault**. These ideas extend beyond analyzing an uploaded photo. They are proposed applications, not claims that the underlying technologies have never been researched.

## 1. AI designs a diagnostic test pattern

**Assessment: Boldest direction.**

Different faults can produce similar-looking defects. FlowPilot could design a small pattern to dispense on a test carrier specifically to separate the competing explanations.

For example, it could compare approved patterns with different deposition orders. A defect that follows elapsed dispensing time provides different evidence from one that consistently appears at the same physical location.

**Technology:** Bayesian experimental design and a process model that predicts each hypothesis's possible outcomes. The AI selects a pattern where those predictions differ most.

**Demo moment:** The judge selects a hidden simulated fault. FlowPilot designs a test, receives the resulting image, and revises its diagnosis.

**Main dependency:** A credible simulator or controlled experimental data. Physical tests would come from an expert-approved operating envelope.

AI-guided physical experimentation is an established research direction. Applying it to dispensing troubleshooting is the proposed extension; the cited research does not validate this application.

Research: [Evolution-guided Bayesian optimization for constrained multi-objective optimization in self-driving labs](https://www.nature.com/articles/s41524-024-01274-x).

## 2. Reconstruct the failure timeline from the finished pattern

**Assessment: Strongest software-first direction.**

A finished coating contains spatial clues about a process that happened over time. Combine its defect map with the nozzle's path and timing to reconstruct **when the output probably started changing**.

FlowPilot could investigate whether anomalies cluster around starts, turns, particular positions, or later portions of the dispensing sequence.

**Technology:** Image registration, alignment between toolpath and image, change-point detection, and probabilistic inverse modeling: working backward from the observed result to plausible process histories.

**Demo moment:** Scrub a timeline over the finished image. The suspected onset of the fault lights up along the deposition path, with uncertainty shown.

**Main dependency:** Actual toolpath and timing data, or a clearly labeled simulator. Existing logs cannot be assumed to contain those fields. Overlapping passes can make reconstruction ambiguous.

**Niche problem statement:**

> Locate when a dispensing process began to fail using the evidence left on the product.

## 3. Detect a factory-wide defect outbreak

Several machines could develop similar defects because they share a material batch, recipe revision, or maintenance event. Investigating each machine separately can conceal that shared factor.

FlowPilot could connect cases across machines and identify which common exposures deserve investigation.

**Technology:** A temporal relationship graph, change-point detection, and comparisons with unaffected machines operating under similar conditions.

**Demo moment:** Three apparently unrelated investigations connect to one material batch. Adding an unaffected machine changes the strength of that hypothesis.

**Main dependency:** Reliable machine, batch, recipe, and timestamp records. A shared factor is evidence to investigate, not proof of causation.

This would give the existing knowledge graph a substantial diagnostic role. The current case-learning implementation does not establish this capability; see [Learning Database](DATABASE_LEARNING_PLAN.md).

## 4. Give the dispenser an acoustic stethoscope

Investigate whether sound or vibration reveals abnormal operation before the deposited pattern becomes visibly defective.

**Technology:** Acoustic embeddings or spectral features, normal-behavior anomaly detection, and alignment with dispensing cycles. Combine the signal with images and machine evidence.

**Demo moment:** Play two recordings that sound similar to a person; highlight the portions that differ from the machine's normal operating signature.

**Main dependency:** Representative recordings and suitable sensor placement. A phone microphone may not capture the useful signal; industrial background noise is a real challenge.

Research has demonstrated acoustic approaches to obstruction detection in other flow systems. Transfer to the flux dispenser would need testing.

Research: [A step towards the live identification of pipe obstructions with the use of passive acoustic emission and supervised machine learning](https://www.sciencedirect.com/science/article/pii/S1537511020300064).

## 5. Let AI choose how to illuminate the defect

Transparent coatings and reflective substrates can make an ordinary photograph inconclusive. FlowPilot could request or control another lighting direction or polarization setting to obtain a more informative image.

**Technology:** Computational imaging, multiple illumination conditions, and active selection of the next observation.

**Demo moment:** A sample appears acceptable under the first light. The system selects another lighting condition, revealing a previously obscured irregularity.

**Main dependency:** Real samples and a small controlled imaging setup. Start by establishing defect visibility before attempting thickness measurement. The current illustrative photos do not establish real flux visibility; see [Photo inspection](PHOTO_INSPECTION.md).

Structured-light inspection has been researched for transparent objects and reflective surfaces. Suitability for the particular coating remains an experiment.

Research: [A novel direct structured-light inspection technique for contaminant and defect detection](https://arxiv.org/abs/2006.12186).

## Recommended focus

Choose **direction 2 as the first implementation** and **direction 1 as the ambitious extension**. They fit together: reconstruct a plausible failure history, identify what remains ambiguous, then design a test to resolve it.

### Proposed problem statement

> Different dispensing faults leave similar defects, making troubleshooting slow and wasteful. FlowPilot reconstructs the likely failure sequence from the deposited pattern and machine path, then designs a targeted diagnostic test to distinguish the remaining explanations.

### Demonstration

Let the judge change the hidden fault and watch the investigation adapt:

1. Present a deposited pattern and its associated toolpath and timing.
2. Reconstruct plausible failure timelines and show uncertainty.
3. Identify competing explanations that the available evidence cannot distinguish.
4. Select a diagnostic test pattern and explain its expected value.
5. Incorporate the observed or explicitly simulated result and update the diagnosis.

### Evidence of value

Measure **how many tests and how much test material it takes to reach a supported diagnosis**, compared with a fixed troubleshooting sequence. Report unresolved or incorrect diagnoses alongside efficiency gains.

A simulator can demonstrate the algorithm's behavior. Industrial performance requires validation with real process data and authorized expert review. Existing procedure boundaries remain applicable; see [Expert review](EXPERT_REVIEW.md).
