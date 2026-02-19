"use strict";
/**
 * Serial REPL manager using Node serialport.
 * Implements MicroPython-style paste (Ctrl+E ... Ctrl+D) and reset (Ctrl+D).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SerialReplManager = void 0;
const serialport_1 = require("serialport");
const CONTROL_B = '\x02';
const CONTROL_C = '\x03';
const CONTROL_D = '\x04';
const CONTROL_E = '\x05';
const ENTER = '\r\n';
const LINE_SEP = /\r\n|\r|\n/;
class SerialReplManager {
    constructor() {
        this.port = null;
        this.onDataCallback = null;
        this.baudRate = 115200;
    }
    async listPorts() {
        const list = await serialport_1.SerialPort.list();
        return list.map((p) => ({
            path: p.path,
            manufacturer: p.manufacturer,
            serialNumber: p.serialNumber,
            productId: p.productId,
            vendorId: p.vendorId,
        }));
    }
    isConnected() {
        return this.port !== null && this.port.isOpen;
    }
    connect(path, baudRate = 115200) {
        if (this.port) {
            return Promise.reject(new Error('Already connected'));
        }
        this.baudRate = baudRate;
        return new Promise((resolve, reject) => {
            const sp = new serialport_1.SerialPort({ path, baudRate }, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.port = sp;
                this.port.on('data', (data) => {
                    const text = data.toString('utf8');
                    if (this.onDataCallback)
                        this.onDataCallback(text);
                });
                this.port.on('close', () => {
                    this.port = null;
                });
                this.port.on('error', () => {
                    this.port = null;
                });
                this.pulseDtrThenResolve(resolve);
            });
        });
    }
    /**
     * Pulse DTR and RTS (low then high) to reset the board, then send Ctrl+B
     * like the original RS232/micro-repl. Many boards (e.g. STM32 Nucleo) show
     * a green LED when the serial port is opened and DTR/RTS is toggled.
     */
    pulseDtrThenResolve(resolve) {
        if (!this.port || !this.port.isOpen) {
            resolve();
            return;
        }
        this.port.set({ dtr: false, rts: false }, (setErr) => {
            if (setErr) {
                resolve();
                return;
            }
            setTimeout(() => {
                if (!this.port || !this.port.isOpen) {
                    resolve();
                    return;
                }
                this.port.set({ dtr: true, rts: true }, () => {
                    this.wakeRepl().then(() => resolve());
                });
            }, 100);
        });
    }
    /** Send Ctrl+B a few times to wake the REPL (same as original RS232 connect). */
    async wakeRepl() {
        if (!this.port || !this.port.isOpen)
            return;
        for (let i = 0; i < 10; i++) {
            await this.write(CONTROL_B);
            await this.sleep(100);
            if (!this.port)
                break;
        }
    }
    onData(cb) {
        this.onDataCallback = cb;
    }
    async write(data) {
        if (!this.port || !this.port.isOpen) {
            throw new Error('Not connected');
        }
        return new Promise((resolve, reject) => {
            this.port.write(data, (err) => (err ? reject(err) : resolve()));
        });
    }
    /** Send raw string to the device */
    async sendRaw(data) {
        await this.write(data);
    }
    /** MicroPython paste: Ctrl+E, then lines with \\r, then Ctrl+D */
    async paste(code) {
        const lines = code.split(LINE_SEP);
        await this.write(CONTROL_E);
        for (const line of lines) {
            await this.write(line + '\r');
            await this.sleep(10);
        }
        await this.write(CONTROL_D);
    }
    /** Soft reset: Ctrl+D */
    async reset() {
        await this.write(CONTROL_D);
    }
    /** Interrupt: Ctrl+C */
    async interrupt() {
        await this.write(CONTROL_C);
    }
    disconnect() {
        if (!this.port)
            return Promise.resolve();
        return new Promise((resolve) => {
            const p = this.port;
            this.port = null;
            p.close(() => resolve());
        });
    }
    sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }
}
exports.SerialReplManager = SerialReplManager;
