import { expect } from "@playwright/test";

export function failOnBrowserErrors(page) {
  const errors = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console.error: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

  return () => expect(errors, "unexpected browser errors").toEqual([]);
}
