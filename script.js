"use strict";

const API = {
    solarWind:
        "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json",

    solarWindPlasma:
        "https://services.swpc.noaa.gov/products/summary/solar-wind.json",

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


/* SOLAR WIND */

async function updateSolarWind() {
    const speedData = await fetchJSON(API.solarWind);

    if (!Array.isArray(speedData) || !speedData.length) {
        throw new Error("No solar-wind speed data.");
    }

    const latest = speedData[0];
    const speed = Number(latest.proton_speed);

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

    /*
     * Get density and temperature from the solar-wind
     * plasma summary when available.
     */
    try {
        const plasmaData =
            await fetchJSON(API.solarWindPlasma);

        if (Array.isArray(plasmaData) && plasmaData.length) {
            const plasma = plasmaData[0];

            const density =
                Number(
                    plasma.proton_density ??
                    plasma.density
                );

            const temperature =
                Number(
                    plasma.proton_temperature ??
                    plasma.temperature
                );

            setText(
                "density",
                Number.isFinite(density)
                    ? formatNumber(density, 2)
                    : "--"
            );

            setText(
                "temperature",
                Number.isFinite(temperature)
                    ? formatNumber(temperature, 0)
                    : "--"
            );

            if (Number.isFinite(density)) {
                if (density < 5) {
                    setText("density-status", "Low");
                } else if (density < 10) {
                    setText("density-status", "Normal");
                } else {
                    setText("density-status", "Elevated");
                }
            }

            if (Number.isFinite(temperature)) {
                setText("temperature-status", "Measured");
            }
        }
    } catch (error) {
        console.warn(
            "Solar-wind plasma data unavailable:",
            error
        );
    }

    return latest.time_tag;
}


/* MAGNETIC FIELD */

async function updateMagneticField() {
    const data =
        await fetchJSON(API.magneticField);

    if (!Array.isArray(data) || !data.length) {
        throw new Error("No magnetic-field data.");
    }

    const latest = data[0];

    const bt = Number(latest.bt);
    const bz = Number(latest.bz_gsm);

    setText(
        "bx",
        Number.isFinite(Number(latest.bx_gsm))
            ? formatNumber(latest.bx_gsm, 1)
            : "--"
    );

    setText(
        "by",
        Number.isFinite(Number(latest.by_gsm))
            ? formatNumber(latest.by_gsm, 1)
            : "--"
    );

    setText(
        "bz",
        Number.isFinite(bz)
            ? formatNumber(bz, 1)
            : "--"
    );

    setText(
        "bt",
        Number.isFinite(bt)
            ? formatNumber(bt, 1)
            : "--"
    );

    /*
     * Clock angle from By/Bz when both are available.
     */
    const by = Number(latest.by_gsm);

    if (Number.isFinite(by) && Number.isFinite(bz)) {
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
        setText("clock-angle", "--");
    }
}


/* KP */

async function updateKp() {
    const data = await fetchJSON(API.kp);

    if (!Array.isArray(data) || !data.length) {
        throw new Error("No Kp data.");
    }

    const latest = data[data.length - 1];
    const kp = Number(latest.Kp);

    if (!Number.isFinite(kp)) {
        throw new Error("Invalid Kp value.");
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


/* MAIN UPDATE */

async function updateAll() {
    setConnection(false, "Connecting...");
    hideError();

    try {
        const solarTime =
            await updateSolarWind();

        await updateMagneticField();
        await updateKp();

        setText(
            "last-update",
            `Updated ${formatTime(solarTime)}`
        );

        setConnection(
            true,
            "Connected"
        );

        console.log(
            "Space Weather data updated successfully."
        );

    } catch (error) {
        console.error(error);

        setConnection(
            false,
            "Connection error"
        );

        showError(
            `Unable to load NOAA data: ${error.message}`
        );
    }
}


/* START */

function start() {
    console.log(
        "Space Weather Monitor loaded."
    );

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
