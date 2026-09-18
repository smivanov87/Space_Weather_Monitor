/*
========================================================
 SPACE WEATHER PREDICTION
 REAL-TIME NOAA SWPC DATA
========================================================
*/


/*
========================================================
 NOAA ENDPOINTS
========================================================
*/

/*
 Current magnetic-field summary.
 Provides:
   bt
   bz_gsm
   time_tag
*/
const MAG_SUMMARY_URL =
    "https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json";


/*
 Current solar-wind speed summary.
 Provides:
   proton_speed
   time_tag
*/
const WIND_SUMMARY_URL =
    "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json";


/*
 One-minute real-time solar-wind magnetic data.
 Used to obtain By.
*/
const MAG_RTSW_URL =
    "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json";


/*
 One-minute planetary Kp data.
*/
const KP_URL =
    "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";


/*
========================================================
 GLOBALS
========================================================
*/

let kpChart = null;


/*
========================================================
 BASIC HELPERS
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
Convert something to a number.

Returns null if it isn't a valid number.
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

    if (
        Number.isFinite(number)
    ) {
        return number;
    }

    return null;
}


/*
Fetch JSON without browser caching.
*/
async function fetchJSON(url) {

    const response =
        await fetch(
            url +
            (url.includes("?") ? "&" : "?") +
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
            " - " +
            response.statusText
        );
    }


    return await response.json();
}


/*
========================================================
 MAGNETIC FIELD
========================================================
*/

