/*
 * © 2026 SeXyxeon (VOIDSEC)
 */

import { spawn } from "child_process";
import pidusage from "pidusage";
import { log } from "@sabir7718/log";

const S7HaTeSY_FILE = "index.js";
const SABIR7718_RAM = 720;
const SYHaTe_CPU = 70;
const HaTe_SY_INTERVAL = 5000;
const S7_COOL = 10000;

let HaTe_CHILD;
let SY_LAST = 0;
let S7_RESTARTING = false;

function S7_START() {
    log("info", "SYSTEM", "Start");

    HaTe_CHILD = spawn("node", [S7HaTeSY_FILE], {
        stdio: "inherit"
    });

    HaTe_CHILD.on("exit", (code) => {
        log("warn", "SYSTEM", `Exit ${code}`);

        setTimeout(() => {
            S7_RESTARTING = false;
            S7_START();
        }, 3000);
    });
}

function SABIR_RESTART(reason) {
    const now = Date.now();

    if (now - SY_LAST < S7_COOL) {
        log("warn", "SYSTEM", "Cooldown");
        return;
    }

    if (S7_RESTARTING) return;

    SY_LAST = now;
    S7_RESTARTING = true;

    log("error", "SYSTEM", reason);

    try {
        HaTe_CHILD.kill("SIGKILL");
    } catch (e) {
        log("error", "SYSTEM", e.message);
        S7_RESTARTING = false;
    }
}

function SY_MONITOR() {
    setInterval(async () => {
        if (!HaTe_CHILD?.pid) return;

        try {
            const s7 = await pidusage(HaTe_CHILD.pid);

            const hate_ram = s7.memory / 1024 / 1024;
            const hate_cpu = s7.cpu;

            log(
                "info",
                "SYSTEM",
                `RAM ${hate_ram.toFixed(2)} MB | CPU ${hate_cpu.toFixed(1)}%`
            );

            if (hate_ram > SABIR7718_RAM) {
                return SABIR_RESTART(`RAM ${hate_ram.toFixed(2)}`);
            }

            if (hate_cpu > SYHaTe_CPU) {
                return SABIR_RESTART(`CPU ${hate_cpu.toFixed(1)}`);
            }
        } catch (err) {
            log("error", "SYSTEM", err.message);
        }
    }, HaTe_SY_INTERVAL);
}

S7_START();
SY_MONITOR();