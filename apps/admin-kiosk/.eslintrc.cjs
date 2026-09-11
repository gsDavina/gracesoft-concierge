module.exports = {
  extends: ["next/core-web-vitals"],
  rules: {
    ...require("@gracesoft/config/eslint/admin-boundary")("admin-kiosk"),
  },
};
