import { handle } from "@/lib/api";
import { cached } from "@/lib/cache";
import { getMRR } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => cached("mrr", 60_000, () => getMRR()));
}
