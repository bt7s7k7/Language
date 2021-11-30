import { DebugInfo } from "../DebugInfo"
import { Type } from "./Type"
import { Value } from "./Value"


export class Program {

    public getSymbol<T>(name: string, type: new (...args: any[]) => T) {
        const value = this.entries.get(name)
        if (!value) return null
        if (!(value instanceof type)) return null
        return value as T
    }

    constructor(
        public readonly entries: Map<string, Value | Type>,
        public readonly debug: DebugInfo.Builder,
        public readonly createdFunctions: Set<string>
    ) { }
}
