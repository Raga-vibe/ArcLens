import { errorResponse, toErrorCode } from "@/lib/api";
import { ARC_MAINNET } from "@/lib/arc/chain";
import { getBlockTimestamp, getLatestBlock } from "@/lib/arc/provider";

export const dynamic = "force-dynamic";

/** Live chain head, used by the landing page to show real network activity. */
export async function GET() {
  try {
    const block = await getLatestBlock();
    const timestamp = await getBlockTimestamp(block);
    return Response.json(
      { ok: true, data: { chainId: ARC_MAINNET.chainId, block, timestamp } },
      { headers: { "cache-control": "public, max-age=2, s-maxage=2" } },
    );
  } catch (err) {
    return errorResponse(toErrorCode(err));
  }
}
