import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { ComplexSuffixNode } from "../ComplexSuffixNode"

export class InvocationNode extends ComplexSuffixNode {

    constructor(
        span: Span,
        public readonly args: ASTNode[]
    ) { super(span) }
}