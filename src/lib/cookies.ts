import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const PLAYER_COOKIE = "tt_player_claim";
const ADMIN_COOKIE = "tt_admin";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET must be set to at least 16 characters");
  }
  return new TextEncoder().encode(value);
}

async function signToken(payload: Record<string, string>, days: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret());
}

async function readToken(token: string) {
  const { payload } = await jwtVerify(token, secret());
  return payload;
}

export async function setPlayerClaim(playerId: string) {
  const token = await signToken({ typ: "player", playerId }, 365);
  const store = await cookies();
  store.set(PLAYER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearPlayerClaim() {
  const store = await cookies();
  store.delete(PLAYER_COOKIE);
}

export async function getClaimedPlayerId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(PLAYER_COOKIE)?.value;
  if (!token) {
    return null;
  }
  try {
    const payload = await readToken(token);
    if (payload.typ !== "player" || typeof payload.playerId !== "string") {
      return null;
    }
    return payload.playerId;
  } catch {
    return null;
  }
}

export async function setAdminSession() {
  const token = await signToken({ typ: "admin" }, 14);
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) {
    return false;
  }
  try {
    const payload = await readToken(token);
    return payload.typ === "admin";
  } catch {
    return false;
  }
}

export function adminCredentialsOk(username: string, password: string) {
  const expectedUser = process.env.ADMIN_USERNAME ?? "";
  const expectedPass = process.env.ADMIN_PASSWORD ?? "";
  return (
    expectedUser.length > 0 &&
    expectedPass.length > 0 &&
    username === expectedUser &&
    password === expectedPass
  );
}
