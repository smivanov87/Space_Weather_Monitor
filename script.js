const MAG_URL =
    "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json";

const KP_URL =
    "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";

const SPEED_URL =
    "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json";

let chart = null;


/* =====================================================
   HELPERS
===================================================== */

function setText(id, value) {

    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


function setStatus(message, error = false) {

    const element = document.getElementById("status");

    if (!element) return;

    element.textContent = message;

    element.className =
        error
            ? "status error"
            : "status ok";
}


async function getJSON(url) {

    const separator =
        url.includes("?") ? "&" : "?";

    const response = await fetch(
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
            response.status
        );
    }

    return await response.json();
}


function showDiagnostic(data) {

    const element =
        document.getElementById("diagnostic");

    if (!element) return;

    try {

        element.textContent =
            JSON.stringify(
                data,
                null,
                2
            );

    } catch {

        element.textContent =
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
            "NOAA magnetic data:",
            data
        );

        showDiagnostic(data);


        if (
            !Array.isArray(data) ||
            data.length < 2
        ) {

            throw new Error(
                "NOAA magnetic response is empty"
            );
        }


        /*
        NOAA RTSW is normally:

        [
            ["time_tag", "bx_gsm", "by_gsm", ...],
            ["2026-...", "...", "...", ...],
            ...
        ]

        The first row contains the column names.
        */

        const headers = data[0];


        function column(names) {

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
                    names.includes(name)
                ) {
                    return i;
                }
            }

            return -1;
        }


        const timeIndex =
            column([
                "time_tag",
                "time",
                "timestamp"
            ]);


        const byIndex =
            column([
                "by_gsm",
                "bygsm",
                "by"
            ]);


        const bzIndex =
            column([
                "bz_gsm",
                "bzgsm",
                "bz"
            ]);


        const btIndex =
            column([
                "bt"
            ]);


        console.log(
            "NOAA columns:",
            {
                timeIndex,
                byIndex,
                bzIndex,
                btIndex
            }
        );


        /*
        Find the newest valid measurement.
        */

        let record = null;


        for (
            let i = data.length - 1;
            i >= 1;
            i--
        ) {

            const row = data[i];


            if (
                !Array.isArray(row)
            ) {
                continue;
            }


            const by =
                byIndex >= 0
                    ? Number(row[byIndex])
                    : NaN;


            const bz =
                bzIndex >= 0
                    ? Number(row[bzIndex])
                    : NaN;


            const bt =
                btIndex >= 0
                    ? Number(row[btIndex])
                    : NaN;


            if (
                Number.isFinite(by) ||
                Number.isFinite(bz) ||
                Number.isFinite(bt)
            ) {

                record = {
                    by,
                    bz,
                    bt,

                    time:
                        timeIndex >= 0
                            ? row[timeIndex]
                            : null
                };

                break;
            }
        }


        if (!record) {

            throw new Error(
                "No valid magnetic measurement found"
            );
        }


        console.log(
            "Current magnetic field:",
            record
        );


        /* =============================================
           BY
        ============================================= */

        if (
            Number.isFinite(record.by)
        ) {

            setText(
                "by",
                record.by.toFixed(1)
            );
        }


        /* =============================================
           BZ
        ============================================= */

        if (
            Number.isFinite(record.bz)
        ) {

            setText(
                "bz",
                record.bz.toFixed(1)
            );
        }


        /* =============================================
           BT
        ============================================= */

        if (
            Number.isFinite(record.bt)
        ) {

            setText(
                "bt",
                record.bt.toFixed(1)
            );
        }


        /* =============================================
           IMF CLOCK ANGLE
        ============================================= */

        if (
            Number.isFinite(record.by) &&
            Number.isFinite(record.bz)
        ) {

            /*
            Clock angle measured from +Bz.

            atan2(By, Bz)
            */

            let angle =
                Math.atan2(
                    record.by,
                    record.bz
                ) *
                180 /
                Math.PI;


            if (angle < 0) {
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
        }


        /* =============================================
           TIME
        ============================================= */

        if (record.time) {

            const date =
                new Date(record.time);


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


        setStatus(
            "✓ NOAA live data connected"
        );


    } catch (error) {

        console.error(
            "NOAA magnetic error:",
            error
        );

        setStatus(
            "NOAA magnetic error: " +
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
            "NOAA solar wind:",
            data
        );


        /*
        NOAA summary endpoint returns:

        [
            {
                proton_speed: 409,
                time_tag: "..."
            }
        ]
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
            Number(
                current.proton_speed
            );


        if (
            Number.isFinite(speed)
        ) {

            setText(
                "speed",
                speed.toFixed(0)
            );

            console.log(
                "Solar wind:",
                speed,
                "km/s"
            );
        }


    } catch (error) {

        console.error(
            "NOAA solar-wind error:",
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
            await getJSON(KP_URL);


        console.log(
            "NOAA Kp data:",
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


        const headers = data[0];


        let kpIndex = -1;

        let timeIndex = -1;


        /*
        Find columns.
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
                name === "kp" ||
                name === "kp_index"
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
        Fallback if NOAA changes
        the exact Kp column name.
        */

        if (kpIndex < 0) {

            kpIndex =
                headers.findIndex(
                    header =>
                        String(header)
                            .toLowerCase()
                            .includes("kp")
                );
        }


        if (kpIndex < 0) {

            throw new Error(
                "Kp column not found"
            );
        }


        const records = [];


        /*
        Convert rows into objects.
        */

        for (
            let i = 1;
            i < data.length;
            i++
        ) {

            const row = data[i];


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
                "No valid Kp measurements found"
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
        Latest Kp time.
        */

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
        Last 40 measurements for chart.
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
                record => record.kp
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
   KP CHART
===================================================== */

function createChart(
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
   UPDATE EVERYTHING
===================================================== */

async function updateAll() {

    console.log(
        "================================"
    );

    console.log(
        "NOAA UPDATE"
    );

    console.log(
        new Date().toISOString()
    );

    console.log(
        "================================"
    );


    /*
    Each request is independent.
    If one fails, the others still work.
    */

    await Promise.allSettled([

        loadMagnetic(),

        loadSpeed(),

        loadKp()

    ]);
}


/* =====================================================
   START
===================================================== */

updateAll();


/* =====================================================
   REFRESH EVERY 60 SECONDS
===================================================== */

setInterval(
    updateAll,
    60000
);
