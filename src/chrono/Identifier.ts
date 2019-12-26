import { Base, IdentityMixin, Mixin } from "../class/BetterMixin.js"
import {
    CalculationContext,
    CalculationGen,
    CalculationIterator,
    CalculationSync,
    Context,
    ContextGen,
    Contexts,
    ContextSync
} from "../primitives/Calculation.js"
import { prototypeValue } from "../util/Helpers.js"
import { Checkout } from "./Checkout.js"
import { ProposedOrCurrent } from "./Effect.js"
import { Quark, QuarkConstructor } from "./Quark.js"
import { RevisionClock } from "./Revision.js"
import { Transaction, YieldableValue } from "./Transaction.js"


//---------------------------------------------------------------------------------------------------------------------
export enum Levels {
    Constant                = 0,
    DependsOnlyOnConstant   = 1,
    DependsOnSelfKind       = 10
}

//---------------------------------------------------------------------------------------------------------------------
export class Meta<ValueT = any, ContextT extends Context = Context> extends Base {
    name                : any       = undefined

    ArgsT               : any[]
    YieldT              : YieldableValue
    ValueT              : ValueT

    level               : number    = Levels.DependsOnSelfKind

    // calculated on demand
    lazy                : boolean   = false
    // can also be a calculated property
    sync                : boolean   = false
    // no cancels
    total               : boolean   = true
    // no "nested" writes
    pure                : boolean   = true

    quarkClass          : QuarkConstructor

    proposedValueIsBuilt    : boolean   = false

    // no init value - only a type
    CalcContextT        : any


    calculation (this : this[ 'CalcContextT' ], YIELD : CalculationContext<this[ 'YieldT' ]>) : Contexts<ValueT, this[ 'YieldT' ]>[ ContextT ] {
        throw new Error("Abstract method `calculation` called")
    }


    equality (v1 : ValueT, v2 : ValueT) : boolean {
        return v1 === v2
    }
}


//---------------------------------------------------------------------------------------------------------------------
export class Identifier<ValueT = any, ContextT extends Context = Context> extends Meta<ValueT, ContextT> {
    context             : this[ 'CalcContextT' ]       = undefined


    newQuark (createdAt : RevisionClock) : InstanceType<this[ 'quarkClass' ]> {
        // micro-optimization - we don't pass a config object to the `new` constructor
        // but instead assign directly to instance
        const newQuark                      = this.quarkClass.new() as InstanceType<this[ 'quarkClass' ]>

        newQuark.createdAt                  = createdAt
        newQuark.identifier                 = this
        newQuark.needToBuildProposedValue   = this.proposedValueIsBuilt

        return newQuark
    }


    write (me : this, transaction : Transaction, quark : InstanceType<this[ 'quarkClass' ]>, proposedValue : ValueT, ...args : this[ 'ArgsT' ]) {
        quark                       = quark || transaction.getWriteTarget(me)

        quark.proposedValue         = proposedValue
        quark.proposedArguments     = args.length > 0 ? args : undefined
    }


    writeToTransaction (transaction : Transaction, proposedValue : ValueT, ...args : this[ 'ArgsT' ]) {
        transaction.write(this, proposedValue, ...args)
    }


    writeToGraph (graph : Checkout, proposedValue : ValueT, ...args : this[ 'ArgsT' ]) {
        graph.write(this, proposedValue, ...args)
    }


    readFromGraphSync (graph : Checkout) : ValueT {
        return graph.read(this)
    }


    readFromGraphDirtySync (graph : Checkout) : ValueT {
        return graph.readDirty(this)
    }


    readFromTransactionSync (transaction : Transaction) : ValueT {
        return transaction.read(this)
    }


    readFromGraphAsync (graph : Checkout) : Promise<ValueT> {
        return graph.readAsync(this)
    }


    readFromTransactionAsync (transaction : Transaction) : Promise<ValueT> {
        return transaction.readAsync(this)
    }


    buildProposedValue (me : this, quark : InstanceType<this[ 'quarkClass' ]>, transaction : Transaction) : ValueT {
        return undefined
    }


    enterGraph (graph : Checkout) {
    }


    leaveGraph (graph : Checkout) {
    }
}


