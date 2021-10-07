import { Span } from "../Span"

export class ASTNode {
    constructor(
        public readonly span: Span
    ) { }
}