import { unreachable } from "../../comTypes/util"
import { AnyTypedArray, AnyTypedArrayCtor } from "./types"

export class Memory {
    public buffer = new ArrayBuffer(1024)
    public view = new Uint8Array(this.buffer)
    public length = 0

    public expand(size: number) {
        this.length += size
        if (this.length > this.buffer.byteLength) {
            const newBuffer = new ArrayBuffer(Math.ceil(this.length / 1024) * 1024)
            const newView = new Uint8Array(newBuffer)

            newView.set(this.view)

            this.buffer = newBuffer
            this.view = newView
        }
    }

    public shrink(size: number) {
        this.length -= size
        if (this.length < 0) throw unreachable()
    }

    public write(offset: number, data: MemoryView) {
        this.view.set(data.getUint8Array(), offset)
    }

    public writeConst(offset: number, data: ArrayBuffer) {
        this.view.set(new Uint8Array(data), offset)
    }

    public read(offset: number, size: number) {
        return new MemoryView(this, offset, size)
    }

    public pop(size: number) {
        const ret = this.read(this.length - size, size)
        this.shrink(size)
        return ret
    }

    public push(data: MemoryView) {
        const offset = this.length
        this.expand(data.length)
        this.write(offset, data)
    }

    public pushConst(data: ArrayBuffer) {
        const offset = this.length
        this.expand(data.byteLength)
        this.writeConst(offset, data)
    }

    public allocate(size: number) {
        const start = this.length
        this.expand(size)
        return this.read(start, size)
    }
}

export class MemoryView {

    public getUint8Array() {
        if (this.array) return this.array
        else return this.array = new Uint8Array(this.memory.buffer, this.offset, this.length)
    }

    public as<T extends AnyTypedArray>(type: AnyTypedArrayCtor<T>) {
        return new type(this.memory.buffer, this.offset, this.length / type.BYTES_PER_ELEMENT)
    }

    protected array: Uint8Array | null = null

    constructor(
        public readonly memory: Memory,
        public readonly offset: number,
        public readonly length: number
    ) { }
}