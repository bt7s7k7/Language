import { LinkedList } from "../../comTypes/LinkedList"
import { Memory } from "./Memory"

interface SegmentInfo {
    free: boolean
    offset: number
    size: number
}

export class Heap {
    public readonly memory = new Memory()
    protected segments = new LinkedList<SegmentInfo>()
    protected segmentsLookup = new Map<number, LinkedList.Node<SegmentInfo>>()

    protected findSegment(size: number) {
        for (const node of this.segments.keys()) {
            if (node.value.free && node.value.size >= size) return node
        }

        return null
    }

    public allocate(size: number) {
        const node = this.findSegment(size)
        if (node) {
            const offset = node.value.offset
            node.value.offset += size
            this.segmentsLookup.delete(offset)
            this.segmentsLookup.set(node.value.offset, node)
            node.value.size -= size
            const newNode = this.segments.insert(node.prev, {
                free: false,
                offset, size
            })

            this.segmentsLookup.set(newNode.value.offset, newNode)

            return offset
        } else {
            if (this.segments.end?.value.free) {
                const end = this.segments.end.value
                this.memory.expand(size - end.size)
                end.free = false
                return end.offset
            } else {
                const offset = this.memory.length
                this.memory.expand(size)

                const newNode = this.segments.push({ free: false, offset, size })
                this.segmentsLookup.set(newNode.value.offset, newNode)
                return offset
            }
        }
    }

    public free(offset: number) {
        let node = this.segmentsLookup.get(offset)
        if (!node || node.value.free) throw new Error(`There is no allocated segment at address ${offset}`)
        node.value.free = true
        if (node.prev?.value.free) {
            node.prev.value.size += node.value.size
            this.segmentsLookup.delete(node.value.offset)
            this.segments.delete(node)
            node = node.prev
        }

        if (node.next?.value.free) {
            node.next.value.size += node.value.size
            this.segmentsLookup.delete(node.next.value.offset)
            node.next.value.offset -= node.value.size
            this.segmentsLookup.set(node.next.value.offset, node.next)
            this.segmentsLookup.delete(node.value.offset)
            this.segments.delete(node)
            node = node.next
        }
    }
}
