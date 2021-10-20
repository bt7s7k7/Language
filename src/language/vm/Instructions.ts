export namespace Instructions {
    export const LOAD = 1
    export const STORE = 2
    export const RETURN = 3
    export const CONST = 4
    export const DROP = 5
    export const CALL = 6
    export const ADD = 101
    export const BR_TRUE = 10
    export const BR_FALSE = 11
    export const BR = 12

    export namespace Types {
        export const UINT32 = 5
        export const FLOAT64 = 10
    }
}