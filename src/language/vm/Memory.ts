import { AnyTypedArray, AnyTypedArrayCtor } from "./types"

export class Memory {
    public buffer
    public view
    public length

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
        if (this.length < 0) throw new Error("Cannot pop, stack too short (" + this.length + ")")
    }

    public write(offset: number, data: MemoryView) {
        this.view.set(data.getUint8Array(), offset)
    }

    public writeConst(offset: number, data: ArrayBuffer) {
        this.view.set(new Uint8Array(data), offset)
    }

    public read(offset: number, size: number) {
        return new MemoryView(this.buffer, offset, size)
    }

    public pop(size: number) {
        const ret = this.read(this.length - size, size)
        this.shrink(size)
        return ret
    }

    public peek(size: number) {
        const ret = this.read(this.length - size, size)
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

    constructor(
        initialSize?: number
    ) {
        if (initialSize == undefined) {
            this.buffer = new ArrayBuffer(1024)
            this.length = 0
        } else {
            this.buffer = new ArrayBuffer(initialSize)
            this.length = initialSize
        }

        this.view = new Uint8Array(this.buffer)
    }
}

export class MemoryView {

    public getUint8Array() {
        if (this.array) return this.array
        else return this.array = new Uint8Array(this.buffer, this.offset, this.length)
    }

    public as<T extends AnyTypedArray>(type: AnyTypedArrayCtor<T>) {
        return new type(this.buffer.slice(this.offset, this.offset + this.length), 0, this.length / type.BYTES_PER_ELEMENT)
    }

    public slice(offset: number, size: number) {
        if (offset >= this.length) throw new RangeError("Offset is outside the range of the MemoryView")
        if ((offset + size) > this.length) throw new RangeError("Ending is outside the range of the MemoryView")

        return new MemoryView(this.buffer, this.offset + offset, size)
    }

    public read(offset: number, size: number) {
        return this.slice(offset, size)
    }

    public write(offset: number, value: MemoryView) {
        this.getUint8Array().set(value.getUint8Array(), offset)
    }

    public clone() {
        const data = this.as(Uint8Array)
        const copyArray = new Uint8Array(data.length)
        copyArray.set(data)
        return new MemoryView(copyArray.buffer, 0, copyArray.length)
    }

    public toString() {
        let represent = ""
        if (this.length == 1) represent += ":uint8(" + this.as(Uint8Array)[0] + ")"
        if (this.length == 1) represent += ":char(" + JSON.stringify(String.fromCharCode(this.as(Uint8Array)[0])).slice(1, -1) + ")"
        if (this.length == 2) represent += ":uint16(" + this.as(Uint16Array)[0] + ")"
        if (this.length == 4) represent += ":uint32(" + this.as(Uint32Array)[0] + ")"
        if (this.length == 8) represent += ":float64(" + this.as(Float64Array)[0] + ")"

        return `[${this.length}]${[...this.getUint8Array()].map(v => v.toString(16).padStart(2, "0")).join("").replace(/^0+/, "")}${represent}`
    }

    protected array: Uint8Array | null = null

    constructor(
        public readonly buffer: ArrayBuffer,
        public readonly offset: number = 0,
        public readonly length: number = buffer.byteLength
    ) { }

    public static readonly empty = new MemoryView(new ArrayBuffer(0), 0, 0)

    public static from(buffer: ArrayBuffer) {
        return new MemoryView(buffer, 0, buffer.byteLength)
    }
}