import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debug, warn, error, info } from "../src/core/logger";
import { setConfig, resetConfig } from "../src/core/config";

describe("logger", () => {
  const timestampedPrefix = "[SessionKit] [2026-08-01T12:00:00.000Z]";

  vi.spyOn(console, 'debug').mockImplementation(() => {});
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    process.env.NODE_ENV = 'development';
    resetConfig();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.NODE_ENV = 'test';
  });

  describe("debug", () => {
    it("does not log when debug is false", () => {
      setConfig({ debug: false });
      debug("test message");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("logs when debug is true", () => {
      setConfig({ debug: true });
      debug("test message", { foo: "bar" });
      expect(consoleLogSpy).toHaveBeenCalledWith(`${timestampedPrefix} test message`, { foo: "bar" });
    });
  });

  describe("warn", () => {
    it("logs in non-production even if debug is false", () => {
      process.env.NODE_ENV = 'development';
      setConfig({ debug: false });
      warn("test warning");
      expect(consoleWarnSpy).toHaveBeenCalledWith(`${timestampedPrefix} test warning`);
    });

    it("does not log in production if debug is false", () => {
      process.env.NODE_ENV = 'production';
      setConfig({ debug: false });
      warn("test warning");
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("logs in production if debug is true", () => {
      process.env.NODE_ENV = 'production';
      setConfig({ debug: true });
      warn("test warning");
      expect(consoleWarnSpy).toHaveBeenCalledWith(`${timestampedPrefix} test warning`);
    });
  });

  describe("error", () => {
    it("logs in non-production even if debug is false", () => {
      process.env.NODE_ENV = 'development';
      setConfig({ debug: false });
      error("test error");
      expect(consoleErrorSpy).toHaveBeenCalledWith(`${timestampedPrefix} test error`);
    });

    it("does not log in production if debug is false", () => {
      process.env.NODE_ENV = 'production';
      setConfig({ debug: false });
      error("test error");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("logs in production if debug is true", () => {
      process.env.NODE_ENV = 'production';
      setConfig({ debug: true });
      error("test error");
      expect(consoleErrorSpy).toHaveBeenCalledWith(`${timestampedPrefix} test error`);
    });
  });

  describe("info", () => {
    it("logs in non-production even if debug is false", () => {
      process.env.NODE_ENV = 'development';
      setConfig({ debug: false });
      info("test info");
      expect(consoleLogSpy).toHaveBeenCalledWith(`${timestampedPrefix} test info`);
    });

    it("does not log in production if debug is false", () => {
      process.env.NODE_ENV = 'production';
      setConfig({ debug: false });
      info("test info");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("logs in production if debug is true", () => {
      process.env.NODE_ENV = 'production';
      setConfig({ debug: true });
      info("test info");
      expect(consoleLogSpy).toHaveBeenCalledWith(`${timestampedPrefix} test info`);
    });
  });
});