//---------------------------------------------------------------------------------------------------------------------
export class Variable<ValueT = any> extends Identifier<ValueT, typeof ContextSync> {
    YieldT              : never

    @prototypeValue(true)
    sync                : boolean

    @prototypeValue(Mixin([ CalculationSync, Quark, Map ], IdentityMixin<CalculationSync & Quark & Map<any, any>>()))
    quarkClass          : QuarkConstructor


    calculation (this : this[ 'CalcContextT' ], YIELD : CalculationContext<this[ 'YieldT' ]>) : Contexts<ValueT, this[ 'YieldT' ]>[ typeof ContextSync ] {
        throw new Error("The 'calculation' method of the variables will never be called. Instead the value will be set directly to quark")
    }


    write (me : this, transaction : Transaction, quark : Quark, proposedValue : ValueT, ...args : this[ 'ArgsT' ]) {
        quark                       = quark || transaction.getWriteTarget(me)

        quark.value                 = proposedValue
        quark.proposedArguments     = args.length > 0 ? args : undefined
    }
}

export function VariableConstructor<ValueT> (...args) : Variable<ValueT> {
    //@ts-ignore
    return Variable.new(...args)
}


//---------------------------------------------------------------------------------------------------------------------
export class VariableGen<ValueT = any> extends Identifier<ValueT, typeof ContextGen> {
    YieldT              : never

    @prototypeValue(false)
    sync                : boolean

    @prototypeValue(Mixin([ CalculationGen, Quark, Map ], IdentityMixin<CalculationGen & Quark & Map<any, any>>()))
    quarkClass          : QuarkConstructor


    * calculation (this : this[ 'CalcContextT' ], YIELD : CalculationContext<this[ 'YieldT' ]>) : CalculationIterator<ValueT, this[ 'YieldT' ]> {
        throw new Error("The 'calculation' method of the variables will never be called. Instead the value will be set directly to quark")
    }


    write (me : this, transaction : Transaction, quark : Quark, proposedValue : ValueT, ...args : this[ 'ArgsT' ]) {
        quark                       = quark || transaction.getWriteTarget(me)

        quark.value                 = proposedValue
        quark.proposedArguments     = args.length > 0 ? args : undefined
    }
}


//---------------------------------------------------------------------------------------------------------------------
export class CalculatedValueSync<ValueT = any> extends Identifier<ValueT, typeof ContextSync> {

    @prototypeValue(true)
    sync                : boolean

    @prototypeValue(Mixin([ CalculationSync, Quark, Map ], IdentityMixin<CalculationSync & Quark & Map<any, any>>()))
    quarkClass          : QuarkConstructor


    calculation (this : this[ 'CalcContextT' ], YIELD : CalculationContext<this[ 'YieldT' ]>) : Contexts<ValueT, this[ 'YieldT' ]>[ typeof ContextSync ] {
        return YIELD(ProposedOrCurrent)
    }
}

export function CalculatedValueSyncConstructor<ValueT> (...args) : CalculatedValueSync<ValueT> {
    //@ts-ignore
    return CalculatedValueSync.new(...args)
}


//---------------------------------------------------------------------------------------------------------------------
export class CalculatedValueGen<ValueT = any> extends Identifier<ValueT, typeof ContextGen> {

    @prototypeValue(false)
    sync                : boolean

    @prototypeValue(Mixin([ CalculationGen, Quark, Map ], IdentityMixin<CalculationGen & Quark & Map<any, any>>()))
    quarkClass          : QuarkConstructor


    * calculation (this : this[ 'CalcContextT' ], YIELD : CalculationContext<this[ 'YieldT' ]>) : Contexts<ValueT, this[ 'YieldT' ]>[ typeof ContextGen ] {
        return yield ProposedOrCurrent
    }
}

export function CalculatedValueGenConstructor<ValueT> (...args) : CalculatedValueGen<ValueT> {
    //@ts-ignore
    return CalculatedValueGen.new(...args)
}


//---------------------------------------------------------------------------------------------------------------------
export const throwUnknownIdentifier = (identifier : Identifier) => { throw new Error(`Unknown identifier ${identifier}`) }
