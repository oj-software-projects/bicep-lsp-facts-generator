import { readFile } from "fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export async function createSchemaValidator(schemaPath) {
  const schemaContent = await readFile(schemaPath, "utf8");
  const schema = JSON.parse(schemaContent);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  return (data) => {
    const valid = validate(data);
    if (!valid) {
      const errors = validate.errors?.map((err) => `${err.instancePath} ${err.message}`) ?? [];
      const message = errors.length ? errors.join("; ") : "Schema validation failed";
      throw new Error(message);
    }
  };
}
