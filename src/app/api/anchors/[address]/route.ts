import { errorResponse, toErrorCode } from "@/lib/api";
import { REGISTRY_ADDRESS } from "@/lib/arc/chain";
import { getAnchorsFor } from "@/lib/arc/registry";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isAddress, normalizeAddress } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Reports anchored on Arc for an address, read from ArcLensRegistry. */
export async function GET(req: Request, ctx: RouteContext<"/api/anchors/[address]">) {
  const { address } = await ctx.params;
  if (!isAddress(address)) return errorResponse("INVALID_ADDRESS");
  if (!REGISTRY_ADDRESS) return Response.json({ ok: true, data: { registry: null, total: 0, anchors: [] } });

  const rl = rateLimit(`anchors:${clientIp(req)}`, 60);
  if (!rl.ok) return errorResponse("RATE_LIMITED", rl.retryAfter);

  try {
    const data = await getAnchorsFor(normalizeAddress(address));
    return Response.json({ ok: true, data: { registry: REGISTRY_ADDRESS, ...data } }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return errorResponse(toErrorCode(err));
  }
}
