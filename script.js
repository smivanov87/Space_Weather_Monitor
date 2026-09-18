const MAG_URL =
    "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json";

const KP_URL =
    "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";

const SPEED_URL =
    "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json";

let chart = null;


/* =====================================================
   FETCH
===================================================== */

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


/* =====================================================
   TEXT
===================================================== */

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


/* =====================================================
   STATUS
===================================================== */

function setStatus(message, error = false) {

    const element =
        document.getElementById("status");

    if (!element) return;

    element.textContent = message;

    element.className =
        error
            ? "status error"
            : "status ok";
}


/* =====================================================
   MAGNETIC DATA
===================================================== */

async function loadMagnetic() {

    try {

        const data =
            await getJSON(MAG_URL);


        console.log(
            "NOAA MAG DATA:",
            data
        );


        /*
         * NOAA RTSW data can contain rows with
         * the column names in the first row.
         *
         * We find the columns dynamically.
         */


        if (
            !Array.isArray(data) ||
            data.length < 2
        ) {

            throw new Error(
                "NOAA magnetic response is empty"
            );
        }


        const header =
            data[0];


        console.log(
            "NOAA MAG HEADER:",
            header
        );


        /*
         * Find a column by several possible names.
         */

        function findColumn(names) {

            for (
                let i = 0;
                i < header.length;
                i++
            ) {

                const name =
                    String(header[i])
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


        const timeColumn =
            findColumn([
                "time_tag",
                "time",
                "timestamp"
            ]);


        const byColumn =
            findColumn([
                "by_gsm",
                "by",
                "b_y"
            ]);


        const bzColumn =
            findColumn([
                "bz_gsm",
                "bz",
                "b_z"
            ]);


        const btColumn =
            findColumn([
                "bt",
                "bt_gsm",
                "b_t"
            ]);


        console.log(
            "MAG COLUMNS:",
            {
                timeColumn,
                byColumn,
                bzColumn,
                btColumn
            }
        );


        /*
         * Find the newest row that has
         * actual magnetic values.
         */

        let latest = null;


        for (
            let i = data.length - 1;
            i >= 1;
            i--
        ) {

            const row =
                data[i];


            if (
                !Array.isArray(row)
            ) {
                continue;
            }


            const by =
                byColumn >= 0
                    ? Number(
                        row[byColumn]
                    )
                    : NaN;


            const bz =
                bzColumn >= 0
                    ? Number(
                        row[bzColumn]
                    )
                    : NaN;


            const bt =
                btColumn >= 0
                    ? Number(
                        row[btColumn]
                    )
                    : NaN;


            if (
                Number.isFinite(by) ||
                Number.isFinite(bz) ||
                Number.isFinite(bt)
            ) {

                latest = {

                    by,

                    bz,

                    bt,

                    time:
                        timeColumn >= 0
                            ? row[timeColumn]
                            : null
                };


                break;
            }
        }


        if (!latest) {

            throw new Error(
                "No valid magnetic row found"
            );
        }


        console.log(
            "LATEST MAG:",
            latest
        );


        /* =================================================
           BY
        ================================================= */

        if (
            Number.isFinite(
                latest.by
            )
        ) {

            setText(
                "by",
                latest.by.toFixed(1)
            );

        } else {

            setText(
                "by",
                "--"
            );
        }


        /* =================================================
           BZ
        ================================================= */

        if (
            Number.isFinite(
                latest.bz
            )
        ) {

            setText(
                "bz",
                latest.bz.toFixed(1)
            );

        } else {

            setText(
                "bz",
                "--"
            );
        }


        /* =================================================
           BT
        ================================================= */

        if (
            Number.isFinite(
                latest.bt
            )
        ) {

            setText(
                "bt",
                latest.bt.toFixed(1)
            );

        } else {

            setText(
                "bt",
                "--"
            );
        }


        /* =================================================
           CLOCK ANGLE
        ================================================= */

        if (
            Number.isFinite(latest.by) &&
            Number.isFinite(latest.bz)
        ) {

            let angle =
                Math.atan2(
                    latest.by,
                    latest.bz
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

        } else {

            setText(
                "angle",
                "--"
            );
        }


        /* =================================================
           TIME
        ================================================= */

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
   SOLAR WIND
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
            return;
        }


        const speed =
            Number(
                record.proton_speed
            );


        if (
            Number.isFinite(speed)
        ) {

            /*
             * Your current HTML does not have
             * a speed element.
             *
             * This still logs the value.
             */

            console.log(
                "SOLAR WIND:",
                speed,
                "km/s"
            );


            /*
             * If you later add:
             *
             * <span id="speed"></span>
             *
             * it will automatically appear.
             */

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
                "Kp data empty"
            );
        }


        const header =
            data[0];


        let kpColumn = -1;

        let timeColumn = -1;


        for (
            let i = 0;
            i < header.length;
            i++
        ) {

            const name =
                String(header[i])
                    .toLowerCase()
                    .trim();


            if (
                name === "kp_index" ||
                name === "kp"
            ) {

                kpColumn = i;
            }


            if (
                name === "time_tag"
            ) {

                timeColumn = i;
            }
        }


        /*
         * Fallback.
         */

        if (
            kpColumn === -1
        ) {

            kpColumn =
                header.findIndex(
                    h =>
                        String(h)
                            .toLowerCase()
                            .includes("kp")
                );
        }


        if (
            kpColumn === -1
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
                    row[kpColumn]
                );


            if (
                Number.isFinite(kp)
            ) {

                records.push({

                    kp,

                    time:
                        timeColumn >= 0
                            ? row[timeColumn]
                            : null
                });
            }
        }


        if (
            records.length === 0
        ) {

            throw new Error(
                "No Kp measurements"
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

                    labels,

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
   UPDATE EVERYTHING
===================================================== */

function updateAll() {

    loadMagnetic();

    loadSpeed();

    loadKp();
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
