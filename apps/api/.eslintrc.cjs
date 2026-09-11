module.exports = {
  extends: ["@gracesoft/config/eslint/base.js"],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: __dirname,
  },
};
