const MAG_URL =
    "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json";

const KP_URL =
    "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";


let kpChart;


/*
--------------------------------------------------
LOAD MAGNETIC FIELD DATA
--------------------------------------------------
*/

async function loadMagneticData() {

    try {

        const response =
            await fetch(MAG_URL);

        const data =
            await response.json();

        if (!data || data.length < 2) {
            throw new Error("No magnetic data");
        }


        /*
        NOAA JSON normally contains:

        timestamp
        source
        ...
        By
        Bz
        Bt
        */

        const headers = data[0];

        const rows = data.slice(1);


        const latest =
            rows[rows.length - 1];


        const record = {};

        headers.forEach((header, index) => {

            record[header] =
                latest[index];

        });


        /*
        Get By / Bz / Bt
        */

        const by =
            Number(record.By);

        const bz =
            Number(record.Bz);

        const bt =
            Number(record.Bt);


        /*
        Update display
        */

        if (Number.isFinite(by)) {

            document.getElementById("by")
                .textContent =
                by.toFixed(1);

        }


        if (Number.isFinite(bz)) {

            document.getElementById("bz")
                .textContent =
                bz.toFixed(1);

            document.getElementById("bz2")
                .textContent =
                bz.toFixed(1);

        }


        if (Number.isFinite(bt)) {

            document.getElementById("bt")
                .textContent =
                bt.toFixed(1);

        }


        /*
        CLOCK ANGLE

        atan2(By, Bz)

        gives the IMF clock angle.
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
            record.time_tag ||
            record.timestamp;


        if (timestamp) {

            document.getElementById(
                "lastUpdate"
            ).textContent =
                new Date(timestamp)
                .toUTCString();

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


    /*
    CSS needle points upward at 0°.

    Therefore:

    0° = north
    90° = east
    180° = south
    270° = west
    */

    needle.style.transform =
        `rotate(${angle}deg)`;


    document.getElementById(
        "clockAngle"
    ).textContent =
        angle.toFixed(1);
}


/*
--------------------------------------------------
LOAD Kp DATA
--------------------------------------------------
*/

async function loadKpData() {

    try {

        const response =
            await fetch(KP_URL);

        const data =
            await response.json();


        if (!data || data.length < 2) {
            throw new Error("No Kp data");
        }


        const headers = data[0];

        const rows = data.slice(1);


        const records =
            rows.map(row => {

                const record = {};

                headers.forEach(
                    (header, index) => {

                        record[header] =
                            row[index];

                    }
                );

                return record;

            });


        /*
        Get the most recent Kp
        */

        const latest =
            records[records.length - 1];


        const kp =
            Number(
                latest.kp_index
            );


        if (Number.isFinite(kp)) {

            document.getElementById(
                "currentKp"
            ).textContent =
                kp.toFixed(1);

        }


        /*
        Create chart data
        */

        const chartRecords =
            records
                .filter(record =>
                    Number.isFinite(
                        Number(
                            record.kp_index
                        )
                    )
                )
                .slice(-40);


        const labels =
            chartRecords.map(
                record => {

                    const time =
                        record.time_tag ||
                        record.timestamp;

                    return new Date(time)
                        .toLocaleTimeString(
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
                    Number(
                        record.kp_index
                    )
            );


        updateKpChart(
            labels,
            values
        );


        const latestTime =
            latest.time_tag ||
            latest.timestamp;


        if (latestTime) {

            document.getElementById(
                "kpUpdated"
            ).textContent =
                "Updated " +
                new Date(latestTime)
                    .toUTCString();

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


    if (kpChart) {

        kpChart.destroy();

    }


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

                            text: "Kp"

                        },

                        grid: {

                            color:
                                "rgba(120,150,190,0.1)"

                        },

                        ticks: {

                            color: "#71829b"

                        }

                    },


                    x: {

                        title: {

                            display: true,

                            text: "UTC"

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
