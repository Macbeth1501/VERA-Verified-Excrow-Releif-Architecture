import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Create account | VERA" };

/** Account-creation page (route group `(auth)`). Renders the shared `AuthForm` in register mode. */
export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
