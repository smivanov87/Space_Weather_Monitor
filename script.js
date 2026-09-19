"use strict";

const API = {
    wind: "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json",
    magnetic: "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json",
    kp: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
    dst: "https://services.swpc.noaa.gov/products/kyoto-dst.json"
};

function $(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
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

function formatTemperature(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "--";
    }

    return Math.round(number)
        .toLocaleString("en-US")
        .replace(/,/g, " ");
}

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

async function fetchJSON(url) {
    const response = await fetch(`${url}?_=${Date.now()}`, {
        cache: "no-store",
        mode: "cors"
    });

    if (!response.ok) {
        throw new Error(`NOAA HTTP ${response.status}`);
    }

    return response.json();
}

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

    return records.reduce((latest, row) => {
        if (!latest) {
            return row;
        }

        return new Date(row.time_tag).getTime() >
            new Date(latest.time_tag).getTime()
            ? row
            : latest;
    }, null);
}


/* =========================
   SOLAR WIND
========================= */

function displaySolarWind(wind) {
    if (!wind) {
        throw new Error("No solar-wind data.");
    }

    const speed = Number(wind.proton_speed);
    const density = Number(wind.proton_density);
    const temperature = Number(wind.proton_temperature);

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

    const timestamp =
        formatMeasurementTime(wind.time_tag);

    setText("speed-time", timestamp);
    setText("density-time", timestamp);
    setText("temperature-time", timestamp);
}


/* =========================
   MAGNETIC FIELD
========================= */

function displayMagneticField(magnetic) {
    if (!magnetic) {
        throw new Error("No magnetic-field data.");
    }

    const bx = Number(magnetic.bx_gsm);
    const by = Number(magnetic.by_gsm);
    const bz = Number(magnetic.bz_gsm);
    const bt = Number(magnetic.bt);

    setText("bx", formatNumber(bx, 1));
    setText("by", formatNumber(by, 1));
    setText("bz", formatNumber(bz, 1));
    setText("bt", formatNumber(bt, 1));

    if (
        Number.isFinite(by) &&
        Number.isFinite(bz)
    ) {
        let angle =
            Math.atan2(by, bz) * 180 / Math.PI;

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

    const timestamp =
        formatMeasurementTime(magnetic.time_tag);

    setText("bx-time", timestamp);
    setText("by-time", timestamp);
    setText("bz-time", timestamp);
    setText("bt-time", timestamp);
    setText("clock-angle-time", timestamp);
}


/* =========================
   THERMAL PRESSURE
========================= */

function calculateThermalPressure(
    densityCm3,
    temperatureK
) {
    const density = Number(densityCm3);
    const temperature = Number(temperatureK);

    if (
        !Number.isFinite(density) ||
        !Number.isFinite(temperature)
    ) {
        return NaN;
    }

    /*
       P = n k T

       n: proton density in cm^-3
       T: proton temperature in K
       result: nPa
    */

    const densityM3 =
        density * 1e6;

    const kB =
        1.380649e-23;

    const pressurePa =
        densityM3 *
        kB *
        temperature;

    return pressurePa * 1e9;
}


/* =========================
   PLASMA BETA
========================= */

function calculatePlasmaBeta(
    thermalPressureNpa,
    magneticFieldNt
) {
    const thermalPressure =
        Number(thermalPressureNpa);

    const magneticField =
        Number(magneticFieldNt);

    if (
        !Number.isFinite(thermalPressure) ||
        !Number.isFinite(magneticField) ||
        magneticField <= 0
    ) {
        return NaN;
    }

    /*
       Plasma beta = thermal pressure /
                     magnetic pressure

       Magnetic pressure:
       P_B = B² / (2 μ0)
    */

    const mu0 =
        4 * Math.PI * 1e-7;

    const magneticFieldTesla =
        magneticField * 1e-9;

    const magneticPressurePa =
        (magneticFieldTesla ** 2) /
        (2 * mu0);

    const magneticPressureNpa =
        magneticPressurePa * 1e9;

    return (
        thermalPressure /
        magneticPressureNpa
    );
}

function displayPlasma(wind, magnetic) {
    if (!wind || !magnetic) {
        throw new Error(
            "Solar-wind or magnetic data unavailable."
        );
    }

    const density =
        Number(wind.proton_density);

    const temperature =
        Number(wind.proton_temperature);

    const bt =
        Number(magnetic.bt);

    const thermalPressure =
        calculateThermalPressure(
            density,
            temperature
        );

    const plasmaBeta =
        calculatePlasmaBeta(
            thermalPressure,
            bt
        );

    setText(
        "thermal-pressure",
        formatNumber(thermalPressure, 2)
    );

    setText(
        "plasma-beta",
        formatNumber(plasmaBeta, 2)
    );

    setText(
        "thermal-pressure-status",
        "Calculated"
    );

    setText(
        "plasma-beta-status",
        "Calculated"
    );

    /*
       The calculations use the solar-wind
       measurement timestamp.
    */

    const timestamp =
        formatMeasurementTime(wind.time_tag);

    setText(
        "thermal-pressure-time",
        timestamp
    );

    setText(
        "plasma-beta-time",
        timestamp
    );
}


/* =========================
   KP
========================= */

function displayKp(data) {
    if (!Array.isArray(data)) {
        throw new Error("No Kp data.");
    }

    const rows = data
        .filter(
            row =>
                row &&
                row.time_tag &&
                row.Kp !== undefined
        );

    const latest =
        newestRecord(rows);

    if (!latest) {
        throw new Error("No valid Kp data.");
    }

    const kp =
        Number(latest.Kp);

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
        formatMeasurementTime(
            latest.time_tag
        )
    );
}


