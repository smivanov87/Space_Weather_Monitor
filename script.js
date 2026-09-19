"use strict";

const API = {
speed:
"https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json",

magnetic:
"https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json",

kp:
"https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
};

const REFRESH_TIME = 5 * 60 * 1000;

function setText(id, value) {
const element = document.getElementById(id);

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

function formatTime(value) {
if (!value) {
return "--";
}

const date = new Date(value);

if (Number.isNaN(date.getTime())) {
return value;
}

return date.toLocaleString();
}

function setConnection(connected) {
setText(
"connection-status",
connected ? "Connected" : "Connection error"
);

const dot = document.getElementById("status-dot");

if (dot) {
dot.classList.toggle("online", connected);
dot.classList.toggle("offline", !connected);
}
}

function showError(message) {
const error = document.getElementById("error-message");

if (!error) {
return;
}

error.textContent = message;
error.classList.remove("hidden");
}

function hideError() {
const error = document.getElementById("error-message");

if (error) {
error.classList.add("hidden");
}
}

async function getJSON(url) {
const response = await fetch(url, {
cache: "no-store"
});

if (!response.ok) {
throw new Error(
`NOAA request failed: ${response.status}`
);
}

return response.json();
}

/* ================================
SOLAR WIND
================================ */

async function loadSolarWind() {
const data = await getJSON(API.speed);

console.log("NOAA solar wind:", data);

if (!Array.isArray(data) || !data.length) {
throw new Error("No solar-wind data received.");
}

const latest = data[0];

const speed = Number(latest.proton_speed);
const time = latest.time_tag;

setText(
"solar-wind-speed",
formatNumber(speed, 0)
);

setText(
"summary-speed",
Number.isFinite(speed)
? `${formatNumber(speed, 0)} km/s`
: "-- km/s"
);

setText(
"speed-status",
Number.isFinite(speed)
? "Current measurement"
: "No data"
);

if (time) {
setText(
"last-update",
formatTime(time)
);
}
}

/* ================================
MAGNETIC FIELD
================================ */

async function loadMagneticField() {
const data = await getJSON(API.magnetic);

console.log("NOAA magnetic field:", data);

if (!Array.isArray(data) || !data.length) {
throw new Error("No magnetic-field data received.");
}

const latest = data[0];

const bt = Number(latest.bt);
const bz = Number(latest.bz_gsm);

/*

* The summary endpoint provides Bt and Bz.
*
* Bx and By are not supplied by this summary product,
* so we deliberately display -- instead of inventing values.
  */

setText("bx", "--");
setText("by", "--");

setText(
"bz",
formatNumber(bz, 1)
);

setText(
"bt",
formatNumber(bt, 1)
);

setText(
"summary-bz",
Number.isFinite(bz)
? `${formatNumber(bz, 1)} nT`
: "-- nT"
);

setText(
"summary-bt",
Number.isFinite(bt)
? `${formatNumber(bt, 1)} nT`
: "-- nT"
);

/*

* Clock angle cannot be calculated reliably
* without By, so don't display a fake value.
  */

setText("clock-angle", "--");

if (latest.time_tag) {
setText(
"last-update",
formatTime(latest.time_tag)
);
}
}

/* ================================
KP INDEX
================================ */

async function loadKp() {
const data = await getJSON(API.kp);

console.log("NOAA Kp:", data);

if (!Array.isArray(data) || !data.length) {
throw new Error("No Kp data received.");
}

/*

* NOAA currently returns objects like:
*
* {
* "time_tag": "...",
* "Kp": 1.67,
* "a_running": 6,
* "station_count": 8
* }
  */

const latest = data[data.length - 1];

const kp = Number(latest.Kp);

if (!Number.isFinite(kp)) {
throw new Error("Invalid Kp value received.");
}

setText(
"kp-index",
formatNumber(kp, 2)
);

setText(
"summary-kp",
formatNumber(kp, 2)
);

setText(
"kp-description",
describeKp(kp)
);

if (latest.time_tag) {
setText(
"last-update",
formatTime(latest.time_tag)
);
}
}

function describeKp(kp) {
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

/* ================================
UPDATE EVERYTHING
================================ */

async function updateAll() {
hideError();

setConnection(false);

try {
await Promise.all([
loadSolarWind(),
loadMagneticField(),
loadKp()
]);

```
setConnection(true);

console.log(
  "Space weather data successfully updated."
);
```

} catch (error) {

```
console.error(
  "Space weather update failed:",
  error
);

setConnection(false);

showError(
  error.message ||
  "Unable to retrieve NOAA data."
);
```

}
}

/* ================================
START
================================ */

document.addEventListener(
"DOMContentLoaded",
() => {

```
console.log(
  "Space Weather Monitor started."
);

updateAll();

setInterval(
  updateAll,
  REFRESH_TIME
);
```

}
);
