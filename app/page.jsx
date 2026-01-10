import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function HomePage({ searchParams }) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
      continue;
    }

    if (value != null) query.append(key, value);
  }

  const queryString = query.toString();
  redirect(queryString ? `/dashboard?${queryString}` : "/dashboard");
}
