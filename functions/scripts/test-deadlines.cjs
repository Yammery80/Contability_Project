const path = require("node:path");

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = "demo-contability-test";
process.env.GOOGLE_CLOUD_PROJECT = "demo-contability-test";

async function main() {
  const functionPath = path.resolve(
    __dirname,
    "../lib/index.js"
  );

  const {processTaskDeadlines} = require(functionPath);

  console.log("Iniciando revisión local de vencimientos...");

  await processTaskDeadlines();

  console.log("Prueba local finalizada.");
}

main().catch((error) => {
  console.error("Error durante la prueba:", error);
  process.exitCode = 1;
});