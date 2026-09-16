// JSON stdin/stdout bridge used only by Python parity tests, never by the API.
import { parseIndustryEventLog } from "../src/ingestion/industryEventLog.mjs";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const { text, sourceName, timezoneOffset } = JSON.parse(input);
process.stdout.write(
  JSON.stringify(parseIndustryEventLog(text, { sourceName, timezoneOffset })),
);
