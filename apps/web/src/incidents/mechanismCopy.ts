export type MechanismCopy = {
  title: string;
  mechanism: string;
  assumption: string;
  path: string;
};

/** Plain-language explanation of each candidate mechanism, shared by every view. */
export const mechanismCopy: Record<string, MechanismCopy> = {
  restriction: {
    title: "Fluid-path restriction",
    mechanism:
      "A restriction in the fluid path could reduce the quantity reaching the substrate while dispensing continues.",
    assumption:
      "The location and degree of restriction are hypothetical. This view does not establish an obstruction from an image or pressure trend.",
    path: "BFS bottle → pickup tube → feed tube → fluid QD → valve → nozzle",
  },
  unstable_delivery: {
    title: "Unstable fluid delivery",
    mechanism:
      "Changing reservoir delivery conditions could interrupt or vary fluid reaching the valve, producing inconsistent coverage.",
    assumption:
      "Reservoir pressure, valve-actuation air and coaxial atomization air are separate paths. No instantaneous airflow is measured by this view.",
    path: "BFS air → bottle headspace → pickup tube → feed tube → valve",
  },
  material_condition: {
    title: "Material-condition change",
    mechanism:
      "A change in material condition could alter delivery and deposited coverage even when the mechanical path has not changed.",
    assumption:
      "Material properties, age and environmental effects require supporting records or checks. No viscosity or material state is inferred as a measurement.",
    path: "Material in bottle → delivery path → deposited coverage",
  },
};
