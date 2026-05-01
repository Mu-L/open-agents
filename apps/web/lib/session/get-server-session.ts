import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth/config";
import {
  MANAGED_TEMPLATE_DEPLOY_YOUR_OWN_PATH,
  shouldRedirectManagedTemplateUser,
} from "@/lib/managed-template-access";
import type { Session } from "./types";

type GetServerSessionOptions = {
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

export const getServerSession = cache(
  async (
    options: GetServerSessionOptions = {},
  ): Promise<Session | undefined> => {
    const requestHeaders = await headers();
    const baSession = await auth.api.getSession({
      headers: requestHeaders,
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
      shouldRedirectManagedTemplateUser(
        session,
        requestHeaders.get("host") ?? "",
      )
    ) {
      redirect(MANAGED_TEMPLATE_DEPLOY_YOUR_OWN_PATH);
    }

    return session;
  },
);
