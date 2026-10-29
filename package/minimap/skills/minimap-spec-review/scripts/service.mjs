#!/usr/bin/env node
import { createUserService } from "../runtime/src/user-service.js";

try {
  const [command, ...extra] = process.argv.slice(2);
  if (extra.length || !["install", "update", "rollback", "uninstall", "status"].includes(command)) throw new Error("Usage: service.mjs install|update|rollback|uninstall|status");
  const result = await createUserService().action(command);
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exitCode = result.code;
} catch (error) {
  process.stderr.write(error.message + "\n");
  process.exitCode = 1;
}
