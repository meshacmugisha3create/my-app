import * as oidc from "openid-client";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/auth";
import { getGoogleConfiguration, getGoogleRedirectUri } from "@/lib/google-oauth";

const stateCookie = "mesh_google_state";
const nonceCookie = "mesh_google_nonce";
const verifierCookie = "mesh_google_verifier";
const flowCookie = "mesh_google_flow";
const oauthCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

export async function GET(request: Request) {
  try {
    const flow = new URL(request.url).searchParams.get("mode") === "link" ? "link" : "login";
    if (flow === "link" && !(await getCurrentMember())) {
      return NextResponse.redirect(new URL("/login?error=google_link_signin", request.url));
    }

    const configuration = getGoogleConfiguration();
    if (!configuration) {
      return NextResponse.redirect(new URL("/login?error=google_unconfigured", request.url));
    }

    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const authorizationUrl = oidc.buildAuthorizationUrl(await configuration, {
      redirect_uri: getGoogleRedirectUri(),
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(stateCookie, state, oauthCookieOptions);
    response.cookies.set(nonceCookie, nonce, oauthCookieOptions);
    response.cookies.set(verifierCookie, codeVerifier, oauthCookieOptions);
    response.cookies.set(flowCookie, flow, oauthCookieOptions);
    return response;
  } catch (error) {
    unstable_rethrow(error);
    console.error("Unable to start Google sign-in:", error);
    return NextResponse.redirect(new URL("/login?error=google_failed", request.url));
  }
}