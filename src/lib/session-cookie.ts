import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

const COOKIE = "swiggyagent_sid";

/** Reads the session id cookie, creating one if absent (route handlers only). */
export async function getSessionId(): Promise<string> {
  const jar = await cookies();
  let sid = jar.get(COOKIE)?.value;
  if (!sid) {
    sid = randomUUID();
    jar.set(COOKIE, sid, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return sid;
}
