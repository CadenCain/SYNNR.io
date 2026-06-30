// Oilfield taxonomy (spec §2.5). Used to populate dropdowns so users pick
// instead of free-texting.

export const UNIT_TYPES: { value: string; label: string }[] = [
  { value: "truck", label: "Truck (DOT)" },
  { value: "shop", label: "Shop / yard building" },
  { value: "service_rig", label: "Service rig" },
  { value: "workover_rig", label: "Workover rig" },
  { value: "pump_truck", label: "Pump truck" },
  { value: "vacuum_truck", label: "Vacuum / transport truck" },
  { value: "hot_oil_truck", label: "Hot oil truck" },
  { value: "wireline_truck", label: "Wireline truck" },
  { value: "coil_tubing_unit", label: "Coil tubing unit" },
  { value: "cement_pump_unit", label: "Cement pump unit" },
  { value: "nitrogen_unit", label: "Nitrogen unit" },
  { value: "crane_truck", label: "Crane / boom truck" },
  { value: "trailer", label: "Trailer" },
  { value: "pickup", label: "Pickup / light vehicle" },
  { value: "other", label: "Other" },
];

export const ASSET_CATEGORIES: { value: string; label: string }[] = [
  { value: "pressure_control", label: "Pressure control" },
  { value: "lifting", label: "Lifting & rigging" },
  { value: "tool", label: "Tools & equipment" },
  { value: "safety", label: "Safety & detection" },
  { value: "vehicle", label: "Vehicle / DOT" },
  { value: "equipment", label: "Equipment" },
  { value: "other", label: "Other" },
];

export const COMPLIANCE_KINDS: { value: string; label: string }[] = [
  { value: "cert", label: "Cert" },
  { value: "inspection", label: "Inspection" },
  { value: "test", label: "Test (BOP, pressure, NDT…)" },
  { value: "dot_sticker", label: "DOT sticker" },
  { value: "registration", label: "Registration" },
  { value: "document", label: "Document" },
];

export function unitTypeLabel(v: string) {
  return UNIT_TYPES.find((t) => t.value === v)?.label ?? v;
}
export function categoryLabel(v: string) {
  return ASSET_CATEGORIES.find((t) => t.value === v)?.label ?? v;
}
export function kindLabel(v: string) {
  return COMPLIANCE_KINDS.find((t) => t.value === v)?.label ?? v;
}
