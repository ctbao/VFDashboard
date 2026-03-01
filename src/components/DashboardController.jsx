import { useEffect, useRef } from "react";
import { api } from "../services/api";
import {
  fetchUser,
  fetchVehicles,
  vehicleStore,
  updateFromMqtt,
  refreshVehicle,
} from "../stores/vehicleStore";
import { fetchChargingSessions } from "../stores/chargingHistoryStore";
import { getMqttClient, destroyMqttClient } from "../services/mqttClient";
import { mqttStore } from "../stores/mqttStore";

/**
 * APK ScreenResources.Home — 90 resources the Home screen requests.
 * Extracted from decompiled ScreenResources.java static initializer.
 * APK sends ONLY these to list_resource, not all 2040 from the alias map.
 */
const HOME_RESOURCES = [
  { objectId: "34229", instanceId: "1", resourceId: "6" },
  { objectId: "34229", instanceId: "1", resourceId: "5" },
  { objectId: "34229", instanceId: "1", resourceId: "3" },
  { objectId: "34229", instanceId: "1", resourceId: "4" },
  { objectId: "34229", instanceId: "1", resourceId: "2" },
  { objectId: "34230", instanceId: "1", resourceId: "1" },
  { objectId: "34230", instanceId: "1", resourceId: "4" },
  { objectId: "34220", instanceId: "1", resourceId: "116" },
  { objectId: "34206", instanceId: "1", resourceId: "1" },
  { objectId: "34214", instanceId: "1", resourceId: "3" },
  { objectId: "34214", instanceId: "1", resourceId: "4" },
  { objectId: "34214", instanceId: "1", resourceId: "5" },
  { objectId: "56789", instanceId: "1", resourceId: "1" },
  { objectId: "56789", instanceId: "1", resourceId: "103" },
  { objectId: "56789", instanceId: "1", resourceId: "9" },
  { objectId: "34193", instanceId: "1", resourceId: "24" },
  { objectId: "34193", instanceId: "1", resourceId: "19" },
  { objectId: "34193", instanceId: "1", resourceId: "22" },
  { objectId: "34193", instanceId: "1", resourceId: "21" },
  { objectId: "34193", instanceId: "1", resourceId: "37" },
  { objectId: "34193", instanceId: "1", resourceId: "30" },
  { objectId: "34193", instanceId: "1", resourceId: "10" },
  { objectId: "34193", instanceId: "1", resourceId: "7" },
  { objectId: "34193", instanceId: "1", resourceId: "5" },
  { objectId: "34193", instanceId: "1", resourceId: "17" },
  { objectId: "34184", instanceId: "1", resourceId: "42" },
  { objectId: "34184", instanceId: "1", resourceId: "25" },
  { objectId: "34184", instanceId: "1", resourceId: "6" },
  { objectId: "34184", instanceId: "1", resourceId: "9" },
  { objectId: "34224", instanceId: "1", resourceId: "2" },
  { objectId: "34224", instanceId: "1", resourceId: "3" },
  { objectId: "34224", instanceId: "1", resourceId: "11" },
  { objectId: "34224", instanceId: "1", resourceId: "7" },
  { objectId: "34224", instanceId: "1", resourceId: "5" },
  { objectId: "34224", instanceId: "1", resourceId: "4" },
  { objectId: "34224", instanceId: "1", resourceId: "6" },
  { objectId: "34224", instanceId: "1", resourceId: "12" },
  { objectId: "34232", instanceId: "1", resourceId: "1" },
  { objectId: "10351", instanceId: "2", resourceId: "50" },
  { objectId: "10351", instanceId: "1", resourceId: "50" },
  { objectId: "10351", instanceId: "4", resourceId: "50" },
  { objectId: "10351", instanceId: "3", resourceId: "50" },
  { objectId: "10351", instanceId: "6", resourceId: "50" },
  { objectId: "5", instanceId: "1", resourceId: "30" },
  { objectId: "5", instanceId: "1", resourceId: "7" },
  { objectId: "34221", instanceId: "1", resourceId: "1" },
  { objectId: "34221", instanceId: "1", resourceId: "6" },
  { objectId: "34221", instanceId: "1", resourceId: "2" },
  { objectId: "34221", instanceId: "1", resourceId: "3" },
  { objectId: "34221", instanceId: "1", resourceId: "4" },
  { objectId: "34221", instanceId: "1", resourceId: "5" },
  { objectId: "34234", instanceId: "1", resourceId: "3" },
  { objectId: "34222", instanceId: "1", resourceId: "3" },
  { objectId: "34207", instanceId: "1", resourceId: "1" },
  { objectId: "34225", instanceId: "1", resourceId: "6" },
  { objectId: "34213", instanceId: "7", resourceId: "3" },
  { objectId: "34213", instanceId: "8", resourceId: "3" },
  { objectId: "34213", instanceId: "1", resourceId: "3" },
  { objectId: "34213", instanceId: "5", resourceId: "3" },
  { objectId: "34213", instanceId: "4", resourceId: "3" },
  { objectId: "34213", instanceId: "9", resourceId: "3" },
  { objectId: "34213", instanceId: "6", resourceId: "3" },
  { objectId: "34213", instanceId: "2", resourceId: "3" },
  { objectId: "34213", instanceId: "3", resourceId: "3" },
  { objectId: "34200", instanceId: "6", resourceId: "16" },
  { objectId: "34205", instanceId: "1", resourceId: "1" },
  { objectId: "34205", instanceId: "1", resourceId: "3" },
  { objectId: "34183", instanceId: "1", resourceId: "7" },
  { objectId: "34183", instanceId: "1", resourceId: "16" },
  { objectId: "34183", instanceId: "1", resourceId: "20" },
  { objectId: "34183", instanceId: "1", resourceId: "17" },
  { objectId: "34183", instanceId: "1", resourceId: "21" },
  { objectId: "34183", instanceId: "1", resourceId: "29" },
  { objectId: "34183", instanceId: "1", resourceId: "9" },
  { objectId: "34183", instanceId: "1", resourceId: "3" },
  { objectId: "34183", instanceId: "1", resourceId: "18" },
  { objectId: "34183", instanceId: "1", resourceId: "22" },
  { objectId: "34183", instanceId: "1", resourceId: "19" },
  { objectId: "34183", instanceId: "1", resourceId: "23" },
  { objectId: "34183", instanceId: "1", resourceId: "11" },
  { objectId: "34183", instanceId: "1", resourceId: "35" },
  { objectId: "34186", instanceId: "7", resourceId: "4" },
  { objectId: "34186", instanceId: "1", resourceId: "4" },
  { objectId: "34186", instanceId: "2", resourceId: "4" },
  { objectId: "34186", instanceId: "5", resourceId: "4" },
  { objectId: "34186", instanceId: "3", resourceId: "4" },
  { objectId: "34186", instanceId: "4", resourceId: "4" },
  { objectId: "34196", instanceId: "1", resourceId: "4" },
  { objectId: "34180", instanceId: "1", resourceId: "10" },
  { objectId: "34181", instanceId: "1", resourceId: "7" },
];

