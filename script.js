/*
========================================================
 SPACE WEATHER PREDICTION
 REAL-TIME NOAA SWPC DATA
========================================================
*/


/*
========================================================
 NOAA DATA SOURCES
========================================================
*/

const NOAA_MAG_URL =
    "https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json";

const NOAA_SPEED_URL =
    "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json";

const NOAA_RTSW_MAG_URL =
    "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json";

const NOAA_KP_URL =
    "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";


/*
========================================================
 GLOBAL VARIABLES
========================================================
*/

let kpChart = null;


/*
========================================================
 HELPER: SET HTML VALUE
========================================================
*/

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


/*
========================================================
 HELPER: NUMBER CONVERSION
========================================================
*/

function toNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const number =
        Number(value);

    if (Number.isFinite(number)) {
        return number;
    }

    return null;
}


/*
========================================================
 HELPER: FETCH JSON
========================================================
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
                cache: "no-store"
            }
        );


    if (!response.ok) {

        throw new Error(
            "HTTP " +
            response.status +
            " " +
            response.statusText
        );
    }


    return await response.json();
}


/*
========================================================
 MAGNETIC FIELD
========================================================

Gets:

    Bz
    Bt
    timestamp

from NOAA's current summary endpoint.

NOAA currently returns:

[
    {
        "bt": 5,
        "bz_gsm": 0,
        "time_tag": "..."
    }
]

========================================================
*/

async function loadMagneticData() {

    console.log(
        "Loading NOAA magnetic data..."
    );


    let bz = null;
    let bt = null;
    let timeTag = null;


    /*
    ----------------------------------------------------
    CURRENT MAGNETIC SUMMARY
    ----------------------------------------------------
    */

    try {

        const data =
            await getJSON(
                NOAA_MAG_URL
            );


        console.log(
            "NOAA magnetic response:",
            data
        );


        /*
        IMPORTANT:

        NOAA returns an ARRAY.

        Therefore we use data[0].
        */

        const current =
            Array.isArray(data)
                ? data[0]
                : data;


        if (!current) {

            throw new Error(
                "NO magnetic data returned"
            );
        }


        /*
        BZ
        */

        bz =
            toNumber(
                current.bz_gsm
            );


        /*
        BT
        */

        bt =
            toNumber(
                current.bt
            );


        /*
        TIMESTAMP
        */

        timeTag =
            current.time_tag ||
            current.timestamp ||
            current.time ||
            null;


        console.log(
            "Current magnetic values:",
            {
                Bz: bz,
                Bt: bt,
                time: timeTag
            }
        );


    } catch (error) {

        console.error(
            "NOAA magnetic summary error:",
            error
        );
    }


    /*
    ----------------------------------------------------
    UPDATE BZ
    ----------------------------------------------------
    */

    if (bz !== null) {

        setText(
            "bz",
            bz.toFixed(1)
        );


        setText(
            "bz2",
            bz.toFixed(1)
        );
    }


    /*
    ----------------------------------------------------
    UPDATE BT
    ----------------------------------------------------
    */

    if (bt !== null) {

        setText(
            "bt",
            bt.toFixed(1)
        );
    }


    /*
    ----------------------------------------------------
    TIMESTAMP
    ----------------------------------------------------
    */

    if (timeTag) {

        const date =
            new Date(timeTag);


        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {

            setText(
                "lastUpdate",
                date.toUTCString()
            );
        }
    }


    /*
    ----------------------------------------------------
    GET BY SEPARATELY
    ----------------------------------------------------

    The summary endpoint does NOT provide By.

    We therefore try the RTSW magnetic feed.
    */

    await loadByData(
        bz
    );
}


/*
========================================================
 GET By FROM NOAA RTSW
========================================================
*/

