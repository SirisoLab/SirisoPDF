/**
 * Read-only Policies state for the editor's enforcement path. The backend
 * (`/api/v1/policies`) is the source of truth: we reconcile the local cache
 * against the stored policies on mount and whenever the signed-in user
 * changes. localStorage is a fast-render cache + offline fallback. Managing
 * policies (create/edit/pause/delete) lives on the portal Pipelines page, not
 * here; the editor only reads them and runs them.
 */

import { useState, useEffect } from "react";
import { useAuth } from "@editor/auth/UseSession";
import {
  loadPolicies,
  onPoliciesChange,
  updatePolicy,
  forgetPolicies,
} from "@editor/services/policyStorage";
import { loadPolicyCatalog } from "@editor/services/policyCatalog";
import {
  fetchPoliciesByCategory,
  decodedToState,
} from "@editor/services/policyBackend";
import type { PoliciesByKey } from "@editor/types/policies";

export function usePolicies() {
  const [policies, setPolicies] = useState<PoliciesByKey>(loadPolicies);
  // Reconciling only on mount leaves the cache in its unconfigured default when the fetch ran
  // before there was a session, and every consumer reads that default as "no policy".
  const { user } = useAuth();
  const sessionKey = user?.id ?? null;

  useEffect(() => onPoliciesChange(() => setPolicies(loadPolicies())), []);

  // One attempt per session: a failed fetch keeps the cached policies rather than polling a
  // backend that may not serve this endpoint.
  useEffect(() => {
    let cancelled = false;

    const reconcile = async () => {
      let byCategory;
      try {
        byCategory = await fetchPoliciesByCategory();
      } catch {
        return;
      }
      if (cancelled) return;
      const local = loadPolicies();
      const reconciled: PoliciesByKey = {};
      for (const cat of loadPolicyCatalog().categories) {
        const decoded = byCategory.get(cat.id);
        reconciled[cat.id] = decoded
          ? decodedToState(decoded)
          : {
              ...local[cat.id],
              configured: false,
              enabled: false,
              backendId: undefined,
            };
      }
      // Builder-made pipelines have no category, so the built-in loop above skips them. They are
      // still policies: one set to run on the editor has to reach the auto-run.
      for (const [key, decoded] of byCategory) {
        if (reconciled[key]) continue;
        reconciled[key] = decodedToState(decoded);
      }
      // A builder pipeline the backend no longer has was deleted on the Pipelines page. Its cached
      // entry keeps a dead backendId that still satisfies the auto-run filter, so the dispatch
      // fails, the run never completes, and the chain behind it never advances.
      forgetPolicies(
        Object.keys(local).filter(
          (id) => !reconciled[id] && !byCategory.has(id),
        ),
      );
      for (const [id, state] of Object.entries(reconciled)) {
        updatePolicy(id, state);
      }
    };
    void reconcile();
    return () => {
      cancelled = true;
    };
  }, [sessionKey]);

  return { policies };
}
