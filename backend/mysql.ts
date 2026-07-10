import mysql, { Pool } from "mysql2/promise";

let pool: Pool | null = null;

// Lazy initialization of the MySQL connection pool
export function getMySQLPool(): Pool | null {
  if (pool) return pool;

  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;
  const port = parseInt(process.env.MYSQL_PORT || "3306", 10);

  if (!host || !user || !database) {
    // Missing required credentials, fallback mode active
    return null;
  }

  try {
    console.log(`[MySQL] Initializing connection pool to ${host}:${port}/${database}...`);
    pool = mysql.createPool({
      host,
      user,
      password,
      database,
      port,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    return pool;
  } catch (err) {
    console.error("[MySQL] Error creating connection pool:", err);
    return null;
  }
}

// Check if MySQL is active
export function isMySQLActive(): boolean {
  return getMySQLPool() !== null;
}

// Automatically bootstrap tables if we can connect
export async function bootstrapMySQLSchema(): Promise<boolean> {
  const activePool = getMySQLPool();
  if (!activePool) return false;

  try {
    console.log("[MySQL] Bootstrapping schema if tables do not exist...");
    
    // Create hcps table
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS hcps (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        hospital VARCHAR(255) NOT NULL,
        speciality VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        address TEXT NOT NULL
      )
    `);

    // Create products table
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(255) NOT NULL,
        description TEXT NOT NULL
      )
    `);

    // Create interactions table
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS interactions (
        id VARCHAR(50) PRIMARY KEY,
        hcpId VARCHAR(50) NOT NULL,
        hcpName VARCHAR(255) NOT NULL,
        hospital VARCHAR(255) NOT NULL,
        speciality VARCHAR(255) NOT NULL,
        date VARCHAR(20) NOT NULL,
        type VARCHAR(50) NOT NULL,
        summary TEXT NOT NULL,
        productsDiscussed TEXT NOT NULL, -- JSON or comma-separated
        samplesGiven TEXT NOT NULL,
        followUpRequired BOOLEAN NOT NULL DEFAULT FALSE,
        nextMeetingDate VARCHAR(20),
        priority VARCHAR(20) NOT NULL,
        notes TEXT NOT NULL
      )
    `);

    // Create follow_ups table
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS follow_ups (
        id VARCHAR(50) PRIMARY KEY,
        interactionId VARCHAR(50) NOT NULL,
        hcpId VARCHAR(50) NOT NULL,
        hcpName VARCHAR(255) NOT NULL,
        actionItem TEXT NOT NULL,
        dueDate VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Pending'
      )
    `);

    // Create activity_logs table
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id VARCHAR(50) PRIMARY KEY,
        action VARCHAR(255) NOT NULL,
        timestamp VARCHAR(50) NOT NULL,
        details TEXT NOT NULL,
        user VARCHAR(255) NOT NULL
      )
    `);

    console.log("[MySQL] Schema bootstrapped successfully!");
    return true;
  } catch (err) {
    console.error("[MySQL] Schema bootstrap failed:", err);
    return false;
  }
}
