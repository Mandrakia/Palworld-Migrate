import * as fs from 'fs';
import * as path from 'path';
import { PropertyMeta, EntityMeta, TypeResolver } from './schema';
import { getSetting } from '../../lib/settings';

const metaPath = process.env.META || process.argv[2] || getSetting('metaPath');
if (!metaPath) {
  console.error('❌ Error: META path not specified. Use env META=..., pass as CLI arg, or set in settings.json');
  process.exit(1);
}

const resolvedMetaPath = path.resolve(process.cwd(), metaPath);
console.log(resolvedMetaPath);
const { EntitySchemas } = require(resolvedMetaPath) as { EntitySchemas: Record<string, EntityMeta> };
console.log(EntitySchemas);
const outputDir = path.resolve(__dirname, '..', getSetting('saveEdit').outputDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const knownPolymorphicTypes = new Set(
  Object.entries(EntitySchemas)
    .filter(([, m]) => !!m.typeResolver)
    .map(([name]) => name)
);

function parseType(typeStr: string) {
  const isList = typeStr.endsWith('[]');
  const baseType = isList ? typeStr.slice(0, -2) : typeStr;
  return { isList, baseType };
}

function extractDependencies(meta: EntityMeta): Set<string> {
  const deps = new Set<string>();

  // Base type
  const base = meta.baseType || 'JsonWrapper';
  deps.add(base);
  if(meta.typeResolver?.mapping){
    for(const derivedT of  Object.values(meta.typeResolver.mapping)){
      deps.add(derivedT);
    }
  }
  // Props
  for (const def of Object.values(meta.properties)) {
    const typeStr = (def as any).type;
    if (!typeStr) continue;
    const { baseType, isList } = parseType(typeStr);
    if (!['string', 'number', 'boolean', 'Date'].includes(baseType)) {
      deps.add(baseType);
    }
  }

  return deps;
}

function generateProperty(
  name: string,
  def: any,
  knownPolymorphicTypes: Set<string>
): string {
  const { type, path: rawPath } = def;
  const { isList, baseType } = parseType(type);
  const pathStr = JSON.stringify(rawPath);
  const comment = def.doc ? `\n  /** ${def.doc} */\n` : '';
 const isStd = baseType === "string" || baseType === "boolean" || baseType === "number";
const factory = knownPolymorphicTypes.has(baseType)
  ? `${baseType}Factory.fromNode`
  : `new ${baseType}`;

  if (isList) {
    if(!isStd){
    return `${comment}  get ${name}(): ${baseType}[] {
    return this.getPath(${pathStr})?.map((x: any) => ${factory}(x)) ?? [];
  }`;
    }
    else{
        return `${comment}  get ${name}(): ${baseType}[] {
    return this.getPath(${pathStr});
    }`;
    }
  }

  if (['string', 'number', 'boolean'].includes(baseType)) {
    return `${comment}  get ${name}(): ${baseType} {
    return this.getPath(${pathStr});
  }

  set ${name}(value: ${baseType}) {
    this.setPath(${pathStr}, value);
  }`;
  }
  if(baseType === 'Date'){
    return `${comment} get ${name}(): ${baseType} {
    const utcDate = this.ticksToDate(this.getPath(${pathStr}));
    // Convert UTC to local time by adjusting for timezone offset
    return new Date(utcDate.getTime() - (utcDate.getTimezoneOffset() * 60000));
  }

  set ${name}(value: ${baseType}) {
    // Convert local time to UTC before storing
    const utcValue = new Date(value.getTime() + (value.getTimezoneOffset() * 60000));
    this.setPath(${pathStr}, this.dateToTicks(utcValue));
  }`;
  }
  return `${comment}  get ${name}(): ${baseType} {
    return ${factory}(this.getPath(${pathStr}));
  }`;
}

function generateClass(name: string, meta: EntityMeta): string {
  const baseType = meta.baseType || 'JsonWrapper';
  const deps = extractDependencies(meta);

if (meta.typeResolver) {
  // Do NOT import own factory
  for (const derived of Object.values(meta.typeResolver.mapping)) {
    if (derived !== name) deps.add(derived);
  }
}
  // Generate imports
const importLines = Array.from(deps)
  .filter(dep => dep !== name)
  .map(dep => {
    if (knownPolymorphicTypes.has(dep)) {
      return `import { ${dep} } from './${dep}';\nimport { ${dep}Factory } from './${dep}Factory';`;
    }
    return `import { ${dep} } from './${dep}';`;
  })
  .join('\n');

  const props = Object.entries(meta.properties)
    .map(([k, v]) => generateProperty(k, v, knownPolymorphicTypes))
    .join('\n\n');



  return `${importLines}
export class ${name} extends ${baseType} {
  constructor(node: any) {
    super(node);
  }

${props}
}
`;
}

function generateFactoryClass(name: string, resolver: TypeResolver): string {
  const pathAccess = resolver.discriminatorPath.map(p => `?.${p}`).join('');
  const defaultV = resolver.mapping["default"] ?? name;
  const mappingLines = Object.entries(resolver.mapping)
    .filter(a=> a[0] !== "default")
    .map(([key, type]) => `      case "${key}": return new ${type}(node);`)
    .join('\n');

  const allTypes = new Set<string>([name, ...Object.values(resolver.mapping)]);
const importLines = Array.from(allTypes)
  .filter(type => type !== name)
  .map(type => `import { ${type} } from './${type}';`)
  .concat(`import { ${name} } from './${name}';`)
  .join('\n');

  return `${importLines}

export class ${name}Factory {
  static fromNode(node: any): ${name} {
    const value = node${pathAccess};
    switch (String(value)) {
${mappingLines}
      default: return new ${defaultV}(node);
    }
  }
}
`;
}

// Write each entity as its own file
for (const [name, meta] of Object.entries(EntitySchemas)) {
  const fileContent = generateClass(name, meta);
  const filePath = path.join(outputDir, `${name}.ts`);
  fs.writeFileSync(filePath, fileContent, 'utf-8');
  console.log(`✅ Generated: ${filePath}`);
}
for (const [name, meta] of Object.entries(EntitySchemas)) {
  if (!meta.typeResolver) continue;
  const factoryCode = generateFactoryClass(name, meta.typeResolver);
  const factoryPath = path.join(outputDir, `${name}Factory.ts`);
  fs.writeFileSync(factoryPath, factoryCode, 'utf-8');
  console.log(`✅ Generated factory: ${factoryPath}`);
}