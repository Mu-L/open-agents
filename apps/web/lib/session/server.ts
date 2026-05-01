import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import type { Session } from "./types";
import { auth } from "@/lib/auth/config";
import {
  MANAGED_TEMPLATE_DEPLOY_YOUR_OWN_PATH,
  shouldRedirectManagedTemplateUser,
} from "@/lib/managed-template-access";

type GetSessionFromReqOptions = {
  enforceManagedTemplateAccess?: boolean;
};

function extractUsername(user: {
  name?: string | null;
  [key: string]: unknown;
}): string {
  if (typeof user.username === "string" && user.username) {
    return user.username;
  }
  return user.name ?? "";
}

export async function getSessionFromReq(
  req: NextRequest,
  options: GetSessionFromReqOptions = {},
): Promise<Session | undefined> {
  const baSession = await auth.api.getSession({
    headers: req.headers,
  });

  if (!baSession?.user) {
    return undefined;
  }

  const session: Session = {
    created: baSession.session.createdAt.getTime(),
    authProvider: "vercel",
    user: {
      id: baSession.user.id,
      username: extractUsername(baSession.user),
      email: baSession.user.email ?? undefined,
      avatar: baSession.user.image ?? "",
      name: baSession.user.name ?? undefined,
    },
  };

  if (
    options.enforceManagedTemplateAccess !== false &&
    shouldRedirectManagedTemplateUser(session, req.url)
  ) {
    redirect(MANAGED_TEMPLATE_DEPLOY_YOUR_OWN_PATH);
  }

  return session;
}
