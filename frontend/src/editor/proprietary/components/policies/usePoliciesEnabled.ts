/**
 * Policies are not hosted in the standalone/OSS web edition. Return false to avoid
 * spurious 404 polling against backend endpoints (/api/v1/policies).
 */
export function usePoliciesEnabled(): boolean {
  return false;
}
