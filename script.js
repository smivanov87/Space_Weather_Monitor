"use strict";

const API = {
    wind: "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json",
    magnetic: "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json",
    kp: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
    dst: "https://services.swpc.noaa.gov/products/kyoto-dst.json"
};


/* =========================
   CONSTANTS
========================= */

const kB = 1.380649e-23;       // Boltzmann constant, J/K
const mu0 = 4 * Math.PI * 1e-7; // Vacuum permeability, H/m
const mp = 1.67262192369e-27;  // Proton mass, kg


/* =========================
   HELPERS
========================= */

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

    records.sort(
        (a, b) =>
            new Date(b.time_tag).getTime() -
            new Date(a.time_tag).getTime()
    );

    return records[0];
}


/* =========================
   SOLAR WIND
========================= */

async function updateSolarWind() {
    const data = await fetchJSON(API.wind);
    const latest = newestRecord(data);

    if (!latest) {
        throw new Error("No solar-wind data.");
    }

    const speed = Number(latest.proton_speed);
    const density = Number(latest.proton_density);
    const temperature = Number(latest.proton_temperature);

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
        formatMeasurementTime(latest.time_tag);

    setText("speed-time", timestamp);
    setText("density-time", timestamp);
    setText("temperature-time", timestamp);

    return latest;
}


/* =========================
   MAGNETIC FIELD
========================= */

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
        formatMeasurementTime(latest.time_tag);

    setText("bx-time", timestamp);
    setText("by-time", timestamp);
    setText("bz-time", timestamp);
    setText("bt-time", timestamp);
    setText("clock-angle-time", timestamp);

    return latest;
}


/* =========================
   PLASMA CALCULATIONS
========================= */

/*
    THERMAL PRESSURE

    P_th = n k_B T

    n  = proton density in m^-3
    kB = Boltzmann constant
    T  = proton temperature in K

    Result: nPa
*/

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

    // cm^-3 -> m^-3
    const densityM3 =
        density * 1e6;

    const pressurePa =
        densityM3 *
        kB *
        temperature;

    // Pa -> nPa
    return pressurePa * 1e9;
}


/*
    MAGNETIC PRESSURE

    P_B = B² / (2 μ0)

    B  = total IMF magnitude in Tesla
    μ0 = vacuum permeability

    Result: nPa
*/

function calculateMagneticPressure(
    magneticFieldNt
) {
    const magneticField =
        Number(magneticFieldNt);

    if (
        !Number.isFinite(magneticField) ||
        magneticField < 0
    ) {
        return NaN;
    }

    // nT -> T
    const magneticFieldTesla =
        magneticField * 1e-9;

    const pressurePa =
        (magneticFieldTesla ** 2) /
        (2 * mu0);

    // Pa -> nPa
    return pressurePa * 1e9;
}


/*
    DYNAMIC PRESSURE

    P_dyn = n m_p v²

    n  = proton density in m^-3
    mp = proton mass
    v  = solar-wind speed in m/s

    Result: nPa
*/

function calculateDynamicPressure(
    densityCm3,
    speedKmS
) {
    const density =
        Number(densityCm3);

    const speed =
        Number(speedKmS);

    if (
        !Number.isFinite(density) ||
        !Number.isFinite(speed)
    ) {
        return NaN;
    }

    // cm^-3 -> m^-3
    const densityM3 =
        density * 1e6;

    // km/s -> m/s
    const speedMs =
        speed * 1000;

    const pressurePa =
        densityM3 *
        mp *
        speedMs ** 2;

    // Pa -> nPa
    return pressurePa * 1e9;
}


/*
    PLASMA BETA

    β = P_th / P_B

    Dimensionless.
*/

function calculatePlasmaBeta(
    thermalPressureNpa,
    magneticPressureNpa
) {
    const thermalPressure =
        Number(thermalPressureNpa);

    const magneticPressure =
        Number(magneticPressureNpa);

    if (
        !Number.isFinite(thermalPressure) ||
        !Number.isFinite(magneticPressure) ||
        magneticPressure <= 0
    ) {
        return NaN;
    }

    return (
        thermalPressure /
        magneticPressure
    );
}


/* =========================
   UPDATE PLASMA
========================= */

