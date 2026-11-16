import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";
import { authErrorMessage } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Atur Ulang Sandi" };

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return <LoginForm initialMode="recovery" initialError={authErrorMessage(sp.error)} />;
}
