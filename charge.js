"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redis = require("redis");
const util = require("util");

// Redis key for the account balance
const KEY = `account1/balance`;
// Default balance if not set in Redis
const DEFAULT_BALANCE = 100;

// Redis client instance
let redisClient;

// Handler for charging the account balance
exports.chargeRequestRedis = async function (event) {
  // Create Redis client if not already initialized
  if (!redisClient) {
    redisClient = await createRedisClient();
  }

  // Extract serviceType and unit from the event
  const { serviceType, unit } = event;

  // Throw an error if serviceType or unit is missing
  if (!serviceType || !unit) {
      throw new Error("Missing serviceType or unit");
  }

  // Throw an error if unit is negative
  if (unit < 0) {
    throw new Error("Invalid unit value. Unit cannot be negative.");
  }

  // Retrieve the remaining balance from Redis
  let remainingBalance;
  try {
    remainingBalance = await getBalanceRedis(KEY);
  } catch (error) {
    console.error("Failed to retrieve balance from Redis:", error);
    throw new Error("Failed to retrieve balance from Redis");
  }

  // Calculate the charges based on serviceType and unit
  const charges = getCharges(serviceType, unit);

  // Check if the request is authorized based on the remaining balance
  const isAuthorized = authorizeRequest(remainingBalance, charges);

  // If not authorized, return the current balance and zero charges
  if (!isAuthorized) {
    return {
      remainingBalance,
      isAuthorized,
      charges: 0,
    };
  }

  // Deduct the charges from the balance and update it in Redis
  try {
    await chargeRedis(KEY, charges);
  } catch (error) {
    console.error("Failed to charge balance in Redis:", error);
    throw new Error("Failed to charge balance in Redis");
  }

  // Return the updated balance, charges, and authorization status
  return {
    remainingBalance: remainingBalance - charges,
    charges,
    isAuthorized,
  };
};

// Handler for resetting the account balance to the default value
exports.resetRedis = async function () {
  // Create Redis client if not already initialized
  if (!redisClient) {
    redisClient = await createRedisClient();
  }

  // Reset the balance to the default value in Redis
  try {
    await resetBalanceRedis(DEFAULT_BALANCE);
  } catch (error) {
    console.error("Failed to reset balance in Redis:", error);
    throw new Error("Failed to reset balance in Redis");
  }

  // Return the default balance
  return DEFAULT_BALANCE;
};

// Create a Redis client instance and return a promise that resolves to the client
async function createRedisClient() {
  const redisURL = `redis://${process.env.ENDPOINT}:${process.env.PORT || "6379"}`;
  const client = redis.createClient(redisURL);

  // Handle errors that occur with the Redis client
  client.on("error", (error) => {
    console.error("Redis client error:", error);
  });

  // Return a promise that resolves to the Redis client when it's ready
  return new Promise((resolve, reject) => {
    client.on("ready", () => {
      console.log("Redis client ready");
      resolve(client);
    });
    client.on("error", (error) => {
      reject(error);
    });
  });
}

// Reset the balance value to the provided value in Redis
async function resetBalanceRedis(balance) {
  return util.promisify(redisClient.set).bind(redisClient)(KEY, String(balance));
}

// Get the balance value from Redis and parse it as an integer
async function getBalanceRedis(key) {
  return parseInt(await util.promisify(redisClient.get).bind(redisClient)(key) || "0");
}

// Deduct the charges from the balance in Redis
async function chargeRedis(key, charges) {
  return util.promisify(redisClient.decrby).bind(redisClient)(key, charges);
}

// Check if the remaining balance is sufficient for the charges
function authorizeRequest(remainingBalance, charges) {
  return remainingBalance >= charges;
}

// Get the charges based on the service type and unit
function getCharges(serviceType, unit) {
  const chargeRates = {
    voice: 2,
    data: 5,
    // Add more service types and their corresponding charge rates here
  };

  if (serviceType in chargeRates) {
    return chargeRates[serviceType] * unit;
  }

  throw new Error("Invalid service type");
}