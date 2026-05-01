import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerSession } from "@/lib/session/get-server-session";

type SettingsTemplateProps = {
  children: ReactNode;
};

export default async function SettingsTemplate({
  children,
}: SettingsTemplateProps) {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/");
  }

  return <>{children}</>;
}
