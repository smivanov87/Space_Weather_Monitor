"use strict";

/*

============================================================
SPACE WEATHER MONITOR
Sources:
NOAA SWPC:
Solar wind:
https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json
IMF:
https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json
WDC Kyoto HAPI:
https://wdc.kugi.kyoto-u.ac.jp/hapi/
SMR:
Requires a SuperMAG API key.
============================================================
*/
/* ============================================================
CONFIGURATION
============================================================ */
const CONFIG = {

refreshMilliseconds: 60 * 1000,

defaultHistoryHours: 6,

maxNoaaPoints: 5000,

/*
 * Put your SuperMAG API key here if you have one.
 *
 * Example:
 *
 * smrApiKey: "YOUR_KEY_HERE"
 *
 * Leave empty to keep SMR disabled.
 */
smrApiKey: "",

noaa: {

    wind:
        "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json",

    magnetic:
        "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json",

    kp:
        "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json"
},

hapi: {

    base:
        "https://wdc.kugi.kyoto-u.ac.jp/hapi",

    dst:
        "hour_dst",

    ae:
        "min_ae",

    symh:
        "min_asysym",

    kp:
        "hour3h_kp"
}

};
/* ============================================================
APPLICATION STATE
============================================================ */

const state = {

historyHours:
    CONFIG.defaultHistoryHours,

wind: [],
magnetic: [],

kp: [],
dst: [],
ae: [],
symh: [],
smr: [],

latest: {},

charts: {}

};
/* ============================================================
DOM HELPERS
============================================================ */

function byId(id) {

return document.getElementById(id);

}
function setText(id, value) {

const element = byId(id);

if (element) {
    element.textContent = value;
}

}
function setStatus(message, error = false) {

const status =
    byId("status");

const dot =
    byId("statusDot");

if (status) {
    status.textContent =
        message;
}

if (dot) {
    dot.classList.toggle(
        "error",
        error
    );
}

}
/* ============================================================
FETCH
============================================================ */

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
            cache: "no-store"
        }
    );

if (!response.ok) {

    throw new Error(
        `HTTP ${response.status}`
    );
}

return response.json();

}
/* ============================================================
GENERAL HELPERS
============================================================ */

function number(value) {

const n =
    Number(value);

return Number.isFinite(n)
    ? n
    : null;

}
function parseTime(value) {

if (!value) {
    return null;
}

const date =
    new Date(value);

return Number.isNaN(
    date.getTime()
)
    ? null
    : date;

}
function formatNumber(
value,
decimals = 1
) {

const n =
    number(value);

if (n === null) {
    return "--";
}

return n.toFixed(decimals);

}
function formatUTC(value) {

const date =
    value instanceof Date
        ? value
        : parseTime(value);

if (!date) {
    return "--";
}

return date.toISOString()
    .replace("T", " ")
    .replace(".000Z", " UTC");

}
function findColumn(
header,
names
) {

if (!Array.isArray(header)) {
    return -1;
}

const wanted =
    names.map(
        item =>
            String(item)
                .toLowerCase()
                .trim()
    );

for (
    let i = 0;
    i < header.length;
    i++
) {

    const name =
        String(header[i])
            .toLowerCase()
            .trim();

    if (
        wanted.includes(name)
    ) {
        return i;
    }
}

return -1;

}
function findColumnContains(
header,
words
) {

if (!Array.isArray(header)) {
    return -1;
}

for (
    let i = 0;
    i < header.length;
    i++
) {

    const name =
        String(header[i])
            .toLowerCase()
            .trim();

    if (
        words.some(
            word =>
                name.includes(
                    word
                )
        )
    ) {
        return i;
    }
}

return -1;

}
/* ============================================================
NOAA TABLE PARSER
============================================================ */

function parseNoaaTable(
data
) {

if (
    !Array.isArray(data) ||
    data.length < 2 ||
    !Array.isArray(data[0])
) {

    throw new Error(
        "Invalid NOAA table"
    );
}

const header =
    data[0];

const rows = [];

for (
    let i = 1;
    i < data.length;
    i++
) {

    if (
        !Array.isArray(data[i])
    ) {
        continue;
    }

    rows.push(
        data[i]
    );
}

return {
    header,
    rows
};

}
/* ============================================================
SOLAR WIND
============================================================ */

