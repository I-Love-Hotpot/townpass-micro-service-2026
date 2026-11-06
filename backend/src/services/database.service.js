import mysql from "mysql2/promise";

export function createDatabasePool(env = process.env) {
  const port = Number(env.MYSQL_PORT ?? 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("MYSQL_PORT must be a valid TCP port");
  }

  return mysql.createPool({
    host: env.MYSQL_HOST,
    port,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_PASSWORD,
    charset: "utf8mb4",
    connectTimeout: 5000,
    connectionLimit: 5,
    waitForConnections: false,
  });
}
