import { Span } from "../Span"

export class Token<T = void> {
    constructor(
        public readonly span: Span,
        public readonly data: T = null!
    ) { }
}