async function loadSolarWind() {

const data =
    await getJSON(
        CONFIG.noaa.wind
    );

const table =
    parseNoaaTable(data);

const timeIndex =
    findColumn(
        table.header,
        [
            "time_tag",
            "time",
            "timestamp"
        ]
    );

const speedIndex =
    findColumn(
        table.header,
        [
            "proton_speed",
            "speed"
        ]
    );

const temperatureIndex =
    findColumn(
        table.header,
        [
            "proton_temperature",
            "temperature"
        ]
    );

const densityIndex =
    findColumn(
        table.header,
        [
            "proton_density",
            "density"
        ]
    );

const records = [];

for (
    const row of table.rows
) {

    const time =
        parseTime(
            row[timeIndex]
        );

    if (!time) {
        continue;
    }

    records.push({

        time,

        speed:
            number(
                row[speedIndex]
            ),

        temperature:
            number(
                row[temperatureIndex]
            ),

        density:
            number(
                row[densityIndex]
            )
    });
}

state.wind =
    records
        .filter(
            row =>
                row.speed !== null ||
                row.temperature !== null ||
                row.density !== null
        )
        .slice(
            -CONFIG.maxNoaaPoints
        );

const latest =
    state.wind[
        state.wind.length - 1
    ];

if (latest) {

    state.latest.speed =
        latest.speed;

    state.latest.temperature =
        latest.temperature;

    state.latest.density =
        latest.density;

    setText(
        "speed",
        formatNumber(
            latest.speed,
            0
        )
    );

    setText(
        "temperature",
        latest.temperature === null
            ? "--"
            : Math.round(
                latest.temperature
            ).toLocaleString()
    );

    setText(
        "density",
        formatNumber(
            latest.density,
            2
        )
    );

    setText(
        "speedTime",
        formatUTC(
            latest.time
        )
    );

    setText(
        "temperatureTime",
        formatUTC(
            latest.time
        )
    );

    setText(
        "densityTime",
        formatUTC(
            latest.time
        )
    );
}

updateSolarWindChart();

}
/* ============================================================
IMF
============================================================ */

async function loadMagnetic() {

const data =
    await getJSON(
        CONFIG.noaa.magnetic
    );

const table =
    parseNoaaTable(data);

const timeIndex =
    findColumn(
        table.header,
        [
            "time_tag",
            "time",
            "timestamp"
        ]
    );

const bxIndex =
    findColumn(
        table.header,
        [
            "bx_gsm",
            "bx",
            "b_x"
        ]
    );

const byIndex =
    findColumn(
        table.header,
        [
            "by_gsm",
            "by",
            "b_y"
        ]
    );

const bzIndex =
    findColumn(
        table.header,
        [
            "bz_gsm",
            "bz",
            "b_z"
        ]
    );

const btIndex =
    findColumn(
        table.header,
        [
            "bt",
            "bt_gsm",
            "b_t"
        ]
    );

const records = [];

for (
    const row of table.rows
) {

    const time =
        parseTime(
            row[timeIndex]
        );

    if (!time) {
        continue;
    }

    records.push({

        time,

        bx:
            number(
                row[bxIndex]
            ),

        by:
            number(
                row[byIndex]
            ),

        bz:
            number(
                row[bzIndex]
            ),

        bt:
            number(
                row[btIndex]
            )
    });
}

state.magnetic =
    records
        .filter(
            row =>
                row.bx !== null ||
                row.by !== null ||
                row.bz !== null ||
                row.bt !== null
        )
        .slice(
            -CONFIG.maxNoaaPoints
        );

const latest =
    state.magnetic[
        state.magnetic.length - 1
    ];

if (latest) {

    state.latest.bx =
        latest.bx;

    state.latest.by =
        latest.by;

    state.latest.bz =
        latest.bz;

    state.latest.bt =
        latest.bt;

    setText(
        "bx",
        formatNumber(
            latest.bx,
            1
        )
    );

    setText(
        "by",
        formatNumber(
            latest.by,
            1
        )
    );

    setText(
        "bz",
        formatNumber(
            latest.bz,
            1
        )
    );

    setText(
        "bt",
        formatNumber(
            latest.bt,
            1
        )
    );

    updateClockAngle(
        latest.by,
        latest.bz
    );
}

updateImfChart();

}
/* ============================================================
CLOCK ANGLE
============================================================ */

