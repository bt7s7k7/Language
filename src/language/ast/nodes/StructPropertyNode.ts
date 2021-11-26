import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { ExpressionNode } from "./ExpressionNode"

export class StructPropertyNode extends ASTNode {
    constructor(
        span: Span,
        public readonly name: string,
        public readonly type: ExpressionNode
    ) { super(span) }
}