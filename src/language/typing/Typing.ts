import { unreachable } from "../../comTypes/util"
import { ASTNode } from "../ast/ASTNode"
import { BlockNode } from "../ast/nodes/BlockNode"
import { ExpressionNode } from "../ast/nodes/ExpressionNode"
import { ForNode } from "../ast/nodes/ForNode"
import { FunctionDefinitionNode } from "../ast/nodes/FunctionDefinitionNode"
import { IdentifierNode } from "../ast/nodes/IdentifierNode"
import { IfStatementNode } from "../ast/nodes/IfStatementNode"
import { InvocationNode } from "../ast/nodes/InvocationNode"
import { NamespaceNode } from "../ast/nodes/NamespaceNode"
import { NumberLiteral } from "../ast/nodes/NumberLiteral"
import { OperatorNode } from "../ast/nodes/OperatorNode"
import { ReturnStatementNode } from "../ast/nodes/ReturnStatement"
import { RootNode } from "../ast/nodes/RootNode"
import { StringLiteral } from "../ast/nodes/StringLiteral"
import { StructNode } from "../ast/nodes/StructNode"
import { TemplateNode } from "../ast/nodes/TemplateNode"
import { TupleNode } from "../ast/nodes/TupleNode"
import { VariableDeclarationNode } from "../ast/nodes/VariableDeclarationNode"
import { WhileNode } from "../ast/nodes/WhileNode"
import { DebugInfo } from "../DebugInfo"
import { Diagnostic } from "../Diagnostic"
import { Span } from "../Span"
import { Primitives } from "./Primitives"
import { Program } from "./Program"
import { Type } from "./Type"
import { Never } from "./types/base"
import { ConstExpr, isConstexpr } from "./types/ConstExpr"
import { FunctionDefinition } from "./types/FunctionDefinition"
import { InstanceType } from "./types/InstanceType"
import { Pointer } from "./types/Pointer"
import { ProgramFunction } from "./types/ProgramFunction"
import { Reference } from "./types/Reference"
import { Slice } from "./types/Slice"
import { Struct } from "./types/Struct"
import { TemplatedEntity } from "./types/TemplatedEntity"
import { normalizeType } from "./util"
import { Value } from "./Value"
import { Block } from "./values/Block"
import { ForLoop } from "./values/ForLoop"
import { IfStatement } from "./values/IfStatement"
import { Invocation } from "./values/Invocation"
import { MemberAccess, MethodAccess } from "./values/MemberAccess"
import { NOP } from "./values/NOP"
import { Return } from "./values/Return"
import { StringConstant } from "./values/StringConstant"
import { Variable } from "./values/Variable"
import { VariableDereference } from "./values/VariableDereference"
import { WhileLoop } from "./values/WhileLoop"

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

interface QueuedNode {
    node: ASTNode
    namespace: string
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

function assertValue(target: Value | Type, span: Span) {
    if (!(target instanceof Value)) throw new ParsingError(new Diagnostic("Expected value", span))
    return target
}

export namespace Typing {
    export class Scope {
        public map = new Map<string, Value | Type>()
        public root: Scope = this.parent?.root ?? this
        protected initializerCache: Set<string> = this.root.initializerCache ?? new Set()

        public get(name: string): Value | Type | undefined {
            return this.map.get(name) ?? this.parent?.get(name)
        }

        public getProperty(type: Type, name: string) {
            type = normalizeType(type)
            const ret = this.get(type.name + "." + name)
            if (ret == null && type instanceof Pointer) return this.get(type.type.name + "." + name)
            return ret
        }

        public register(name: string, value: Value | Type) {
            if (this.map.has(name)) throw new ParsingError(new Diagnostic("Duplicate declaration", value.span), new Diagnostic("Declared here", this.map.get(name)!.span))
            this.map.set(name, value)
            return true
        }

