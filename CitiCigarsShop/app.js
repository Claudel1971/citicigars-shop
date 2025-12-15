/**
 * Entry point for cPanel/Passenger deployment (WHC.ca)
 * This file is used when deploying to shared hosting with Phusion Passenger
 */

// Set production environment
process.env.NODE_ENV = 'production';

// Load the compiled server and get the Express app
const server = require('./dist/index.cjs');

// Export the Express app for Passenger
// Passenger will handle starting the server
module.exports = server.app || server;
