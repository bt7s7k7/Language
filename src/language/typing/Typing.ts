import exp = require("constants")
import { unreachable } from "../../comTypes/util"
import { ASTNode } from "../ast/ASTNode"
import { BlockNode } from "../ast/nodes/BlockNode"
import { ExpressionNode } from "../ast/nodes/ExpressionNode"
import { FunctionDefinitionNode } from "../ast/nodes/FunctionDefinitionNode"
import { IdentifierNode } from "../ast/nodes/IdentifierNode"
import { NumberLiteral } from "../ast/nodes/NumberLiteral"
import { OperatorNode } from "../ast/nodes/OperatorNode"
import { ReturnStatementNode } from "../ast/nodes/ReturnStatement"
import { RootNode } from "../ast/nodes/RootNode"
import { Diagnostic } from "../Diagnostic"
import { Span } from "../Span"
import { Argument } from "./expressions/Argument"
import { Block } from "./expressions/Block"
import { Invocation } from "./expressions/Invocation"
import { Return } from "./expressions/Return"
import { VariableDereference } from "./expressions/VariableDereference"
import { Double64 } from "./Number"
import { Type } from "./Type"
import { ConstExpr } from "./types/ConstExpr"
import { FunctionDefinition } from "./types/FunctionDefinition"
import { InstanceType } from "./types/InstanceType"
import { ProgramFunction } from "./types/ProgramFunction"
import { SpecificFunction } from "./types/SpecificFunction"
import { Variable } from "./Variable"

class ParsingError extends Error {
    public name = "ParsingError"
    public readonly diagnostics

    constructor(
        ...diagnostics: Diagnostic[]
    ) {
        super()
        this.diagnostics = diagnostics
    }
}

function notAssignable(a: Type, b: Type, span: Span) {
    return new Diagnostic(`Type "${a.name}" is not assignable to "${b.name}"`, span)
}

class FunctionConstruct {
    public implicitReturnType: Type | null = null

    public setReturnType(value: Return) {
        if (this.explicitReturnType && !value.body.type.assignableTo(this.explicitReturnType)) throw new ParsingError(notAssignable(value.body.type, this.explicitReturnType, value.span))
        if (this.implicitReturnType == null) {
            this.implicitReturnType = value.body.type
            return
        }

        if (value.body.type.assignableTo(this.implicitReturnType)) return
        if (this.implicitReturnType.assignableTo(value.body.type)) {
            this.implicitReturnType = value.body.type
            return
        }

        throw new ParsingError(notAssignable(value.body.type, this.implicitReturnType, value.span))
    }

    constructor(
        public readonly explicitReturnType: Type | null
    ) { }
}

function assetValue(target: Variable | Type, span: Span) {
    if (!(target instanceof Variable)) throw new ParsingError(new Diagnostic("Expected value", span))
    return target
}

export namespace Typing {
    export class Scope {
        public map = new Map<string, Variable | Type>()

        public get(name: string): Variable | Type | undefined {
            return this.map.get(name) ?? this.parent?.get(name)
        }

        public register(name: string, value: Variable | Type) {
            if (this.map.has(name)) throw new ParsingError(new Diagnostic("Duplicate declaration", value.span), new Diagnostic("Declared here", this.map.get(name)!.span))
            this.map.set(name, value)
            return true
        }

        constructor(
            public readonly parent: Scope | null = null,
            public readonly construct: any = parent?.construct
        ) { }
    }

