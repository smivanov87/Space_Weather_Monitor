/*
========================================================
 SPACE WEATHER PREDICTION
 Real-time NOAA SWPC data
========================================================
*/

/*
========================================================
 NOAA DATA SOURCES
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
 HELPER FUNCTIONS
========================================================
*/

/*
 Convert NOAA array-format JSON into objects.

 NOAA commonly returns:

 [
   ["time_tag", "bx_gsm", "by_gsm", "bz_gsm", "bt"],
   ["2026-...", "...", "...", "...", "..."]
 ]

 This function converts each row into:

 {
   time_tag: "...",
   bx_gsm: "...",
   by_gsm: "...",
   bz_gsm: "...",
   bt: "..."
 }
*/

function convertNOAAData(data) {

    if (!Array.isArray(data) || data.length < 2) {
        return [];
    }

    const headers = data[0];

    return data
        .slice(1)
        .map(row => {

            const record = {};

            headers.forEach((header, index) => {
                record[header] = row[index];
            });

            return record;
        });
}


/*
 Find a value using several possible NOAA field names.
 This makes the code more tolerant if NOAA changes
 the field naming slightly.
*/

function getField(record, names) {

    for (const name of names) {

        if (
            record &&
            record[name] !== undefined &&
            record[name] !== null &&
            record[name] !== ""
        ) {
            return Number(record[name]);
        }
    }

    return NaN;
}


/*
 Find timestamp.
*/

function getTimestamp(record) {

    if (!record) {
        return null;
    }

    return (
        record.time_tag ||
        record.timestamp ||
        record.time ||
        null
    );
}


/*
 Format a timestamp in UTC.
*/

function formatUTC(timestamp) {

    if (!timestamp) {
        return "--";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "--";
    }

    return date.toUTCString();
}


/*
 Update an HTML element safely.
*/

function setText(id, value) {

    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


/*
========================================================
 LOAD MAGNETIC FIELD DATA
========================================================
*/

async function loadMagneticData() {

    try {

        console.log("Loading NOAA magnetic-field data...");

        const response = await fetch(
            MAG_URL + "?_=" + Date.now(),
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `NOAA magnetic request failed: ${response.status}`
            );
        }

        const data = await response.json();

        const records = convertNOAAData(data);

        if (records.length === 0) {
            throw new Error("No magnetic-field records returned");
        }


        /*
        Find the newest record containing valid data.
        */

        let latest = null;

        for (let i = records.length - 1; i >= 0; i--) {

            const by = getField(records[i], [
                "by_gsm",
                "by",
                "By"
            ]);

            const bz = getField(records[i], [
                "bz_gsm",
                "bz",
                "Bz"
            ]);

            const bt = getField(records[i], [
                "bt",
                "Bt"
            ]);

            if (
                Number.isFinite(by) ||
                Number.isFinite(bz) ||
                Number.isFinite(bt)
            ) {

                latest = records[i];
                break;
            }
        }


        if (!latest) {
            throw new Error(
                "No valid magnetic-field data found"
            );
        }


        /*
        Get magnetic-field values.

        Prefer GSM components because the dashboard
        uses IMF clock angle.
        */

        const by = getField(latest, [
            "by_gsm",
            "by",
            "By"
        ]);

        const bz = getField(latest, [
            "bz_gsm",
            "bz",
            "Bz"
        ]);

        const bt = getField(latest, [
            "bt",
            "Bt"
        ]);


        /*
        Update By
        */

        if (Number.isFinite(by)) {

            setText(
                "by",
                by.toFixed(1)
            );
        }


        /*
        Update Bz
        */

        if (Number.isFinite(bz)) {

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
        Update total magnetic-field strength
        */

        if (Number.isFinite(bt)) {

            setText(
                "bt",
                bt.toFixed(1)
            );
        }


        /*
        ====================================================
        IMF CLOCK ANGLE
        ====================================================

        Clock angle in GSM coordinates:

        atan2(By, Bz)

        0°   = northward
        90°  = eastward
        180° = southward
        270° = westward
        */

        if (
            Number.isFinite(by) &&
            Number.isFinite(bz)
        ) {

            let angle =
                Math.atan2(by, bz) *
                180 /
                Math.PI;

            if (angle < 0) {
                angle += 360;
            }

            updateClock(angle);
        }


        /*
        Timestamp
        */

        const timestamp =
            getTimestamp(latest);

        if (timestamp) {

            setText(
                "lastUpdate",
                formatUTC(timestamp)
            );
        }


        console.log(
            "NOAA magnetic data loaded:",
            latest
        );


    } catch (error) {

        console.error(
            "Magnetic data error:",
            error
        );

        /*
        Do not erase previous valid values.
        This allows the dashboard to continue
        displaying the last successful reading.
        */
    }
}


/*
========================================================
 LOAD SOLAR-WIND SPEED
========================================================
*/

async function loadWindData() {

    try {

        console.log("Loading NOAA solar-wind data...");

        const response = await fetch(
            WIND_URL + "?_=" + Date.now(),
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `NOAA wind request failed: ${response.status}`
            );
        }

        const data = await response.json();

        const records = convertNOAAData(data);

        if (records.length === 0) {
            throw new Error(
                "No solar-wind records returned"
            );
        }


        /*
        Find newest record with a valid speed.

        NOAA field is normally:
        V
        or
        speed
        */

        let latest = null;
        let speed = NaN;

        for (let i = records.length - 1; i >= 0; i--) {

            const possibleSpeed = getField(
                records[i],
                [
                    "V",
                    "v",
                    "speed",
                    "wind_speed",
                    "Vsw"
                ]
            );

            if (Number.isFinite(possibleSpeed)) {

                latest = records[i];
                speed = possibleSpeed;

                break;
            }
        }


        if (!latest || !Number.isFinite(speed)) {

            throw new Error(
                "No valid solar-wind speed found"
            );
        }


        /*
        Update top solar-wind card
        */

        setText(
            "solarSpeed",
            speed.toFixed(0)
        );


        /*
        Update detailed solar-wind section
        */

        setText(
            "speed2",
            speed.toFixed(0)
        );


        /*
        Update timestamp if magnetic data
        isn't available.
        */

        const timestamp =
            getTimestamp(latest);

        if (
            timestamp &&
            document.getElementById("lastUpdate")
        ) {

            const currentText =
                document.getElementById(
                    "lastUpdate"
                ).textContent;

            if (
                !currentText ||
                currentText === "--"
            ) {

                setText(
                    "lastUpdate",
                    formatUTC(timestamp)
                );
            }
        }


        console.log(
            "NOAA solar-wind data loaded:",
            latest
        );


    } catch (error) {

        console.error(
            "Solar-wind data error:",
            error
        );
    }
}


