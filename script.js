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

const $ = (id) => document.getElementById(id);

function setText(id, value) {
    const element = $(id);

    if (!element) {
        console.error(`Missing HTML element: #${id}`);
        return;
    }

    element.textContent = value;
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
        const response = await fetch(`${url}?_=${Date.now()}`, {
            method: "GET",
            cache: "no-store",
            mode: "cors",
            signal: controller.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} from ${url}`);
        }

        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

function updateSolarWind(data) {
    if (!Array.isArray(data) || !data.length) {
        throw new Error("Solar wind API returned no data.");
    }

    const latest = data[0];

    const speed = Number(latest.proton_speed);

    if (!Number.isFinite(speed)) {
        throw new Error("Solar wind speed is missing from NOAA response.");
    }

    setText("solar-wind-speed", formatNumber(speed));
    setText("summary-speed", `${formatNumber(speed)} km/s`);

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

function updateMagneticField(data) {
    if (!Array.isArray(data) || !data.length) {
        throw new Error("Magnetic field API returned no data.");
    }

    const latest = data[0];

    const bt = Number(latest.bt);
    const bz = Number(latest.bz_gsm);

    setText("bx", "--");
    setText("by", "--");

    setText("bz", formatNumber(bz, 1));
    setText("bt", formatNumber(bt, 1));
    setText("summary-bz", `${formatNumber(bz, 1)} nT`);
    setText("summary-bt", `${formatNumber(bt, 1)} nT`);

    if (bz <= -10) {
        setText("speed-status", "Check Bz");
    }

    setText("clock-angle", "--");

    return latest.time_tag;
}

function updateKp(data) {
    if (!Array.isArray(data) || !data.length) {
        throw new Error("Kp API returned no data.");
    }

    const latest = data[data.length - 1];

    const kp = Number(latest.Kp);

    if (!Number.isFinite(kp)) {
        throw new Error("Kp value is missing from NOAA response.");
    }

    setText("kp-index", formatNumber(kp, 2));
    setText("summary-kp", `Kp ${formatNumber(kp, 2)}`);

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

    setText("kp-description", description);

    return latest.time_tag;
}

async function updateAll() {
    console.log("Space Weather Monitor: starting update...");

    setConnection(false, "Connecting...");
    hideError();

    try {
        const [solarWind, magneticField, kp] = await Promise.all([
            fetchJSON(API.solarWind),
            fetchJSON(API.magneticField),
            fetchJSON(API.kp)
        ]);

        console.log("NOAA solar wind:", solarWind);
        console.log("NOAA magnetic field:", magneticField);
        console.log("NOAA Kp:", kp);

        const solarTime = updateSolarWind(solarWind);
        updateMagneticField(magneticField);
        updateKp(kp);

        const updateTime = solarTime || new Date().toISOString();

        setText("last-update", `Updated ${formatTime(updateTime)}`);

        setConnection(true, "Connected");

        console.log("Space Weather Monitor: update successful.");
    } catch (error) {
        console.error("Space Weather Monitor error:", error);

        setConnection(false, "Connection error");

        showError(
            `Unable to load NOAA data: ${
                error && error.message
                    ? error.message
                    : "Unknown error"
            }`
        );
    }
}

function start() {
    console.log("Space Weather Monitor JavaScript loaded.");

    setConnection(false, "Connecting...");

    updateAll();

    // NOAA data does not need to be requested every second.
    setInterval(updateAll, 60000);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
} else {
    start();
}
```
