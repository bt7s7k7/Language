import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"

export class StringLiteral extends ASTNode {
    constructor(
        span: Span,
        public readonly value: string,
        public readonly type: "char" | "string"
    ) { super(span) }
}