function updateClockAngle(
by,
bz
) {

if (
    !Number.isFinite(by) ||
    !Number.isFinite(bz)
) {

    setText(
        "clockAngle",
        "--"
    );

    setText(
        "clockAngleLarge",
        "--"
    );

    return;
}

/*
 * Clock angle is measured from +Bz
 * toward +By.
 *
 * Result is normalized to 0–360°.
 */

let angle =
    Math.atan2(
        by,
        bz
    ) *
    180 /
    Math.PI;

if (angle < 0) {
    angle += 360;
}

angle =
    angle % 360;

setText(
    "clockAngle",
    angle.toFixed(1)
);

setText(
    "clockAngleLarge",
    angle.toFixed(1)
);

const needle =
    byId("clockNeedle");

if (needle) {

    needle.style.transform =
        `rotate(${angle}deg)`;
}

}
/* ============================================================
HAPI
============================================================ */

async function hapiData(
dataset,
start,
stop
) {

const url =
    new URL(
        CONFIG.hapi.base +
        "/data"
    );

url.searchParams.set(
    "id",
    dataset
);

url.searchParams.set(
    "time.min",
    start.toISOString()
);

url.searchParams.set(
    "time.max",
    stop.toISOString()
);

url.searchParams.set(
    "format",
    "json"
);

return getJSON(
    url.toString()
);

}
/* ============================================================
HAPI DATA NORMALIZATION
============================================================ */

function hapiRows(
response
) {

if (
    !response ||
    !Array.isArray(
        response.data
    )
) {

    return [];
}

const parameters =
    Array.isArray(
        response.parameters
    )
        ? response.parameters
        : [];

const names =
    parameters.map(
        p => p.name
    );

const timeIndex =
    names.findIndex(
        name =>
            String(name)
                .toLowerCase()
                === "time"
    );

const rows = [];

for (
    const row of response.data
) {

    if (
        !Array.isArray(row)
    ) {
        continue;
    }

    const time =
        parseTime(
            row[
                timeIndex >= 0
                    ? timeIndex
                    : 0
            ]
        );

    if (!time) {
        continue;
    }

    rows.push({
        time,
        row,
        names
    });
}

return rows;

}
function hapiValue(
record,
preferredNames
) {

const wanted =
    preferredNames.map(
        name =>
            String(name)
                .toLowerCase()
    );

for (
    let i = 0;
    i < record.names.length;
    i++
) {

    const name =
        String(
            record.names[i]
        )
            .toLowerCase();

    if (
        wanted.includes(name)
    ) {

        return number(
            record.row[i]
        );
    }
}

return null;

}
/* ============================================================
LOAD Dst
============================================================ */

async function loadDst(
start,
stop
) {

const response =
    await hapiData(
        CONFIG.hapi.dst,
        start,
        stop
    );

const rows =
    hapiRows(response);

state.dst =
    rows.map(
        record => ({

            time:
                record.time,

            value:
                hapiValue(
                    record,
                    [
                        "dstValue",
                        "dst"
                    ]
                )
        })
    )
    .filter(
        row =>
            row.value !== null
    );

const latest =
    state.dst[
        state.dst.length - 1
    ];

if (latest) {

    setText(
        "dst",
        formatNumber(
            latest.value,
            0
        )
    );

    setText(
        "dstTime",
        formatUTC(
            latest.time
        )
    );
}

updateSingleChart(
    "dstChart",
    "Dst",
    state.dst,
    "#ff6b6b",
    {
        min: -300
    }
);

}
/* ============================================================
LOAD AE
============================================================ */

