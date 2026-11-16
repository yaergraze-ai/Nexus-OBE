import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";
import { authErrorMessage, parseInitialAuthMode } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  return (
    <LoginForm
      initialMode={parseInitialAuthMode(sp.mode)}
      initialError={authErrorMessage(sp.error)}
    />
  );
}