        public registerMany(namespace: string | null, values: Record<string, Value | Type>) {
            for (const [key, value] of Object.entries(values)) {
                const name = namespace ? namespace + "." + key : key
                this.register(name, value)
            }
        }

        public runInitializer(name: string, callback: () => void) {
            if (this.initializerCache.has(name)) return
            this.initializerCache.add(name)
            callback()
        }

        constructor(
            public readonly parent: Scope | null = null,
            public readonly construct: any = parent?.construct
        ) { }
    }

    export function parse(rootNode: RootNode, globalScope: Scope) {
        const rootScope = globalScope
        const debug = new DebugInfo.Builder()

        function createConstant(constexpr: ConstExpr) {
            if (constexpr.type == Primitives.Number.TYPE) return new Primitives.Number.Constant(constexpr.span, constexpr.value, constexpr)
            else if (constexpr.type == Type.TYPE) return constexpr.value as Type
            else throw unreachable()
        }

        function createInvocation(span: Span, handler: FunctionDefinition, operands: (Value | Type)[], scope: Scope) {
            const args = operands.map(v => ({ span: v.span, type: v instanceof Value ? v.type : new ConstExpr(v.span, Type.TYPE, v) }))
            const overload = handler.findOverload(span, args, { scope, rootScope, debug })
            if (overload instanceof Array) throw new ParsingError(new Diagnostic(`Cannot find overload for function "${handler.name}"`, span), ...overload)

            return overload.result instanceof ConstExpr ? createConstant(overload.result)
                : new Invocation(span, overload, operands.map(v => v instanceof Value ? v : new NOP(v.span)))
        }

        function parseMemberAccess(node: OperatorNode, scope: Scope) {
            let targetNode: ASTNode = node
            const path: IdentifierNode[] = []

            for (; targetNode instanceof OperatorNode && targetNode.name == "member";) {
                const propertyNameNode = targetNode.children[1]
                if (!(propertyNameNode instanceof IdentifierNode)) throw new ParsingError(new Diagnostic("Expected identifier", propertyNameNode.span))

                path.unshift(propertyNameNode)
                targetNode = targetNode.children[0]
            }

            const target = parseExpressionNode(targetNode, scope)

            const steps: MemberAccess.Property[] = []
            for (let i = 0; i < path.length; i++) {
                let { name, span } = path[i]
                const type = steps[steps.length - 1]?.type ?? (target instanceof Value ? target.type : (name = "static " + name, target))
                const property = scope.getProperty(type, name)

                if (!property) throw new ParsingError(new Diagnostic(`Type "${type.name}" does not have property "${name}"`, span))

                if (property instanceof FunctionDefinition) {
                    if (i != path.length - 1) throw new ParsingError(new Diagnostic(`Cannot index a method`, span))

                    return new MethodAccess(node.span, target instanceof Type ? null : new MemberAccess(node.span, target, steps), property)
                }
                if (property instanceof ConstExpr) throw unreachable()
                if (!(property instanceof MemberAccess.Property)) throw unreachable()

                const step = property
                steps.push(step)
            }

            return new MemberAccess(node.span, assertValue(target, target.span), steps)

        }

        function parseExpressionNode(node: ASTNode, scope: Scope, root = false): Value | Type {
            if (node instanceof ExpressionNode) {
                return parseExpressionNode(node.children[0], scope)
            } else if (node instanceof IdentifierNode) {
                const value = scope.get(node.name)
                if (!value) throw new ParsingError(new Diagnostic(`Cannot find name "${node.name}"`, node.span))
                if (value instanceof Type) return value
                if (!(value instanceof Variable)) throw new Error("Found value in scope but it's not a Variable, got " + value.constructor.name)
                return new VariableDereference(node.span, value)
            } else if (node instanceof NumberLiteral || node instanceof StringLiteral) {
                if (node.type == "string") {
                    return new StringConstant(node.span, node.value, new ConstExpr(node.span, new Slice(Primitives.Char.TYPE), node.value))
                } else {
                    const type = node.type == "number" ? Primitives.Number : Primitives.Char
                    const value = typeof node.value == "string" ? node.value.charCodeAt(0) : node.value
                    return new type.Constant(node.span, value, new ConstExpr(node.span, type.TYPE, value))
                }
            } else if (node instanceof ReturnStatementNode) {
                const construct = scope.construct
                if (!(construct instanceof FunctionConstruct)) throw new ParsingError(new Diagnostic("Return can only be used in a function definition", node.span))
                const body = parseExpressionNode(node.body, scope)
                if (!(body instanceof Value)) throw new ParsingError(new Diagnostic("Expected value", body.span))
                const ret = new Return(node.span, body)
                construct.setReturnType(ret)
                return ret
            } else if (node instanceof BlockNode) {
                return new Block(node.span, node.children.map(v => assertValue(parseExpressionNode(v, scope, true), v.span)))
            } else if (node instanceof OperatorNode) {
                if (node.name == "member") {
                    return parseMemberAccess(node, scope)
                }

                const operator = node.name
                let handler = globalScope.get("__operator__" + operator) as FunctionDefinition
                if (!(handler instanceof FunctionDefinition)) throw new ParsingError(new Diagnostic(`Cannot find operator "${operator}"`, node.span))
                const operands = node.children.map(v => parseExpressionNode(v, scope))

                if (node.name == "index" && operands[0] instanceof TemplatedEntity) {
                    const template = operands[0]
                    operands.shift()
                    handler = template.specialization
                }

                return createInvocation(node.span, handler, operands, scope)
            } else if (node instanceof IfStatementNode) {
                const predicate = assertValue(parseExpressionNode(node.predicate, scope), node.span)
                const body = assertValue(parseExpressionNode(node.body, scope), node.span)
                const bodyElse = node.bodyElse ? assertValue(parseExpressionNode(node.bodyElse, scope), node.span) : null
                const returns = !root
                if (returns) {
                    if (bodyElse && !bodyElse.type.assignableTo(body.type)) throw new ParsingError(notAssignable(bodyElse.type, body.type, node.span))
                }

                if (isConstexpr<number>(predicate.type, Primitives.Number.TYPE)) {
                    if (predicate.type.value) {
                        return body
                    } else {
                        if (bodyElse) return bodyElse
                        else return new NOP(node.span)
                    }
                }

                return new IfStatement(node.span, returns, predicate, body, bodyElse)
            } else if (node instanceof WhileNode) {
                const predicate = assertValue(parseExpressionNode(node.predicate, scope), node.span)
                const body = assertValue(parseExpressionNode(node.body, scope), node.span)

                return new WhileLoop(node.span, predicate, body)
            } else if (node instanceof ForNode) {
                const innerScope = new Scope(scope)
                const initializer = node.initializer ? assertValue(parseExpressionNode(node.initializer, innerScope), node.initializer.span) : null
                const predicate = node.predicate ? assertValue(parseExpressionNode(node.predicate, innerScope), node.predicate.span) : null
                const increment = node.increment ? assertValue(parseExpressionNode(node.increment, innerScope), node.increment.span) : null
                const body = assertValue(parseExpressionNode(node.body, innerScope), node.body.span)

                return new ForLoop(node.span, initializer, predicate, increment, body)
            } else if (node instanceof VariableDeclarationNode) {
                const name = node.name
                const body = node.body ? assertValue(parseExpressionNode(node.body, scope), node.span) : null
                let type = node.type ? parseExpressionNode(node.type, scope) : body?.type
                if (!type) throw new ParsingError(new Diagnostic("Cannot get type of variable declaration", node.span))
                if (!(type instanceof Type)) throw new ParsingError(new Diagnostic("Expected type", node.type!.span))

                if (type instanceof ConstExpr || type instanceof Reference) {
                    type = type.type
                }

                if (body && !body.type.assignableTo(type)) throw new ParsingError(notAssignable(body.type, type, body.span))

                const variable = new Variable(node.span, type, name)
                scope.register(name, variable)
                if (!body) return new VariableDereference(node.span, variable, "declaration")

                const handler = (scope.get("__operator__assign") ?? unreachable()) as FunctionDefinition
                return createInvocation(node.span, handler, [new VariableDereference(node.span, variable, "construction"), body], scope)
            } else if (node instanceof InvocationNode) {
                const target = parseExpressionNode(node.target, scope)
                const operands = node.args.map(v => parseExpressionNode(v, scope))
                const func = ((): FunctionDefinition => {
                    if (target instanceof FunctionDefinition) return target
                    if (target instanceof Type) {
                        const invokeFunction = scope.getProperty(target, "static !invoke")
                        if (!invokeFunction) throw new ParsingError(new Diagnostic("Target is not invocable", node.span))
                        if (!(invokeFunction instanceof FunctionDefinition)) unreachable()
                        if (invokeFunction) {
                            return invokeFunction
                        }
                    }

                    if (target instanceof MethodAccess) {
                        const handler = target.method
                        const self = target.target
                        if (self) {
                            if (!(self.type instanceof Reference)) throw new ParsingError(new Diagnostic(`Cannot call a method on non-ref value`, node.span))
                            const addressOfOperator = scope.get("__operator__addr")
                            if (!(addressOfOperator instanceof FunctionDefinition)) throw unreachable()
                            operands.unshift(createInvocation(node.span, addressOfOperator, [self], scope))
                        }

                        return handler
                    }

                    throw new ParsingError(new Diagnostic(`Target is not callable`, node.span))
                })()

                return createInvocation(node.span, func, operands, scope)
            } else if (node instanceof TupleNode) {
                const operands = node.elements.map(v => parseExpressionNode(v, scope))
                const handler = scope.get("__createTuple") as FunctionDefinition
                return createInvocation(node.span, handler, operands, scope)
            } else throw new ParsingError(new Diagnostic(`Unknown node type ${node.constructor.name}`, node.span))
        }

        function parseFunctionDefinition(func: FunctionDefinitionNode, scope: Scope, name = func.name) {
            let resultType = func.type ? parseExpressionNode(func.type, scope) : null
            if (resultType != null && !(resultType instanceof Type)) throw new ParsingError(new Diagnostic("Expected type" + resultType.type.name, func.type!.span))

            const construct = new FunctionConstruct(resultType)
            const innerScope = new Scope(scope, construct)
            const args: ProgramFunction.Argument[] = []

            for (const argument of func.args) {
                const name = argument.name
                const typeExpr = argument.type
                if (!typeExpr) throw new ParsingError(new Diagnostic("Missing argument type", argument.span))
                if (argument.value) throw unreachable() // TODO: Implement default arguments

                let type = parseExpressionNode(typeExpr, innerScope)
                if (!(type instanceof InstanceType)) {
                    if (type instanceof ConstExpr && type.type instanceof InstanceType) {
                        type = type.type
                    } else {
                        throw new ParsingError(new Diagnostic("Expected type", typeExpr.span), new Diagnostic("Declared here", type.span))
                    }
                }

                args.push({ type, name, span: argument.span })
                innerScope.register(name, new Variable(argument.span, type, name))
            }

            const self = new ProgramFunction(func.span, name, resultType ?? Never.TYPE, args, null!)
            const definition = new FunctionDefinition(func.span, name)
            definition.addOverload(self)
            innerScope.register(name, definition)

            const body = func.body == "extern" ? "extern" : parseExpressionNode(func.body, innerScope)
            if (body != "extern" && !(body instanceof Value)) throw new ParsingError(new Diagnostic("Expected value result", func.span))
            if (resultType == null) {
                if (body == "extern") throw new ParsingError(new Diagnostic("Explicit return type is required for extern functions", func.span))
                self.result = construct.implicitReturnType ?? body.type
            }

            self.body = body
            self.result = ConstExpr.removeConstexpr(Reference.dereference(self.result))
            self.regenerateName(definition.name)
            debug.func(self.getSignature())

            if (scope.get(name) instanceof FunctionDefinition) {
                (scope.get(name) as FunctionDefinition).addOverload(self)
            } else {
                scope.register(name, definition)
            }

            return definition
        }

        function parseTemplateDefinition(node: TemplateNode, scope: Scope) {
            if (!node.entity) unreachable()

            const implicit = !!node.params[0]?.strategy
            if (implicit) {
                for (const param of node.params) {
                    if (!param.strategy) {
                        throw new ParsingError(new Diagnostic("Template with ISS must have a strategy for all parameters", param.span))
                    }
                }
            }

            if (node.entity instanceof FunctionDefinitionNode) {
                const name = node.entity.name
                debug.template(name)

                const template = new TemplatedEntity(node.span, name, node.params, implicit, (scope, args) => {
                    const specializedName = name + "<" + args.map(v => v.name).join(", ") + ">"
                    const memoized = scope.get(specializedName)
                    if (memoized)
                        return memoized as FunctionDefinition

                    const innerScope = new Scope(scope)
                    node.params.forEach((v, i) => innerScope.register(v.name, args[i]))
                    const definition = parseFunctionDefinition(node.entity as FunctionDefinitionNode, innerScope, specializedName)

                    scope.register(specializedName, definition)

                    return definition

                })

                scope.register(name, template)

                scope.registerMany(name, {
                    "static !invoke": template.implicitSpecialization
                })
            } else throw new ParsingError(new Diagnostic(`Node type ${node.entity.constructor.name} is not suitable for templating`, node.entity.span))
        }

        function parseStruct(namespace: string, struct: StructNode, scope: Scope) {
            let offset = 0
            const properties: MemberAccess.Property[] = []

            for (const propertyNode of struct.properties) {
                const type = parseExpressionNode(propertyNode.type, scope)
                if (!(type instanceof InstanceType)) throw new ParsingError(new Diagnostic("Expected type", type.span))
                const property = new MemberAccess.Property(propertyNode.span, propertyNode.name, type, offset)
                offset += type.size
                properties.push(property)

                scope.register(namespace + "." + property.name, property)
            }

            const type = new Struct(struct.span, namespace, offset, properties)
            debug.type(type)
            scope.register(namespace, type)
        }

        function parseRoot(root: RootNode, scope: Scope) {
            let pending: QueuedNode[] = root.children.map(v => ({ node: v, namespace: "" }))
            let next: QueuedNode[] = []
            const globalErrors: Diagnostic[] = []

            while (pending.length > 0) {
                let errors: Diagnostic[] = []
                for (const queued of pending) {
                    const { node, namespace } = queued
                    try {
                        if (node instanceof FunctionDefinitionNode) {
                            parseFunctionDefinition(node, scope)
                            continue
                        }

                        if (node instanceof TemplateNode) {
                            parseTemplateDefinition(node, scope)
                            continue
                        }

                        if (node instanceof NamespaceNode) {
                            const fqn = namespace ? namespace + "." + node.name : node.name
                            next.push(...node.children.map(v => ({ node: v, namespace: fqn })))
                            if (node.struct) {
                                parseStruct(fqn, node.struct, scope)
                            }
                            continue
                        }

                        throw new ParsingError(new Diagnostic(`Unknown node type ${node.constructor.name}`, node.span))
                    } catch (err) {
                        if (err instanceof ParsingError) {
                            if (!(queued.node instanceof NamespaceNode)) {
                                errors.push(...err.diagnostics)
                                next.push(queued)
                            } else {
                                globalErrors.push(...err.diagnostics)
                            }
                        } else throw err
                    }
                }

                if (next.length == pending.length) {
                    throw new ParsingError(...errors, ...globalErrors)
                }

                pending = next
                next = []
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

        return new Program(rootScope.map, debug)
    }
}
