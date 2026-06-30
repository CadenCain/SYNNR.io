import Link from "next/link";
import { redirect } from "next/navigation";
import { getSaasUser } from "@/lib/saas/auth";
import SignupForm from "./signup-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Start free · SYNNR" };

export default async function SignupPage() {
  if (await getSaasUser()) redirect("/app");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Start free</h1>
        <p className="mt-1 text-sm text-zinc-400">14 days, no charge. Add a yard and load your list in minutes.</p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[#e7ddc7] hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
