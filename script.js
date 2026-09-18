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


function diagnostic(data) {

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
            "NOAA MAGNETIC SUMMARY:",
            data
        );


        diagnostic(data);


        /*
        NOAA's summary endpoint can return
        either an object or an array.
        */

        let current =
            Array.isArray(data)
                ? data[0]
                : data;


        if (!current) {

            throw new Error(
                "No magnetic data returned"
            );
        }


        /*
        Print the exact NOAA fields.
        This is useful if NOAA changes
        the endpoint format.
        */

        console.log(
            "MAGNETIC FIELDS:",
            Object.keys(current)
        );


        /*
        NOAA magnetic summary normally
        provides these values.
        */

        const by =
            Number(
                current.b_y
                ??
                current.by
                ??
                current.By
                ??
                current.by_gsm
            );


        const bz =
            Number(
                current.b_z
                ??
                current.bz
                ??
                current.Bz
                ??
                current.bz_gsm
            );


        const bt =
            Number(
                current.b_t
                ??
                current.bt
                ??
                current.Bt
            );


        console.log(
            "CURRENT MAGNETIC VALUES:",
            {
                by,
                bz,
                bt
            }
        );


        /* =================================================
           BY
        ================================================= */

        if (
            Number.isFinite(by)
        ) {

            setText(
                "by",
                by.toFixed(1)
            );
        }


        /* =================================================
           BZ
        ================================================= */

        if (
            Number.isFinite(bz)
        ) {

            setText(
                "bz",
                bz.toFixed(1)
            );
        }


        /* =================================================
           BT
        ================================================= */

        if (
            Number.isFinite(bt)
        ) {

            setText(
                "bt",
                bt.toFixed(1)
            );
        }


        /* =================================================
           CLOCK ANGLE
        ================================================= */

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


        /* =================================================
           TIME
        ================================================= */

        const time =
            current.time_tag
            ??
            current.time
            ??
            current.timestamp;


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


        setStatus(
            "✓ NOAA live magnetic data connected"
        );


    } catch (error) {

        console.error(
            "MAGNETIC ERROR:",
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


        const current =
            Array.isArray(data)
                ? data[0]
                : data;


        if (!current) {

            throw new Error(
                "No solar-wind data"
            );
        }


        const speed =
            Number(
                current.proton_speed
                ??
                current.speed
            );


        if (
            Number.isFinite(speed)
        ) {

            setText(
                "speed",
                speed.toFixed(0)
            );
        }


    } catch (error) {

        console.error(
            "SOLAR WIND ERROR:",
            error
        );
    }
}


/* =====================================================
   KP
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
                "Empty Kp response"
            );
        }


        const headers =
            data[0];


        let kpIndex = -1;

        let timeIndex = -1;


        headers.forEach(
            (header, index) => {

                const name =
                    String(header)
                        .toLowerCase()
                        .trim();


                if (
                    name === "kp_index" ||
                    name === "kp"
                ) {

                    kpIndex = index;
                }


                if (
                    name === "time_tag"
                ) {

                    timeIndex = index;
                }
            }
        );


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
                "No Kp values found"
            );
        }


        const latest =
            records[
                records.length - 1
            ];


        setText(
            "kp",
            latest.kp.toFixed(1)
        );


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


        /* =============================================
           CHART
        ============================================= */

        const recent =
            records.slice(-40);


        const labels =
            recent.map(
                item => {

                    if (!item.time) {
                        return "";
                    }


                    const date =
                        new Date(
                            item.time
                        );


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
                item => item.kp
            );


        createChart(
            labels,
            values
        );


    } catch (error) {

        console.error(
            "KP ERROR:",
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
        typeof Chart === "undefined"
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
    Run all three independently.
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
   UPDATE EVERY MINUTE
===================================================== */

setInterval(
    updateAll,
    60000
);
