import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { ExpressionNode } from "./ExpressionNode"

export class InvocationNode extends ASTNode {
    public target!: ASTNode

    constructor(
        span: Span,
        public readonly args: ASTNode[]
    ) { super(span) }
}