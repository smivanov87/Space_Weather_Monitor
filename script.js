const MAG_URL =
    "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json";

const KP_URL =
    "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";

let kpChart = null;


/* ==================================================
   GENERIC FETCH
   ================================================== */

async function getJSON(url) {

    const response = await fetch(url, {
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status}: ${response.statusText}`
        );
    }

    return await response.json();
}


/* ==================================================
   FIND VALUE IN NOAA RECORD
   ================================================== */

function getValue(record, names) {

    for (const name of names) {

        if (
            record[name] !== undefined &&
            record[name] !== null &&
            record[name] !== ""
        ) {
            return record[name];
        }

    }

    return null;
}


/* ==================================================
   MAGNETIC FIELD
   ================================================== */

async function loadMagneticData() {

    try {

        const data = await getJSON(MAG_URL);

        console.log("NOAA MAG DATA:", data);


        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("NOAA returned no magnetic data");
        }


        /*
        NOAA normally returns an array of objects.
        */

        let latest = null;


        for (let i = data.length - 1; i >= 0; i--) {

            const item = data[i];

            if (!item || typeof item !== "object") {
                continue;
            }


            const by = Number(
                getValue(item, ["By", "by"])
            );

            const bz = Number(
                getValue(item, ["Bz", "bz"])
            );

            const bt = Number(
                getValue(item, ["Bt", "bt"])
            );


            if (
                Number.isFinite(by) ||
                Number.isFinite(bz) ||
                Number.isFinite(bt)
            ) {

                latest = item;

                break;
            }

        }


        if (!latest) {
            throw new Error(
                "Could not find valid By/Bz/Bt values"
            );
        }


        const by = Number(
            getValue(latest, ["By", "by"])
        );

        const bz = Number(
            getValue(latest, ["Bz", "bz"])
        );

        const bt = Number(
            getValue(latest, ["Bt", "bt"])
        );


        console.log(
            "Latest IMF:",
            {
                By: by,
                Bz: bz,
                Bt: bt,
                record: latest
            }
        );


        /* -----------------------------
           By
        ----------------------------- */

        const byElement =
            document.getElementById("by");

        if (
            byElement &&
            Number.isFinite(by)
        ) {

            byElement.textContent =
                by.toFixed(1);

        }


        /* -----------------------------
           Bz
        ----------------------------- */

        const bzElement =
            document.getElementById("bz");

        const bz2Element =
            document.getElementById("bz2");


        if (
            Number.isFinite(bz)
        ) {

            if (bzElement) {

                bzElement.textContent =
                    bz.toFixed(1);

            }

            if (bz2Element) {

                bz2Element.textContent =
                    bz.toFixed(1);

            }

        }


        /* -----------------------------
           Bt
        ----------------------------- */

        const btElement =
            document.getElementById("bt");

        if (
            btElement &&
            Number.isFinite(bt)
        ) {

            btElement.textContent =
                bt.toFixed(1);

        }


        /* -----------------------------
           CLOCK ANGLE
        ----------------------------- */

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


        /* -----------------------------
           TIME
        ----------------------------- */

        const timestamp =
            getValue(
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


            if (
                !Number.isNaN(
                    date.getTime()
                )
            ) {

                updateElement.textContent =
                    date.toUTCString();

            }

        }


    } catch (error) {

        console.error(
            "MAGNETIC DATA ERROR:",
            error
        );

        showError(
            "Magnetic data error: " +
            error.message
        );

    }

}


/* ==================================================
   CLOCK
   ================================================== */

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


/* ==================================================
   KP DATA
   ================================================== */

async function loadKpData() {

    try {

        const data = await getJSON(KP_URL);

        console.log("NOAA KP DATA:", data);


        if (!Array.isArray(data) || data.length === 0) {

            throw new Error(
                "NOAA returned no Kp data"
            );

        }


        /*
        Find records with a Kp value.
        */

        const records =
            data.filter(item => {

                if (
                    !item ||
                    typeof item !== "object"
                ) {
                    return false;
                }


                const value =
                    Number(
                        getValue(
                            item,
                            [
                                "kp_index",
                                "kp",
                                "Kp"
                            ]
                        )
                    );


                return Number.isFinite(value);

            });


        if (records.length === 0) {

            throw new Error(
                "No valid Kp values found"
            );

        }


        /*
        Latest Kp
        */

        const latest =
            records[records.length - 1];


        const kp =
            Number(
                getValue(
                    latest,
                    [
                        "kp_index",
                        "kp",
                        "Kp"
                    ]
                )
            );


        console.log(
            "Latest Kp:",
            kp,
            latest
        );


        const kpElement =
            document.getElementById(
                "currentKp"
            );


        if (
            kpElement &&
            Number.isFinite(kp)
        ) {

            kpElement.textContent =
                kp.toFixed(1);

        }


        /*
        Last 40 readings
        */

        const chartRecords =
            records.slice(-40);


        const labels =
            chartRecords.map(item => {

                const timestamp =
                    getValue(
                        item,
                        [
                            "time_tag",
                            "timestamp",
                            "time"
                        ]
                    );


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
                        minute: "2-digit",
                        timeZone: "UTC"
                    }
                );

            });


        const values =
            chartRecords.map(item => {

                return Number(
                    getValue(
                        item,
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
        Update timestamp
        */

        const timestamp =
            getValue(
                latest,
                [
                    "time_tag",
                    "timestamp",
                    "time"
                ]
            );


        const updatedElement =
            document.getElementById(
                "kpUpdated"
            );


        if (
            updatedElement &&
            timestamp
        ) {

            const date =
                new Date(timestamp);


            if (
                !Number.isNaN(
                    date.getTime()
                )
            ) {

                updatedElement.textContent =
                    "Updated " +
                    date.toUTCString();

            }

        }


    } catch (error) {

        console.error(
            "KP DATA ERROR:",
            error
        );

        showError(
            "Kp data error: " +
            error.message
        );

    }

}


/* ==================================================
   CHART
   ================================================== */

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
            "Canvas #kpChart was not found"
        );

        return;

    }


    if (typeof Chart === "undefined") {

        console.error(
            "Chart.js has not been loaded"
        );

        showError(
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

                            pointRadius: 3,

                            pointBackgroundColor:
                                "#48b7ff",

                            tension: 0.25,

                            fill: true

                        }

                    ]

                },


                options: {

                    responsive: true,

                    maintainAspectRatio: false,


                    scales: {

                        y: {

                            min: 0,

                            max: 9,

                            ticks: {

                                stepSize: 1,

                                color:
                                    "#71829b"

                            },

                            title: {

                                display: true,

                                text: "Kp",

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

                            title: {

                                display: true,

                                text: "UTC",

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


/* ==================================================
   ERROR DISPLAY
   ================================================== */

function showError(message) {

    console.error(message);


    const errorElement =
        document.getElementById(
            "dataError"
        );


    if (errorElement) {

        errorElement.textContent =
            message;

        errorElement.style.display =
            "block";

    }

}


/* ==================================================
   START
   ================================================== */

loadMagneticData();

loadKpData();


/* ==================================================
   UPDATE EVERY MINUTE
   ================================================== */

setInterval(
    loadMagneticData,
    60 * 1000
);

setInterval(
    loadKpData,
    60 * 1000
);
