import { Memory } from "./Memory"
import { MemoryMapper } from "./MemoryMapper"

export class CoroutineHandle {
    public readonly stack = new Memory()
    public readonly stackAddress

    constructor(
        memoryMap: MemoryMapper
    ) {
        this.stackAddress = memoryMap.createPage(this.stack)
    }
}