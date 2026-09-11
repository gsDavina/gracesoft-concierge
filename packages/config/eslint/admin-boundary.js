/**
 * Enforces the architecture boundary from 03-project-structure.md:
 * admin-owner and admin-kiosk may only import from /packages, never from each other.
 *
 * Usage in an app's .eslintrc.cjs:
 *   rules: { ...require("@gracesoft/config/eslint/admin-boundary")("admin-owner") }
 */
module.exports = function adminBoundaryRules(selfAppName) {
  const otherApp = selfAppName === "admin-owner" ? "admin-kiosk" : "admin-owner";

  return {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [`**/apps/${otherApp}/**`, `@gracesoft/${otherApp}`, `${otherApp}/**`],
            message:
              "admin-owner and admin-kiosk must not import from each other. Share code via /packages instead.",
          },
        ],
      },
    ],
  };
};
