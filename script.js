const MAG_URL =
    "https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json";

const SPEED_URL =
    "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json";

const KP_URL =
    "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";

let chart = null;


/* =====================================================
   HELPERS
===================================================== */

function setText(id, value) {

    const el = document.getElementById(id);

    if (el) {
        el.textContent = value;
    }
}


function setStatus(message, error = false) {

    const el = document.getElementById("status");

    if (!el) return;

    el.textContent = message;

    el.className =
        error
            ? "status error"
            : "status ok";
}


async function getJSON(url) {

    const response = await fetch(
        url + "?_=" + Date.now(),
        {
            cache: "no-store"
        }
    );

    if (!response.ok) {

        throw new Error(
            "HTTP " + response.status
        );
    }

    return await response.json();
}


function showDiagnostic(data) {

    const el =
        document.getElementById("diagnostic");

    if (!el) return;

    try {

        el.textContent =
            JSON.stringify(
                data,
                null,
                2
            );

    } catch {

        el.textContent =
            String(data);
    }
}


/* =====================================================
   MAGNETIC FIELD
===================================================== */

async function loadMagnetic() {

    try {

        const data =
            await getJSON(MAG_URL);


        console.log(
            "NOAA MAGNETIC:",
            data
        );


        showDiagnostic(data);


        /*
        NOAA currently returns something like:

        [
            {
                "bt": 5,
                "bz_gsm": 0,
                "time_tag": "2026-09-18T23:14:00Z"
            }
        ]
        */


        if (
            !Array.isArray(data) ||
            data.length === 0
        ) {

            throw new Error(
                "NOAA magnetic response is empty"
            );
        }


        const record =
            data[data.length - 1];


        if (
            !record ||
            typeof record !== "object"
        ) {

            throw new Error(
                "Invalid NOAA magnetic response"
            );
        }


        console.log(
            "NOAA magnetic record:",
            record
        );


        /* =================================================
           BT
        ================================================= */

        const bt =
            Number(record.bt);


        if (
            Number.isFinite(bt)
        ) {

            setText(
                "bt",
                bt.toFixed(1)
            );

        } else {

            setText(
                "bt",
                "--"
            );
        }


        /* =================================================
           BZ
        ================================================= */

        const bz =
            Number(
                record.bz_gsm
            );


        if (
            Number.isFinite(bz)
        ) {

            setText(
                "bz",
                bz.toFixed(1)
            );

        } else {

            setText(
                "bz",
                "--"
            );
        }


        /* =================================================
           BY
        ================================================= */

        /*
        The current NOAA summary endpoint does NOT
        provide By.

        We therefore check several possible names,
        but do not fail if none exists.
        */

        const byValue =
            record.by ??
            record.by_gsm ??
            record.b_y ??
            record.By;


        const by =
            Number(byValue);


        if (
            Number.isFinite(by)
        ) {

            setText(
                "by",
                by.toFixed(1)
            );

        } else {

            setText(
                "by",
                "--"
            );
        }


        /* =================================================
           CLOCK ANGLE
        ================================================= */

        /*
        A true IMF clock angle requires both
        By and Bz.

        If By isn't supplied by NOAA, we can still
        display a useful Bz direction but we don't
        pretend we have a complete clock angle.
        */

        if (
            Number.isFinite(by) &&
            Number.isFinite(bz)
        ) {

            let angle =
                Math.atan2(
                    by,
                    bz
                ) *
                180 /
                Math.PI;


            if (
                angle < 0
            ) {

                angle += 360;
            }


            setText(
                "angle",
                angle.toFixed(1)
            );


            const needle =
                document.getElementById(
                    "needle"
                );


            if (needle) {

                needle.style.transform =
                    "translate(-50%, -100%) " +
                    "rotate(" +
                    angle +
                    "deg)";
            }

        } else {

            setText(
                "angle",
                "--"
            );


            const needle =
                document.getElementById(
                    "needle"
                );


            if (needle) {

                needle.style.transform =
                    "translate(-50%, -100%) " +
                    "rotate(0deg)";
            }
        }


        /* =================================================
           TIME
        ================================================= */

        const time =
            record.time_tag;


        if (time) {

            const date =
                new Date(time);


            if (
                !Number.isNaN(
                    date.getTime()
                )
            ) {

                setText(
                    "magTime",
                    date.toUTCString()
                );
            }
        }


        /*
        Magnetic request succeeded even if By
        is unavailable.
        */

        setStatus(
            "✓ NOAA magnetic data connected"
        );


    } catch (error) {

        console.error(
            "NOAA magnetic error:",
            error
        );


        setStatus(
            "NOAA magnetic data error: " +
            error.message,
            true
        );
    }
}


