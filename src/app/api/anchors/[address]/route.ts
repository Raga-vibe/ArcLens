import { errorResponse, toErrorCode } from "@/lib/api";
import { REGISTRY_ADDRESS } from "@/lib/arc/chain";
import { getAnchorsFor, isRegistryDeployed } from "@/lib/arc/registry";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isAddress, normalizeAddress } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** Reports anchored on Arc for an address, read from ArcLensRegistry. */
export async function GET(req: Request, ctx: RouteContext<"/api/anchors/[address]">) {
  const { address } = await ctx.params;
  if (!isAddress(address)) return errorResponse("INVALID_ADDRESS");

  const rl = rateLimit(`anchors:${clientIp(req)}`, 60);
  if (!rl.ok) return errorResponse("RATE_LIMITED", rl.retryAfter);

  try {
    if (!(await isRegistryDeployed())) {
      return Response.json({ ok: true, data: { registry: REGISTRY_ADDRESS, deployed: false, total: 0, anchors: [] } });
    }
    const data = await getAnchorsFor(normalizeAddress(address));
    return Response.json(
      { ok: true, data: { registry: REGISTRY_ADDRESS, deployed: true, ...data } },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return errorResponse(toErrorCode(err));
  }
}