/* =========================
   DST
========================= */

function displayDst(data) {
    if (!Array.isArray(data)) {
        throw new Error("No Dst data.");
    }

    const rows = data.filter(
        row =>
            row &&
            row.time_tag &&
            row.dst !== undefined
    );

    const latest =
        newestRecord(rows);

    if (!latest) {
        throw new Error("No valid Dst data.");
    }

    const dst =
        Number(latest.dst);

    setText(
        "dst",
        formatNumber(dst, 0)
    );

    if (Number.isFinite(dst)) {
        if (dst > -30) {
            setText("dst-status", "Quiet");
        } else if (dst > -50) {
            setText("dst-status", "Disturbed");
        } else if (dst > -100) {
            setText("dst-status", "Storm");
        } else {
            setText("dst-status", "Strong storm");
        }
    } else {
        setText("dst-status", "--");
    }

    setText(
        "dst-time",
        formatMeasurementTime(
            latest.time_tag
        )
    );
}


/* =========================
   UPDATE EVERYTHING
========================= */

async function updateAll() {
    setConnection(false, "Updating...");
    hideError();

    const refreshTime =
        new Date();

    try {
        /*
           Fetch each NOAA feed only once.
        */

        const [
            windData,
            magneticData,
            kpData,
            dstData
        ] = await Promise.all([
            fetchJSON(API.wind),
            fetchJSON(API.magnetic),
            fetchJSON(API.kp),
            fetchJSON(API.dst)
        ]);

        const wind =
            newestRecord(windData);

        const magnetic =
            newestRecord(magneticData);

        /*
           Update all dashboard sections
           from the same downloaded data.
        */

        displaySolarWind(wind);
        displayMagneticField(magnetic);
        displayPlasma(wind, magnetic);
        displayKp(kpData);
        displayDst(dstData);

        setText(
            "last-update",
            `Last update: ${formatLastUpdate(refreshTime)}`
        );

        setConnection(
            true,
            "Connected"
        );

        console.log(
            "Space Weather data updated successfully."
        );

    } catch (error) {
        console.error(
            "Space Weather update failed:",
            error
        );

        setConnection(
            false,
            "Data unavailable"
        );

        showError(
            `NOAA data update failed: ${error.message}`
        );

        setText(
            "last-update",
            `Last update: ${formatLastUpdate(refreshTime)}`
        );
    }
}


/* =========================
   START
========================= */

function start() {
    updateAll();

    setInterval(
        updateAll,
        60000
    );
}

if (
    document.readyState === "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        start
    );
} else {
    start();
}