/* =====================================================
   SOLAR WIND SPEED
===================================================== */

async function loadSpeed() {

    try {

        const data =
            await getJSON(
                SPEED_URL
            );


        console.log(
            "NOAA SOLAR WIND:",
            data
        );


        const record =
            Array.isArray(data)
                ? data[0]
                : data;


        if (!record) {

            throw new Error(
                "No solar wind data"
            );
        }


        const speed =
            Number(
                record.proton_speed
            );


        /*
        Your current HTML doesn't contain a
        speed card, so don't try to display
        it if the element doesn't exist.
        */

        if (
            Number.isFinite(speed)
        ) {

            setText(
                "speed",
                speed.toFixed(0)
            );

            console.log(
                "Solar wind speed:",
                speed,
                "km/s"
            );
        }


    } catch (error) {

        console.error(
            "NOAA solar wind error:",
            error
        );
    }
}


/* =====================================================
   KP INDEX
===================================================== */

async function loadKp() {

    try {

        const data =
            await getJSON(
                KP_URL
            );


        console.log(
            "NOAA KP:",
            data
        );


        if (
            !Array.isArray(data) ||
            data.length < 2
        ) {

            throw new Error(
                "NOAA Kp response is empty"
            );
        }


        const headers =
            data[0];


        let kpIndex = -1;

        let timeIndex = -1;


        /*
        Find Kp and time columns.
        */

        for (
            let i = 0;
            i < headers.length;
            i++
        ) {

            const name =
                String(headers[i])
                    .toLowerCase()
                    .trim();


            if (
                name === "kp_index" ||
                name === "kp"
            ) {

                kpIndex = i;
            }


            if (
                name === "time_tag"
            ) {

                timeIndex = i;
            }
        }


        /*
        Fallback.
        */

        if (
            kpIndex === -1
        ) {

            kpIndex =
                headers.findIndex(
                    header =>
                        String(header)
                            .toLowerCase()
                            .includes("kp")
                );
        }


        if (
            kpIndex === -1
        ) {

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


            if (
                !Array.isArray(row)
            ) {

                continue;
            }


            const kp =
                Number(
                    row[kpIndex]
                );


            if (
                Number.isFinite(kp)
            ) {

                records.push({

                    kp: kp,

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
                "No valid Kp measurements"
            );
        }


        /*
        Latest Kp.
        */

        const latest =
            records[
                records.length - 1
            ];


        setText(
            "kp",
            latest.kp.toFixed(1)
        );


        /*
        Kp time.
        */

        if (
            latest.time
        ) {

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
        Chart.
        */

        const recent =
            records.slice(-40);


        const labels =
            recent.map(
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


        createChart(
            labels,
            values
        );


    } catch (error) {

        console.error(
            "NOAA Kp error:",
            error
        );


        setText(
            "kp",
            "--"
        );
    }
}


/* =====================================================
   CHART
===================================================== */

function createChart(
    labels,
    values
) {

    const canvas =
        document.getElementById(
            "kpChart"
        );


    if (
        !canvas ||
        typeof Chart ===
        "undefined"
    ) {

        return;
    }


    if (chart) {

        chart.destroy();
    }


    chart =
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

                                color:
                                    "#71839c",

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


/* =====================================================
   UPDATE
===================================================== */

async function updateAll() {

    console.log(
        "NOAA update:",
        new Date().toISOString()
    );


    /*
    Run independently.
    */

    loadMagnetic();

    loadSpeed();

    loadKp();
}


/* =====================================================
   START
===================================================== */

updateAll();


/* =====================================================
   REFRESH EVERY MINUTE
===================================================== */

setInterval(
    updateAll,
    60000
);