export default function DashboardController({ vin: initialVin }) {
  const isMounted = useRef(true);
  const firstMqttMessageAt = useRef(null);

  // Init Effect
  useEffect(() => {
    isMounted.current = true;
    firstMqttMessageAt.current = null;

    // Set MQTT callbacks EARLY — before fetchVehicles which triggers
    // switchVehicle → switchVin → connect(). Without this, MQTT connects
    // but onTelemetryUpdate is null so messages are ignored.
    const mqttClient = getMqttClient();
    mqttClient.onTelemetryUpdate = (mqttVin, parsed, rawMessages) => {
      if (!isMounted.current) return;

      // Measure time-to-first-data for diagnostics
      if (!firstMqttMessageAt.current) {
        firstMqttMessageAt.current = performance.now();
        const connectedAt = mqttClient._connectedAt || 0;
        const delta = connectedAt ? (firstMqttMessageAt.current - connectedAt).toFixed(0) : "?";
        console.log(
          `%c[MQTT Perf] First data for ${mqttVin} in ${delta}ms after connect`,
          "color:#22c55e;font-weight:bold",
        );
      }

      updateFromMqtt(mqttVin, parsed, rawMessages);
    };
    mqttClient.onConnected = (connectedVin) => {
      if (!isMounted.current) return;

      // Record connect time for perf measurement
      mqttClient._connectedAt = performance.now();

      console.log(`[MQTT] Connected for ${connectedVin} — triggering T-Box via wakeup + heartbeat`);

      // APK startup flow after MQTT subscription succeeds:
      // 1. Heartbeat CONNECTED(2) — already handled by mqttClient._startHeartbeat()
      // 2. device-trust — register device with VinFast (APK does on startup)
      // 3. app/wakeup — explicit T-Box wake REST call
      // 4. list_resource — register telemetry resources
      // 5. app/ping — keepalive ping

      // Fire-and-forget: don't block MQTT on REST calls
      (async () => {
        // Device-trust: APK calls PUT /device-trust/fcm-token on every startup.
        // This may be required before telemetry endpoints accept requests.
        try {
          const trustResult = await api.registerDeviceTrust();
          console.log(
            `%c[Trigger] device-trust → ${trustResult.status}`,
            trustResult.status < 300 ? 'color:#10b981;font-weight:bold' : 'color:#f59e0b;font-weight:bold',
            trustResult.data,
          );
        } catch (e) {
          console.warn('[Trigger] device-trust error:', e.message);
        }

        try {
          const wakeResult = await api.wakeupTBox();
          console.log(`[Trigger] wakeup → ${wakeResult.status}`);
        } catch (e) {
          console.warn('[Trigger] wakeup error:', e.message);
        }

        // list_resource + app/ping: capture response details for debugging.
        // These have returned 403 since Feb 2026 — device-trust may fix this.
        try {
          const lrResult = await api.listResource(connectedVin, HOME_RESOURCES);
          console.log(
            `%c[Trigger] list_resource → ${lrResult.status}`,
            lrResult.status < 300 ? 'color:#10b981;font-weight:bold' : 'color:#ef4444;font-weight:bold',
            lrResult,
          );
        } catch (e) {
          console.warn('[Trigger] list_resource error:', e.message);
        }

        try {
          const pingResult = await api.appPing(HOME_RESOURCES);
          console.log(
            `%c[Trigger] app/ping → ${pingResult.status || '?'}`,
            'color:#8b5cf6;font-weight:bold',
            pingResult,
          );
        } catch (e) {
          console.warn('[Trigger] app/ping error:', e.message);
        }
      })();
    };

    const init = async () => {
      let targetVin = initialVin || vehicleStore.get().vin;

      // Sequential: fetchVehicles handles 401 → token refresh.
      // fetchUser runs after so it uses the refreshed token.
      if (!targetVin) {
        targetVin = await fetchVehicles();
        if (!isMounted.current) return;
      }

      // fetchUser after vehicles — token is guaranteed fresh
      await fetchUser();
      if (!isMounted.current) return;

      if (targetVin) {
        // Preload full charging history for dashboard stats.
        void fetchChargingSessions(targetVin);
      }

      // If still no VIN or failed to fetch, redirect to login
      if (!targetVin && isMounted.current) {
        api.clearSession();
        window.location.href = '/login';
        return;
      }

      // Mark as initialized — we have a valid VIN and user.
      // MQTT will fill in live telemetry data progressively.
      if (!vehicleStore.get().isInitialized) {
        vehicleStore.setKey("isInitialized", true);
      }

      // Start MQTT if not already started by switchVehicle
      if (targetVin && isMounted.current) {
        const mqttState = mqttStore.get();

        const shouldStartMqtt =
          mqttClient.vin !== targetVin ||
          (mqttState.status !== "connected" && mqttState.status !== "connecting");

        if (shouldStartMqtt) {
          mqttClient.connect(targetVin);
        }
      }
    };

    init();

    return () => {
      isMounted.current = false;
      destroyMqttClient();
    };
  }, [initialVin]);

  // Auto-refresh timer: when showing cached data, auto-trigger refresh after 5 minutes.
  // This gives users time to see cached data immediately, then seamlessly transitions to live.
  const cacheTimerRef = useRef(null);
  const lastDataSourceRef = useRef(null);

  useEffect(() => {
    const CACHE_AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

    const unsub = vehicleStore.subscribe((state) => {
      const ds = state.dataSource;
      if (ds === lastDataSourceRef.current) return;
      lastDataSourceRef.current = ds;

      // Clear any existing timer
      if (cacheTimerRef.current) {
        clearTimeout(cacheTimerRef.current);
        cacheTimerRef.current = null;
      }

      // Schedule auto-refresh when data is from cache
      if (ds === 'cache' && state.vin) {
        cacheTimerRef.current = setTimeout(() => {
          const current = vehicleStore.get();
          if (current.dataSource === 'cache' && current.vin && isMounted.current) {
            console.log(`[Auto-Refresh] Cache expired for ${current.vin}, triggering refresh`);
            refreshVehicle(current.vin);
          }
        }, CACHE_AUTO_REFRESH_MS);
      }
    });

    return () => {
      unsub();
      if (cacheTimerRef.current) clearTimeout(cacheTimerRef.current);
    };
  }, []);
  return null; // Headless
}
