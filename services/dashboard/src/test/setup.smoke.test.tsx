import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// Smoke test for the test toolchain itself: confirms vitest runs, jsdom is the
// environment, React Testing Library can render, and jest-dom matchers are wired.
function Hello() {
  return <button type="button">Hola</button>;
}

describe("dashboard test toolchain", () => {
  it("renders a component into jsdom and applies jest-dom matchers", () => {
    render(<Hello />);
    expect(screen.getByRole("button", { name: "Hola" })).toBeInTheDocument();
  });
});
