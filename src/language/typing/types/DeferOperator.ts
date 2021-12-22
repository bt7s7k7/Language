import { unreachable } from "../../../comTypes/util"
import { Diagnostic } from "../../Diagnostic"
import { EmissionUtil } from "../../emission/EmissionUtil"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { IntrinsicFunction } from "../intrinsic/IntrinsicFunction"
import { IntrinsicMaths } from "../intrinsic/IntrinsicMaths"
import { normalizeType } from "../util"
import { Value } from "../Value"
import { Invocation } from "../values/Invocation"
import { VariableDereference } from "../values/VariableDereference"
import { FunctionDefinition } from "./FunctionDefinition"
import { Pointer } from "./Pointer"
import { IIntrinsicRefFunction, isRefValue, Reference } from "./Reference"
import { SpecificFunction } from "./SpecificFunction"

const disposeInvocations = new WeakMap<SpecificFunction.Signature, (callback: () => void) => Invocation>()

export const DEFER = new class DeferOperator extends IntrinsicFunction implements IIntrinsicRefFunction {
    public match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic | Diagnostic[] {
        if (args.length != 1) return new Diagnostic(`Expected ${1} argument, got ${args.length}`, span)
        const target = args[0].type

        if (!(target instanceof Reference)) return new Diagnostic(`Expected reference type, got "${target.name}"`, args[0].span)

        const normalizedTarget = normalizeType(target)
        const disposeFunction = context.scope.getProperty(normalizedTarget, "@dispose")
        if (!disposeFunction || !(disposeFunction instanceof FunctionDefinition)) return new Diagnostic(`Type "${target.name}" is not disposable`, span)
        const targetPointer = new Pointer(normalizedTarget)
        const disposeSignature = disposeFunction.findOverload(span, [{ span: args[0].span, type: targetPointer }], context)
        if (disposeSignature instanceof Array) return disposeSignature

        const signature: SpecificFunction.Signature = {
            target: this,
            arguments: [{ name: "target", type: target }],
            result: target
        }

        disposeInvocations.set(signature, (callback: () => void) => new Invocation(span, disposeSignature, [new class extends Value {
            public emit(builder: FunctionIRBuilder): number {
                callback()
                return 8
            }

            constructor() { super(span, targetPointer) }
        }]))

        return signature
    }

    public emitStore(builder: FunctionIRBuilder, invocation: Invocation): void {
        this.defer(builder, invocation)

        if (!isRefValue(invocation.args[0])) throw unreachable()
        invocation.args[0].emitStore(builder)
    }

    public emitPtr(builder: FunctionIRBuilder, invocation: Invocation): void {
        this.defer(builder, invocation)

        if (!isRefValue(invocation.args[0])) throw unreachable()
        invocation.args[0].emitPtr(builder)
    }

    public emit(builder: FunctionIRBuilder, invocation: Invocation): number {
        this.defer(builder, invocation)

        EmissionUtil.safeEmit(builder, invocation.signature.result.size, invocation.args[0])
        return invocation.signature.result.size
    }

    protected defer(builder: FunctionIRBuilder, invocation: Invocation) {
        let variable: string | null = null
        const target = invocation.args[0]
        if (target instanceof VariableDereference) {
            variable = target.variable.name
        } else if (target instanceof Invocation && target.signature.target instanceof IntrinsicMaths.Assignment && target.args[0] instanceof VariableDereference) {
            variable = target.args[0].variable.name
        } else {
            unreachable()
        }

        if (variable != null) {
            builder.pushDeferred(() => {
                disposeInvocations.get(invocation.signature)!(() => {
                    builder.pushInstruction(Instructions.VAR_PTR, 0, [variable!])
                }).emit(builder)
            })
        } else {
            unreachable()
        }
    }

    constructor() {
        super(Span.native, "@defer")
    }
}