import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"

export class FuncDefNode extends ASTNode {
    constructor(
        span: Span,
        public readonly name: string
    ) { super(span) }
}