async function updatePlasma() {
    const [windData, magneticData] =
        await Promise.all([
            fetchJSON(API.wind),
            fetchJSON(API.magnetic)
        ]);

    const wind =
        newestRecord(windData);

    const magnetic =
        newestRecord(magneticData);

    if (!wind) {
        throw new Error(
            "No solar-wind data for plasma calculation."
        );
    }

    if (!magnetic) {
        throw new Error(
            "No magnetic data for plasma calculation."
        );
    }

    const density =
        Number(wind.proton_density);

    const temperature =
        Number(wind.proton_temperature);

    const speed =
        Number(wind.proton_speed);

    const bt =
        Number(magnetic.bt);


    /* =========================
       CALCULATE PRESSURES
    ========================= */

    const thermalPressure =
        calculateThermalPressure(
            density,
            temperature
        );

    const magneticPressure =
        calculateMagneticPressure(
            bt
        );

    const dynamicPressure =
        calculateDynamicPressure(
            density,
            speed
        );

    const plasmaBeta =
        calculatePlasmaBeta(
            thermalPressure,
            magneticPressure
        );


    /* =========================
       DISPLAY VALUES
    ========================= */

    setText(
        "thermal-pressure",
        formatNumber(
            thermalPressure,
            2
        )
    );

    setText(
        "magnetic-pressure",
        formatNumber(
            magneticPressure,
            2
        )
    );

    setText(
        "dynamic-pressure",
        formatNumber(
            dynamicPressure,
            2
        )
    );

    setText(
        "plasma-beta",
        formatNumber(
            plasmaBeta,
            2
        )
    );


    /* =========================
       DISPLAY STATUS
    ========================= */

    setText(
        "thermal-pressure-status",
        Number.isFinite(thermalPressure)
            ? "Calculated"
            : "--"
    );

    setText(
        "magnetic-pressure-status",
        Number.isFinite(magneticPressure)
            ? "Calculated"
            : "--"
    );

    setText(
        "dynamic-pressure-status",
        Number.isFinite(dynamicPressure)
            ? "Calculated"
            : "--"
    );

    setText(
        "plasma-beta-status",
        Number.isFinite(plasmaBeta)
            ? "Calculated"
            : "--"
    );


    /* =========================
       MEASUREMENT TIMES
    ========================= */

    setText(
        "thermal-pressure-time",
        formatMeasurementTime(
            wind.time_tag
        )
    );

    setText(
        "dynamic-pressure-time",
        formatMeasurementTime(
            wind.time_tag
        )
    );

    setText(
        "magnetic-pressure-time",
        formatMeasurementTime(
            magnetic.time_tag
        )
    );

    /*
        Plasma beta depends on both
        thermal pressure and magnetic pressure.

        Therefore use the later of the
        two source measurements.
    */

    const windDate =
        new Date(wind.time_tag);

    const magneticDate =
        new Date(magnetic.time_tag);

    const betaDate =
        windDate >= magneticDate
            ? windDate
            : magneticDate;

    setText(
        "plasma-beta-time",
        formatMeasurementTime(
            betaDate.toISOString()
        )
    );


    return {
        windTime: wind.time_tag,
        magneticTime: magnetic.time_tag
    };
}


/* =========================
   KP
========================= */

async function updateKp() {
    const data =
        await fetchJSON(API.kp);

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
        throw new Error(
            "No valid Kp data."
        );
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

async function updateDst() {
    const data =
        await fetchJSON(API.dst);

    if (!Array.isArray(data)) {
        throw new Error("No Dst data.");
    }

    const rows = data
        .filter(
            row =>
                row &&
                row.time_tag &&
                row.dst !== undefined
        )
        .sort(
            (a, b) =>
                new Date(b.time_tag).getTime() -
                new Date(a.time_tag).getTime()
        );

    const latest = rows[0];

    if (!latest) {
        throw new Error(
            "No valid Dst data."
        );
    }

    const dst =
        Number(latest.dst);

    setText(
        "dst",
        formatNumber(dst, 0)
    );

    if (Number.isFinite(dst)) {
        if (dst > -30) {
            setText(
                "dst-status",
                "Quiet"
            );
        } else if (dst > -50) {
            setText(
                "dst-status",
                "Disturbed"
            );
        } else if (dst > -100) {
            setText(
                "dst-status",
                "Storm"
            );
        } else {
            setText(
                "dst-status",
                "Strong storm"
            );
        }
    } else {
        setText(
            "dst-status",
            "--"
        );
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
    setConnection(
        false,
        "Updating..."
    );

    hideError();

    const refreshTime =
        new Date();

    const results =
        await Promise.allSettled([
            updateSolarWind(),
            updateMagneticField(),
            updatePlasma(),
            updateKp(),
            updateDst()
        ]);

    const failures =
        results.filter(
            result =>
                result.status ===
                "rejected"
        );

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
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        start
    );
} else {
    start();
}

