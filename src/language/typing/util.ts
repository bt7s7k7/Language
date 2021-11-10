import { Type } from "./Type"
import { ConstExpr } from "./types/ConstExpr"
import { Reference } from "./types/Reference"

export function normalizeType(type: Type) {
    return ConstExpr.removeConstexpr(Reference.dereference(type))
}