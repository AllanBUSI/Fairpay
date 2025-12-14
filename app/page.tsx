import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  
  if (token) {
    const user = verifyToken(token);
    if (user) {
      redirect("/dashboard");
      return;
    }
  }
  
  redirect("/login");
}
