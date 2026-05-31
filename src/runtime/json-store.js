import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export class JsonStore {
  constructor(file) {
    this.file = file;
  }

  async read(defaultValue = {}) {
    try {
      return JSON.parse(await readFile(this.file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return defaultValue;
      throw error;
    }
  }

  async write(value) {
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  }
}
