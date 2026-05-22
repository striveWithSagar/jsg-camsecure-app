import { redirect } from "next/navigation";

// /login is superseded by /login/admin — redirect for backward compat
export default function LoginRedirect() {
  redirect("/login/admin");
}
