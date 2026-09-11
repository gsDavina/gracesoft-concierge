"use client";

import type { AuthenticatedActor } from "@gracesoft/shared-types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { loadDevSession } from "./session";

/** Redirects to /login if no dev session exists; otherwise returns the actor. */
export function useRequireSession(): AuthenticatedActor | null {
  const router = useRouter();
  const [actor, setActor] = useState<AuthenticatedActor | null>(null);

  useEffect(() => {
    const session = loadDevSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setActor(session);
  }, [router]);

  return actor;
}
