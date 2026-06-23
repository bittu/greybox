let chalk: any;
try {
  chalk = require('chalk');
} catch {
  chalk = {
    gray: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
    cyan: (s: string) => s,
    white: (s: string) => s,
    bold: (s: string) => s,
    bgGray: { black: { bold: (s: string) => s } },
    bgGreen: { black: { bold: (s: string) => s } },
    bgRed: { black: { bold: (s: string) => s } },
    bgYellow: { black: { bold: (s: string) => s } },
    bgCyan: { black: { bold: (s: string) => s } },
  };
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LoggerDelegate {
  log(level: LogLevel, message: string): void;
}

class ConsoleDelegate implements LoggerDelegate {
  log(level: LogLevel, message: string): void {
    process.stdout.write(message + '\n');
  }
}

const LEVEL_COLOR: Record<LogLevel, (s: string) => string> = {
  info: (s) => chalk.white(s),
  warn: (s) => chalk.yellow(s),
  error: (s) => chalk.red(s),
  debug: (s) => chalk.gray(s),
};

const LABEL_BG: Record<string, (s: string) => string> = {
  STEP: (s) => chalk.bgCyan.black?.bold(s) ?? s,
  CODE: (s) => chalk.bgGray.black?.bold(s) ?? s,
  CACHE: (s) => chalk.bgGreen.black?.bold(s) ?? s,
  WARN: (s) => chalk.bgYellow.black?.bold(s) ?? s,
  ERROR: (s) => chalk.bgRed.black?.bold(s) ?? s,
  SUCCESS: (s) => chalk.bgGreen.black?.bold(s) ?? s,
  RETRY: (s) => chalk.bgYellow.black?.bold(s) ?? s,
};

class Logger {
  private static _instance: Logger;
  private _delegate: LoggerDelegate = new ConsoleDelegate();
  private _level: LogLevel = 'info';

  static get instance(): Logger {
    if (!this._instance) this._instance = new Logger();
    return this._instance;
  }

  setDelegate(d: LoggerDelegate): void {
    this._delegate = d;
  }
  setLevel(l: LogLevel): void {
    this._level = l;
  }

  private shouldLog(level: LogLevel): boolean {
    const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return order.indexOf(level) >= order.indexOf(this._level);
  }

  private send(level: LogLevel, message: string): void {
    if (!this.shouldLog(level)) return;
    this._delegate.log(level, LEVEL_COLOR[level](message));
  }

  info(msg: string): void {
    this.send('info', msg);
  }
  warn(msg: string): void {
    this.send('warn', msg);
  }
  error(msg: string): void {
    this.send('error', msg);
  }
  debug(msg: string): void {
    this.send('debug', msg);
  }

  labeled(label: string): {
    info(m: string): void;
    warn(m: string): void;
    error(m: string): void;
    debug(m: string): void;
  } {
    const tag = (LABEL_BG[label] ?? ((s: string) => `[${s}]`))(` ${label} `);
    const fmt = (level: LogLevel, m: string) => this.send(level, `${tag} ${m}`);
    return {
      info: (m) => fmt('info', m),
      warn: (m) => fmt('warn', m),
      error: (m) => fmt('error', m),
      debug: (m) => fmt('debug', m),
    };
  }

  progress(
    label: string,
    initial: string,
  ): { update(m: string): void; succeed(m: string): void; fail(m: string): void } {
    const tag = (LABEL_BG[label] ?? ((s: string) => `[${s}]`))(` ${label} `);
    this.send('info', `${tag} ${initial}`);
    return {
      update: (m) => this.send('info', `${tag} ${m}`),
      succeed: (m) => this.send('info', `${(LABEL_BG.SUCCESS ?? ((s: string) => s))(` ✓ `)} ${m}`),
      fail: (m) => this.send('error', `${(LABEL_BG.ERROR ?? ((s: string) => s))(` ✗ `)} ${m}`),
    };
  }

  logCode(code: string): void {
    this.labeled('CODE').debug(code.replace(/\n/g, ' ').slice(0, 200));
  }
}

export const logger = Logger.instance;
export { Logger };
