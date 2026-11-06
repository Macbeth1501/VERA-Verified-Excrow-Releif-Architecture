import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Sign in | VERA" };

/** Sign-in page (route group `(auth)`). Renders the shared `AuthForm` in login mode. */
export default function LoginPage() {
  return <AuthForm mode="login" />;
}
