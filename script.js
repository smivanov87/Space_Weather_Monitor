const MAG_URL =
    "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json";

const KP_URL =
    "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";

const SPEED_URL =
    "https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json";

let chart = null;


/* =====================================================
   BASIC HELPERS
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
   NORMALIZE NOAA MAGNETIC RESPONSE
===================================================== */

function normalizeMagneticData(data) {

    /*
    Case 1:
    NOAA returns an array of objects.

    Example:

    [
        {
            "time_tag": "...",
            "by_gsm": 2.1,
            "bz_gsm": -4.2,
            "bt": 6.3
        }
    ]
    */

    if (
        Array.isArray(data) &&
        data.length > 0 &&
        data[0] &&
        typeof data[0] === "object" &&
        !Array.isArray(data[0])
    ) {

        return data;
    }


    /*
    Case 2:
    NOAA returns:

    [
        ["time_tag", "by_gsm", "bz_gsm", "bt"],
        ["...", 2.1, -4.2, 6.3]
    ]
    */

    if (
        Array.isArray(data) &&
        Array.isArray(data[0])
    ) {

        const headers = data[0];

        return data
            .slice(1)
            .map(row => {

                const object = {};

                headers.forEach(
                    (header, index) => {

                        object[
                            String(header)
                        ] = row[index];

                    }
                );

                return object;
            });
    }


    /*
    Case 3:
    NOAA returns one object.
    */

    if (
        data &&
        typeof data === "object"
    ) {

        return [data];
    }


    return [];
}


/* =====================================================
   GET VALUE FROM OBJECT
===================================================== */

function getField(
    object,
    names
) {

    /*
    First try exact names.
    */

    for (
        const name of names
    ) {

        if (
            Object.prototype.hasOwnProperty.call(
                object,
                name
            )
        ) {

            return object[name];
        }
    }


    /*
    Then try case-insensitive
    matching.
    */

    const keys =
        Object.keys(object);


    for (
        const key of keys
    ) {

        const lower =
            key
                .toLowerCase()
                .trim();


        for (
            const name of names
        ) {

            if (
                lower ===
                name.toLowerCase()
            ) {

                return object[key];
            }
        }
    }


    return undefined;
}


/* =====================================================
   MAGNETIC DATA
===================================================== */

