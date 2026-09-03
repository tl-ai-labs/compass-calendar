import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, mock } from "bun:test";
import "@testing-library/jest-dom";

import { EVENT_JOIN_CONTROL_ATTRIBUTE } from "@web/grid/interaction/dom";
import { type EventPosition } from "@web/grid/types/grid.types";
import { EventJoinIcon } from "./EventJoinIcon";

const defaultPosition: EventPosition = {
  height: 50,
  left: 0,
  top: 0,
  width: 100,
};

describe("EventJoinIcon", () => {
  it("renders a named link", () => {
    render(
      <EventJoinIcon
        baseColor="#3b82f6"
        eventTitle="Planning block"
        position={defaultPosition}
        url="https://meet.example.com/xyz"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Join Planning block" }),
    ).toBeInTheDocument();
  });

  it("sets target, rel, and href attributes correctly", () => {
    const url = "https://meet.example.com/xyz";
    render(
      <EventJoinIcon
        baseColor="#3b82f6"
        eventTitle="Planning block"
        position={defaultPosition}
        url={url}
      />,
    );

    const link = screen.getByRole("link", { name: "Join Planning block" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("href", url);
  });

  it("yields accessible name 'Join Untitled event' when eventTitle is empty", () => {
    render(
      <EventJoinIcon
        baseColor="#3b82f6"
        eventTitle=""
        position={defaultPosition}
        url="https://meet.example.com/xyz"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Join Untitled event" }),
    ).toBeInTheDocument();
  });

  it("allows the data attribute to be reachable from the real pointer target", () => {
    render(
      <EventJoinIcon
        baseColor="#3b82f6"
        eventTitle="Planning block"
        position={defaultPosition}
        url="https://meet.example.com/xyz"
      />,
    );

    const link = screen.getByRole("link", { name: "Join Planning block" });
    const svg = link.querySelector("svg");
    expect(svg?.closest(`[${EVENT_JOIN_CONTROL_ATTRIBUTE}]`)).toBe(link);
  });

  it("renders nothing when url is javascript:alert(1)", () => {
    render(
      <EventJoinIcon
        baseColor="#3b82f6"
        eventTitle="Planning block"
        position={defaultPosition}
        url="javascript:alert(1)"
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders nothing for data: and vbscript: URLs", () => {
    const { rerender } = render(
      <EventJoinIcon
        baseColor="#3b82f6"
        eventTitle="Planning block"
        position={defaultPosition}
        url="data:text/html,<script>"
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();

    rerender(
      <EventJoinIcon
        baseColor="#3b82f6"
        eventTitle="Planning block"
        position={defaultPosition}
        url="vbscript:msgbox(1)"
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders nothing for not a url, /relative, and empty string URLs", () => {
    const { rerender } = render(
      <EventJoinIcon
        baseColor="#3b82f6"
        eventTitle="Planning block"
        position={defaultPosition}
        url="not a url"
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();

    rerender(
      <EventJoinIcon
        baseColor="#3b82f6"
        eventTitle="Planning block"
        position={defaultPosition}
        url="/relative"
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();

    rerender(
      <EventJoinIcon
        baseColor="#3b82f6"
        eventTitle="Planning block"
        position={defaultPosition}
        url=""
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
  });

  // S-1. These parse to an off-site host with no base, but a browser resolves
  // an href against the page: when the URL's scheme matches the page's and no
  // `//` authority follows, the parser enters the relative state and inherits
  // the page's host instead of reading one. `https:/evil.test/x` then navigates
  // to `https://<page-host>/evil.test/x`, and `https:/cleanup` reaches an in-app
  // route that wipes local storage on mount — a same-origin navigation
  // primitive driven by whatever conference URL a stranger's meeting invite
  // carries. The scheme check alone passes every one of these.
  //
  // The divergence is scheme-conditional, so the page's own scheme decides
  // which inputs are dangerous. This suite's default base is http://localhost/,
  // which would only exercise the `http:` variants; the base is pinned to https
  // below so the case that matters in production is the one under test.
  describe("base-relative forms (S-1)", () => {
    const setBase = (href: string) => {
      const base = document.createElement("base");
      base.href = href;
      document.head.appendChild(base);
      return () => base.remove();
    };

    it.each([
      "https:/evil.test/x",
      "https:/cleanup",
      "https:foo",
    ])("renders nothing for %s on an https page", (url) => {
      const restore = setBase("https://victim.test/app/");

      try {
        render(
          <EventJoinIcon
            baseColor="#3b82f6"
            eventTitle="Planning block"
            position={defaultPosition}
            url={url}
          />,
        );

        expect(screen.queryByRole("link")).toBeNull();
      } finally {
        restore();
      }
    });

    it("renders nothing for http:/evil.test/x on an http page", () => {
      render(
        <EventJoinIcon
          baseColor="#3b82f6"
          eventTitle="Planning block"
          position={defaultPosition}
          url="http:/evil.test/x"
        />,
      );

      expect(screen.queryByRole("link")).toBeNull();
    });

    it("still renders a fully-qualified https url on an https page", () => {
      const restore = setBase("https://victim.test/app/");

      try {
        render(
          <EventJoinIcon
            baseColor="#3b82f6"
            eventTitle="Planning block"
            position={defaultPosition}
            url="https://meet.example.com/abc"
          />,
        );

        expect(
          screen.getByRole("link", { name: "Join Planning block" }),
        ).toHaveAttribute("href", "https://meet.example.com/abc");
      } finally {
        restore();
      }
    });
  });

  it("still renders a fully-qualified url that needs no base", () => {
    const url = "https://evil-looking-but-absolute.example.com/x";
    render(
      <EventJoinIcon
        baseColor="#3b82f6"
        eventTitle="Planning block"
        position={defaultPosition}
        url={url}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Join Planning block" }),
    ).toHaveAttribute("href", url);
  });

  it("renders when url has uppercase scheme HTTPS://MEET.EXAMPLE.COM/x", () => {
    const url = "HTTPS://MEET.EXAMPLE.COM/x";
    render(
      <EventJoinIcon
        baseColor="#3b82f6"
        eventTitle="Planning block"
        position={defaultPosition}
        url={url}
      />,
    );

    const link = screen.getByRole("link", { name: "Join Planning block" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", url);
  });

  it("prevents mousedown from reaching a parent handler", () => {
    const parentSpy = mock();
    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test wrapper simulates a parent shortcut listener.
      <div onMouseDown={parentSpy}>
        <EventJoinIcon
          baseColor="#3b82f6"
          eventTitle="Planning block"
          position={defaultPosition}
          url="https://meet.example.com/xyz"
        />
      </div>,
    );

    const link = screen.getByRole("link", { name: "Join Planning block" });
    fireEvent.mouseDown(link);
    expect(parentSpy).not.toHaveBeenCalled();
  });

  it("positions the control with expected geometry and rightInsetPx", () => {
    render(
      <EventJoinIcon
        baseColor="#3b82f6"
        eventTitle="Planning block"
        position={{ height: 60, left: 10, top: 20, width: 140 }}
        rightInsetPx={16}
        url="https://meet.example.com/xyz"
      />,
    );

    const link = screen.getByRole("link", { name: "Join Planning block" });
    expect(link.style.left).toBe("110px");
    expect(link.style.top).toBe("38px");
    expect(link.style.width).toBe("24px");
    expect(link.style.height).toBe("24px");
  });
});
