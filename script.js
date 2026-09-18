/*
========================================================
 SPACE WEATHER PREDICTION
 REAL-TIME NOAA DATA
========================================================
*/

const NOAA = {
    magnetic:
        "https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json",

    speed:
        "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json",

    kp:
        "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json"
};


/*
========================================================
 HELPERS
========================================================
*/

function setText(id, value) {

    const el = document.getElementById(id);

    if (el) {
        el.textContent = value;
    }
}


function number(value) {

    const n = Number(value);

    return Number.isFinite(n) ? n : null;
}


function getValue(obj, names) {

    if (!obj) {
        return null;
    }

    for (const name of names) {

        if (
            obj[name] !== undefined &&
            obj[name] !== null &&
            obj[name] !== ""
        ) {

            const n = Number(obj[name]);

            if (Number.isFinite(n)) {
                return n;
            }
        }
    }

    return null;
}


/*
========================================================
 MAGNETIC FIELD
========================================================
*/

async function loadMagnetic() {

    try {

        console.log(
            "NOAA: loading magnetic field..."
        );

        const response = await fetch(
            NOAA.magnetic +
            "?_=" +
            Date.now(),
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {

            throw new Error(
                "HTTP " + response.status
            );
        }

        const data =
            await response.json();

        console.log(
            "NOAA magnetic response:",
            data
        );


        /*
        NOAA summary endpoint normally returns
        a simple object containing the current
        magnetic-field values.
        */

        const by = getValue(
            data,
            [
                "By",
                "by",
                "by_gsm",
                "BY_GSM"
            ]
        );


        const bz = getValue(
            data,
            [
                "Bz",
                "bz",
                "bz_gsm",
                "BZ_GSM"
            ]
        );


        const bt = getValue(
            data,
            [
                "Bt",
                "bt",
                "bt_total",
                "BT"
            ]
        );


        /*
        BY
        */

        if (by !== null) {

            setText(
                "by",
                by.toFixed(1)
            );
        }


        /*
        BZ
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
        BT
        */

        if (bt !== null) {

            setText(
                "bt",
                bt.toFixed(1)
            );
        }


        /*
        CLOCK ANGLE
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
        TIMESTAMP
        */

        const timestamp =
            data.time_tag ||
            data.timestamp ||
            data.time ||
            data.date ||
            null;


        if (timestamp) {

            setText(
                "lastUpdate",
                new Date(
                    timestamp
                ).toUTCString()
            );
        }


        console.log(
            "Magnetic field OK:",
            {
                By: by,
                Bz: bz,
                Bt: bt
            }
        );


    } catch (error) {

        console.error(
            "NOAA magnetic error:",
            error
        );
    }
}


/*
========================================================
 SOLAR WIND SPEED
========================================================
*/

async function loadSolarWind() {

    try {

        console.log(
            "NOAA: loading solar-wind speed..."
        );


        const response =
            await fetch(
                NOAA.speed +
                "?_=" +
                Date.now(),
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );
        }


        const data =
            await response.json();


        console.log(
            "NOAA speed response:",
            data
        );


        const speed =
            getValue(
                data,
                [
                    "speed",
                    "Speed",
                    "v",
                    "V",
                    "Vsw",
                    "solar_wind_speed"
                ]
            );


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
            "Solar wind speed:",
            speed
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
 KP
========================================================
*/

async function loadKp() {

    try {

        console.log(
            "NOAA: loading Kp..."
        );


        const response =
            await fetch(
                NOAA.kp +
                "?_=" +
                Date.now(),
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "HTTP " +
                response.status
            );
        }


        const raw =
            await response.json();


        console.log(
            "NOAA Kp response:",
            raw
        );


        /*
        Convert NOAA array data.
        */

        let records = [];


        if (
            Array.isArray(raw) &&
            raw.length > 1
        ) {

            const headers =
                raw[0];


            records =
                raw.slice(1)
                    .map(row => {

                        const obj = {};

                        headers.forEach(
                            (header, index) => {

                                obj[header] =
                                    row[index];
                            }
                        );

                        return obj;
                    });
        }


        /*
        Find latest valid Kp.
        */

        let latest = null;


        for (
            let i = records.length - 1;
            i >= 0;
            i--
        ) {

            const kp =
                getValue(
                    records[i],
                    [
                        "kp_index",
                        "kp",
                        "Kp"
                    ]
                );


            if (kp !== null) {

                latest = {
                    record: records[i],
                    value: kp
                };

                break;
            }
        }


        if (!latest) {

            throw new Error(
                "No valid Kp found"
            );
        }


        setText(
            "currentKp",
            latest.value.toFixed(1)
        );


        /*
        Build chart data.
        */

        const chartRecords =
            records
                .filter(record =>
                    getValue(
                        record,
                        [
                            "kp_index",
                            "kp",
                            "Kp"
                        ]
                    ) !== null
                )
                .slice(-40);


        const labels =
            chartRecords.map(
                record => {

                    const time =
                        record.time_tag ||
                        record.timestamp ||
                        record.time;


                    if (!time) {
                        return "";
                    }


                    const date =
                        new Date(time);


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
                    getValue(
                        record,
                        [
                            "kp_index",
                            "kp",
                            "Kp"
                        ]
                    )
            );


        drawKpChart(
            labels,
            values
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
 KP CHART
========================================================
*/

let kpChart = null;


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
            "kpChart not found"
        );

        return;
    }


    if (
        typeof Chart ===
        "undefined"
    ) {

        console.warn(
            "Chart.js not loaded"
        );

        return;
    }


    if (kpChart) {

        kpChart.destroy();

        kpChart = null;
    }


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
 LOAD EVERYTHING
========================================================
*/

async function updateSpaceWeather() {

    console.log(
        "===================================="
    );

    console.log(
        "SPACE WEATHER UPDATE"
    );

    console.log(
        new Date().toISOString()
    );

    console.log(
        "===================================="
    );


    /*
    Run independently.
    If one NOAA request fails,
    the others still work.
    */

    await Promise.allSettled([

        loadMagnetic(),

        loadSolarWind(),

        loadKp()

    ]);


    console.log(
        "Update finished."
    );
}


/*
========================================================
 START
========================================================
*/

updateSpaceWeather();


/*
========================================================
 AUTO REFRESH
========================================================

Every 60 seconds.
========================================================
*/

setInterval(
    updateSpaceWeather,
    60 * 1000
);
