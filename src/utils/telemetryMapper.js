export const TELEMETRY_KEY_MAP = {
  // 4.1 Battery & Charging
  VEHICLE_STATUS_HV_BATTERY_SOC: "battery_level",
  VEHICLE_STATUS_REMAINING_DISTANCE: "range",
  BMS_STATUS_STATE_OF_HEALTH: "soh_percentage",
  BMS_STATUS_NOMINAL_CAPACITY_OF_THE_BATTERY_PACK:
    "battery_nominal_capacity_kwh",
  CHARGING_STATUS_CHARGING_REMAINING_TIME: "remaining_charging_time",
  CHARGE_CONTROL_CURRENT_TARGET_SOC: "target_soc",
  CHARGING_STATUS_CHARGING_STATUS: "charging_status", // 0=Plug in, 1=Charging...
  VEHICLE_STATUS_LV_BATTERY_SOC: "battery_health_12v",
  BMS_STATUS_BATTERY_TYPE: "battery_type",
  BMS_STATUS_BATTERY_SERIAL_NUMBER: "battery_serial",
  BMS_STATUS_BATTERY_DECODED_MANUFACTURE_DATE: "battery_manufacture_date",
  VINFAST_VEHICLE_IDENTIFIER_VEHICLE_MANUFACTURER: "manufacturer",

  // 4.2 Vehicle
  VEHICLE_STATUS_ODOMETER: "odometer",
  VEHICLE_STATUS_GEAR_POSITION: "gear_position",
  VEHICLE_STATUS_VEHICLE_SPEED: "speed",

  // 4.3 Tires (Tech Ref Mapped)
  VEHICLE_STATUS_FRONT_LEFT_TIRE_PRESSURE: "tire_pressure_fl",
  VEHICLE_STATUS_FRONT_RIGHT_TIRE_PRESSURE: "tire_pressure_fr",
  VEHICLE_STATUS_REAR_LEFT_TIRE_PRESSURE: "tire_pressure_rl",
  VEHICLE_STATUS_REAR_RIGHT_TIRE_PRESSURE: "tire_pressure_rr",

  VEHICLE_STATUS_FRONT_LEFT_TIRE_TEMPERATURE: "tire_temp_fl",
  VEHICLE_STATUS_FRONT_RIGHT_TIRE_TEMPERATURE: "tire_temp_fr",
  VEHICLE_STATUS_REAR_LEFT_TIRE_TEMPERATURE: "tire_temp_rl",
  VEHICLE_STATUS_REAR_RIGHT_TIRE_TEMPERATURE: "tire_temp_rr",

  // 4.4 Location
  LOCATION_LATITUDE: "latitude",
  LOCATION_LONGITUDE: "longitude",
  LOCATION_BEARING_DEGREE: "heading",

  // 4.5 Climate
  VEHICLE_STATUS_AMBIENT_TEMPERATURE: "outside_temp",
  CLIMATE_INFORMATION_DRIVER_TEMPERATURE: "inside_temp",
  CLIMATE_INFORMATION_PASSENGER_TEMPERATURE: "climate_passenger_temp",
  CLIMATE_INFORMATION_DRIVER_AIR_BLOW_LEVEL: "fan_speed", // Mapped from correct alias
  CLIMATE_INFORMATION_FAN_SPEED: "fan_speed", // Keep for legacy safety

  // 5.1 Doors & Locks
  DOOR_AJAR_FRONT_LEFT_DOOR_STATUS: "door_fl",
  DOOR_AJAR_FRONT_RIGHT_DOOR_STATUS: "door_fr",
  DOOR_AJAR_REAR_LEFT_DOOR_STATUS: "door_rl",
  DOOR_AJAR_REAR_RIGHT_DOOR_STATUS: "door_rr",
  DOOR_TRUNK_DOOR_STATUS: "trunk_status",
  DOOR_BONNET_DOOR_STATUS: "hood_status",
  REMOTE_CONTROL_DOOR_STATUS: "is_locked",

  // 5.2 Modes
  PET_MODE_CONTROL_STATUS: "pet_mode",
  CAMP_MODE_CONTROL_STATUS: "camp_mode",
  VALET_MODE_CONTROL_STATUS: "valet_mode",

  // Additional from get-alias.json
  VEHICLE_STATUS_INTERIOR_TEMPERATURE: "inside_temp",
  VEHICLE_STATUS_IGNITION_STATUS: "ignition_status",
  VEHICLE_STATUS_HANDBRAKE_STATUS: "handbrake_status",
  REMOTE_CONTROL_WINDOW_STATUS: "window_status",

  // ECU Versions
  ECUS_BMS_SOFTWARE_VERSION: "bms_version",
  ECUS_GATEWAY_SOFTWARE_VERSION: "gateway_version",

  // ECU Information Modules
  ECUS_INFORMATION_HEAD_UNIT: "ecu_head_unit",
  ECUS_INFORMATION_AUDIO_AMPLIFIER: "ecu_audio_amp",
  ECUS_INFORMATION_CONNECTIVITY_MODULE: "ecu_connectivity",
  ECUS_INFORMATION_NAVIGATION_MODULE: "ecu_nav",
  ECUS_INFORMATION_DRIVER_MONITORING_SYSTEM_MODULE: "ecu_driver_monitoring",
  ECUS_INFORMATION_CAMERA_MODULE: "ecu_camera",
  ECUS_INFORMATION_LIGHTING_MODULE: "ecu_lighting",
  ECUS_INFORMATION_POWER_TAILGATE_MODULE: "ecu_tailgate",
  ECUS_INFORMATION_DOOR_CONTROL_MODULE: "ecu_door_control",
  ECUS_INFORMATION_SEAT_CONTROL_MODULE: "ecu_seat_control",

  // New Software Versions
  ECUS_INFORMATION_MHU_SOFTWARE_VERSION: "mhu_version",
  ECUS_INFORMATION_VCU_SOFTWARE_VERSION: "vcu_version",
  ECUS_INFORMATION_BCM_SOFTWARE_VERSION: "bcm_version",

  VEHICLE_STATUS_CENTRAL_LOCK_STATUS: "central_lock_status",

  // 5.3 Windows (per-door ajar status from object 34215)
  WINDOW_AJAR_FRONT_LEFT_STATUS: "window_fl",
  WINDOW_AJAR_FRONT_RIGHT_STATUS: "window_fr",
  WINDOW_AJAR_REAR_LEFT_STATUS: "window_rl",
  WINDOW_AJAR_REAR_RIGHT_STATUS: "window_rr",
  WINDOW_SUNSHADE_STATUS: "sunroof_status",

  // 5.4 Charging Details (from object 34193)
  CHARGING_STATUS_AC_CHARGING_GUN_STATUS: "ac_charging_gun",
  CHARGING_STATUS_DC_CHARGING_GUN_STATUS: "dc_charging_gun",
  CHARGING_STATUS_CHARGE_LID_STATUS: "charge_lid_status",
  CHARGING_STATUS_TARGET_SOC_CONTROL: "target_soc_actual",
  CHARGE_CONTROL_PEAK_OFF_HOUR_START: "charge_schedule_start",
  CHARGE_CONTROL_PEAK_OFF_HOUR_END: "charge_schedule_end",
  CHARGE_CONTROL_CURRENT_DEPARTURE_TIME: "departure_time",
  CHARGE_CONTROL_ENABLE_PEAK_OFF_HOUR: "peak_off_hour_enabled",
  // Live charging power metrics
  CHARGING_STATUS_CURRENT_POWER: "charging_power_kw",
  CHARGING_STATUS_VOLTAGE: "charging_voltage_v",
  CHARGING_STATUS_CURRENT: "charging_current_a",

  // BMS Pack metrics
  BMS_STATUS_PACK_VOLTAGE: "bms_pack_voltage",
  BMS_STATUS_BATTERY_PACK_TOTAL_CURRENT: "bms_pack_current",
  BMS_STATUS_PACK_TEMPERATURE: "bms_pack_temp",
  BMS_STATUS_BMS_BALANCE_STATUS: "bms_balance_active",

  // BMS Cell Voltage (mV)
  BMS_STATUS_MIN_CELL_VOLTAGE: "bms_cell_voltage_min_mv",
  BMS_STATUS_MAX_CELL_VOLTAGE: "bms_cell_voltage_max_mv",
  BMS_STATUS_CELL_NUMBER_OF_MIN_CELL_VOLTAGE: "bms_cell_number_min_v",
  BMS_STATUS_CELL_NUMBER_OF_MAX_CELL_VOLTAGE: "bms_cell_number_max_v",

  // BMS Cell Temperature (°C)
  BMS_STATUS_MIN_CELL_TEMPERATURE: "bms_cell_temp_min",
  BMS_STATUS_MAX_CELL_TEMPERATURE: "bms_cell_temp_max",
  BMS_STATUS_PROBE_NUMBER_OF_MAX_CELL_TEMPERATURE: "bms_probe_number_max_temp",
  BMS_STATUS_PROBE_NUMBER_OF_MIN_CELL_TEMPERATURE: "bms_probe_number_min_temp",
  BMS_STATUS_DELTA_TEMPERATURE_WARNING_SIGNAL: "bms_delta_temp_warning",

  // BMS Coolant
  BMS_STATUS_TEMPERATURE_OF_BATTERY_COOLANT_INLET: "bms_coolant_inlet_temp",
  BMS_STATUS_TEMPERATURE_OF_BATTERY_COOLANT_OUTLET: "bms_coolant_outlet_temp",
  BMS_STATUS_REQUESTING_THE_COOLING_POWER_REQUIRED_FRO_THE_BATTERY_PACK: "bms_cooling_power_req_w",

  // BMS Safety Warnings
  BMS_STATUS_ISOLATION_WARNING: "bms_isolation_warning",
  BMS_STATUS_HVIL_WARNING_SIGNAL: "bms_hvil_warning",

  // 5.5 Climate Control (from object 34199)
  CLIMATE_CONTROL_AC_CONTROL_STATUS: "ac_status",
  CLIMATE_SCHEDULE_SET_DRIVER_TEMPERATURE: "climate_set_driver_temp",
  CLIMATE_SCHEDULE_SET_PASSENGER_TEMPERATURE: "climate_set_passenger_temp",

  // 5.6 Remote Control Status (from object 34213)
  REMOTE_CONTROL_TRUNK_STATUS: "remote_trunk_status",
  REMOTE_CONTROL_LIGHT_STATUS: "remote_light_status",
  REMOTE_CONTROL_HORN_STATUS: "remote_horn_status",

  // 5.7 Warnings (from object 34186)
  VEHICLE_WARNINGS_FRONT_LEFT_TIRE_PRESSURE_LOW_STATUS: "tire_warn_fl",
  VEHICLE_WARNINGS_FRONT_RIGHT_TIRE_PRESSURE_LOW_STATUS: "tire_warn_fr",
  VEHICLE_WARNINGS_REAR_LEFT_TIRE_PRESSURE_LOW_STATUS: "tire_warn_rl",
  VEHICLE_WARNINGS_REAR_RIGHT_TIRE_PRESSURE_LOW_STATUS: "tire_warn_rr",
  VEHICLE_WARNINGS_HV_BATTERY_LOW_SOC_WARNING_STATUS: "low_battery_warn",

  // 5.8 Battery Leasing (from object 34210)
  BATTERY_LEASING_INFO_CURRENT_LIMITED_SOC: "lease_soc_limit",

  // 5.9 Security
  INTRUSION_STATUS: "intrusion_status",
  IMMOBILIZATION_STATUS: "immobilization_status",

  // System Health / Vehicle Status
  FIRMWARE_UPDATE_CURRENT_PKG_VERSION: "firmware_version",
  VERSION_INFO_TBOX_SOFTWARE_VERSION: "tbox_version",
  BMS_STATUS_THERMAL_RUNAWAY_WARNING: "thermal_warning", // 0=Normal
  CCARSERVICE_OBJECT_BOOKING_SERVICE_STATUS: "service_alert",
};

