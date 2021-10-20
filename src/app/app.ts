import chalk = require("chalk")
import { inspect } from "util"
import { BytecodeVM } from "../language/vm/BytecodeVM"
import { Instructions } from "../language/vm/Instructions"
import { MemoryView } from "../language/vm/Memory"

// @ts-ignore
MemoryView.prototype[inspect.custom] = function (this: MemoryView) {
    let represent = ""
    if (this.length == 1) represent += ":uint8(" + this.as(Uint8Array)[0] + ")"
    if (this.length == 2) represent += ":uint16(" + this.as(Uint16Array)[0] + ")"
    if (this.length == 4) represent += ":uint32(" + this.as(Uint32Array)[0] + ")"
    if (this.length == 8) represent += ":float64(" + this.as(Float64Array)[0] + ")"
    return chalk.yellow(`[${this.length}]${[...this.getUint8Array()].map(v => v.toString(16).padStart(2, "0")).join("").replace(/^0+/, "")}${represent}`)
}


const vm = new BytecodeVM({
    data: [],
    functions: [
        {
            name: "main",
            arguments: [
                {
                    name: "a",
                    size: 8
                },
                {
                    name: "b",
                    size: 8
                }
            ],
            variables: [
                {
                    name: "counter",
                    size: 8,
                }
            ],
            returns: [
                {
                    name: "ret",
                    size: 8
                }
            ],
            labels: [
                {
                    name: "loop_start",
                    offset: 4
                },
                {
                    name: "loop_end",
                    offset: 25
                }
            ],
            offset: 0,
            size: 104
        }
    ]
}, new Uint32Array([
    (Instructions.LOAD << 16) | 8,
    0,
    (Instructions.STORE << 16) | 8,
    2,

    (Instructions.LOAD << 16) | 8,
    2,
    (Instructions.BR_FALSE << 16) | Instructions.Types.FLOAT64,
    1,

    (Instructions.LOAD << 16) | 8,
    2,
    (Instructions.CONST << 16) | 8,
    ...new Uint32Array(new Float64Array([-1]).buffer),
    (Instructions.ADD << 16) | Instructions.Types.FLOAT64,
    (Instructions.STORE << 16) | 8,
    2,

    (Instructions.LOAD << 16) | 8,
    1,
    (Instructions.LOAD << 16) | 8,
    3,
    (Instructions.ADD << 16) | Instructions.Types.FLOAT64,
    (Instructions.STORE << 16) | 8,
    3,

    Instructions.BR << 16,
    0,

    Instructions.RETURN << 16,
]).buffer)

const result = vm.directCall(0, [new Float64Array([100, 150]).buffer], 8)

console.log(result.as(Float64Array))
