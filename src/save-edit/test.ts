import { CharacterSave } from './models/CharacterSave'
import { Pal } from './models/Pal';
import { Player } from './models/Player';
import { ServerSave } from './models/ServerSave';

const charaData = require('./Level.sav.json');

const charaSave = new ServerSave(charaData);

function logWithGetters(obj: any) {
    const result: any = {};
    let proto = obj;

    while (proto && proto !== Object.prototype) {
        for (const key of Object.getOwnPropertyNames(proto)) {
            if (!(key in result)) {
                const descriptor = Object.getOwnPropertyDescriptor(proto, key);
                if (descriptor?.get) {
                    try {
                        result[key] = obj[key]; // Invoke the getter
                    } catch (e) {
                        result[key] = `[Error: ${e}]`;
                    }
                }
            }
        }
        proto = Object.getPrototypeOf(proto);
    }

    console.log(result);
}

for(let c of charaSave.ItemContainers){
    logWithGetters(c);
}