/**
 * Entry point for cPanel/Passenger deployment (WHC.ca)
 * This file is used when deploying to shared hosting with Phusion Passenger
 */

// Set environment for Passenger
process.env.NODE_ENV = 'production';
process.env.PASSENGER = 'true';

// Load the compiled server and get the Express app
const server = require('./dist/index.cjs');

// Export the Express app for Passenger
module.exports = server.app || server;
