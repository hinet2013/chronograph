import { ChronoGraph, MinimalChronoGraph } from "../../src/chrono/Graph.js"
import { ProposedOrCurrentValue, ProposedValue, Transaction } from "../../src/chrono/Transaction.js"
import { CalculationIterator } from "../../src/primitives/Calculation.js"
import { ImpureCalculatedValueGen } from "../../src/chrono/Identifier.js"

declare const StartTest : any

StartTest(t => {

    t.it('ProposedOrCurrentValue - transient', async t => {
        const graph : ChronoGraph   = MinimalChronoGraph.new()

        const max       = graph.variableId('variable', 100)

        const var1      = graph.addIdentifier(ImpureCalculatedValueGen.new({
            * calculation () : CalculationIterator<number> {
                const proposedValue : number    = yield ProposedOrCurrentValue()

                const maxValue : number         = yield max

                return proposedValue <= maxValue ? proposedValue : maxValue
            }
        }))

        graph.call(var1, 18)

        graph.propagate()

        t.is(graph.read(var1), 18, 'Correct value')

        //------------------
        graph.call(var1, 180)

        graph.propagate()

        t.is(graph.read(var1), 100, 'Correct value')


        //------------------
        graph.write(max, 1000)

        graph.propagate()

        t.is(graph.read(var1), 100, 'Correct value')


        //------------------
        graph.write(max, 50)

        graph.propagate()

        t.is(graph.read(var1), 50, 'Correct value')


        //------------------
        graph.write(max, 100)

        graph.propagate()

        t.is(graph.read(var1), 50, 'Correct value')
    })


    t.iit('ProposedOrCurrentValue - caching', async t => {
        const graph : ChronoGraph   = MinimalChronoGraph.new()

        const var0      = graph.variableId('var0', 1)

        const max       = graph.variableId('max', 100)

        const var1      = graph.addIdentifier(ImpureCalculatedValueGen.new({
            * calculation () : CalculationIterator<number> {
                const proposedValue : number    = yield ProposedOrCurrentValue()

                const maxValue : number         = yield max

                return proposedValue <= maxValue ? proposedValue : maxValue
            }
        }))

        const spy       = t.spyOn(var1, 'calculation')

        graph.call(var1, 18)

        graph.propagate()

        t.expect(spy).toHaveBeenCalled(1)

        t.is(graph.read(var1), 18, 'Correct value')

        //------------------
        spy.reset()

        graph.write(var0, 2)

        graph.propagate()

        t.expect(spy).toHaveBeenCalled(0)

        t.is(graph.read(var1), 18, 'Correct value')

        //------------------
        spy.reset()

        graph.write(var0, 3)

        graph.propagate()

        t.expect(spy).toHaveBeenCalled(0)

        t.is(graph.read(var1), 18, 'Correct value')

        //------------------
        spy.reset()

        graph.write(max, 50)

        graph.propagate()

        t.expect(spy).toHaveBeenCalled(1)

        t.is(graph.read(var1), 18, 'Correct value')


        //------------------
        spy.reset()

        graph.write(max, 10)

        graph.propagate()

        t.expect(spy).toHaveBeenCalled(1)

        t.is(graph.read(var1), 10, 'Correct value')
    })


    // t.it('CurrentProposedValue - transient', async t => {
    //     const graph : ChronoGraph   = MinimalChronoGraph.new()
    //
    //     const var1      = graph.variableId('variable', 100)
    //
    //     const var2      = graph.addIdentifier(ImpureCalculatedValueGen.new({
    //         validate (Yield : Transaction, proposedValue : any) : CalculationIterator<number> {
    //             const max : number      = yield var1
    //
    //             return proposedValue <= max ? proposedValue : max
    //         },
    //
    //         * calculation () : CalculationIterator<number> {
    //             const dispatching = yield dispatcher
    //
    //             if (dispatching === 'recalculate') {
    //
    //             }
    //             else if (dispatching === 'use_user_input_or_keep_unchanged') {
    //                 return UseProposedOrKeepUnchanged()
    //             }
    //         },
    //
    //
    //     }))
    // })


})
