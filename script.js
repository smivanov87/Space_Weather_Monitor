/*
 * Space Weather Prediction Dashboard
 *
 * Data source:
 * NOAA Space Weather Prediction Center
 *
 * Solar wind:
 * rtsw_wind_1m.json
 *
 * Magnetic field:
 * rtsw_mag_1m.json
 *
 * Kp:
 * planetary_k_index_1m.json
 */

"use strict";


// ------------------------------------------------------------
// NOAA DATA URLS
// ------------------------------------------------------------

const WIND_URL =
    "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json";

const MAG_URL =
    "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json";

const KP_URL =
    "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";


// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


function number(value, decimals = 1) {
    const n = Number(value);

    if (!Number.isFinite(n)) {
        return "--";
    }

    return n.toFixed(decimals);
}


function getLatestRecord(data) {

    if (!Array.isArray(data) || data.length < 2) {
        return null;
    }

    const headers = data[0];

    const rows = data
        .slice(1)
        .filter(row => Array.isArray(row));

    if (!rows.length) {
        return null;
    }

    const row = rows[rows.length - 1];

    const record = {};

    headers.forEach((header, index) => {
        record[header] = row[index];
    });

    return record;
}


function findValue(record, possibleNames) {

    if (!record) {
        return null;
    }

    for (const name of possibleNames) {

        if (
            Object.prototype.hasOwnProperty.call(record, name) &&
            record[name] !== null &&
            record[name] !== undefined &&
            record[name] !== ""
        ) {
            return record[name];
        }
    }

    return null;
}


function formatTime(record) {

    if (!record) {
        return "--";
    }

    const time =
        findValue(record, [
            "time_tag",
            "time",
            "timestamp",
            "date"
        ]);

    if (!time) {
        return "--";
    }

    const date = new Date(time);

    if (Number.isNaN(date.getTime())) {
        return String(time);
    }

    return date.toLocaleString();
}


// ------------------------------------------------------------
// SOLAR WIND
// ------------------------------------------------------------

