import { Memory, MemoryView } from "./Memory"

const PAGE_SIZE = 2 ** 32 - 1

export class MemoryMapper {
    protected readonly pages = new Map<number, any>()
    protected readonly protectedPages = new Set<number>()
    protected pageOffset = 1

    public createPage(value: any) {
        const pageIndex = this.pageOffset++
        this.pages.set(pageIndex, value)
        return pageIndex * PAGE_SIZE
    }

    public allocate(size: number) {
        const memory = new Memory(size)
        return this.createPage(memory)
    }

    protected freePage(index: number) {
        if (this.protectedPages.has(index)) throw new Error("Tried to free a protected page")
        const success = this.pages.delete(index)
        if (!success) throw new Error(`Tried to delete non-existent page ${index}`)
    }

    public freeAddress(address: number) {
        const page = Math.floor(address / PAGE_SIZE)
        this.freePage(page)
    }

    public writeValue(address: number, value: MemoryView) {
        const page = Math.floor(address / PAGE_SIZE)
        const offset = address % PAGE_SIZE

        const pageValue = this.pages.get(page)
        if (pageValue instanceof Memory || pageValue instanceof MemoryView) {
            pageValue.write(offset, value)
        } else {
            throw new Error(`Tried to write into non-memory page ${page} (ptr = ${address})`)
        }
    }

    public readValue(address: number, size: number) {
        const page = Math.floor(address / PAGE_SIZE)
        const offset = address % PAGE_SIZE

        const pageValue = this.pages.get(page)
        if (pageValue instanceof Memory || pageValue instanceof MemoryView) {
            return pageValue.read(offset, size)
        } else {
            throw new Error(`Tried to read from non-memory page ${page} (ptr = ${address})`)
        }
    }
}