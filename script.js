"use strict";
const API = {
wind: "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json",
magnetic: "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json",
kp: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
};
function $(id) {
return document.getElementById(id);
}
function setText(id, value) {
const element = $(id);
if (element) {
    element.textContent = value;
}
}
function setConnection(online, message) {
const dot = $("status-dot");
const status = $("connection-status");

if (dot) {
    dot.classList.toggle("online", online);
    dot.classList.toggle("offline", !online);
}

if (status) {
    status.textContent = message;
}
}
function showError(message) {
const error = $("error-message");

if (error) {
    error.textContent = message;
    error.hidden = false;
}

console.error(message);
}
function hideError() {
const error = $("error-message");

if (error) {
    error.hidden = true;
}
}
/* Number formatting */
function formatNumber(value, decimals = 0) {
const number = Number(value);

if (!Number.isFinite(number)) {
    return "--";
}

return number.toFixed(decimals);
}
/* Temperature: 104 971 instead of 104,971 */
function formatTemperature(value) {
const number = Number(value);

if (!Number.isFinite(number)) {
    return "--";
}

return Math.round(number)
    .toLocaleString("en-US")
    .replace(/,/g, " ");
}
/* NOAA measurement date/time */
function formatMeasurementTime(value) {
if (!value) {
    return "--";
}

const date = new Date(value);

if (Number.isNaN(date.getTime())) {
    return "--";
}

return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
});
}
/* Dashboard refresh time */
function formatLastUpdate(date) {
return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
});
}
/* Fetch NOAA JSON */
async function fetchJSON(url) {
const response = await fetch(
    `${url}?_=${Date.now()}`,
    {
        cache: "no-store",
        mode: "cors"
    }
);

if (!response.ok) {
    throw new Error(`NOAA HTTP ${response.status}`);
}

return response.json();
}
/* Find newest usable record */
function newestRecord(data) {
if (!Array.isArray(data)) {
    return null;
}

const records = data.filter(
    row => row && row.time_tag
);

if (!records.length) {
    return null;
}

records.sort(
    (a, b) =>
        new Date(b.time_tag).getTime() -
        new Date(a.time_tag).getTime()
);

return records[0];
}
/* SOLAR WIND */
async function updateSolarWind() {
const data = await fetchJSON(API.wind);

const latest = newestRecord(data);

if (!latest) {
    throw new Error("No solar-wind data.");
}


const speed = Number(latest.proton_speed);
const density = Number(latest.proton_density);
const temperature = Number(latest.proton_temperature);


/* Speed */

setText(
    "solar-wind-speed",
    formatNumber(speed, 0)
);

if (Number.isFinite(speed)) {

    if (speed < 400) {
        setText("speed-status", "Low");
    } else if (speed < 500) {
        setText("speed-status", "Normal");
    } else if (speed < 700) {
        setText("speed-status", "Elevated");
    } else {
        setText("speed-status", "High");
    }

} else {
    setText("speed-status", "--");
}


/* Density */

setText(
    "density",
    formatNumber(density, 2)
);

if (Number.isFinite(density)) {

    if (density < 5) {
        setText("density-status", "Low");
    } else if (density < 10) {
        setText("density-status", "Normal");
    } else {
        setText("density-status", "Elevated");
    }

} else {
    setText("density-status", "--");
}


/* Temperature */

setText(
    "temperature",
    formatTemperature(temperature)
);

setText(
    "temperature-status",
    Number.isFinite(temperature)
        ? "Measured"
        : "--"
);


/* Timestamp */

const timestamp =
    formatMeasurementTime(latest.time_tag);

setText("speed-time", timestamp);
setText("density-time", timestamp);
setText("temperature-time", timestamp);

return latest.time_tag;
}
/* MAGNETIC FIELD */
async function updateMagneticField() {
const data = await fetchJSON(API.magnetic);

const latest = newestRecord(data);

if (!latest) {
    throw new Error("No magnetic-field data.");
}


const bx = Number(latest.bx_gsm);
const by = Number(latest.by_gsm);
const bz = Number(latest.bz_gsm);
const bt = Number(latest.bt);


setText("bx", formatNumber(bx, 1));
setText("by", formatNumber(by, 1));
setText("bz", formatNumber(bz, 1));
setText("bt", formatNumber(bt, 1));


/* Clock angle */

if (
    Number.isFinite(by) &&
    Number.isFinite(bz)
) {

    let angle =
        Math.atan2(by, bz) *
        180 /
        Math.PI;

    if (angle < 0) {
        angle += 360;
    }

    setText(
        "clock-angle",
        formatNumber(angle, 1)
    );

} else {

    setText(
        "clock-angle",
        "--"
    );
}


/* Timestamp */

const timestamp =
    formatMeasurementTime(latest.time_tag);

setText("bx-time", timestamp);
setText("by-time", timestamp);
setText("bz-time", timestamp);
setText("bt-time", timestamp);
setText("clock-angle-time", timestamp);

return latest.time_tag;
}
/* KP INDEX */
async function updateKp() {
const data = await fetchJSON(API.kp);

if (!Array.isArray(data)) {
    throw new Error("No Kp data.");
}


const rows = data
    .filter(
        row =>
            row &&
            row.time_tag &&
            row.Kp !== undefined
    )
    .sort(
        (a, b) =>
            new Date(b.time_tag).getTime() -
            new Date(a.time_tag).getTime()
    );


const latest = rows[0];

if (!latest) {
    throw new Error("No valid Kp data.");
}


const kp = Number(latest.Kp);


setText(
    "kp-index",
    formatNumber(kp, 1)
);


let description = "Unknown";


if (Number.isFinite(kp)) {

    if (kp < 2) {
        description = "Quiet";
    } else if (kp < 4) {
        description = "Unsettled";
    } else if (kp < 5) {
        description = "Active";
    } else if (kp < 6) {
        description = "Minor storm";
    } else if (kp < 8) {
        description = "Moderate storm";
    } else {
        description = "Strong storm";
    }

}


setText(
    "kp-description",
    description
);


setText(
    "kp-time",
    formatMeasurementTime(latest.time_tag)
);
}
/* MAIN UPDATE */
async function updateAll() {
setConnection(false, "Updating...");
hideError();


const refreshTime = new Date();


const results =
    await Promise.allSettled([
        updateSolarWind(),
        updateMagneticField(),
        updateKp()
    ]);


const failures =
    results.filter(
        result =>
            result.status === "rejected"
    );


/* Dashboard update timestamp */

setText(
    "last-update",
    `Last update: ${formatLastUpdate(refreshTime)}`
);


if (failures.length === 0) {

    setConnection(
        true,
        "Connected"
    );

    console.log(
        "Space Weather data updated successfully."
    );

} else {

    setConnection(
        false,
        "Partial data"
    );

    showError(
        `${failures.length} NOAA data source(s) unavailable.`
    );
}
}
/* START */
function start() {
updateAll();

setInterval(
    updateAll,
    60000
);
}
if (document.readyState === "loading") {
document.addEventListener(
    "DOMContentLoaded",
    start
);
} else {
start();
}
