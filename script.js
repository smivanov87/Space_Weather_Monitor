"use strict";

const API = {
  wind: "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json",
  magnetic: "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json",
  kp: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
};

const $ = (id) => document.getElementById(id);

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function formatNumber(value, decimals = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : "--";
}

function setStatus(text, connected = true) {
  setText("connection-status", text);

  const dot = $("status-dot");
  if (dot) {
    dot.classList.toggle("connected", connected);
    dot.classList.toggle("error", !connected);
  }
}

async function fetchJSON(url) {
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function newestActiveRecord(data) {
  if (!Array.isArray(data)) return null;

  const active = data.filter(
    row => row && (row.active === true || row.active === "true")
  );

  const records = active.length ? active : data;

  return records.find(
    row =>
      row &&
      row.time_tag &&
      (
        row.proton_speed !== undefined ||
        row.proton_density !== undefined ||
        row.proton_temperature !== undefined ||
        row.bx_gsm !== undefined ||
        row.bt !== undefined
      )
  ) || null;
}

async function updateSolarWind() {
  const data = await fetchJSON(API.wind);
  const row = newestActiveRecord(data);

  if (!row) throw new Error("No solar-wind data available");

  setText("solar-wind-speed", formatNumber(row.proton_speed, 0));
  setText("density", formatNumber(row.proton_density, 2));

  // NOAA RTSW uses proton_temperature for the solar-wind temperature.
  const temperature = Number(row.proton_temperature);

  if (Number.isFinite(temperature)) {
    setText("temperature", temperature.toLocaleString("en-US", {
      maximumFractionDigits: 0
    }));
  } else {
    setText("temperature", "--");
  }

  return row.time_tag;
}

async function updateMagneticField() {
  const data = await fetchJSON(API.magnetic);
  const row = newestActiveRecord(data);

  if (!row) throw new Error("No magnetic-field data available");

  setText("bx", formatNumber(row.bx_gsm, 1));
  setText("by", formatNumber(row.by_gsm, 1));
  setText("bz", formatNumber(row.bz_gsm, 1));
  setText("bt", formatNumber(row.bt, 1));

  const bx = Number(row.bx_gsm);
  const by = Number(row.by_gsm);
  const bz = Number(row.bz_gsm);

  if (
    Number.isFinite(bx) &&
    Number.isFinite(by) &&
    Number.isFinite(bz)
  ) {
    // GSM clock angle measured from +Bz.
    let angle = Math.atan2(by, bz) * 180 / Math.PI;
    if (angle < 0) angle += 360;

    setText("clock-angle", `${angle.toFixed(1)}°`);
  } else {
    setText("clock-angle", "--");
  }

  return row.time_tag;
}

async function updateKp() {
  const data = await fetchJSON(API.kp);

  if (!Array.isArray(data) || data.length < 2) {
    throw new Error("No Kp data available");
  }

  // NOAA's Kp file contains a header row followed by measurements.
  const rows = data
    .filter(row => row && row.time_tag && row.Kp !== undefined)
    .sort(
      (a, b) =>
        new Date(b.time_tag).getTime() -
        new Date(a.time_tag).getTime()
    );

  const row = rows[0];

  if (!row) {
    throw new Error("No valid Kp measurement");
  }

  const kp = Number(row.Kp);

  setText(
    "kp-index",
    Number.isFinite(kp) ? kp.toFixed(1) : "--"
  );

  let description = "Unknown";

  if (Number.isFinite(kp)) {
    if (kp < 2) description = "Quiet";
    else if (kp < 4) description = "Unsettled";
    else if (kp < 5) description = "Active";
    else if (kp < 6) description = "Minor storm";
    else if (kp < 7) description = "Moderate storm";
    else if (kp < 8) description = "Strong storm";
    else description = "Severe storm";
  }

  setText("kp-description", description);

  return row.time_tag;
}

async function updateAll() {
  setStatus("Updating...", true);

  const results = await Promise.allSettled([
    updateSolarWind(),
    updateMagneticField(),
    updateKp()
  ]);

  const failures = results.filter(
    result => result.status === "rejected"
  );

  if (failures.length === 0) {
    setStatus("Connected", true);
    setText(
      "last-update",
      `Last update: ${new Date().toLocaleTimeString()}`
    );

    const error = $("error-message");
    if (error) error.textContent = "";
  } else {
    setStatus("Partial data", false);

    const error = $("error-message");
    if (error) {
      error.textContent =
        `${failures.length} data source${failures.length > 1 ? "s" : ""} unavailable.`;
    }
  }
}

function start() {
  updateAll();

  // Refresh every minute to match NOAA's RTSW cadence.
  setInterval(updateAll, 60 * 1000);
}

document.addEventListener("DOMContentLoaded", start);
