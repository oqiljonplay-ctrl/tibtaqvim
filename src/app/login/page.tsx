import { redirect } from "next/navigation";

export default function LoginRedirect({
  searchParams,
}: {
  searchParams: { returnUrl?: string };
}) {
  const q = searchParams.returnUrl
    ? `?returnUrl=${encodeURIComponent(searchParams.returnUrl)}`
    : "";
  redirect(`/${q}`);
}
