import * as oidc from "openid-client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createMemberSession, getCurrentMember } from "@/lib/auth";
import {
  findOrCreateGoogleMember,
  getGoogleConfiguration,
  GoogleAccountLinkRequiredError,
  GoogleAccountMismatchError,
  linkGoogleIdentity,
} from "@/lib/google-oauth";

const stateCookie = "mesh_google_state";
const nonceCookie = "mesh_google_nonce";
const verifierCookie = "mesh_google_verifier";
const flowCookie = "mesh_google_flow";
const oauthCookieNames = [stateCookie, nonceCookie, verifierCookie, flowCookie];

function redirectToLogin(request: Request, error: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
  for (const name of oauthCookieNames) response.cookies.delete(name);
  return response;
}

export async function GET(request: Request) {
  const callbackUrl = new URL(request.url);
  if (callbackUrl.searchParams.has("error")) return redirectToLogin(request, "google_cancelled");

  const cookieStore = await cookies();
  const state = cookieStore.get(stateCookie)?.value;
  const nonce = cookieStore.get(nonceCookie)?.value;
  const codeVerifier = cookieStore.get(verifierCookie)?.value;
  const flow = cookieStore.get(flowCookie)?.value;
  if (
    !state ||
    !nonce ||
    !codeVerifier ||
    (flow !== "login" && flow !== "link") ||
    !callbackUrl.searchParams.has("code")
  ) {
    return redirectToLogin(request, "google_failed");
  }

  try {
    const configuration = getGoogleConfiguration();
    if (!configuration) return redirectToLogin(request, "google_unconfigured");

    const tokens = await oidc.authorizationCodeGrant(await configuration, callbackUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedState: state,
      expectedNonce: nonce,
    });
    const claims = tokens.claims();
    const subject = claims?.sub;
    const email = typeof claims?.email === "string" ? claims.email.trim().toLowerCase() : "";
    const emailVerified = claims?.email_verified === true;
    const googleName = typeof claims?.name === "string" ? claims.name : "";

    if (!subject || !email || !emailVerified || email.length > 254) {
      return redirectToLogin(request, "google_email_unverified");
    }

    let member;
    if (flow === "link") {
      const currentMember = await getCurrentMember();
      if (!currentMember) return redirectToLogin(request, "google_link_signin");
      member = linkGoogleIdentity(currentMember.id, email, subject);
    } else {
      member = await findOrCreateGoogleMember(subject, email, googleName);
    }
    await createMemberSession(member.id);
    const response = NextResponse.redirect(new URL("/progress", request.url));
    for (const name of oauthCookieNames) response.cookies.delete(name);
    return response;
  } catch (error) {
    console.error("Google sign-in callback failed:", error);
    if (error instanceof GoogleAccountLinkRequiredError) {
      return redirectToLogin(request, "google_link_required");
    }
    if (error instanceof GoogleAccountMismatchError) {
      return redirectToLogin(request, "google_account_mismatch");
    }
    return redirectToLogin(request, "google_failed");
  }
}