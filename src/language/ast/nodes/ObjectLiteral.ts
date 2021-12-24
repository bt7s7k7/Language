import { Span } from "../../Span"
import { ComplexSuffixNode } from "../ComplexSuffixNode"
import { ExpressionNode } from "./ExpressionNode"

export class ObjectLiteral extends ComplexSuffixNode {
    constructor(
        span: Span,
        public readonly props: Map<string, ObjectLiteral.Property>
    ) { super(span) }
}

export namespace ObjectLiteral {
    export interface Property {
        span: Span
        name: string
        value: ExpressionNode
    }
}