async function loadByData(bz) {

    let by = null;


    try {

        const raw =
            await getJSON(
                NOAA_RTSW_MAG_URL
            );


        console.log(
            "NOAA RTSW magnetic response:",
            raw
        );


        /*
        RTSW normally returns an array where
        the first row contains column names.
        */

        if (
            Array.isArray(raw) &&
            raw.length >= 2
        ) {

            const headers =
                raw[0];


            const rows =
                raw.slice(1);


            console.log(
                "NOAA RTSW headers:",
                headers
            );


            /*
            Find By column.

            We check several possible names.
            */

            let byIndex = -1;


            for (
                let i = 0;
                i < headers.length;
                i++
            ) {

                const name =
                    String(
                        headers[i]
                    )
                    .toLowerCase()
                    .replace(
                        /[^a-z0-9]/g,
                        ""
                    );


                if (
                    name === "bygsm" ||
                    name === "by"
                ) {

                    byIndex = i;

                    break;
                }
            }


            console.log(
                "By column index:",
                byIndex
            );


            /*
            Search from newest to oldest.
            */

            if (
                byIndex >= 0
            ) {

                for (
                    let i =
                        rows.length - 1;
                    i >= 0;
                    i--
                ) {

                    const value =
                        toNumber(
                            rows[i][byIndex]
                        );


                    if (
                        value !== null
                    ) {

                        by = value;

                        break;
                    }
                }
            }
        }


    } catch (error) {

        console.warn(
            "NOAA By data unavailable:",
            error
        );
    }


    /*
    ----------------------------------------------------
    UPDATE BY
    ----------------------------------------------------
    */

    if (by !== null) {

        setText(
            "by",
            by.toFixed(1)
        );


        console.log(
            "By:",
            by
        );


        /*
        ------------------------------------------------
        IMF CLOCK ANGLE
        ------------------------------------------------

        atan2(By, Bz)

        0°   = north
        90°  = east
        180° = south
        270° = west
        */

        if (
            bz !== null
        ) {

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


            setText(
                "clockAngle",
                angle.toFixed(1)
            );


            /*
            Move clock needle if present.
            */

            const needle =
                document.getElementById(
                    "clockNeedle"
                );


            if (needle) {

                needle.style.transform =
                    "rotate(" +
                    angle +
                    "deg)";
            }
        }


    } else {

        /*
        Do NOT overwrite the rest of
        the magnetic data if By is missing.
        */

        console.warn(
            "NOAA By is currently unavailable"
        );
    }
}


/*
========================================================
 SOLAR WIND SPEED
========================================================

NOAA currently returns:

[
    {
        "proton_speed": 409,
        "time_tag": "..."
    }
]

========================================================
*/

async function loadSolarWindData() {

    console.log(
        "Loading NOAA solar-wind speed..."
    );


    try {

        const data =
            await getJSON(
                NOAA_SPEED_URL
            );


        console.log(
            "NOAA solar-wind response:",
            data
        );


        /*
        IMPORTANT:

        NOAA returns an ARRAY.
        */

        const current =
            Array.isArray(data)
                ? data[0]
                : data;


        if (!current) {

            throw new Error(
                "No solar-wind data returned"
            );
        }


        const speed =
            toNumber(
                current.proton_speed
            );


        /*
        ------------------------------------------------
        UPDATE SPEED
        ------------------------------------------------
        */

        if (speed !== null) {

            setText(
                "solarSpeed",
                speed.toFixed(0)
            );


            setText(
                "speed2",
                speed.toFixed(0)
            );
        }


        console.log(
            "Solar-wind speed:",
            speed,
            "km/s"
        );


    } catch (error) {

        console.error(
            "NOAA solar-wind error:",
            error
        );
    }
}


/*
========================================================
 KP INDEX
========================================================
*/

