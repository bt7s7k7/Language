import { Span } from "../Span"

export abstract class Type {
    public assignableTo(other: Type) {
        return other == this
    }

    constructor(
        public readonly span: Span,
        public readonly name: string
    ) { }
}