export const PATH_MAP = {
  "/34183/1/7": "outside_temp",
  "/34207/1/1": "pet_mode",
  "/34206/1/1": "camp_mode",

  // Fallback Mappings (Inferred for SOH, T-Box, etc.)
  "/34196/0/1": "battery_serial",
  "/34197/0/0": "soh_percentage",
  "/34197/0/2": "battery_manufacture_date",
  "/34200/0/0": "tbox_version",
  "/34201/0/0": "firmware_version",
};

export const parseTelemetry = (rawData, pathToAlias) => {
  if (!rawData || !Array.isArray(rawData)) return {};

  const result = {};

  rawData.forEach((item) => {
    if (!item.deviceKey) return;

    // Reconstruct path 34183_00001_00009 -> /34183/1/9
    const parts = item.deviceKey.split("_");
    const oid = parseInt(parts[0], 10);
    const iid = parseInt(parts[1], 10);
    const rid = parseInt(parts[2], 10);
    const path = `/${oid}/${iid}/${rid}`;

    // Special Logic for Door Status (Object 10351, Resource 50)
    if (oid === 10351 && rid === 50) {
      let doorKey = null;
      switch (iid) {
        case 1:
          doorKey = "door_fr";
          break;
        case 2:
          doorKey = "door_fl";
          break;
        case 3:
          doorKey = "door_rr";
          break;
        case 4:
          doorKey = "door_rl";
          break;
        case 5:
          doorKey = "hood_status";
          break;
        case 6:
          doorKey = "trunk_status";
          break;
      }
      if (doorKey) {
        result[doorKey] = Number(item.value) === 1;
        return; // Skip normal mapping
      }
    }

    const alias = pathToAlias[path] || path;
    let friendlyKey = TELEMETRY_KEY_MAP[alias];
    if (!friendlyKey) friendlyKey = PATH_MAP[path];
    if (!friendlyKey) friendlyKey = alias;

    let val = item.value;
    if (!isNaN(val)) val = Number(val);

    // Logic Overrides
    if (friendlyKey === "is_locked") val = val == 1;
    if (friendlyKey === "central_lock_status") val = val == 1;
    if (friendlyKey === "handbrake_status") val = val == 1;

    // Special handling for Service Alerts (JSON parsing)
    if (friendlyKey === "service_alert" && typeof val === "string") {
      try {
        if (val.startsWith("[") || val.startsWith("{")) {
          const parsed = JSON.parse(val);
          // If it's an array of appointments, we might want to extract the first one
          if (Array.isArray(parsed) && parsed.length > 0) {
            result.service_appointment_id = parsed[0].appointmentId;
            result.service_appointment_status = parsed[0].status;
          }
        }
      } catch {
        // Not JSON, keep original value
      }
    }

    if (friendlyKey && result[friendlyKey] === undefined) {
      result[friendlyKey] = val;
    }
  });

  return result;
};
