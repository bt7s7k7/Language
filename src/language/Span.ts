import { Position } from "./Position"

export class Span {
    constructor(
        public readonly pos: Position,
        public readonly length: number
    ) { }
}