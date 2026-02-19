/**
 * Serial REPL manager using Node serialport.
 * Implements MicroPython-style paste (Ctrl+E ... Ctrl+D) and reset (Ctrl+D).
 */

import { SerialPort } from 'serialport';

const CONTROL_B = '\x02';
const CONTROL_C = '\x03';
const CONTROL_D = '\x04';
const CONTROL_E = '\x05';
const ENTER = '\r\n';
const LINE_SEP = /\r\n|\r|\n/;

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  productId?: string;
  vendorId?: string;
}

export class SerialReplManager {
  private port: SerialPort | null = null;
  private onDataCallback: ((chunk: string) => void) | null = null;
  private baudRate = 115200;

  async listPorts(): Promise<SerialPortInfo[]> {
    const list = await SerialPort.list();
    return list.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer,
      serialNumber: p.serialNumber,
      productId: p.productId,
      vendorId: p.vendorId,
    }));
  }

  isConnected(): boolean {
    return this.port !== null && this.port.isOpen;
  }

  connect(path: string, baudRate = 115200): Promise<void> {
    if (this.port) {
      return Promise.reject(new Error('Already connected'));
    }
    this.baudRate = baudRate;
    return new Promise((resolve, reject) => {
      const sp = new SerialPort(
        { path, baudRate },
        (err) => {
          if (err) {
            reject(err);
            return;
          }
          this.port = sp;
          this.port.on('data', (data: Buffer) => {
            const text = data.toString('utf8');
            if (this.onDataCallback) this.onDataCallback(text);
          });
          this.port.on('close', () => {
            this.port = null;
          });
          this.port.on('error', () => {
            this.port = null;
          });
          this.pulseDtrThenResolve(resolve);
        }
      );
    });
  }

  /**
   * Pulse DTR and RTS (low then high) to reset the board, then send Ctrl+B
   * like the original RS232/micro-repl. Many boards (e.g. STM32 Nucleo) show
   * a green LED when the serial port is opened and DTR/RTS is toggled.
   */
  private pulseDtrThenResolve(resolve: () => void): void {
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
        this.port!.set({ dtr: true, rts: true }, () => {
          this.wakeRepl().then(() => resolve());
        });
      }, 100);
    });
  }

  /** Send Ctrl+B a few times to wake the REPL (same as original RS232 connect). */
  private async wakeRepl(): Promise<void> {
    if (!this.port || !this.port.isOpen) return;
    for (let i = 0; i < 10; i++) {
      await this.write(CONTROL_B);
      await this.sleep(100);
      if (!this.port) break;
    }
  }

  onData(cb: (chunk: string) => void): void {
    this.onDataCallback = cb;
  }

  private async write(data: string): Promise<void> {
    if (!this.port || !this.port.isOpen) {
      throw new Error('Not connected');
    }
    return new Promise((resolve, reject) => {
      this.port!.write(data, (err) => (err ? reject(err) : resolve()));
    });
  }

  /** Send raw string to the device */
  async sendRaw(data: string): Promise<void> {
    await this.write(data);
  }

  /** MicroPython paste: Ctrl+E, then lines with \\r, then Ctrl+D */
  async paste(code: string): Promise<void> {
    const lines = code.split(LINE_SEP);
    await this.write(CONTROL_E);
    for (const line of lines) {
      await this.write(line + '\r');
      await this.sleep(10);
    }
    await this.write(CONTROL_D);
  }

  /** Soft reset: Ctrl+D */
  async reset(): Promise<void> {
    await this.write(CONTROL_D);
  }

  /** Interrupt: Ctrl+C */
  async interrupt(): Promise<void> {
    await this.write(CONTROL_C);
  }

  disconnect(): Promise<void> {
    if (!this.port) return Promise.resolve();
    return new Promise((resolve) => {
      const p = this.port!;
      this.port = null;
      p.close(() => resolve());
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}
