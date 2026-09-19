"use strict";

/*

* Space Weather Monitor
* Current NOAA SWPC data format
  */

const API = {
solarWindSpeed:
"https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json",

magneticField:
"https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json",

kp:
"https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
};

const REFRESH_INTERVAL = 5 * 60 * 1000;

function $(id) {
return document.getElementById(id);
}

function setText(id, value) {
const element = $(id);

if (element) {
element.textContent = value;
}
}

function number(value, decimals = 1) {
const n = Number(value);

return Number.isFinite(n)
? n.toFixed(decimals)
: "--";
}

function formatTime(value) {
if (!value) {
return "--";
}

const date = new Date(value);

if (Number.isNaN(date.getTime())) {
return String(value);
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

function setStatus(connected) {
const dot = $("status-dot");
const text = $("connection-status");

if (dot) {
dot.classList.toggle("online", connected);
dot.classList.toggle("offline", !connected);
}

if (text) {
text.textContent = connected
? "Connected"
: "Connection error";
}
}

function showError(message) {
const box = $("error-message");

if (!box) {
return;
}

box.textContent = message;
box.classList.remove("hidden");
}

function hideError() {
const box = $("error-message");

if (box) {
box.classList.add("hidden");
}
}

async function getJSON(url) {
const response = await fetch(url, {
method: "GET",
cache: "no-store"
});

if (!response.ok) {
throw new Error(
`${response.status} ${response.statusText}`
);
}

return response.json();
}

/* ---------------------------------------------
SOLAR WIND
--------------------------------------------- */

async function loadSolarWind() {
const data = await getJSON(API.solarWindSpeed);

console.log("NOAA solar wind:", data);

/*

* Current NOAA summary products use a JSON object.
* Keep the parser flexible because NOAA may expose
* slightly different property names.
  */

const speed =
data.speed ??
data.solar_wind_speed ??
data.wind_speed ??
data.value;

const time =
data.time_tag ??
data.time ??
data.timestamp ??
data.updated;

setText(
"solar-wind-speed",
number(speed, 0)
);

setText(
"summary-speed",
Number.isFinite(Number(speed))
? `${number(speed, 0)} km/s`
: "-- km/s"
);

setText(
"speed-status",
Number.isFinite(Number(speed))
? "Current measurement"
: "No valid measurement"
);

if (time) {
setText("last-update", formatTime(time));
}
}

/* ---------------------------------------------
MAGNETIC FIELD
--------------------------------------------- */

async function loadMagneticField() {
const data = await getJSON(API.magneticField);

console.log("NOAA magnetic field:", data);

const bx =
data.bx ??
data.bx_gsm ??
data.Bx;

const by =
data.by ??
data.by_gsm ??
data.By;

const bz =
data.bz ??
data.bz_gsm ??
data.Bz;

const bt =
data.bt ??
data.Bt ??
data.total_field;

setText("bx", number(bx));
setText("by", number(by));
setText("bz", number(bz));
setText("bt", number(bt));

setText(
"summary-bz",
Number.isFinite(Number(bz))
? `${number(bz)} nT`
: "-- nT"
);

setText(
"summary-bt",
Number.isFinite(Number(bt))
? `${number(bt)} nT`
: "-- nT"
);

/*

* IMF clock angle.
*
* atan2(By, Bz)
  */

if (
Number.isFinite(Number(by)) &&
Number.isFinite(Number(bz))
) {
let angle =
Math.atan2(
Number(by),
Number(bz)
) * 180 / Math.PI;

```
if (angle < 0) {
  angle += 360;
}

setText(
  "clock-angle",
  number(angle, 1)
);
```

} else {
setText("clock-angle", "--");
}
}

/* ---------------------------------------------
KP INDEX
--------------------------------------------- */

async function loadKp() {
const data = await getJSON(API.kp);

console.log("NOAA Kp:", data);

let kp = null;
let time = null;

/*

* New NOAA format:
*
* [
* {
* ```
  "time_tag": "...",
  ```
* ```
  "kp_index": 2
  ```
* },
* ...
* ]
  */

if (Array.isArray(data)) {

```
for (let i = data.length - 1; i >= 0; i--) {

  const item = data[i];

  if (
    item &&
    typeof item === "object"
  ) {

    const candidate =
      item.kp_index ??
      item.kp ??
      item.Kp ??
      item.k_index;

    if (
      candidate !== undefined &&
      candidate !== null &&
      Number.isFinite(Number(candidate))
    ) {
      kp = Number(candidate);

      time =
        item.time_tag ??
        item.time ??
        item.timestamp;

      break;
    }
  }
}
```

}

if (kp === null) {
throw new Error(
"NOAA Kp data could not be parsed."
);
}

setText(
"kp-index",
number(kp, 1)
);

setText(
"summary-kp",
number(kp, 1)
);

setText(
"kp-description",
describeKp(kp)
);

if (time) {
setText(
"last-update",
formatTime(time)
);
}
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

/* ---------------------------------------------
MAIN UPDATE
--------------------------------------------- */

async function updateSpaceWeather() {

hideError();

setStatus(false);

const results =
await Promise.allSettled([
loadSolarWind(),
loadMagneticField(),
loadKp()
]);

const errors =
results.filter(
result => result.status === "rejected"
);

if (errors.length === 0) {

```
setStatus(true);

console.log(
  "Space weather data updated successfully."
);

return;
```

}

console.error(
"NOAA errors:",
errors
);

setStatus(false);

const messages =
errors
.map(
result =>
result.reason?.message
)
.filter(Boolean);

showError(
"NOAA data error: " +
messages.join(" | ")
);
}

/* ---------------------------------------------
START
--------------------------------------------- */

document.addEventListener(
"DOMContentLoaded",
() => {

```
updateSpaceWeather();

window.setInterval(
  updateSpaceWeather,
  REFRESH_INTERVAL
);
```

}
);
