import { ExecutableHeader } from "../vm/ExecutableHeader"
import { AssembledFunction } from "./FunctionIR"

export class Assembler {
    public readonly chunks: ArrayBuffer[] = []
    public readonly header: ExecutableHeader = {
        data: [],
        functions: []
    }
    public length = 0

    public addFunction(func: AssembledFunction) {
        func.header.offset = this.length
        this.chunks.push(func.data)
        this.length += func.data.byteLength
        this.header.functions.push(func.header)
    }

    public concatData() {
        const result = new Uint8Array(this.length)
        let cursor = 0
        for (const chunk of this.chunks) {
            result.set(new Uint8Array(chunk), cursor)
            cursor += chunk.byteLength
        }

        return result.buffer
    }

    public build() {
        return { header: this.header, data: this.concatData() }
    }
}