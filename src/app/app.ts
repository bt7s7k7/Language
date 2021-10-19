import chalk = require("chalk")
import { BytecodeVM } from "../language/vm/BytecodeVM"


const vm = new BytecodeVM({
    data: [],
    functions: [
        {
            name: "main",
            arguments: [
                {
                    name: "a",
                    size: 8
                }
            ],
            variables: [],
            returns: [
                {
                    name: "ret",
                    size: 8
                }
            ],
            labels: [],
            offset: 0,
            size: 20
        }
    ]
}, new Uint32Array([
    0x00010008,
    0x00000000,
    0x00020008,
    0x00000001,
    0x00030000,
]).buffer)

const result = vm.directCall(0, [new Float64Array([101010]).buffer], 8)

console.log(result.as(Float64Array))