async function loadAe(
start,
stop
) {

const response =
    await hapiData(
        CONFIG.hapi.ae,
        start,
        stop
    );

const rows =
    hapiRows(response);

state.ae =
    rows.map(
        record => ({

            time:
                record.time,

            value:
                hapiValue(
                    record,
                    [
                        "ae",
                        "aeValue"
                    ]
                )
        })
    )
    .filter(
        row =>
            row.value !== null
    );

const latest =
    state.ae[
        state.ae.length - 1
    ];

if (latest) {

    setText(
        "ae",
        formatNumber(
            latest.value,
            0
        )
    );

    setText(
        "aeTime",
        formatUTC(
            latest.time
        )
    );
}

updateSingleChart(
    "aeChart",
    "AE",
    state.ae,
    "#ffd166",
    {
        min: 0
    }
);

}
/* ============================================================
LOAD SYM-H
============================================================ */

async function loadSymh(
start,
stop
) {

const response =
    await hapiData(
        CONFIG.hapi.symh,
        start,
        stop
    );

const rows =
    hapiRows(response);

state.symh =
    rows.map(
        record => ({

            time:
                record.time,

            value:
                hapiValue(
                    record,
                    [
                        "symh",
                        "symhValue"
                    ]
                )
        })
    )
    .filter(
        row =>
            row.value !== null
    );

const latest =
    state.symh[
        state.symh.length - 1
    ];

if (latest) {

    setText(
        "symh",
        formatNumber(
            latest.value,
            0
        )
    );

    setText(
        "symhTime",
        formatUTC(
            latest.time
        )
    );
}

updateSingleChart(
    "symhChart",
    "SYM-H",
    state.symh,
    "#a78bfa",
    {
        min: -300
    }
);

}
/* ============================================================
LOAD Kp
============================================================ */

async function loadKp(
start,
stop
) {

/*
 * Use the NOAA 1-minute Kp feed first.
 * This preserves the existing source used
 * by your website.
 */

try {

    const data =
        await getJSON(
            CONFIG.noaa.kp
        );

    const table =
        parseNoaaTable(data);

    const timeIndex =
        findColumn(
            table.header,
            [
                "time_tag",
                "time"
            ]
        );

    const kpIndex =
        findColumn(
            table.header,
            [
                "kp_index",
                "kp"
            ]
        );

    const records = [];

    for (
        const row of table.rows
    ) {

        const time =
            parseTime(
                row[timeIndex]
            );

        const kp =
            number(
                row[kpIndex]
            );

        if (
            time &&
            kp !== null &&
            time >= start
        ) {

            records.push({
                time,
                value: kp
            });
        }
    }

    state.kp =
        records;

} catch (error) {

    console.warn(
        "NOAA Kp failed, trying HAPI",
        error
    );

    const response =
        await hapiData(
            CONFIG.hapi.kp,
            start,
            stop
        );

    const rows =
        hapiRows(response);

    state.kp =
        rows.map(
            record => ({

                time:
                    record.time,

                value:
                    hapiValue(
                        record,
                        [
                            "kp",
                            "kpIndex",
                            "kpValue"
                        ]
                    )
            })
        )
        .filter(
            row =>
                row.value !== null
        );
}

const latest =
    state.kp[
        state.kp.length - 1
    ];

if (latest) {

    setText(
        "kp",
        formatNumber(
            latest.value,
            1
        )
    );

    setText(
        "kpTime",
        formatUTC(
            latest.time
        )
    );
}

updateSingleChart(
    "kpChart",
    "Kp",
    state.kp,
    "#42b9ff",
    {
        min: 0,
        max: 9
    }
);

}
/* ============================================================
SMR
============================================================ */

async function loadSmr(
start,
stop
) {

/*
 * SuperMAG requires authentication.
 *
 * We deliberately do not fabricate SMR values.
 */

if (
    !CONFIG.smrApiKey
) {

    setText(
        "smr",
        "--"
    );

    const message =
        byId("smrMessage");

    if (message) {

        message.innerHTML =
            "SMR is ready in the dashboard, " +
            "but SuperMAG requires an API key. " +
            "Add your key to <code>CONFIG.smrApiKey</code> " +
            "in script.js.";
    }

    return;
}

/*
 * SuperMAG endpoint details can vary with the
 * account/API version. Keep this function isolated
 * so the rest of the dashboard does not depend on it.
 *
 * Replace this request with the endpoint supplied
 * with your SuperMAG API credentials.
 */

console.warn(
    "SMR API key supplied but the SuperMAG endpoint " +
    "has not been configured."
);

setText(
    "smr",
    "--"
);

}
/* ============================================================
CHART HELPERS
============================================================ */

