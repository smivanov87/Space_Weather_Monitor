"use strict";

/*
 * ============================================================
 * NOAA SPACE WEATHER DATA
 * ============================================================
 */

const NOAA = {
    magnetic:
        "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json",

    kp:
        "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json",

    solarWind:
        "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json"
};

let kpChart = null;


/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


function setStatus(message, error = false) {
    const element = document.getElementById("status");

    if (!element) {
        return;
    }

    element.textContent = message;

    element.className =
        error
            ? "status error"
            : "status";
}


function showDiagnostic(data) {
    const element =
        document.getElementById("diagnostic");

    if (!element) {
        return;
    }

    try {
        element.textContent =
            JSON.stringify(data, null, 2);
    } catch {
        element.textContent = String(data);
    }
}


/*
 * ============================================================
 * FETCH JSON
 * ============================================================
 */

async function getJSON(url) {

    const separator =
        url.includes("?")
            ? "&"
            : "?";

    const response =
        await fetch(
            url +
            separator +
            "_=" +
            Date.now(),
            {
                method: "GET",
                cache: "no-store",
                headers: {
                    "Accept": "application/json"
                }
            }
        );

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status} ${response.statusText}`
        );
    }

    const text =
        await response.text();

    if (!text.trim()) {
        throw new Error(
            "NOAA returned an empty response"
        );
    }

    try {
        return JSON.parse(text);
    } catch {
        throw new Error(
            "NOAA returned invalid JSON"
        );
    }
}


/*
 * ============================================================
 * FIND COLUMN
 * ============================================================
 */

function findColumn(headers, names) {

    if (!Array.isArray(headers)) {
        return -1;
    }

    const wanted =
        names.map(
            name =>
                String(name)
                    .toLowerCase()
                    .trim()
        );

    for (
        let i = 0;
        i < headers.length;
        i++
    ) {

        const header =
            String(headers[i])
                .toLowerCase()
                .trim();

        if (wanted.includes(header)) {
            return i;
        }
    }

    return -1;
}


/*
 * ============================================================
 * CONVERT VALUE TO NUMBER
 * ============================================================
 */

function numberValue(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return NaN;
    }

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : NaN;
}


/*
 * ============================================================
 * MAGNETIC FIELD
 * ============================================================
 */

async function loadMagnetic() {
    try {
        const data = await getJSON(NOAA.magnetic);

        console.log("NOAA magnetic data:", data);

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("NOAA magnetic data is empty");
        }

        /*
         * NOAA rtsw_mag_1m.json returns objects like:
         *
         * {
         *   time_tag: "...",
         *   bx_gsm: ...,
         *   by_gsm: ...,
         *   bz_gsm: ...,
         *   bt: ...
         * }
         *
         * It does NOT return a header row.
         */

        let latest = null;

        for (let i = data.length - 1; i >= 0; i--) {
            const row = data[i];

            if (!row || typeof row !== "object") {
                continue;
            }

            const by = Number(row.by_gsm);
            const bz = Number(row.bz_gsm);
            const bt = Number(row.bt);

            if (
                Number.isFinite(by) ||
                Number.isFinite(bz) ||
                Number.isFinite(bt)
            ) {
                latest = {
                    by,
                    bz,
                    bt,
                    bx: Number(row.bx_gsm),
                    time: row.time_tag
                };

                break;
            }
        }

        if (!latest) {
            throw new Error("No valid magnetic row found");
        }

        console.log("Latest magnetic measurement:", latest);

        /*
         * BY
         */
        setText(
            "by",
            Number.isFinite(latest.by)
                ? latest.by.toFixed(1)
                : "--"
        );

        /*
         * BZ
         */
        setText(
            "bz",
            Number.isFinite(latest.bz)
                ? latest.bz.toFixed(1)
                : "--"
        );

        /*
         * BT
         */
        setText(
            "bt",
            Number.isFinite(latest.bt)
                ? latest.bt.toFixed(1)
                : "--"
        );

        /*
         * IMF clock angle.
         *
         * atan2(By, Bz)
         *
         * Result is converted to 0–360 degrees.
         */
        if (
            Number.isFinite(latest.by) &&
            Number.isFinite(latest.bz)
        ) {
            let angle =
                Math.atan2(
                    latest.by,
                    latest.bz
                ) * 180 / Math.PI;

            if (angle < 0) {
                angle += 360;
            }

            setText(
                "angle",
                angle.toFixed(1)
            );

            const needle =
                document.getElementById("needle");

            if (needle) {
                needle.style.transform =
                    `translate(-50%, -100%) rotate(${angle}deg)`;
            }
        } else {
            setText("angle", "--");
        }

        /*
         * Timestamp
         */
        if (latest.time) {
            const date =
                new Date(latest.time);

            if (!Number.isNaN(date.getTime())) {
                setText(
                    "magTime",
                    date.toUTCString()
                );
            }
        }

        return true;

    } catch (error) {
        console.error(
            "NOAA magnetic data error:",
            error
        );

        setStatus(
            "NOAA magnetic data error: " +
            error.message,
            true
        );

        return false;
    }
}

/*
 * ============================================================
 * SOLAR WIND SPEED
 * ============================================================
 */

async function loadSolarWind() {

    try {

        const data =
            await getJSON(
                NOAA.solarWind
            );

        console.log(
            "NOAA solar wind:",
            data
        );

        let record = null;

        /*
         * NOAA summary endpoint normally
         * returns an object, but accept an
         * array too.
         */

        if (Array.isArray(data)) {
            record = data[0];
        } else {
            record = data;
        }

        if (!record) {
            throw new Error(
                "Solar wind response is empty"
            );
        }

        const speed =
            numberValue(
                record.proton_speed
            );

        if (
            Number.isFinite(speed)
        ) {

            setText(
                "speed",
                speed.toFixed(0)
            );

        } else {

            setText(
                "speed",
                "--"
            );
        }

        return true;

    } catch (error) {

        console.error(
            "Solar wind error:",
            error
        );

        setText(
            "speed",
            "--"
        );

        return false;
    }
}


/*
 * ============================================================
 * KP INDEX
 * ============================================================
 */

async function loadKp() {

    try {

        const data =
            await getJSON(
                NOAA.kp
            );

        console.log(
            "NOAA Kp data:",
            data
        );

        if (
            !Array.isArray(data) ||
            data.length < 2
        ) {
            throw new Error(
                "NOAA Kp data is empty"
            );
        }

        const headers =
            data[0];

        const kpIndex =
            findColumn(
                headers,
                [
                    "kp",
                    "kp_index"
                ]
            );

        const timeIndex =
            findColumn(
                headers,
                [
                    "time_tag",
                    "time",
                    "timestamp"
                ]
            );

        if (kpIndex < 0) {

            throw new Error(
                "Kp column not found"
            );
        }

        const records = [];

        for (
            let i = 1;
            i < data.length;
            i++
        ) {

            const row =
                data[i];

            if (!Array.isArray(row)) {
                continue;
            }

            const kp =
                numberValue(
                    row[kpIndex]
                );

            if (
                Number.isFinite(kp)
            ) {

                records.push({
                    kp,
                    time:
                        timeIndex >= 0
                            ? row[timeIndex]
                            : null
                });
            }
        }

        if (
            records.length === 0
        ) {

            throw new Error(
                "No Kp measurements found"
            );
        }

        const latest =
            records[
                records.length - 1
            ];

        setText(
            "kp",
            latest.kp.toFixed(1)
        );

        if (latest.time) {

            const date =
                new Date(
                    latest.time
                );

            if (
                !Number.isNaN(
                    date.getTime()
                )
            ) {

                setText(
                    "kpTime",
                    date.toUTCString()
                );
            }
        }

        /*
         * Last 40 measurements
         */

        const recent =
            records.slice(-40);

        const labels =
            recent.map(
                record => {

                    if (!record.time) {
                        return "";
                    }

                    const date =
                        new Date(
                            record.time
                        );

                    if (
                        Number.isNaN(
                            date.getTime()
                        )
                    ) {
                        return "";
                    }

                    return date.toLocaleTimeString(
                        "en-GB",
                        {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "UTC"
                        }
                    );
                }
            );

        const values =
            recent.map(
                record =>
                    record.kp
            );

        createKpChart(
            labels,
            values
        );

        return true;

    } catch (error) {

        console.error(
            "Kp error:",
            error
        );

        setText(
            "kp",
            "--"
        );

        return false;
    }
}


/*
 * ============================================================
 * KP CHART
 * ============================================================
 */

function createKpChart(
    labels,
    values
) {

    const canvas =
        document.getElementById(
            "kpChart"
        );

    if (
        !canvas ||
        typeof Chart === "undefined"
    ) {
        return;
    }

    if (kpChart) {
        kpChart.destroy();
    }

    kpChart =
        new Chart(
            canvas,
            {
                type: "line",

                data: {
                    labels,

                    datasets: [
                        {
                            label: "Kp",
                            data: values,

                            borderColor:
                                "#4bbcff",

                            backgroundColor:
                                "rgba(75,188,255,0.12)",

                            borderWidth: 2,

                            pointRadius: 3,

                            pointBackgroundColor:
                                "#4bbcff",

                            tension: 0.25,

                            fill: true
                        }
                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    animation: false,

                    scales: {

                        y: {
                            min: 0,
                            max: 9,

                            ticks: {
                                color: "#71839c",
                                stepSize: 1
                            },

                            grid: {
                                color:
                                    "rgba(120,150,190,.1)"
                            }
                        },

                        x: {

                            ticks: {
                                color:
                                    "#71839c"
                            },

                            grid: {
                                color:
                                    "rgba(120,150,190,.05)"
                            }
                        }
                    },

                    plugins: {

                        legend: {

                            labels: {
                                color:
                                    "#9aabc2"
                            }
                        }
                    }
                }
            }
        );
}


/*
 * ============================================================
 * UPDATE EVERYTHING
 * ============================================================
 */

async function updateAll() {

    setStatus(
        "Connecting to NOAA SWPC..."
    );

    console.log(
        "Updating NOAA data..."
    );

    const results =
        await Promise.allSettled([
            loadMagnetic(),
            loadSolarWind(),
            loadKp()
        ]);

    const successful =
        results.filter(
            result =>
                result.status === "fulfilled" &&
                result.value === true
        ).length;

    console.log(
        `NOAA update complete: ${successful}/3 sources`,
        new Date().toISOString()
    );

    if (successful === 3) {

        setStatus(
            "✓ NOAA live data connected"
        );

    } else if (successful > 0) {

        setStatus(
            `NOAA connected — ${successful}/3 data sources available`
        );

    } else {

        setStatus(
            "Unable to retrieve NOAA data. Check the browser console.",
            true
        );
    }
}


/*
 * ============================================================
 * START
 * ============================================================
 */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        updateAll();

        /*
         * Refresh every minute.
         */

        setInterval(
            updateAll,
            60 * 1000
        );
    }
);