async function loadMagneticData() {

    console.log(
        "Loading NOAA magnetic data..."
    );


    let bz = null;
    let bt = null;
    let by = null;
    let magneticTime = null;


    /*
    ====================================================
    STEP 1
    CURRENT BZ / BT SUMMARY
    ====================================================
    */

    try {

        const data =
            await fetchJSON(
                MAG_SUMMARY_URL
            );


        console.log(
            "NOAA magnetic summary:",
            data
        );


        /*
        Current NOAA summary field names:
        bz_gsm
        bt
        */

        bz =
            toNumber(
                data.bz_gsm
            );


        bt =
            toNumber(
                data.bt
            );


        magneticTime =
            data.time_tag ||
            data.time ||
            data.timestamp ||
            null;


    } catch (error) {

        console.error(
            "Magnetic summary error:",
            error
        );
    }


    /*
    ====================================================
    STEP 2
    GET BY FROM RTSW
    ====================================================
    */

    try {

        const raw =
            await fetchJSON(
                MAG_RTSW_URL
            );


        console.log(
            "NOAA RTSW magnetic response:",
            raw
        );


        /*
        NOAA RTSW normally returns:

        [
            ["time_tag", "bx_gsm", "by_gsm",
             "bz_gsm", "bt", ...],

            ["...", "...", "...", "...", "..."]
        ]
        */


        if (
            Array.isArray(raw) &&
            raw.length >= 2
        ) {

            const headers =
                raw[0];


            const rows =
                raw.slice(1);


            /*
            Find columns dynamically.

            This avoids depending on the
            exact position of the columns.
            */

            let timeIndex = -1;
            let byIndex = -1;
            let bzIndex = -1;
            let btIndex = -1;


            headers.forEach(
                (header, index) => {

                    const name =
                        String(header)
                            .toLowerCase()
                            .trim();


                    /*
                    Time
                    */

                    if (
                        name === "time_tag" ||
                        name === "timestamp" ||
                        name === "time"
                    ) {

                        timeIndex =
                            index;
                    }


                    /*
                    By GSM
                    */

                    if (
                        name === "by_gsm" ||
                        name === "bygsm"
                    ) {

                        byIndex =
                            index;
                    }


                    /*
                    Bz GSM
                    */

                    if (
                        name === "bz_gsm" ||
                        name === "bzgsm"
                    ) {

                        bzIndex =
                            index;
                    }


                    /*
                    Bt
                    */

                    if (
                        name === "bt"
                    ) {

                        btIndex =
                            index;
                    }
                }
            );


            console.log(
                "RTSW columns:",
                {
                    headers,
                    timeIndex,
                    byIndex,
                    bzIndex,
                    btIndex
                }
            );


            /*
            Search backwards so that we get
            the newest valid measurement.
            */

            for (
                let i = rows.length - 1;
                i >= 0;
                i--
            ) {

                const row =
                    rows[i];


                /*
                BY
                */

                if (
                    by === null &&
                    byIndex >= 0
                ) {

                    const value =
                        toNumber(
                            row[byIndex]
                        );


                    if (
                        value !== null
                    ) {

                        by =
                            value;
                    }
                }


                /*
                BZ
                */

                if (
                    bz === null &&
                    bzIndex >= 0
                ) {

                    const value =
                        toNumber(
                            row[bzIndex]
                        );


                    if (
                        value !== null
                    ) {

                        bz =
                            value;
                    }
                }


                /*
                BT
                */

                if (
                    bt === null &&
                    btIndex >= 0
                ) {

                    const value =
                        toNumber(
                            row[btIndex]
                        );


                    if (
                        value !== null
                    ) {

                        bt =
                            value;
                    }
                }


                /*
                Timestamp
                */

                if (
                    magneticTime === null &&
                    timeIndex >= 0
                ) {

                    const value =
                        row[timeIndex];


                    if (value) {

                        magneticTime =
                            value;
                    }
                }


                /*
                Stop when all values
                have been found.
                */

                if (
                    by !== null &&
                    bz !== null &&
                    bt !== null
                ) {

                    break;
                }
            }
        }


    } catch (error) {

        console.error(
            "RTSW magnetic error:",
            error
        );
    }


    /*
    ====================================================
    UPDATE BY
    ====================================================
    */

    if (by !== null) {

        setText(
            "by",
            by.toFixed(1)
        );

    } else {

        console.warn(
            "NOAA By value unavailable"
        );
    }


    /*
    ====================================================
    UPDATE BZ
    ====================================================
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

    } else {

        console.warn(
            "NOAA Bz value unavailable"
        );
    }


    /*
    ====================================================
    UPDATE BT
    ====================================================
    */

    if (bt !== null) {

        setText(
            "bt",
            bt.toFixed(1)
        );

    } else {

        console.warn(
            "NOAA Bt value unavailable"
        );
    }


    /*
    ====================================================
    IMF CLOCK ANGLE
    ====================================================

    GSM clock angle:

        atan2(By, Bz)

    0°   = north
    90°  = east
    180° = south
    270° = west
    */

    if (
        by !== null &&
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
        Move the visual clock needle
        if the element exists.
        */

        const needle =
            document.getElementById(
                "clockNeedle"
            );


        if (needle) {

            needle.style.transform =
                `rotate(${angle}deg)`;
        }
    }


    /*
    ====================================================
    LAST UPDATE
    ====================================================
    */

    if (magneticTime) {

        const date =
            new Date(
                magneticTime
            );


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
    ====================================================
    LOG RESULT
    ====================================================
    */

    console.log(
        "MAGNETIC DATA RESULT:",
        {
            By: by,
            Bz: bz,
            Bt: bt,
            time: magneticTime
        }
    );
}


/*
========================================================
 SOLAR-WIND SPEED
========================================================
*/

async function loadSolarWindData() {

    console.log(
        "Loading NOAA solar-wind speed..."
    );


    try {

        const data =
            await fetchJSON(
                WIND_SUMMARY_URL
            );


        console.log(
            "NOAA solar-wind summary:",
            data
        );


        /*
        Current NOAA field:

        proton_speed
        */

        const speed =
            toNumber(
                data.proton_speed
            );


        if (speed !== null) {

            /*
            Main solar-wind speed display
            */

            setText(
                "solarSpeed",
                speed.toFixed(0)
            );


            /*
            Detailed speed display
            */

            setText(
                "speed2",
                speed.toFixed(0)
            );
        }


        console.log(
            "SOLAR WIND SPEED:",
            speed,
            "km/s"
        );


    } catch (error) {

        console.error(
            "Solar-wind speed error:",
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
        "Loading NOAA Kp..."
    );


    try {

        const raw =
            await fetchJSON(
                KP_URL
            );


        /*
        NOAA Kp data is an array:

        [
          ["time_tag", "Kp"],
          [...]
        ]

        Some versions use kp_index.
        */


        if (
            !Array.isArray(raw) ||
            raw.length < 2
        ) {

            throw new Error(
                "Invalid Kp response"
            );
        }


        const headers =
            raw[0];


        const rows =
            raw.slice(1);


        /*
        Locate the Kp column.
        */

        let kpIndex = -1;
        let timeIndex = -1;


        headers.forEach(
            (header, index) => {

                const name =
                    String(header)
                        .toLowerCase()
                        .trim();


                if (
                    name === "kp" ||
                    name === "kp_index"
                ) {

                    kpIndex =
                        index;
                }


                if (
                    name === "time_tag" ||
                    name === "timestamp" ||
                    name === "time"
                ) {

                    timeIndex =
                        index;
                }
            }
        );


        /*
        Fallback:
        if NOAA doesn't explicitly name
        the Kp column, search common names.
        */

        if (
            kpIndex < 0
        ) {

            kpIndex =
                headers.findIndex(
                    header =>
                        String(header)
                            .toLowerCase()
                            .includes("kp")
                );
        }


        console.log(
            "Kp columns:",
            {
                headers,
                kpIndex,
                timeIndex
            }
        );


        /*
        Build valid Kp records.
        */

        const validRecords =
            [];


        for (
            const row of rows
        ) {

            const value =
                kpIndex >= 0
                    ? toNumber(
                        row[kpIndex]
                    )
                    : null;


            if (
                value !== null
            ) {

                validRecords.push({
                    value,
                    time:
                        timeIndex >= 0
                            ? row[timeIndex]
                            : null
                });
            }
        }


        if (
            validRecords.length === 0
        ) {

            throw new Error(
                "No valid Kp values found"
            );
        }


        /*
        Latest Kp
        */

        const latest =
            validRecords[
                validRecords.length - 1
            ];


        setText(
            "currentKp",
            latest.value.toFixed(1)
        );


        /*
        ==================================================
        KP CHART
        ==================================================
        */

        const chartRecords =
            validRecords.slice(-40);


        const labels =
            chartRecords.map(
                item => {

                    if (!item.time) {
                        return "";
                    }


                    const date =
                        new Date(
                            item.time
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
                item =>
                    item.value
            );


        drawKpChart(
            labels,
            values
        );


        console.log(
            "KP RESULT:",
            latest.value
        );


    } catch (error) {

        console.error(
            "Kp error:",
            error
        );
    }
}


/*
========================================================
 KP CHART
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


    /*
    Chart isn't present in the HTML.
    Nothing else should break because
    of that.
    */

    if (!canvas) {

        console.warn(
            "kpChart element not found"
        );

        return;
    }


    if (
        typeof Chart ===
        "undefined"
    ) {

        console.warn(
            "Chart.js is not loaded"
        );

        return;
    }


    /*
    Destroy old chart.
    */

    if (kpChart) {

        kpChart.destroy();

        kpChart = null;
    }


    /*
    Create new chart.
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
 MAIN UPDATE
========================================================
*/

async function updateSpaceWeather() {

    console.log(
        "========================================"
    );

    console.log(
        "REAL-TIME SPACE WEATHER UPDATE"
    );

    console.log(
        new Date().toISOString()
    );

    console.log(
        "========================================"
    );


    /*
    Each request runs independently.

    If NOAA's Kp endpoint fails,
    magnetic data still loads.

    If magnetic data fails,
    solar wind still loads.
    */

    await Promise.allSettled([

        loadMagneticData(),

        loadSolarWindData(),

        loadKpData()

    ]);


    console.log(
        "========================================"
    );

    console.log(
        "UPDATE COMPLETE"
    );

    console.log(
        "========================================"
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
 AUTOMATIC REFRESH
========================================================

Refresh every 60 seconds.

The page does not need to be manually refreshed.
========================================================
*/

setInterval(
    updateSpaceWeather,
    60 * 1000
);