function destroyChart(
id
) {

if (
    state.charts[id]
) {

    state.charts[id].destroy();

    delete state.charts[id];
}

}
function chartLabels(
records
) {

return records.map(
    record => {

        const date =
            record.time;

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

}
function chartData(
records
) {

return records.map(
    record =>
        record.value
);

}
function createLineChart(
id,
labels,
datasets,
options = {}
) {

const canvas =
    byId(id);

if (
    !canvas ||
    typeof Chart === "undefined"
) {
    return;
}

destroyChart(id);

state.charts[id] =
    new Chart(
        canvas,
        {
            type: "line",

            data: {
                labels,

                datasets
            },

            options: {

                responsive: true,

                maintainAspectRatio:
                    false,

                animation: false,

                interaction: {
                    mode: "index",
                    intersect: false
                },

                plugins: {

                    legend: {
                        labels: {
                            color:
                                "#8293ad"
                        }
                    },

                    tooltip: {
                        callbacks: {

                            title(items) {

                                if (
                                    !items.length
                                ) {
                                    return "";
                                }

                                return (
                                    items[0]
                                        .label +
                                    " UTC"
                                );
                            }
                        }
                    }
                },

                scales: {

                    x: {

                        ticks: {
                            color:
                                "#647894",

                            maxTicksLimit:
                                12
                        },

                        grid: {
                            color:
                                "rgba(120,150,190,.06)"
                        }
                    },

                    y: {

                        min:
                            options.min,

                        max:
                            options.max,

                        ticks: {
                            color:
                                "#71839c"
                        },

                        grid: {
                            color:
                                "rgba(120,150,190,.10)"
                        }
                    }
                }
            }
        }
    );

}
function updateSingleChart(
id,
label,
records,
color,
options = {}
) {

if (
    !records ||
    records.length === 0
) {
    return;
}

createLineChart(
    id,
    chartLabels(records),
    [
        {
            label,

            data:
                chartData(records),

            borderColor:
                color,

            backgroundColor:
                color.replace(
                    ")",
                    ", 0.10)"
                ),

            borderWidth: 2,

            pointRadius: 0,

            pointHoverRadius: 4,

            tension: 0.15,

            fill: true
        }
    ],
    options
);

}
/* ============================================================
SOLAR WIND CHART
============================================================ */

function updateSolarWindChart() {

const cutoff =
    Date.now() -
    CONFIG.historyHours *
    60 *
    60 *
    1000;

const records =
    state.wind.filter(
        row =>
            row.time.getTime() >=
            cutoff
    );

if (
    records.length === 0
) {
    return;
}

const labels =
    records.map(
        row =>
            row.time.toLocaleTimeString(
                "en-GB",
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC"
                }
            )
    );

createLineChart(
    "solarWindChart",
    labels,
    [
        {
            label: "Speed (km/s)",

            data:
                records.map(
                    row =>
                        row.speed
                ),

            borderColor:
                "#42f2a3",

            backgroundColor:
                "rgba(66,242,163,0.06)",

            borderWidth: 2,

            pointRadius: 0,

            tension: 0.15,

            yAxisID:
                "speed"
        },

        {
            label: "Temperature (K)",

            data:
                records.map(
                    row =>
                        row.temperature
                ),

            borderColor:
                "#ffd166",

            borderWidth: 1.5,

            pointRadius: 0,

            tension: 0.15,

            yAxisID:
                "temperature"
        },

        {
            label: "Density (cm⁻³)",

            data:
                records.map(
                    row =>
                        row.density
                ),

            borderColor:
                "#42b9ff",

            borderWidth: 1.5,

            pointRadius: 0,

            tension: 0.15,

            yAxisID:
                "density"
        }
    ]
);

}
/* ============================================================
IMF CHART
============================================================ */

function updateImfChart() {

const cutoff =
    Date.now() -
    CONFIG.historyHours *
    60 *
    60 *
    1000;

const records =
    state.magnetic.filter(
        row =>
            row.time.getTime() >=
            cutoff
    );

if (
    records.length === 0
) {
    return;
}

const labels =
    records.map(
        row =>
            row.time.toLocaleTimeString(
                "en-GB",
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC"
                }
            )
    );

createLineChart(
    "imfChart",
    labels,
    [
        {
            label: "Bx",

            data:
                records.map(
                    row =>
                        row.bx
                ),

            borderColor:
                "#a78bfa",

            borderWidth: 1.5,

            pointRadius: 0,

            tension: 0.15
        },

        {
            label: "By",

            data:
                records.map(
                    row =>
                        row.by
                ),

            borderColor:
                "#42b9ff",

            borderWidth: 1.5,

            pointRadius: 0,

            tension: 0.15
        },

        {
            label: "Bz",

            data:
                records.map(
                    row =>
                        row.bz
                ),

            borderColor:
                "#ff6b6b",

            borderWidth: 2,

            pointRadius: 0,

            tension: 0.15
        },

        {
            label: "Bt",

            data:
                records.map(
                    row =>
                        row.bt
                ),

            borderColor:
                "#42f2a3",

            borderWidth: 2,

            pointRadius: 0,

            tension: 0.15
        }
    ]
);

}
/* ============================================================
LOAD GEOMAGNETIC DATA
============================================================ */

