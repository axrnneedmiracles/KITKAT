/**
 * Vercel Serverless Function Entrypoint
 * Bridges Vercel serverless requests directly to the SHEcurity Express Application.
 */

const app = require("../website-server/backend/server");

module.exports = app;

