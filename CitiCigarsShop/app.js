/**
 * Entry point for cPanel/Passenger deployment (WHC.ca)
 * This file is used when deploying to shared hosting with Phusion Passenger
 */

// Set production environment
process.env.NODE_ENV = 'production';

// Load the compiled server
require('./dist/index.cjs');
