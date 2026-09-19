```javascript
"use strict";

const API = {
    solarWind:
        "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json",

    magneticField:
        "https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json",

    kp:
        "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
};


function $(id) {
    return document.getElementById(id);
}


function setText(id, value) {
    const element = $(id);

    if (element) {
        element.textContent = value;
    } else {
        console.error("Missing HTML element:", id);
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


function formatNumber(value, decimals = 0) {
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
        return "--";
    }

    return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}


async function fetchJSON(url) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, 15000);

    try {
        const response = await fetch(
            `${url}?cacheBust=${Date.now()}`,
            {
                method: "GET",
                cache: "no-store",
                mode: "cors",
                signal: controller.signal
            }
        );

        if (!response.ok) {
            throw new Error(
                `NOAA returned HTTP ${response.status}`
            );
        }

        return await response.json();

    } finally {
        clearTimeout(timeout);
    }
}


/* SOLAR WIND */

function updateSolarWind(data) {

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error("NOAA returned no solar-wind data.");
    }

    const latest = data[0];

    const speed = Number(latest.proton_speed);

    if (!Number.isFinite(speed)) {
        throw new Error(
            "Solar-wind speed was not present in the NOAA response."
        );
    }

    setText(
        "solar-wind-speed",
        formatNumber(speed)
    );

    if (speed < 400) {
        setText("speed-status", "Low");
    } else if (speed < 500) {
        setText("speed-status", "Normal");
    } else if (speed < 700) {
        setText("speed-status", "Elevated");
    } else {
        setText("speed-status", "High");
    }

    return latest.time_tag;
}


/*
 * The NOAA summary endpoint currently provides Bt and Bz.
 * Bx and By are therefore displayed as unavailable rather
 * than inventing values.
 */

function updateMagneticField(data) {

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error(
            "NOAA returned no magnetic-field data."
        );
    }

    const latest = data[0];

    const bt = Number(latest.bt);
    const bz = Number(latest.bz_gsm);

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

    /*
     * Clock angle cannot be calculated correctly without
     * the transverse magnetic-field components.
     */
    setText("clock-angle", "--");
}


/* GEOMAGNETIC Kp */

function updateKp(data) {

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error(
            "NOAA returned no Kp data."
        );
    }

    const latest = data[data.length - 1];

    const kp = Number(latest.Kp);

    if (!Number.isFinite(kp)) {
        throw new Error(
            "Kp value was not present in the NOAA response."
        );
    }

    setText(
        "kp-index",
        formatNumber(kp, 2)
    );


    let description;

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

    setText(
        "kp-description",
        description
    );
}


/* UPDATE EVERYTHING */

async function updateAll() {

    console.log("Space Weather Monitor: updating...");

    setConnection(false, "Connecting...");
    hideError();

    try {

        const results = await Promise.all([
            fetchJSON(API.solarWind),
            fetchJSON(API.magneticField),
            fetchJSON(API.kp)
        ]);

        const solarWindData = results[0];
        const magneticData = results[1];
        const kpData = results[2];

        console.log(
            "Solar wind:",
            solarWindData
        );

        console.log(
            "Magnetic field:",
            magneticData
        );

        console.log(
            "Kp:",
            kpData
        );


        const solarTime =
            updateSolarWind(solarWindData);

        updateMagneticField(
            magneticData
        );

        updateKp(kpData);


        setText(
            "last-update",
            `Updated ${formatTime(solarTime)}`
        );

        setConnection(
            true,
            "Connected"
        );

        console.log(
            "Space Weather Monitor: update successful."
        );

    } catch (error) {

        console.error(
            "Space Weather Monitor error:",
            error
        );

        setConnection(
            false,
            "Connection error"
        );

        showError(
            "Unable to load NOAA data: " +
            (error.message || "Unknown error")
        );
    }
}


/* START */

function start() {

    console.log(
        "Space Weather Monitor JavaScript loaded."
    );

    updateAll();

    // Refresh every minute.
    setInterval(
        updateAll,
        60 * 1000
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
```
