import { ChronoGraph } from "../../src/chrono/Graph.js"

declare const StartTest : any

StartTest(t => {

    t.it('Add variable', async t => {
        const graph1 : ChronoGraph   = ChronoGraph.new()

        const var1      = graph1.variable(0)

        t.livesOk(() => graph1.read(var1))

        graph1.commit()

        t.is(graph1.read(var1), 0, 'Correct value')

        //--------------
        const graph2    = graph1.branch()

        const var2      = graph2.variable(1)

        graph2.commit()

        t.is(graph2.read(var2), 1, 'Correct value')

        //--------------
        t.throwsOk(() => graph1.read(var2), 'Unknown identifier', 'First branch does not know about variable in 2nd branch')
    })


    t.it('Remove variable', async t => {
        const graph1 : ChronoGraph   = ChronoGraph.new()

        const var1      = graph1.variable(0)

        const iden1     = graph1.identifier(function * () {
            return yield var1
        })

        t.livesOk(() => graph1.read(var1))

        graph1.commit()

        t.is(graph1.read(var1), 0, 'Correct value')

        //--------------
        const graph2    = graph1.branch()

        //--------------
        graph1.removeIdentifier(var1)

        t.throwsOk(() => graph1.read(var1), 'Unknown identifier')

        //--------------
        t.is(graph2.read(var1), 0, 'Other branches not affected by removal')
    })


    t.it('Remove identifier', async t => {
        const graph1 : ChronoGraph   = ChronoGraph.new()

        const var1      = graph1.variable(0)

        const iden1     = graph1.identifier(function * () {
            return (yield var1) + 1
        })

        const iden2     = graph1.identifier(function * () {
            return (yield iden1) + 1
        })

        t.is(graph1.read(iden2), 2)

        graph1.commit()

        // remove identifier with incoming edge and commit
        graph1.removeIdentifier(iden2)

        graph1.commit()

        // should not trigger a crash
        graph1.write(var1, 1)

        t.is(graph1.read(iden1), 2)
    })
})
