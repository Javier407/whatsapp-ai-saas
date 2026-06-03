// Vitest global test setup.
// - Registers @testing-library/jest-dom matchers on Vitest's `expect`.
// - Unmounts React trees after each test so cases stay isolated.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
