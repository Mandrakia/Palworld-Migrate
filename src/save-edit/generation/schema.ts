export interface EntityMeta {
  baseType?: string | null;  // default = "JsonWrapper"
  properties: Record<string, PropertyMeta>;
  typeResolver?: TypeResolver;
}

export interface PropertyMeta {
  type: string;           // e.g. "string", "number", "boolean", "CustomType", "CustomType[]"
  path: string[];         // navigation path
  doc?: string;           // optional: for documentation or hover
}

export interface TypeResolver {
  discriminatorPath: string[]; // e.g., ["RawData", "value", "object", "SaveParameter", "value", "IsPlayer"]
  mapping: Record<string, string>; // e.g., { "true": "Player", "false": "Monster" }
}
