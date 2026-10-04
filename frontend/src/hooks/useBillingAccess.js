import { useSyncExternalStore } from "react";
import { getEntitlementState, subscribeEntitlements } from "../entitlementStore";

export default function useBillingAccess() {
  return useSyncExternalStore(subscribeEntitlements, getEntitlementState, getEntitlementState);
}
