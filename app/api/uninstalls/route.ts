import { handle } from "@/lib/api";
import { cached } from "@/lib/cache";
import { getChurn } from "@/lib/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => cached("uninstalls", 60_000, () => getChurn()));
}
