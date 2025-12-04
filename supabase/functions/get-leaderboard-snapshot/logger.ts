export const logger = {
  function: {
    start: () => {},
    step: (_msg: string) => {},
    success: (_msg?: string, _extra?: unknown) => {},
    error: (_msg: string, _error: unknown) => {},
  },
  env: {
    missing: (_keys: string[]) => {},
    check: (_hasUrl: boolean, _hasKey: boolean) => {},
  },
  request: {
    parsing: () => {},
    validation: (_value: unknown, _ok: boolean) => {},
    error: (_err: unknown) => {},
  },
  db: {
    operation: (_msg: string) => {},
    error: (_msg: string, _err: unknown) => {},
  },
};

