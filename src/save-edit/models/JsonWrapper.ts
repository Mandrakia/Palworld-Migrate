export class JsonWrapper {
  protected _node: any;

  constructor(node: any) {
    this._node = node;
  }

  protected getPath(path: string[]): any {
    return path.reduce((obj, key) => obj?.[key], this._node);
  }

  protected setPath(path: string[], value: any): void {
    let obj = this._node;
    for (let i = 0; i < path.length - 1; i++) {
      if (!(path[i] in obj)) obj[path[i]] = {};
      obj = obj[path[i]];
    }
    obj[path[path.length - 1]] = value;
  }
  protected ticksToDate(ticks: number): Date {
    const ticksPerMillisecond = 10_000;
    const epochTicks = 621355968000000000; // Ticks at Unix epoch (1970-01-01T00:00:00Z)

    const millisecondsSinceUnixEpoch = (ticks - epochTicks) / ticksPerMillisecond;
    return new Date(millisecondsSinceUnixEpoch);
  }
  protected dateToTicks(date: Date): number {
    const ticksPerMillisecond = 10_000;
    const epochTicks = 621355968000000000; // Ticks at Unix epoch (1970-01-01T00:00:00Z)

    return epochTicks + date.getTime() * ticksPerMillisecond;
  }

  toJSON(): any {
    const result: any = {};
    let proto = Object.getPrototypeOf(this);
    
    // Walk up the prototype chain to collect all getters
    while (proto && proto !== Object.prototype) {
      const descriptors = Object.getOwnPropertyDescriptors(proto);
      
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (key !== 'constructor' && descriptor.get && typeof descriptor.get === 'function' && !result.hasOwnProperty(key)) {
          try {
            result[key] = this[key as keyof this];
          } catch (error) {
            // Skip getters that throw errors
          }
        }
      }
      
      proto = Object.getPrototypeOf(proto);
    }
    
    return result;
  }
}
