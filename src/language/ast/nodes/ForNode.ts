import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { BlockNode } from "./BlockNode"
import { ExpressionNode } from "./ExpressionNode"

export class ForNode extends ASTNode {
    constructor(
        span: Span,
        public readonly initializer: ExpressionNode | null,
        public readonly predicate: ExpressionNode | null,
        public readonly increment: ExpressionNode | null,
        public readonly body: ExpressionNode | BlockNode
    ) { super(span) }
}