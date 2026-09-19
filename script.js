"use strict";

/*

* Space Weather Monitor
* NOAA SWPC data
  */

const API = {
plasma:
"https://services.swpc.noaa.gov/products/solar-wind/plasma-5-minute.json",

magnetic:
"https://services.swpc.noaa.gov/products/solar-wind/mag-5-minute.json",

kp:
"https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
};

const REFRESH_INTERVAL = 5 * 60 * 1000;

function byId(id) {
return document.getElementById(id);
}

function setText(id, value) {
const element = byId(id);

if (element) {
element.textContent = value;
}
}

function formatNumber(value, decimals = 1) {
const number = Number(value);

if (!Number.isFinite(number)) {
return "--";
}

return number.toFixed(decimals);
}

function formatDate(value) {
const date = new Date(value);

if (Number.isNaN(date.getTime())) {
return "--";
}

return date.toLocaleString(undefined, {
year: "numeric",
month: "short",
day: "2-digit",
hour: "2-digit",
minute: "2-digit",
second: "2-digit",
timeZoneName: "short"
});
}

function showError(message) {
const element = byId("error-message");

if (!element) {
return;
}

element.textContent = message;
element.classList.remove("hidden");
}

function hideError() {
const element = byId("error-message");

if (element) {
element.classList.add("hidden");
}
}

function setConnectionStatus(online) {
const dot = byId("status-dot");
const status = byId("connection-status");

if (dot) {
dot.classList.toggle("online", online);
dot.classList.toggle("offline", !online);
}

if (status) {
status.textContent = online ? "Connected" : "Connection error";
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

function findLatestRow(data) {
if (!Array.isArray(data) || data.length < 2) {
throw new Error("NOAA returned no usable data.");
}

/*

* NOAA JSON files normally contain:
*
* [
* ["time_tag", "density", "speed", ...],
* ["...", "...", "..."]
* ]
*
* Search backwards because the newest valid observation
* is normally at the end of the array.
  */

for (let i = data.length - 1; i >= 1; i--) {
const row = data[i];

```
if (Array.isArray(row) && row.length > 0) {
  return row;
}
```

}

throw new Error("No valid NOAA observation found.");
}

function getColumnIndex(header, possibleNames) {
const normalizedHeader = header.map((name) =>
String(name).trim().toLowerCase()
);

for (const name of possibleNames) {
const index = normalizedHeader.indexOf(name.toLowerCase());

```
if (index !== -1) {
  return index;
}
```

}

return -1;
}

async function updateSolarWind() {
const data = await fetchJSON(API.plasma);

const header = data[0];
const row = findLatestRow(data);

const densityIndex = getColumnIndex(header, [
"density",
"proton_density"
]);

const speedIndex = getColumnIndex(header, [
"speed",
"bulk_speed"
]);

const temperatureIndex = getColumnIndex(header, [
"temperature",
"proton_temperature"
]);

const timeIndex = getColumnIndex(header, [
"time_tag",
"time"
]);

const speed = speedIndex >= 0 ? row[speedIndex] : null;
const density = densityIndex >= 0 ? row[densityIndex] : null;
const temperature =
temperatureIndex >= 0 ? row[temperatureIndex] : null;

setText("solar-wind-speed", formatNumber(speed, 0));
setText("density", formatNumber(density, 2));
setText("temperature", formatNumber(temperature, 0));

setText(
"speed-status",
Number.isFinite(Number(speed))
? "Current measurement"
: "No valid measurement"
);

setText(
"density-status",
Number.isFinite(Number(density))
? "Current measurement"
: "No valid measurement"
);

setText(
"temperature-status",
Number.isFinite(Number(temperature))
? "Current measurement"
: "No valid measurement"
);

if (timeIndex >= 0) {
setText("last-update", formatDate(row[timeIndex]));
}

setText(
"summary-speed",
Number.isFinite(Number(speed))
? `${formatNumber(speed, 0)} km/s`
: "-- km/s"
);
}

async function updateMagneticField() {
const data = await fetchJSON(API.magnetic);

const header = data[0];
const row = findLatestRow(data);

const bxIndex = getColumnIndex(header, ["bx_gsm", "bx"]);
const byIndex = getColumnIndex(header, ["by_gsm", "by"]);
const bzIndex = getColumnIndex(header, ["bz_gsm", "bz"]);
const btIndex = getColumnIndex(header, ["bt"]);

const bx = bxIndex >= 0 ? Number(row[bxIndex]) : NaN;
const by = byIndex >= 0 ? Number(row[byIndex]) : NaN;
const bz = bzIndex >= 0 ? Number(row[bzIndex]) : NaN;
const bt = btIndex >= 0 ? Number(row[btIndex]) : NaN;

setText("bx", formatNumber(bx));
setText("by", formatNumber(by));
setText("bz", formatNumber(bz));
setText("bt", formatNumber(bt));

/*

* Clock angle measured from +Bz.
*
* atan2(By, Bz) gives the transverse field direction.
* Normalize to 0–360 degrees.
  */

if (Number.isFinite(by) && Number.isFinite(bz)) {
let angle =
Math.atan2(by, bz) * (180 / Math.PI);

```
if (angle < 0) {
  angle += 360;
}

setText("clock-angle", formatNumber(angle, 1));
```

} else {
setText("clock-angle", "--");
}

setText(
"summary-bz",
Number.isFinite(bz)
? `${formatNumber(bz)} nT`
: "-- nT"
);

setText(
"summary-bt",
Number.isFinite(bt)
? `${formatNumber(bt)} nT`
: "-- nT"
);
}

function describeKp(kp) {
if (!Number.isFinite(kp)) {
return "Waiting for data";
}

if (kp < 3) {
return "Quiet";
}

if (kp < 4) {
return "Unsettled";
}

if (kp < 5) {
return "Active";
}

if (kp < 6) {
return "Minor geomagnetic storm";
}

if (kp < 7) {
return "Moderate geomagnetic storm";
}

if (kp < 8) {
return "Strong geomagnetic storm";
}

if (kp < 9) {
return "Severe geomagnetic storm";
}

return "Extreme geomagnetic storm";
}

async function updateKp() {
const data = await fetchJSON(API.kp);

const header = data[0];
const row = findLatestRow(data);

const kpIndex = getColumnIndex(header, [
"kp_index",
"kp",
"k-index"
]);

if (kpIndex === -1) {
throw new Error("Could not find Kp column in NOAA data.");
}

const kp = Number(row[kpIndex]);

setText(
"kp-index",
Number.isFinite(kp)
? formatNumber(kp, 1)
: "--"
);

setText("kp-description", describeKp(kp));

setText(
"summary-kp",
Number.isFinite(kp)
? formatNumber(kp, 1)
: "--"
);
}

async function updateAll() {
hideError();
setConnectionStatus(false);

const results = await Promise.allSettled([
updateSolarWind(),
updateMagneticField(),
updateKp()
]);

const failures = results.filter(
(result) => result.status === "rejected"
);

if (failures.length === 0) {
setConnectionStatus(true);
return;
}

setConnectionStatus(false);

const messages = failures
.map((failure) => failure.reason?.message)
.filter(Boolean);

showError(
`Unable to retrieve ${failures.length} NOAA data source${
      failures.length === 1 ? "" : "s"
    }. ${messages.join(" ")}`
);
}

/*

* Start the application after the HTML has loaded.
  */
  document.addEventListener("DOMContentLoaded", () => {
  updateAll();

window.setInterval(
updateAll,
REFRESH_INTERVAL
);
});
