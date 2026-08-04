import { describe, expect, it } from "vitest";
import { err, isErr, isOk, ok, unwrap, type Result } from "./result.js";

describe("Result helpers", () => {
  it("ok() creates a success result recognized by isOk", () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
  });

  it("err() creates a failure result recognized by isErr", () => {
    const result = err("boom");
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
  });

  it("unwrap() returns the value for an ok result", () => {
    expect(unwrap(ok("value"))).toBe("value");
  });

  it("unwrap() throws the error for a failed result", () => {
    const result: Result<never, Error> = err(new Error("failure"));
    expect(() => unwrap(result)).toThrow("failure");
  });

  it("unwrap() wraps non-Error failures", () => {
    const result: Result<never, string> = err("plain string error");
    expect(() => unwrap(result)).toThrow("plain string error");
  });
});
