import { errorResponse, toErrorCode } from "@/lib/api";
import { REGISTRY_ADDRESS } from "@/lib/arc/chain";
import { isRegistryDeployed } from "@/lib/arc/registry";

export const dynamic = "force-dynamic";

/** Where ArcLensRegistry lives and whether it has been deployed yet. */
export async function GET() {
  try {
    const deployed = await isRegistryDeployed();
    return Response.json(
      { ok: true, data: { address: REGISTRY_ADDRESS, deployed } },
      { headers: { "cache-control": deployed ? "public, max-age=300" : "no-store" } },
    );
  } catch (err) {
    return errorResponse(toErrorCode(err));
  }
}
