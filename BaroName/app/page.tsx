import { cookies } from "next/headers";
import { LoginScreen } from "@/components/login-screen";
import { Workspace } from "@/components/workspace";
import { isValidSession } from "@/lib/auth";

export default async function Home() {
  const cookieStore = await cookies();
  const session = cookieStore.get("baroname_session")?.value;
  const unlocked = isValidSession(session);

  return unlocked ? <Workspace /> : <LoginScreen />;
}
