import { Span } from "./Span"

export class Diagnostic {
    constructor(
        public message: string,
        public readonly span: Span
    ) { }
}