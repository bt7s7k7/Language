import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"

export class NumberLiteral extends ASTNode {
    constructor(
        span: Span,
        public readonly value: number
    ) { super(span) }
}