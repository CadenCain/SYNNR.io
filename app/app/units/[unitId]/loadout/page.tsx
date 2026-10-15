import { redirect } from "next/navigation";

/** The old gear list is now the truck's kit. */
export default async function OldGearList({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = await params;
  redirect(`/app/units/${unitId}/kit`);
}
