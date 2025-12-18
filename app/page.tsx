import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { LandingPage } from "@/components/landing/landing-page";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (token) {
    try {
      const user = verifyToken(token);
      if (user) {
        redirect("/dashboard");
      }
    } catch (error) {
      // Token invalid or verification failed, just show landing page
      // If the error is a redirect error, rethrow it
      if (error instanceof Error && error.message === "NEXT_REDIRECT") {
        throw error;
      }
      // If it's a digest (Next.js specific), it might be an object
      if (typeof error === 'object' && error !== null && 'digest' in error && (error as any).digest?.startsWith('NEXT_REDIRECT')) {
        throw error;
      }
    }
  }

  return <LandingPage />;
}
