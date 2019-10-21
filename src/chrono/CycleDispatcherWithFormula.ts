import { AnyConstructor, Base, BaseConstructor } from "../class/Mixin.js"


//---------------------------------------------------------------------------------------------------------------------
export enum CalculationMode {
    CalculateProposed   = 'CalculateProposed',
    CalculatePure       = 'CalculatePure'
}



export class Formula<Variable> extends Base {
    inputs              : Set<Variable>     = new Set()
    output              : Variable
}


export class FormulasCache<Variable> extends Base {
    formulas            : Set<Formula<Variable>>

    formulasByInput     : Map<Variable, Set<Formula<Variable>>>     = new Map()
    formulasByOutput    : Map<Variable, Set<Formula<Variable>>>     = new Map()


    initialize (...args) {
        super.initialize(...args)

        this.formulas.forEach(formula => {
            let formulasByOutput    = this.formulasByOutput.get(formula.output)

            if (!formulasByOutput) {
                formulasByOutput    = new Set()
                this.formulasByOutput.set(formula.output, formulasByOutput)
            }

            formulasByOutput.add(formula)

            formula.inputs.forEach(input => {
                let formulasByInput    = this.formulasByInput.get(input)

                if (!formulasByInput) {
                    formulasByInput    = new Set()
                    this.formulasByInput.set(input, formulasByInput)
                }

                formulasByInput.add(formula)
            })
        })
    }
}



//---------------------------------------------------------------------------------------------------------------------
export type CycleResolution<Variable>  = Map<Variable, CalculationMode>


export class CycleDispatcher<Variable = object> extends Base {
    formulas            : Set<Formula<Variable>>    = new Set()

    // formulasByInput     : Map<Variable, Set<Formula<Variable>>>     = new Map()
    // formulasByOutput    : Map<Variable, Set<Formula<Variable>>>     = new Map()

    defaultResolution   : CycleResolution<Variable>
    resolution          : CycleResolution<Variable>

    variables           : Set<Variable>

    hasProposedValue    : Set<Variable>    = new Set()
    hasPreviousValue    : Set<Variable>    = new Set()
    keepIfPossible      : Set<Variable>    = new Set()


    // initialize (...args) {
    //     super.initialize(...args)
    //
    //     for (const formula of this.formulas) {
    //         let formulasByOutput    = this.formulasByOutput.get(formula.output)
    //
    //         if (!formulasByOutput) {
    //             formulasByOutput    = new Set()
    //             this.formulasByOutput.set(formula.output, formulasByOutput)
    //         }
    //
    //         formulasByOutput.add(formula)
    //
    //         for (const input of formula.inputs) {
    //             let formulasByInput    = this.formulasByInput.get(input)
    //
    //             if (!formulasByInput) {
    //                 formulasByInput    = new Set()
    //                 this.formulasByInput.set(input, formulasByInput)
    //             }
    //
    //             formulasByInput.add(formula)
    //         }
    //     }
    // }


    addProposedValueFlag (variable : Variable) {
        // debug only
        // if (!this.variables.has(variable)) throw new Error('Unknown variable')

        this.hasProposedValue.add(variable)
    }


    addPreviousValueFlag (variable : Variable) {
        // debug only
        // if (!this.variables.has(variable)) throw new Error('Unknown variable')

        this.hasPreviousValue.add(variable)
    }


    addKeepIfPossibleFlag (variable : Variable) {
        // debug only
        // if (!this.variables.has(variable)) throw new Error('Unknown variable')

        this.keepIfPossible.add(variable)
    }


    getResolution () : CycleResolution<Variable> {
        if (this.resolution) return this.resolution

        return this.resolution = this.buildCycleResolution()
    }


    buildCycleResolution () : CycleResolution<Variable> {
        //------------------
        if (
            // no user input, all variables have values
            this.hasProposedValue.size === 0 && this.hasPreviousValue.size === this.variables.size
            ||
            // initial data load - all variables have input, no previous values
            this.hasProposedValue.size === this.variables.size && this.hasPreviousValue.size === 0
        ) {
            return this.defaultResolution
        }

        //------------------
        const result : CycleResolution<Variable>   = new Map()

        const appropriateFormulas   = new Set(this.formulas)
        const initialCache          = (FormulasCache as AnyConstructor<FormulasCache<Variable>> & BaseConstructor).new({ formulas : this.formulas })

        //------------------
        for (const variable of this.variables) {
            if (this.hasProposedValue.has(variable)) {
                // remove the formulas, where the user-proposed variable is an output
                initialCache.formulasByOutput.get(variable).forEach(formula => appropriateFormulas.delete(formula))
            }
        }



    }





    // satisfiesDefaultResolution (result : CycleResolution<Variable>) : boolean {
    //     for (const [ variable, mode ] of result) {
    //         if (this.defaultResolution.get(variable) !== mode) return false
    //     }
    //
    //     return true
    // }
    //
    //
    // promoteSomeVariablesWithPreviousValueToFixed (result : CycleResolution<Variable>, vars : Set<Variable>, needToPromoteNumber : number) {
    // }
    //
    //
    // markRemainingAsPure (result : CycleResolution<Variable>) {
    //     for (const variable of this.variables) {
    //         if (!result.get(variable)) result.set(variable, CalculationMode.CalculatePure)
    //     }
    // }
}


// export class ChronoCycleDispatcher extends CycleDispatcher<Identifier> {
//
//     collectInfo (YIELD : SyncEffectHandler, identifier : Identifier) {
//         if (YIELD(PreviousValueOf(identifier)) != null) this.addPreviousValueFlag(identifier)
//
//         if (YIELD(HasProposedValue(identifier))) this.addProposedValueFlag(identifier)
//     }
// }