/*
========================================================
 CLOCK ANGLE DISPLAY
========================================================
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


    setText(
        "clockAngle",
        angle.toFixed(1)
    );
}


/*
========================================================
 LOAD KP DATA
========================================================
*/

async function loadKpData() {

    try {

        console.log("Loading NOAA Kp data...");

        const response = await fetch(
            KP_URL + "?_=" + Date.now(),
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `NOAA Kp request failed: ${response.status}`
            );
        }

        const data = await response.json();

        const records = convertNOAAData(data);

        if (records.length === 0) {
            throw new Error(
                "No Kp records returned"
            );
        }


        /*
        Find valid Kp records.
        */

        const validRecords =
            records.filter(record => {

                const kp =
                    getField(
                        record,
                        [
                            "kp_index",
                            "kp",
                            "Kp"
                        ]
                    );

                return Number.isFinite(kp);
            });


        if (validRecords.length === 0) {

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


        const kp =
            getField(
                latest,
                [
                    "kp_index",
                    "kp",
                    "Kp"
                ]
            );


        if (Number.isFinite(kp)) {

            setText(
                "currentKp",
                kp.toFixed(1)
            );
        }


        /*
        ====================================================
        Kp CHART
        ====================================================
        */

        const chartRecords =
            validRecords.slice(-40);


        const labels =
            chartRecords.map(record => {

                const timestamp =
                    getTimestamp(record);

                if (!timestamp) {
                    return "";
                }

                const date =
                    new Date(timestamp);

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
            });


        const values =
            chartRecords.map(record => {

                return getField(
                    record,
                    [
                        "kp_index",
                        "kp",
                        "Kp"
                    ]
                );
            });


        updateKpChart(
            labels,
            values
        );


        /*
        Kp timestamp
        */

        const latestTime =
            getTimestamp(latest);

        if (latestTime) {

            setText(
                "kpUpdated",
                "Updated " +
                formatUTC(latestTime)
            );
        }


        console.log(
            "NOAA Kp data loaded:",
            latest
        );


    } catch (error) {

        console.error(
            "Kp data error:",
            error
        );

        setText(
            "kpUpdated",
            "Kp data temporarily unavailable"
        );
    }
}


/*
========================================================
 KP CHART
========================================================
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

        console.warn(
            "kpChart canvas not found"
        );

        return;
    }


    /*
    Destroy previous Chart.js instance.
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

                            pointRadius: 3,

                            pointBackgroundColor:
                                "#48b7ff",

                            pointBorderColor:
                                "#48b7ff",

                            tension: 0.25,

                            fill: true
                        }

                    ]
                },


                options: {

                    responsive: true,

                    maintainAspectRatio: false,


                    animation: false,


                    scales: {

                        y: {

                            min: 0,

                            max: 9,

                            title: {

                                display: true,

                                text: "Kp",

                                color: "#9aabc2"
                            },


                            grid: {

                                color:
                                    "rgba(120,150,190,0.1)"
                            },


                            ticks: {

                                color:
                                    "#71829b"
                            }
                        },


                        x: {

                            title: {

                                display: true,

                                text: "UTC",

                                color: "#9aabc2"
                            },


                            grid: {

                                color:
                                    "rgba(120,150,190,0.05)"
                            },


                            ticks: {

                                color:
                                    "#71829b"
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
 INITIAL LOAD
========================================================
*/

async function loadAllData() {

    console.log(
        "===================================="
    );

    console.log(
        "Loading real-time space weather data..."
    );

    console.log(
        "===================================="
    );


    /*
    Load all three NOAA feeds.

    Promise.allSettled means that if one
    NOAA endpoint fails, the others can
    still update the dashboard.
    */

    await Promise.allSettled([

        loadMagneticData(),

        loadWindData(),

        loadKpData()

    ]);


    console.log(
        "Space weather update complete."
    );
}


/*
========================================================
 START
========================================================
*/

loadAllData();


/*
========================================================
 AUTO UPDATE
========================================================

Update every 60 seconds.

NOAA's real-time solar-wind feeds are
minute-resolution feeds.
========================================================
*/

setInterval(
    loadAllData,
    60 * 1000
);
