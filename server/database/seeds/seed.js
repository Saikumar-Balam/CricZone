import "dotenv/config";
import fs from "fs";
import databaseClient from "../../src/containers/database.container.js"


const seedDatabase = async () => {
  try {
    const sql = fs.readFileSync(
      new URL("./seed.sql", import.meta.url),
      "utf8"
    );

    console.log("Seeding database...");

    await databaseClient.query(sql);

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Database seeding failed:");
    console.error(error);

    process.exitCode = 1;
  } finally {
    await databaseClient.disconnect();
  }
};

seedDatabase();