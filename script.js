const MAG_URL =
    "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json";

const KP_URL =
    "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";

let kpChart = null;


/*
--------------------------------------------------
HELPERS
--------------------------------------------------
*/

async function fetchJson(url) {

    const response = await fetch(url, {
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status} ${response.statusText}`
        );
    }

    return await response.json();
}


/*
Convert NOAA data into an array of objects.

Supports:

1. Array of objects:
   [
       { time_tag: "...", Bz: -5.2, ... }
   ]

2. Header + rows:
   [
       ["time_tag", "Bz", "By"],
       ["...", "-5.2", "2.1"]
   ]
*/

function normaliseData(data) {

    if (!Array.isArray(data) || data.length === 0) {
        return [];
    }


    // Already an array of objects
    if (
        typeof data[0] === "object" &&
        !Array.isArray(data[0])
    ) {

        return data;
    }


    // Header + rows
    if (Array.isArray(data[0])) {

        const headers = data[0];

        return data.slice(1).map(row => {

            const record = {};

            headers.forEach((header, index) => {

                record[header] = row[index];

            });

            return record;

        });
    }


    return [];
}


/*
Find a property regardless of minor
capitalisation differences.
*/

function getField(record, names) {

    for (const name of names) {

        if (
            record[name] !== undefined &&
            record[name] !== null
        ) {

            return record[name];

        }
    }


    // Case-insensitive fallback

    const keys = Object.keys(record);

    for (const wanted of names) {

        const found = keys.find(
            key =>
                key.toLowerCase() ===
                wanted.toLowerCase()
        );

        if (found) {
            return record[found];
        }
    }


    return undefined;
}


/*
--------------------------------------------------
LOAD MAGNETIC FIELD DATA
--------------------------------------------------
*/

async function loadMagneticData() {

    try {

        const data =
            await fetchJson(MAG_URL);


        const records =
            normaliseData(data);


        if (records.length === 0) {
            throw new Error("No magnetic data received");
        }


        /*
        Find the latest valid record.

        Sometimes the final NOAA record can contain
        null values, so work backwards until we find
        a usable record.
        */

        let latest = null;

        for (
            let i = records.length - 1;
            i >= 0;
            i--
        ) {

            const record = records[i];

            const by =
                Number(
                    getField(record, ["By", "by"])
                );

            const bz =
                Number(
                    getField(record, ["Bz", "bz"])
                );

            const bt =
                Number(
                    getField(record, ["Bt", "bt"])
                );


            if (
                Number.isFinite(by) ||
                Number.isFinite(bz) ||
                Number.isFinite(bt)
            ) {

                latest = record;
                break;

            }
        }


        if (!latest) {
            throw new Error(
                "No valid magnetic field record found"
            );
        }


        /*
        Get magnetic field values
        */

        const by =
            Number(
                getField(latest, ["By", "by"])
            );

        const bz =
            Number(
                getField(latest, ["Bz", "bz"])
            );

        const bt =
            Number(
                getField(latest, ["Bt", "bt"])
            );


        /*
        Update By
        */

        const byElement =
            document.getElementById("by");

        if (
            byElement &&
            Number.isFinite(by)
        ) {

            byElement.textContent =
                by.toFixed(1);

        }


        /*
        Update Bz
        */

        const bzElement =
            document.getElementById("bz");

        const bzElement2 =
            document.getElementById("bz2");


        if (Number.isFinite(bz)) {

            if (bzElement) {

                bzElement.textContent =
                    bz.toFixed(1);

            }


            if (bzElement2) {

                bzElement2.textContent =
                    bz.toFixed(1);

            }

        }


        /*
        Update Bt
        */

        const btElement =
            document.getElementById("bt");

        if (
            btElement &&
            Number.isFinite(bt)
        ) {

            btElement.textContent =
                bt.toFixed(1);

        }


        /*
        IMF CLOCK ANGLE

        atan2(By, Bz)

        0°   = north
        90°  = east
        180° = south
        270° = west
        */

        if (
            Number.isFinite(by) &&
            Number.isFinite(bz)
        ) {

            let angle =
                Math.atan2(by, bz)
                * 180 / Math.PI;


            if (angle < 0) {
                angle += 360;
            }


            updateClock(angle);

        }


        /*
        Timestamp
        */

        const timestamp =
            getField(
                latest,
                [
                    "time_tag",
                    "timestamp",
                    "time"
                ]
            );


        const updateElement =
            document.getElementById(
                "lastUpdate"
            );


        if (
            updateElement &&
            timestamp
        ) {

            const date =
                new Date(timestamp);


            if (!Number.isNaN(date.getTime())) {

                updateElement.textContent =
                    date.toUTCString();

            }

        }


    } catch (error) {

        console.error(
            "Magnetic data error:",
            error
        );

    }
}


/*
--------------------------------------------------
CLOCK ANGLE
--------------------------------------------------
*/

function updateClock(angle) {

    const needle =
        document.getElementById(
            "clockNeedle"
        );


    if (needle) {

        needle.style.transform =
            `rotate(${angle}deg)`;

    }


    const angleElement =
        document.getElementById(
            "clockAngle"
        );


    if (angleElement) {

        angleElement.textContent =
            angle.toFixed(1);

    }
}


/*
--------------------------------------------------
LOAD Kp DATA
--------------------------------------------------
*/

async function loadKpData() {

    try {

        const data =
            await fetchJson(KP_URL);


        const records =
            normaliseData(data);


        if (records.length === 0) {
            throw new Error("No Kp data received");
        }


        /*
        Keep only records with a valid Kp value.
        */

        const validRecords =
            records.filter(record => {

                const value =
                    Number(
                        getField(
                            record,
                            [
                                "kp_index",
                                "kp",
                                "Kp"
                            ]
                        )
                    );

                return Number.isFinite(value);

            });


        if (validRecords.length === 0) {

            throw new Error(
                "No valid Kp records found"
            );

        }


        /*
        Most recent Kp
        */

        const latest =
            validRecords[
                validRecords.length - 1
            ];


        const kp =
            Number(
                getField(
                    latest,
                    [
                        "kp_index",
                        "kp",
                        "Kp"
                    ]
                )
            );


        const currentKpElement =
            document.getElementById(
                "currentKp"
            );


        if (
            currentKpElement &&
            Number.isFinite(kp)
        ) {

            currentKpElement.textContent =
                kp.toFixed(1);

        }


        /*
        Last 40 Kp records
        */

        const chartRecords =
            validRecords.slice(-40);


        const labels =
            chartRecords.map(record => {

                const time =
                    getField(
                        record,
                        [
                            "time_tag",
                            "timestamp",
                            "time"
                        ]
                    );


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
                        minute: "2-digit",
                        timeZone: "UTC"
                    }
                );

            });


        const values =
            chartRecords.map(record => {

                return Number(
                    getField(
                        record,
                        [
                            "kp_index",
                            "kp",
                            "Kp"
                        ]
                    )
                );

            });


        updateKpChart(
            labels,
            values
        );


        /*
        Kp update time
        */

        const latestTime =
            getField(
                latest,
                [
                    "time_tag",
                    "timestamp",
                    "time"
                ]
            );


        const kpUpdatedElement =
            document.getElementById(
                "kpUpdated"
            );


        if (
            kpUpdatedElement &&
            latestTime
        ) {

            const date =
                new Date(latestTime);


            if (!Number.isNaN(date.getTime())) {

                kpUpdatedElement.textContent =
                    "Updated " +
                    date.toUTCString();

            }

        }


    } catch (error) {

        console.error(
            "Kp data error:",
            error
        );

    }
}


/*
--------------------------------------------------
Kp CHART
--------------------------------------------------
*/

function updateKpChart(
    labels,
    values
) {

    const canvas =
        document.getElementById(
            "kpChart"
        );


    if (!canvas) {

        console.error(
            "Kp chart canvas #kpChart not found"
        );

        return;

    }


    /*
    Make sure Chart.js is loaded.
    */

    if (typeof Chart === "undefined") {

        console.error(
            "Chart.js is not loaded"
        );

        return;

    }


    /*
    Destroy previous chart
    */

    if (kpChart) {

        kpChart.destroy();

        kpChart = null;

    }


    /*
    Create new chart
    */

    kpChart =
        new Chart(canvas, {

            type: "line",

            data: {

                labels: labels,

                datasets: [{

                    label: "Kp",

                    data: values,

                    borderColor:
                        "#48b7ff",

                    backgroundColor:
                        "rgba(72,183,255,0.12)",

                    borderWidth: 2,

                    pointRadius: 3,

                    pointBackgroundColor:
                        "#48b7ff",

                    pointBorderColor:
                        "#48b7ff",

                    tension: 0.25,

                    fill: true

                }]

            },


            options: {

                responsive: true,

                maintainAspectRatio: false,


                scales: {

                    y: {

                        min: 0,

                        max: 9,

                        title: {

                            display: true,

                            text: "Kp",

                            color: "#71829b"

                        },

                        grid: {

                            color:
                                "rgba(120,150,190,0.1)"

                        },

                        ticks: {

                            color: "#71829b",

                            stepSize: 1

                        }

                    },


                    x: {

                        title: {

                            display: true,

                            text: "UTC",

                            color: "#71829b"

                        },

                        grid: {

                            color:
                                "rgba(120,150,190,0.05)"

                        },

                        ticks: {

                            color: "#71829b"

                        }

                    }

                },


                plugins: {

                    legend: {

                        labels: {

                            color: "#9aabc2"

                        }

                    }

                }

            }

        });

}


/*
--------------------------------------------------
INITIAL LOAD
--------------------------------------------------
*/

loadMagneticData();

loadKpData();


/*
--------------------------------------------------
AUTO UPDATE

Every 60 seconds
--------------------------------------------------
*/

setInterval(
    loadMagneticData,
    60 * 1000
);


setInterval(
    loadKpData,
    60 * 1000
);
