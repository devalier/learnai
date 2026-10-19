/**
 * Pre-flight: the checks the server runs at startup, without starting it.
 *
 *   set -a; . /etc/learnai.env; set +a; npm run check:env
 *
 * Evaluated as production unless NODE_ENV says otherwise. Exit 1 if the server would
 * refuse to start; warnings are printed but do not fail.
 */
import { checkEnvironment } from "../src/lib/startup";

const env = { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "production" };
const { errors, warnings } = checkEnvironment(env);
for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`ERROR:   ${e}`);
if (errors.length) {
  console.log(`\nThe server would refuse to start (${errors.length} error${errors.length > 1 ? "s" : ""}).`);
  process.exit(1);
}
console.log(warnings.length ? "\nThe server would start (with the warnings above)." : "Configuration looks good.");
