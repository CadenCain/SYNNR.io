import Link from "next/link";
import { redirect } from "next/navigation";
import { getSaasUser } from "@/lib/saas/auth";
import SignupForm from "./signup-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Get started · RollReady" };

export default async function SignupPage() {
  if (await getSaasUser()) redirect("/app");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-ink-dim">$500 per yard a month, billed monthly. Add your card at the next step. Cancel anytime.</p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-ink-dim">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[#e7ddc7] hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