    export function parse(rootNode: RootNode, globalScope: Scope) {
        const rootScope = new Scope(globalScope)

        function createConstant(constexpr: ConstExpr) {
            if (constexpr.type == Double64.TYPE) return new Double64.Constant(constexpr.span, constexpr.value, constexpr)
            else throw unreachable()
        }

        function createInvocation(span: Span, handler: FunctionDefinition, operands: (Variable | Type)[]) {
            const args = operands.map(v => v instanceof Variable ? v.type : new ConstExpr(v.span, Type.TYPE, v))
            const overload = handler.findOverload(span, args, args.map(v => v.span))
            if (overload instanceof Array) throw new ParsingError(new Diagnostic(`Cannot find overload for function "${handler.name}"`, span), ...overload)

            return overload.result instanceof ConstExpr ? createConstant(overload.result)
                : new Invocation(span, overload.target, operands.map(v => v instanceof Variable ? v : unreachable()), overload.result)
        }

        function parseExpressionNode(node: ASTNode, scope: Scope): Variable | Type {
            if (node instanceof ExpressionNode) {
                return parseExpressionNode(node.children[0], scope)
            } else if (node instanceof IdentifierNode) {
                const value = scope.get(node.name)
                if (!value) throw new ParsingError(new Diagnostic(`Cannot find name "${node.name}"`, node.span))
                if (value instanceof Type) return value
                return new VariableDereference(node.span, value)
            } else if (node instanceof NumberLiteral) {
                return new Double64.Constant(node.span, node.value, new ConstExpr(node.span, Double64.TYPE, node.value))
            } else if (node instanceof ReturnStatementNode) {
                const construct = scope.construct
                if (!(construct instanceof FunctionConstruct)) throw new ParsingError(new Diagnostic("Return can only be used in a function definition", node.span))
                const body = parseExpressionNode(node.body, scope)
                if (!(body instanceof Variable)) throw new ParsingError(new Diagnostic("Expected value", body.span))
                const ret = new Return(node.span, body)
                construct.setReturnType(ret)
                return ret
            } else if (node instanceof BlockNode) {
                return new Block(node.span, node.children.map(v => assetValue(parseExpressionNode(v, scope), v.span)))
            } else if (node instanceof OperatorNode) {
                const operator = node.name
                const handler = globalScope.get("__operator__" + operator)
                if (!(handler instanceof FunctionDefinition)) throw new ParsingError(new Diagnostic(`Cannot find operator "${operator}"`, node.span))
                const operands = node.children.map(v => parseExpressionNode(v, scope))
                return createInvocation(node.span, handler, operands)
            } else throw new ParsingError(new Diagnostic(`Unknown node type ${node.constructor.name}`, node.span))
        }

        function parseFunctionDefinition(func: FunctionDefinitionNode, scope: Scope) {
            const name = func.name
            let resultType = func.type ? parseExpressionNode(func.type, scope) : null
            if (resultType != null && !(resultType instanceof Type)) throw new ParsingError(new Diagnostic("Expected type", func.type!.span))
            const construct = new FunctionConstruct(resultType)
            const innerScope = new Scope(scope, construct)
            const args: SpecificFunction.Argument[] = []

            for (const argument of func.args) {
                const name = argument.name
                const typeExpr = argument.type
                if (!typeExpr) throw new ParsingError(new Diagnostic("Missing argument type", argument.span))
                if (argument.value) throw unreachable() // TODO: Implement default arguments

                const type = parseExpressionNode(typeExpr, innerScope)
                if (!(type instanceof InstanceType)) throw new ParsingError(new Diagnostic("Expected type", typeExpr.span), new Diagnostic("Declared here", type.span))

                args.push({ type, name })
                innerScope.register(name, new Argument(argument.span, type))
            }


            const body = parseExpressionNode(func.body, innerScope)
            if (!(body instanceof Variable)) throw new ParsingError(new Diagnostic("Expected value result", func.span))
            if (resultType == null) resultType = construct.implicitReturnType ?? body.type

            scope.register(name, new FunctionDefinition(func.span, name).addOverload(new ProgramFunction(func.span, name, resultType, args, body)))
        }

        function parseRoot(root: RootNode, scope: Scope) {
            for (const node of root.children) {
                if (node instanceof FunctionDefinitionNode) {
                    parseFunctionDefinition(node, scope)
                } else throw new ParsingError(new Diagnostic(`Unknown node type ${node.constructor.name}`, node.span))
            }
        }

        try {
            parseRoot(rootNode, rootScope)
        } catch (err) {
            if (err instanceof ParsingError) {
                return err.diagnostics
            } else {
                throw err
            }
        }

        return rootScope.map
    }
}