async function loadKpData() {

    console.log(
        "Loading NOAA Kp data..."
    );


    try {

        const raw =
            await getJSON(
                NOAA_KP_URL
            );


        if (
            !Array.isArray(raw) ||
            raw.length < 2
        ) {

            throw new Error(
                "Invalid NOAA Kp response"
            );
        }


        /*
        First row contains column names.
        */

        const headers =
            raw[0];


        const rows =
            raw.slice(1);


        /*
        Find time column.
        */

        let timeIndex = -1;


        for (
            let i = 0;
            i < headers.length;
            i++
        ) {

            const name =
                String(
                    headers[i]
                )
                .toLowerCase()
                .trim();


            if (
                name === "time_tag" ||
                name === "time" ||
                name === "timestamp"
            ) {

                timeIndex = i;

                break;
            }
        }


        /*
        Find Kp column.
        */

        let kpIndex = -1;


        for (
            let i = 0;
            i < headers.length;
            i++
        ) {

            const name =
                String(
                    headers[i]
                )
                .toLowerCase()
                .trim();


            if (
                name === "kp" ||
                name === "kp_index"
            ) {

                kpIndex = i;

                break;
            }
        }


        /*
        Fallback Kp search.
        */

        if (
            kpIndex < 0
        ) {

            kpIndex =
                headers.findIndex(
                    header =>
                        String(
                            header
                        )
                        .toLowerCase()
                        .includes("kp")
                );
        }


        console.log(
            "Kp columns:",
            {
                headers,
                timeIndex,
                kpIndex
            }
        );


        /*
        ------------------------------------------------
        BUILD VALID RECORDS
        ------------------------------------------------
        */

        const records = [];


        for (
            const row of rows
        ) {

            if (
                kpIndex < 0
            ) {
                continue;
            }


            const kp =
                toNumber(
                    row[kpIndex]
                );


            if (
                kp === null
            ) {
                continue;
            }


            records.push({

                kp: kp,

                time:
                    timeIndex >= 0
                        ? row[timeIndex]
                        : null

            });
        }


        if (
            records.length === 0
        ) {

            throw new Error(
                "No valid Kp data found"
            );
        }


        /*
        ------------------------------------------------
        CURRENT KP
        ------------------------------------------------
        */

        const latest =
            records[
                records.length - 1
            ];


        setText(
            "currentKp",
            latest.kp.toFixed(1)
        );


        /*
        ------------------------------------------------
        KP CHART
        ------------------------------------------------
        */

        const chartRecords =
            records.slice(-40);


        const labels =
            chartRecords.map(
                record => {

                    if (
                        !record.time
                    ) {
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
                            minute: "2-digit"
                        }
                    );
                }
            );


        const values =
            chartRecords.map(
                record =>
                    record.kp
            );


        drawKpChart(
            labels,
            values
        );


        console.log(
            "Current Kp:",
            latest.kp
        );


    } catch (error) {

        console.error(
            "NOAA Kp error:",
            error
        );
    }
}


/*
========================================================
 DRAW KP CHART
========================================================
*/

function drawKpChart(
    labels,
    values
) {

    const canvas =
        document.getElementById(
            "kpChart"
        );


    if (!canvas) {

        console.warn(
            "kpChart element not found"
        );

        return;
    }


    /*
    Chart.js may not be loaded.
    */

    if (
        typeof Chart ===
        "undefined"
    ) {

        console.warn(
            "Chart.js not loaded"
        );

        return;
    }


    /*
    Destroy previous chart.
    */

    if (kpChart) {

        kpChart.destroy();

        kpChart = null;
    }


    /*
    Create chart.
    */

    kpChart =
        new Chart(
            canvas,
            {

                type: "line",


                data: {

                    labels: labels,


                    datasets: [

                        {

                            label: "Kp",


                            data: values,


                            borderColor:
                                "#48b7ff",


                            backgroundColor:
                                "rgba(72,183,255,0.12)",


                            borderWidth: 2,


                            pointRadius: 2,


                            pointBackgroundColor:
                                "#48b7ff",


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

                                color:
                                    "#71829b"
                            },


                            grid: {

                                color:
                                    "rgba(120,150,190,0.1)"
                            }
                        },


                        x: {

                            ticks: {

                                color:
                                    "#71829b"
                            },


                            grid: {

                                color:
                                    "rgba(120,150,190,0.05)"
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
========================================================
 UPDATE EVERYTHING
========================================================
*/

async function updateSpaceWeather() {

    console.log(
        "======================================"
    );

    console.log(
        "REAL-TIME SPACE WEATHER UPDATE"
    );

    console.log(
        new Date().toISOString()
    );

    console.log(
        "======================================"
    );


    /*
    Run independently.

    If one NOAA feed fails, the other
    feeds continue working.
    */

    await Promise.allSettled([

        loadMagneticData(),

        loadSolarWindData(),

        loadKpData()

    ]);


    console.log(
        "UPDATE COMPLETE"
    );

    console.log(
        "Next update in 60 seconds."
    );
}


/*
========================================================
 INITIAL LOAD
========================================================
*/

updateSpaceWeather();


/*
========================================================
 AUTOMATIC UPDATE
========================================================

Update every 60 seconds.
========================================================
*/

setInterval(
    updateSpaceWeather,
    60 * 1000
);