async function loadGeomagnetic() {

const stop =
    new Date();

const start =
    new Date(
        stop.getTime() -
        CONFIG.historyHours *
        60 *
        60 *
        1000
    );

/*
 * Load independently.
 *
 * This means a failure in AE does not
 * prevent Dst, Kp or SYM-H from displaying.
 */

const results =
    await Promise.allSettled(
        [
            loadKp(
                start,
                stop
            ),

            loadDst(
                start,
                stop
            ),

            loadAe(
                start,
                stop
            ),

            loadSymh(
                start,
                stop
            ),

            loadSmr(
                start,
                stop
            )
        ]
    );

results.forEach(
    (result, index) => {

        if (
            result.status ===
            "rejected"
        ) {

            console.error(
                "Geomagnetic source failed:",
                index,
                result.reason
            );
        }
    }
);

}
/* ============================================================
RANGE BUTTONS
============================================================ */

function setupRangeButtons() {

document
    .querySelectorAll(
        ".range-button"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                async () => {

                    const hours =
                        Number(
                            button.dataset
                                .hours
                        );

                    if (
                        !Number.isFinite(
                            hours
                        )
                    ) {
                        return;
                    }

                    state.historyHours =
                        hours;

                    document
                        .querySelectorAll(
                            ".range-button"
                        )
                        .forEach(
                            item =>
                                item.classList
                                    .remove(
                                        "active"
                                    )
                        );

                    button.classList.add(
                        "active"
                    );

                    await loadGeomagnetic();

                    updateSolarWindChart();

                    updateImfChart();
                }
            );
        }
    );

}
/* ============================================================
UPDATE
============================================================ */

async function updateAll() {

setStatus(
    "Updating…"
);

const results =
    await Promise.allSettled(
        [
            loadSolarWind(),
            loadMagnetic(),
            loadGeomagnetic()
        ]
    );

const failures =
    results.filter(
        result =>
            result.status ===
            "rejected"
    );

if (
    failures.length === 0
) {

    setStatus(
        "Live data connected"
    );

} else {

    setStatus(
        `${failures.length} data source(s) unavailable`,
        true
    );
}

setText(
    "lastUpdate",
    formatUTC(
        new Date()
    )
);

}
/* ============================================================
START
============================================================ */

setupRangeButtons();

updateAll();

/* ============================================================
AUTOMATIC REFRESH
============================================================ */

setInterval(
updateAll,
CONFIG.refreshMilliseconds
);
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