async function loadSolarWindData() {

    try {

        const response = await fetch(
            WIND_URL + "?t=" + Date.now(),
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Solar wind HTTP ${response.status}`
            );
        }

        const data = await response.json();

        const latest = getLatestRecord(data);

        if (!latest) {
            throw new Error(
                "No solar wind data returned by NOAA"
            );
        }


        // ----------------------------------------------------
        // SPEED
        // ----------------------------------------------------

        const speed = findValue(
            latest,
            [
                "speed",
                "Speed",
                "proton_speed",
                "wind_speed"
            ]
        );


        // ----------------------------------------------------
        // DENSITY
        // ----------------------------------------------------

        const density = findValue(
            latest,
            [
                "density",
                "Density",
                "proton_density"
            ]
        );


        // ----------------------------------------------------
        // TEMPERATURE
        // ----------------------------------------------------

        const temperature = findValue(
            latest,
            [
                "temperature",
                "Temperature",
                "proton_temperature"
            ]
        );


        // ----------------------------------------------------
        // UPDATE HTML
        // ----------------------------------------------------

        if (speed !== null) {

            const formattedSpeed = number(speed, 0);

            setText(
                "solarSpeed",
                formattedSpeed
            );

            setText(
                "speed2",
                formattedSpeed
            );
        }


        if (density !== null) {

            setText(
                "density",
                number(density, 2)
            );
        }


        if (temperature !== null) {

            setText(
                "temperature",
                Number(temperature).toLocaleString(
                    undefined,
                    {
                        maximumFractionDigits: 0
                    }
                )
            );
        }


        // ----------------------------------------------------
        // TIMESTAMP
        // ----------------------------------------------------

        setText(
            "windTime",
            formatTime(latest)
        );


        return true;

    } catch (error) {

        console.error(
            "Solar wind data error:",
            error
        );

        setText(
            "solarSpeed",
            "--"
        );

        setText(
            "speed2",
            "--"
        );

        setText(
            "density",
            "--"
        );

        setText(
            "temperature",
            "--"
        );

        setText(
            "windTime",
            "Solar wind data unavailable"
        );

        return false;
    }
}


// ------------------------------------------------------------
// MAGNETIC FIELD
// ------------------------------------------------------------

async function loadMagneticData() {

    try {

        const response = await fetch(
            MAG_URL + "?t=" + Date.now(),
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Magnetic field HTTP ${response.status}`
            );
        }

        const data = await response.json();

        const latest = getLatestRecord(data);

        if (!latest) {
            throw new Error(
                "No magnetic field data returned by NOAA"
            );
        }


        // ----------------------------------------------------
        // BY
        // ----------------------------------------------------

        const by = findValue(
            latest,
            [
                "by_gsm",
                "by",
                "By",
                "By_gsm"
            ]
        );


        // ----------------------------------------------------
        // BZ
        // ----------------------------------------------------

        const bz = findValue(
            latest,
            [
                "bz_gsm",
                "bz",
                "Bz",
                "Bz_gsm"
            ]
        );


        // ----------------------------------------------------
        // BT
        // ----------------------------------------------------

        const bt = findValue(
            latest,
            [
                "bt",
                "Bt",
                "total_field"
            ]
        );


        // ----------------------------------------------------
        // UPDATE BY
        // ----------------------------------------------------

        if (by !== null) {

            setText(
                "by",
                number(by, 1)
            );
        }


        // ----------------------------------------------------
        // UPDATE BZ
        // ----------------------------------------------------

        if (bz !== null) {

            setText(
                "bz",
                number(bz, 1)
            );
        }


        // ----------------------------------------------------
        // UPDATE BT
        // ----------------------------------------------------

        if (bt !== null) {

            const formattedBt = number(bt, 1);

            setText(
                "bt",
                formattedBt
            );

            setText(
                "bt2",
                formattedBt
            );
        }


        // ----------------------------------------------------
        // CLOCK ANGLE
        //
        // atan2(By, Bz)
        // ----------------------------------------------------

        if (by !== null && bz !== null) {

            const byNumber = Number(by);
            const bzNumber = Number(bz);

            if (
                Number.isFinite(byNumber) &&
                Number.isFinite(bzNumber)
            ) {

                let angle =
                    Math.atan2(
                        byNumber,
                        bzNumber
                    ) *
                    180 /
                    Math.PI;

                if (angle < 0) {
                    angle += 360;
                }

                setText(
                    "clockAngle",
                    angle.toFixed(1)
                );
            }
        }


        // ----------------------------------------------------
        // TIMESTAMP
        // ----------------------------------------------------

        setText(
            "magTime",
            formatTime(latest)
        );


        return true;

    } catch (error) {

        console.error(
            "Magnetic field data error:",
            error
        );

        setText("by", "--");
        setText("bz", "--");
        setText("bt", "--");
        setText("bt2", "--");
        setText("clockAngle", "--");

        setText(
            "magTime",
            "Magnetic field data unavailable"
        );

        return false;
    }
}


// ------------------------------------------------------------
// KP INDEX
// ------------------------------------------------------------

async function loadKpData() {

    try {

        const response = await fetch(
            KP_URL + "?t=" + Date.now(),
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Kp HTTP ${response.status}`
            );
        }

        const data = await response.json();

        const latest = getLatestRecord(data);

        if (!latest) {
            throw new Error(
                "No Kp data returned by NOAA"
            );
        }


        const kp = findValue(
            latest,
            [
                "kp_index",
                "kp",
                "Kp"
            ]
        );


        if (kp !== null) {

            setText(
                "currentKp",
                number(kp, 1)
            );
        }


        return true;

    } catch (error) {

        console.error(
            "Kp data error:",
            error
        );

        setText(
            "currentKp",
            "--"
        );

        return false;
    }
}


// ------------------------------------------------------------
// UPDATE STATUS
// ------------------------------------------------------------

async function updateDashboard() {

    const results = await Promise.all([
        loadSolarWindData(),
        loadMagneticData(),
        loadKpData()
    ]);

    const solarWindOK = results[0];
    const magneticOK = results[1];
    const kpOK = results[2];


    const status = document.getElementById("status");

    if (!status) {
        return;
    }


    if (
        solarWindOK &&
        magneticOK &&
        kpOK
    ) {

        status.textContent =
            "LIVE — NOAA SWPC data connected";

        status.className = "ok";

    } else {

        status.textContent =
            "PARTIAL DATA — some NOAA feeds unavailable";

        status.className = "error";
    }
}


// ------------------------------------------------------------
// INITIAL LOAD
// ------------------------------------------------------------

updateDashboard();


// ------------------------------------------------------------
// REFRESH EVERY 60 SECONDS
// ------------------------------------------------------------

setInterval(
    updateDashboard,
    60 * 1000
);