async function loadMagnetic() {

    try {

        const raw =
            await getJSON(
                MAG_URL
            );


        console.log(
            "================================"
        );

        console.log(
            "NOAA MAGNETIC RAW RESPONSE"
        );

        console.log(
            raw
        );

        console.log(
            "================================"
        );


        showDiagnostic(raw);


        const records =
            normalizeMagneticData(
                raw
            );


        console.log(
            "Normalized magnetic records:",
            records
        );


        if (
            records.length === 0
        ) {

            throw new Error(
                "NOAA returned no magnetic records"
            );
        }


        /*
        Look from newest to oldest.
        */

        let current = null;


        for (
            let i =
                records.length - 1;
            i >= 0;
            i--
        ) {

            const record =
                records[i];


            if (
                !record ||
                typeof record !== "object"
            ) {

                continue;
            }


            const byValue =
                getField(
                    record,
                    [
                        "by_gsm",
                        "By_gsm",
                        "BY_GSM",
                        "by",
                        "By",
                        "BY"
                    ]
                );


            const bzValue =
                getField(
                    record,
                    [
                        "bz_gsm",
                        "Bz_gsm",
                        "BZ_GSM",
                        "bz",
                        "Bz",
                        "BZ"
                    ]
                );


            const btValue =
                getField(
                    record,
                    [
                        "bt",
                        "Bt",
                        "BT",
                        "bt_gsm",
                        "Bt_gsm",
                        "BT_GSM"
                    ]
                );


            const by =
                Number(byValue);


            const bz =
                Number(bzValue);


            const bt =
                Number(btValue);


            /*
            Accept the record if at least
            one magnetic field value exists.
            */

            if (
                Number.isFinite(by) ||
                Number.isFinite(bz) ||
                Number.isFinite(bt)
            ) {

                const time =
                    getField(
                        record,
                        [
                            "time_tag",
                            "time",
                            "timestamp"
                        ]
                    );


                current = {

                    by,

                    bz,

                    bt,

                    time
                };


                break;
            }
        }


        if (!current) {

            /*
            This is deliberately detailed so
            we can see exactly what NOAA sent.
            */

            console.error(
                "NO MAGNETIC RECORD FOUND"
            );


            console.error(
                "Records:",
                records
            );


            if (
                records[0]
            ) {

                console.error(
                    "First NOAA record keys:",
                    Object.keys(
                        records[0]
                    )
                );
            }


            throw new Error(
                "No magnetic measurements found. Check Diagnostic Information below."
            );
        }


        console.log(
            "CURRENT MAGNETIC:",
            current
        );


        /* =================================================
           BY
        ================================================= */

        if (
            Number.isFinite(
                current.by
            )
        ) {

            setText(
                "by",
                current.by.toFixed(1)
            );
        }


        /* =================================================
           BZ
        ================================================= */

        if (
            Number.isFinite(
                current.bz
            )
        ) {

            setText(
                "bz",
                current.bz.toFixed(1)
            );
        }


        /* =================================================
           BT
        ================================================= */

        if (
            Number.isFinite(
                current.bt
            )
        ) {

            setText(
                "bt",
                current.bt.toFixed(1)
            );
        }


        /* =================================================
           CLOCK ANGLE
        ================================================= */

        if (
            Number.isFinite(
                current.by
            ) &&
            Number.isFinite(
                current.bz
            )
        ) {

            let angle =
                Math.atan2(
                    current.by,
                    current.bz
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
        }


        /* =================================================
           TIME
        ================================================= */

        if (
            current.time
        ) {

            const date =
                new Date(
                    current.time
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
            "Solar wind error:",
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
            data.length === 0
        ) {

            throw new Error(
                "Empty Kp response"
            );
        }


        /*
        Handle both object and
        table responses.
        */

        let records =
            normalizeMagneticData(
                data
            );


        /*
        If NOAA returns normal objects,
        use them directly.
        */

        const valid =
            records.filter(
                record => {

                    const value =
                        getField(
                            record,
                            [
                                "kp_index",
                                "kp",
                                "Kp",
                                "KP"
                            ]
                        );


                    return Number.isFinite(
                        Number(value)
                    );
                }
            );


        if (
            valid.length === 0
        ) {

            throw new Error(
                "No valid Kp measurements"
            );
        }


        const latest =
            valid[
                valid.length - 1
            ];


        const kp =
            Number(
                getField(
                    latest,
                    [
                        "kp_index",
                        "kp",
                        "Kp",
                        "KP"
                    ]
                )
            );


        setText(
            "kp",
            kp.toFixed(1)
        );


        const time =
            getField(
                latest,
                [
                    "time_tag",
                    "time",
                    "timestamp"
                ]
            );


        if (time) {

            const date =
                new Date(time);


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
            valid.slice(-40);


        const labels =
            recent.map(
                record => {

                    const t =
                        getField(
                            record,
                            [
                                "time_tag",
                                "time",
                                "timestamp"
                            ]
                        );


                    if (!t) {
                        return "";
                    }


                    const date =
                        new Date(t);


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
                    Number(
                        getField(
                            record,
                            [
                                "kp_index",
                                "kp",
                                "Kp",
                                "KP"
                            ]
                        )
                    )
            );


        createChart(
            labels,
            values
        );


    } catch (error) {

        console.error(
            "Kp error:",
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
   UPDATE
===================================================== */

async function updateAll() {

    console.log(
        "NOAA update:",
        new Date().toISOString()
    );


    /*
    Run independently.
    One failure doesn't stop the others.
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
