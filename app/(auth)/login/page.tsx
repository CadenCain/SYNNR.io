import Link from "next/link";
import { redirect } from "next/navigation";
import { getSaasUser } from "@/lib/saas/auth";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in · SYNNR" };

export default async function LoginPage() {
  if (await getSaasUser()) redirect("/app");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Log in</h1>
        <p className="mt-1 text-sm text-zinc-400">Welcome back. Pick up where your yard left off.</p>
      </div>
      <LoginForm />
      <p className="text-center text-sm text-zinc-400">
        New here?{" "}
        <Link href="/signup" className="font-medium text-[#e7ddc7] hover:underline">
          Start free
        </Link>
      </p>
    </div>
  );
}
