/*
========================================================
 SPACE WEATHER PREDICTION
 REAL-TIME NOAA SWPC DATA
========================================================
*/

const MAG_URL =
    "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json";

const WIND_URL =
    "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json";

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
 HELPERS
========================================================
*/

function setText(id, value) {

    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


function convertNOAAArray(data) {

    if (!Array.isArray(data) || data.length < 2) {
        return [];
    }

    const headers = data[0];

    return data.slice(1).map(row => {

        const object = {};

        headers.forEach((header, index) => {
            object[header] = row[index];
        });

        return object;
    });
}


function findLatestValid(records, fields) {

    for (let i = records.length - 1; i >= 0; i--) {

        const record = records[i];

        for (const field of fields) {

            const value = Number(record[field]);

            if (Number.isFinite(value)) {

                return {
                    record: record,
                    value: value
                };
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

async function loadMagneticData() {

    try {

        console.log(
            "Loading NOAA magnetic data..."
        );


        const response = await fetch(
            MAG_URL + "?t=" + Date.now(),
            {
                cache: "no-store"
            }
        );


        if (!response.ok) {

            throw new Error(
                "NOAA magnetic HTTP " +
                response.status
            );
        }


        const raw =
            await response.json();


        console.log(
            "NOAA magnetic raw data:",
            raw
        );


        const records =
            convertNOAAArray(raw);


        console.log(
            "Magnetic records:",
            records.length
        );


        /*
        ------------------------------------------------
        BY
        ------------------------------------------------
        */

        const byResult =
            findLatestValid(
                records,
                [
                    "by_gsm",
                    "by",
                    "By",
                    "BY_GSM"
                ]
            );


        /*
        ------------------------------------------------
        BZ
        ------------------------------------------------
        */

        const bzResult =
            findLatestValid(
                records,
                [
                    "bz_gsm",
                    "bz",
                    "Bz",
                    "BZ_GSM"
                ]
            );


        /*
        ------------------------------------------------
        BT
        ------------------------------------------------
        */

        const btResult =
            findLatestValid(
                records,
                [
                    "bt",
                    "Bt",
                    "BT"
                ]
            );


        console.log(
            "Magnetic values:",
            {
                By: byResult,
                Bz: bzResult,
                Bt: btResult
            }
        );


        /*
        ------------------------------------------------
        UPDATE BY
        ------------------------------------------------
        */

        if (byResult) {

            setText(
                "by",
                byResult.value.toFixed(1)
            );
        }


        /*
        ------------------------------------------------
        UPDATE BZ
        ------------------------------------------------
        */

        if (bzResult) {

            setText(
                "bz",
                bzResult.value.toFixed(1)
            );

            setText(
                "bz2",
                bzResult.value.toFixed(1)
            );
        }


        /*
        ------------------------------------------------
        UPDATE BT
        ------------------------------------------------
        */

        if (btResult) {

            setText(
                "bt",
                btResult.value.toFixed(1)
            );
        }


        /*
        ------------------------------------------------
        IMF CLOCK ANGLE
        ------------------------------------------------

        GSM clock angle:

        atan2(By, Bz)

        0°   = north
        90°  = east
        180° = south
        270° = west
        */

        if (
            byResult &&
            bzResult
        ) {

            let angle =
                Math.atan2(
                    byResult.value,
                    bzResult.value
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
        ------------------------------------------------
        TIMESTAMP
        ------------------------------------------------
        */

        const latestRecord =
            records[records.length - 1];


        if (
            latestRecord &&
            latestRecord.time_tag
        ) {

            setText(
                "lastUpdate",
                new Date(
                    latestRecord.time_tag
                ).toUTCString()
            );
        }


        console.log(
            "✓ Magnetic data loaded"
        );


    } catch (error) {

        console.error(
            "✗ Magnetic data error:",
            error
        );
    }
}


/*
========================================================
 SOLAR WIND SPEED
========================================================
*/

async function loadSolarWindData() {

    try {

        console.log(
            "Loading NOAA solar-wind data..."
        );


        const response =
            await fetch(
                WIND_URL +
                "?t=" +
                Date.now(),
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "NOAA wind HTTP " +
                response.status
            );
        }


        const raw =
            await response.json();


        console.log(
            "NOAA wind raw data:",
            raw
        );


        const records =
            convertNOAAArray(raw);


        console.log(
            "Wind records:",
            records.length
        );


        /*
        NOAA uses "V" in the RTSW
        wind feed in many versions.

        Check several possible names.
        */

        const speedResult =
            findLatestValid(
                records,
                [
                    "V",
                    "v",
                    "proton_speed",
                    "speed",
                    "Vsw",
                    "wind_speed"
                ]
            );


        console.log(
            "Solar wind speed:",
            speedResult
        );


        if (speedResult) {

            const speed =
                speedResult.value;


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
            "✓ Solar wind data loaded"
        );


    } catch (error) {

        console.error(
            "✗ Solar wind error:",
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

    try {

        console.log(
            "Loading NOAA Kp data..."
        );


        const response =
            await fetch(
                KP_URL +
                "?t=" +
                Date.now(),
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "NOAA Kp HTTP " +
                response.status
            );
        }


        const raw =
            await response.json();


        const records =
            convertNOAAArray(raw);


        /*
        Find valid Kp records.
        */

        const valid =
            records.filter(record => {

                const value =
                    Number(
                        record.kp_index ??
                        record.kp ??
                        record.Kp
                    );


                return Number.isFinite(
                    value
                );
            });


        if (!valid.length) {

            throw new Error(
                "No valid Kp records"
            );
        }


        /*
        Latest Kp
        */

        const latest =
            valid[valid.length - 1];


        const latestKp =
            Number(
                latest.kp_index ??
                latest.kp ??
                latest.Kp
            );


        setText(
            "currentKp",
            latestKp.toFixed(1)
        );


        /*
        Chart data
        */

        const chartRecords =
            valid.slice(-40);


        const labels =
            chartRecords.map(record => {

                if (!record.time_tag) {
                    return "";
                }


                const date =
                    new Date(
                        record.time_tag
                    );


                return date.toLocaleTimeString(
                    "en-GB",
                    {
                        hour: "2-digit",
                        minute: "2-digit"
                    }
                );
            });


        const values =
            chartRecords.map(record =>
                Number(
                    record.kp_index ??
                    record.kp ??
                    record.Kp
                )
            );


        drawKpChart(
            labels,
            values
        );


        console.log(
            "✓ Kp data loaded:",
            latestKp
        );


    } catch (error) {

        console.error(
            "✗ Kp error:",
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


    if (!canvas) {
        return;
    }


    if (
        typeof Chart ===
        "undefined"
    ) {

        console.error(
            "Chart.js is not loaded"
        );

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
    Run independently so one failed
    NOAA request does not stop the others.
    */

    await Promise.allSettled([

        loadMagneticData(),

        loadSolarWindData(),

        loadKpData()

    ]);


    console.log(
        "===================================="
    );

    console.log(
        "UPDATE COMPLETE"
    );

    console.log(
        "===================================="
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
 AUTO REFRESH
========================================================

Every 60 seconds.
========================================================
*/

setInterval(
    updateSpaceWeather,
    60 * 1000
);
