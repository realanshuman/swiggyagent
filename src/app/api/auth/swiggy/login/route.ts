import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Real-mode OAuth entry point (SWIGGY_MODE=real).
 *
 * Swiggy's MCP servers implement MCP-standard OAuth: the server's 401 carries
 * protected-resource metadata pointing at the authorization server. The full
 * authorization-code + PKCE flow (discovery → register/redirect → token) is
 * exercised by `npm run discover-tools` against staging; wire the same
 * provider here once our redirect URI is whitelisted by Swiggy Builders Club.
 *
 * Until then this endpoint only reports what's missing, so real mode fails
 * loudly instead of half-working.
 */
export async function GET(): Promise<Response> {
  if (process.env.SWIGGY_MODE !== "real") {
    redirect("/");
  }
  const clientId = process.env.SWIGGY_OAUTH_CLIENT_ID;
  if (!clientId) {
    return Response.json(
      {
        error: "oauth_not_configured",
        message:
          "Set SWIGGY_OAUTH_CLIENT_ID / SWIGGY_OAUTH_REDIRECT_URI after Swiggy whitelists this app's redirect URI (Builders Club onboarding). Run `npm run discover-tools` to exercise the OAuth flow from localhost first.",
      },
      { status: 501 }
    );
  }
  // TODO(builders-club): initiate authorization-code + PKCE flow here.
  return Response.json({ error: "oauth_flow_pending_whitelist" }, { status: 501 });
}
