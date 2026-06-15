import "./yard.css";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getYardData } from "@/lib/data/workspace";
import YardClient from "./yard-client";

export const metadata = { title: "SYNNR — Digital Yard Twin" };

export default async function YardPage() {
  const supabase = await getServerSupabase();
  if (!supabase) redirect("/login");
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/yard");

  const data = await getYardData();
  return <YardClient data={data} />;
}
