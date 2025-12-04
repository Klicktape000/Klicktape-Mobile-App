import { useEffect } from 'react';
import { usePathname, useGlobalSearchParams } from 'expo-router';
import { storeRouteState, shouldPersistRoute } from '@/lib/routeRestoration';

/**
 * RouteTracker component that automatically tracks and stores the current route
 * for restoration after app refresh
 */
export default function RouteTracker() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();

  useEffect(() => {
    //// console.log('📍 RouteTracker - Current pathname:', pathname);
    //// console.log('📍 RouteTracker - Current params:', params);
    
    if (pathname && shouldPersistRoute(pathname)) {
      //// console.log('✅ Storing route state for:', pathname);
      storeRouteState(pathname, params);
    } else {
      //// console.log('❌ Not storing route (excluded):', pathname);
    }
  }, [pathname, params]);

  return null;
}
