import { errorResponse, toErrorCode } from "@/lib/api";
import { buildTransactionReport } from "@/lib/arc/report";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { validateTxRequest } from "@/lib/request";
import { isNetworkKey } from "@/lib/networks";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/tx/[hash]">) {
  const { hash } = await ctx.params;
  const v = validateTxRequest(hash);
  if (!v.ok) return errorResponse(v.code);
  const rawNetwork = new URL(req.url).searchParams.get("network");
  if (rawNetwork !== null && !isNetworkKey(rawNetwork)) return errorResponse("INVALID_NETWORK");
  const network = rawNetwork ?? "arc-mainnet";

  const rl = rateLimit(`tx:${clientIp(req)}`, 40);
  if (!rl.ok) return errorResponse("RATE_LIMITED", rl.retryAfter);

  try {
    const data = await buildTransactionReport(v.value, network);
    if (!data) return errorResponse("NOT_FOUND");
    // Short cache preserves fresh testnet results while reducing repeat reads.
    return Response.json(
      { ok: true, data },
      { headers: { "cache-control": "public, max-age=30, s-maxage=300" } },
    );
  } catch (err) {
    return errorResponse(toErrorCode(err));
  }
}
