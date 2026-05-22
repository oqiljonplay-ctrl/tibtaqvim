"use client";

import { useState, useEffect } from "react";

export interface CurrentUser {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  phone: string | null;
  role: string;
  clinicId: string | null;
  branchId: string | null;
  clinic: { id: string; name: string; logoUrl: string | null; city: string | null } | null;
  branch: { id: string; name: string } | null;
}

interface State {
  user: CurrentUser | null;
  loading: boolean;
}

export function useCurrentUser(): State {
  const [state, setState] = useState<State>({ user: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setState({ user: json.success ? json.data : null, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ user: null, loading: false });
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}
