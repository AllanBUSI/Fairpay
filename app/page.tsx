import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { LandingPage } from "@/components/landing/landing-page";

export default async function Home() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    
    if (token) {
      const user = verifyToken(token);
      if (user) {
        redirect("/dashboard");
        return null;
      }
    }
    
    return <LandingPage />;
  } catch (error) {
    console.error("Error in Home page:", error);
    return <LandingPage />;
  }
}
