import { describe, expect, it } from "bun:test";
import { getJoinableConferenceUrl, isJoinableUrl } from "./event-join-url.util";

describe("isJoinableUrl", () => {
  it("returns true for a valid https URL", () => {
    expect(isJoinableUrl("https://meet.google.com/abc-defg-hij")).toBe(true);
  });

  it("returns true for a plain http URL", () => {
    expect(isJoinableUrl("http://meet.example.com/x")).toBe(true);
  });

  it("returns true for an uppercase HTTPS URL", () => {
    expect(isJoinableUrl("HTTPS://Meet.Example.com")).toBe(true);
  });

  it("returns false for a javascript: URL", () => {
    expect(isJoinableUrl("javascript:alert(1)")).toBe(false);
  });

  it("returns false for a data: URL", () => {
    expect(isJoinableUrl("data:text/html,<script>x</script>")).toBe(false);
  });

  it("returns false for a vbscript: URL", () => {
    expect(isJoinableUrl("vbscript:msgbox(1)")).toBe(false);
  });

  it("returns false for a file: URL", () => {
    expect(isJoinableUrl("file:///etc/passwd")).toBe(false);
  });

  it("returns false for a protocol-relative URL", () => {
    expect(isJoinableUrl("//meet.google.com/x")).toBe(false);
  });

  it("returns false for a bare domain URL", () => {
    expect(isJoinableUrl("meet.google.com/x")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isJoinableUrl("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isJoinableUrl(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isJoinableUrl(undefined)).toBe(false);
  });
});

describe("getJoinableConferenceUrl", () => {
  it("returns null when conference is undefined", () => {
    expect(getJoinableConferenceUrl(undefined)).toBe(null);
  });

  it("returns null when conference is null", () => {
    expect(getJoinableConferenceUrl(null as any)).toBe(null);
  });

  it("returns the original string for a valid https conference", () => {
    const rawUrl = "https://meet.google.com/abc-defg-hij";
    const conference = { url: rawUrl, label: "x" } as any;
    expect(getJoinableConferenceUrl(conference)).toBe(rawUrl);
  });

  it("returns null for a javascript: conference URL", () => {
    const conference = { url: "javascript:alert(1)", label: null } as any;
    expect(getJoinableConferenceUrl(conference)).toBe(null);
  });
});
