import { AnyConstructor, AnyFunction, Mixin, MixinConstructor } from "../class/Mixin.js"
import { Graph, MinimalGraph } from "../graph/Graph.js"
import { Node } from "../graph/Node.js"
import { cycleInfo, OnCycleAction, WalkForwardContext, WalkStep } from "../graph/Walkable.js"
import { FieldAtom } from "../replica/Atom.js"
import { ChronoAtom, ChronoAtomI, ChronoIterator, ChronoValue, isChronoAtom, MinimalChronoAtom } from "./Atom.js"
import {
    CancelPropagationEffect,
    Effect,
    EffectResolutionResult,
    EffectResolverFunction,
    GraphCycleDetectedEffect,
    RestartPropagationEffect
} from "./Effect.js"
import { ChronoId } from "./Id.js"


//---------------------------------------------------------------------------------------------------------------------
export type ChronoRevision          = number

//---------------------------------------------------------------------------------------------------------------------
export type ChronoContinuation      = { iterator : ChronoIterator, atom? : ChronoAtom }
export type ChronoIterationResult   = { value? : ChronoValue, continuation? : ChronoContinuation, effect? : Effect }
export type PropagateSingleResult   = { success : true }
export type FinalizerFn             = () => Promise<PropagationResult>

//---------------------------------------------------------------------------------------------------------------------
export enum PropagationResult {
    Canceled,
    Completed,
    Passed
}


export type Transition = { iterator : IterableIterator<ChronoValue>, iterationResult : IteratorResult<ChronoValue>, edgesFlow : number }


//---------------------------------------------------------------------------------------------------------------------
export const ChronoGraph = <T extends AnyConstructor<Graph>>(base : T) =>

class ChronoGraph extends base {
    nodeT                   : ChronoAtomI

    nodesMap                : Map<ChronoId, ChronoAtomI> = new Map()

    needRecalculationAtoms  : Set<ChronoAtomI>       = new Set()

    transitions             : Map<ChronoAtomI, Transition>

    isPropagating           : boolean               = false

    propagateCompletedListeners : AnyFunction[]     = []

    propagateSuspended      : number                = 0

    resumePromise           : Promise<PropagationResult>

    resumeResolved          : Function

    resumeRejected          : Function


    isAtomNeedRecalculation (atom : ChronoAtomI) : boolean {
        return this.needRecalculationAtoms.has(atom)
    }


    markAsNeedRecalculation (atom : ChronoAtomI) {
        this.needRecalculationAtoms.add(atom)
    }


    markProcessed (atom : ChronoAtomI) {
        this.needRecalculationAtoms.delete(atom)
    }


    commit () {
        this.needRecalculationAtoms.forEach(atom => atom.clearUserInput())
        this.needRecalculationAtoms.clear()

        for (const [ atom, transition ] of this.transitions) {
            if (transition.iterationResult) {
                atom.commitValue()
                atom.commitEdges()
            }
        }
    }


    reject () {
        this.rejectPartialProgress()

        this.needRecalculationAtoms.forEach(atom => atom.clearUserInput())
        this.needRecalculationAtoms.clear()
    }


    rejectPartialProgress () {
        this.transitions.forEach((transition, atom) => {
            if (transition.iterationResult) atom.reject()
        })
    }


    addNode (node : this[ 'nodeT' ]) : this[ 'nodeT' ] {
        const res   = super.addNode(node)

        this.nodesMap.set(node.id, node)

        this.markAsNeedRecalculation(node)

        node.onEnterGraph(this)

        return res
    }


    removeNode (node : this[ 'nodeT' ]) {
        node.outgoing.forEach((toNode : ChronoAtom) => this.markAsNeedRecalculation(toNode))

        const res   = super.removeNode(node)

        this.nodesMap.delete(node.id)
        this.needRecalculationAtoms.delete(node)

        node.onLeaveGraph(this)

        return res
    }


    // startAtomCalculation (sourceAtom : ChronoAtomI) : ChronoIterationResult {
    //     const iterator : ChronoIterator<ChronoValue> = sourceAtom.calculate(sourceAtom.proposedValue)
    //
    //     let iteratorValue   = iterator.next()
    //
    //     const value         = iteratorValue.value
    //
    //     if (value instanceof Effect) {
    //         return { effect : value, continuation : { iterator : iterator } }
    //     }
    //     else if (iteratorValue.done) {
    //         return { value }
    //     }
    //     else {
    //         return { continuation : { atom : value, iterator : iterator } }
    //     }
    // }
    //
    //
    // continueAtomCalculation (sourceAtom : ChronoAtomI, continuation : ChronoContinuation, maybeDirtyAtoms : Set<ChronoAtomI>) : ChronoIterationResult {
    //     const me            = this,
    //           iterator      = continuation.iterator
    //
    //     let incomingAtom    = continuation.atom
    //
    //     do {
    //         let iteratorValue : IteratorResult<Effect | ChronoAtom | ChronoValue>
    //
    //         if (incomingAtom) {
    //             sourceAtom.observedDuringCalculation.push(incomingAtom)
    //
    //             // Cycle condition
    //             // ideally should be removed (same as while condition)
    //             if (maybeDirtyAtoms.has(incomingAtom) && !this.isAtomStable(incomingAtom)) {
    //                 let cycle : Node[]
    //
    //                 me.walkDepth(WalkForwardContext.new({
    //                     forEachNext             : function (atom : ChronoAtom, func) {
    //                         if (atom === <any> me) {
    //                             me.needRecalculationAtoms.forEach(func)
    //                         }
    //                         else {
    //                             atom.observedDuringCalculation.forEach(func)
    //                         }
    //                     },
    //
    //                     onCycle                 : (node : Node, stack : WalkStep[]) => {
    //                         // NOTE: After onCycle call walkDepth instantly returns
    //                         cycle = cycleInfo(stack) as Node[]
    //
    //                         return OnCycleAction.Cancel
    //                     }
    //                 }))
    //
    //                 iteratorValue = { value: GraphCycleDetectedEffect.new({ cycle }), done : true }
    //             }
    //             else {
    //                 iteratorValue   = iterator.next(
    //                     incomingAtom.hasNextStableValue() ? incomingAtom.getNextStableValue() : incomingAtom.getConsistentValue()
    //                 )
    //             }
    //
    //         } else {
    //             iteratorValue   = iterator.next()
    //         }
    //
    //         const value         = iteratorValue.value
    //
    //         if (value instanceof Effect) {
    //             return { effect : value, continuation : { iterator : iterator } }
    //         }
    //
    //         if (iteratorValue.done) {
    //             return { value }
    //         }
    //
    //         // TODO should ignore non-final non-atom values
    //         incomingAtom    = value
    //
    //     } while (!maybeDirtyAtoms.has(incomingAtom) || this.isAtomStable(incomingAtom))
    //
    //     return { continuation : { iterator, atom : incomingAtom } }
    // }


    * propagateSingle () : IterableIterator<Effect | PropagateSingleResult> {
        const stack             = []
        const transitions       = this.transitions = new Map<ChronoAtom, Transition>()

        const me                = this

        let cycle : Node[]      = null

        this.walkDepth(WalkForwardContext.new({
            forEachNext             : function (atom : ChronoAtom, func) {
                if (atom === <any> me) {
                    me.needRecalculationAtoms.forEach(func)
                } else {
                    WalkForwardContext.prototype.forEachNext.call(this, atom, func)
                }
            },

            onNode                  : (atom : ChronoAtom) => {
                // console.log(`Visiting ${node}`)
            },
            onCycle                 : (node : Node, stack : WalkStep[]) => {
                // NOTE: After onCycle call walkDepth instantly returns
                cycle = cycleInfo(stack) as Node[]

                return OnCycleAction.Cancel
            },

            onTopologicalNode       : (atom : ChronoAtom) => {
                if (<any> atom === <any> this) return

                transitions.set(atom, { iterator : null, iterationResult : null, edgesFlow : atom.incoming.size })

                // skip lazy atoms from `toCalculate` array, instead nullify there values
                // lazy atoms may still be calculated as dependencies of other atoms
                if (atom.lazy) {
                    atom.clear()
                } else {
                    stack.push(atom)
                }
            }
        }))

        if (cycle) {
            return GraphCycleDetectedEffect.new({ cycle })
        }

        // set edgesFlow for `needRecalculation` atoms to 1e6 - to always force there calculation
        this.needRecalculationAtoms.forEach(atom => transitions.get(atom).edgesFlow = 1e6)

        let depth

        while (depth = stack.length) {
            const sourceAtom : ChronoAtom   = stack[ depth - 1 ]

            const transition    = transitions.get(sourceAtom)

            if (transition.iterationResult && transition.iterationResult.done || transition.edgesFlow < 0) {
                stack.pop()
                continue
            }

            let iterationResult : IteratorResult<any>

            if (transition.iterationResult) {
                iterationResult     = transition.iterationResult
            } else {
                if (transition.edgesFlow == 0 && sourceAtom.proposedArgs === undefined) {
                    transition.edgesFlow--

                    sourceAtom.nextStableValue  = sourceAtom.value

                    sourceAtom.outgoing.forEach((atom : ChronoAtom) => transitions.get(atom).edgesFlow--)

                    stack.pop()
                    continue
                } else {
                    transition.iterator     = sourceAtom.calculate(sourceAtom.proposedValue)

                    iterationResult         = transition.iterationResult = transition.iterator.next()
                }
            }

            do {
                const value         = iterationResult.value

                if (iterationResult.done) {
                    if (sourceAtom.equality(value, sourceAtom.getConsistentValue())) {
                        sourceAtom.outgoing.forEach((atom : ChronoAtom) => transitions.get(atom).edgesFlow--)
                    }

                    sourceAtom.nextStableValue = value

                    stack.pop()

                    break
                }
                else if (isChronoAtom(value)) {
                    sourceAtom.observedDuringCalculation.push(value)

                    const requestedTransition   = transitions.get(value)

                    if (!requestedTransition || requestedTransition.edgesFlow <= 0 || requestedTransition.iterationResult && requestedTransition.iterationResult.done) {
                        iterationResult = transition.iterationResult = transition.iterator.next(value.get())
                    }
                    else if (!requestedTransition.iterationResult) {
                        stack.push(value)

                        break
                    }
                    else {
                        // cycle - the requested quark has started calculation (means it was encountered in this loop before)
                        // but the calculation did not complete yet (even that requested quark is calculated before the current)
                        let cycle : Node[]

                        me.walkDepth(WalkForwardContext.new({
                            forEachNext             : function (atom : ChronoAtom, func) {
                                if (atom === <any> me) {
                                    me.needRecalculationAtoms.forEach(func)
                                }
                                else {
                                    atom.observedDuringCalculation.forEach(func)
                                }
                            },

                            onCycle                 : (node : Node, stack : WalkStep[]) => {
                                // NOTE: After onCycle call walkDepth instantly returns
                                cycle = cycleInfo(stack) as Node[]

                                return OnCycleAction.Cancel
                            }
                        }))

                        yield GraphCycleDetectedEffect.new({ cycle })
                    }
                }
                else {
                    // bypass the unrecognized effect to the outer context
                    iterationResult = transition.iterationResult = transition.iterator.next(yield value)
                }

            } while (true)
        }

        return { success : true }
    }


    calculateLazyAtom (atom : ChronoAtomI) : ChronoValue {
        const toCalculate       = [ atom ]
        const transitions       = new Map<ChronoAtom, { iterator : IterableIterator<ChronoValue>, iterationResult : IteratorResult<ChronoValue> }>()

        const updatedAtoms : ChronoAtom[]     = []

        while (toCalculate.length) {
            const sourceAtom : ChronoAtom   = toCalculate[ toCalculate.length - 1 ]

            let transition      = transitions.get(sourceAtom)

            if (transition && transition.iterationResult.done) {
                toCalculate.pop()
                continue
            }

            if (!transition) {
                const iterator      = sourceAtom.calculate(sourceAtom.proposedValue)

                transition          = { iterator : iterator, iterationResult : iterator.next() }

                transitions.set(sourceAtom, transition)
            }

            let iterationResult : IteratorResult<any> = transition.iterationResult

            do {
                const value         = iterationResult.value

                if (iterationResult.done) {
                    sourceAtom.value    = value

                    updatedAtoms.push(sourceAtom)

                    toCalculate.pop()

                    break
                }
                else if (isChronoAtom(value)) {
                    sourceAtom.observedDuringCalculation.push(value)

                    // non-lazy atoms are supposed to be already calculated
                    if (!value.lazy) {
                        iterationResult = transition.iterationResult = transition.iterator.next(value.get())
                    } else {
                        const requestedTransition   = transitions.get(value)

                        if (!requestedTransition) {
                            toCalculate.push(value)
                            break
                        } else if (requestedTransition.iterationResult.done) {
                            iterationResult = transition.iterationResult = transition.iterator.next(value.get())
                        } else {
                            throw new Error("Cycle during lazy atom calculation")
                        }
                    }
                }
                else {
                    throw new Error("Unknown value yielded during lazy atom calculation")
                }

            } while (true)
        }

        updatedAtoms.forEach(atom => atom.commitEdges())

        return atom.get()
    }


    async onEffect (effect : Effect) : Promise<EffectResolutionResult> {
        if (effect instanceof CancelPropagationEffect) {
            return EffectResolutionResult.Cancel
        }

        if (effect instanceof RestartPropagationEffect) {
            return EffectResolutionResult.Restart
        }

        if (effect instanceof GraphCycleDetectedEffect) {
            throw new Error('Graph cycle detected')
        }

        return EffectResolutionResult.Resume
    }


    waitForPropagateCompleted () : Promise<PropagationResult | null> {
        if (!this.isPropagating) return Promise.resolve(null)

        return new Promise(resolve => {
            this.propagateCompletedListeners.push(resolve)
        })
    }

    /**
     * 222 Suspend propagation processing. When propagation is suspended, calls to propagate
     * do not proceed, instead a propagate call is deferred until a matching
     * _resumePropagate_ is called.
     */
    suspendPropagate () {
        this.propagateSuspended++
    }

    /**
     * Resume propagation. If propagation is resumed (calls may be nested which increments a
     * suspension counter), then if a call to propagate was made during suspension, propagate is
     * executed.
     * @param {Boolean} [trigger] Pass `false` to inhibit automatic propagation if propagate was requested during suspension.
     */
    async resumePropagate (trigger? : Boolean) {
        if (this.propagateSuspended) {
            // If we are still suspended, return the resumePromise
            if (--this.propagateSuspended) {
                return this.resumePromise
            }
            // Otherwise, if a call to propagate while suspended led to the creation
            // of the resumePromise, propagate now.
            else if (this.resumePromise && trigger !== false) {
                return this.propagate()
            }
        }

        // We were not suspended, or we have resumed but there were no calls
        // to propagate during the suspension, so there's no effect.
        return Promise.resolve(PropagationResult.Completed)
    }

    async propagate (onEffect? : EffectResolverFunction, dryRun : (boolean | Function) = false) : Promise<PropagationResult> {
        const me = this

        if (me.propagateSuspended) {
            // Create a promise which we will resolve when the suspension is lifted
            // and this Entity propagates.
            if (!me.resumePromise) {
                me.resumePromise = new Promise<PropagationResult>((resolve, reject) => {
                    me.resumeResolved = resolve
                    me.resumeRejected = reject
                })
            }
            return me.resumePromise
        }
        else {
            if (me.resumePromise) {
                const
                    resolve = me.resumeResolved,
                    reject = me.resumeRejected

                // Reset the suspension promise apparatus
                me.resumePromise = me.resumeResolved = me.resumeRejected = null

                // Perform the propagation then inform any callers of propagate during the suspension.
                return me.propagateUnsuspended(onEffect, dryRun).then(value => {
                    resolve(value)
                    return value
                }, value => {
                    reject(value)
                    return value
                })
            }
            else {
                return me.propagateUnsuspended(onEffect, dryRun)
            }
        }
    }

    async propagateUnsuspended (onEffect? : EffectResolverFunction, dryRun : (boolean | Function) = false) : Promise<PropagationResult> {
        if (this.isPropagating) throw new Error("Can not nest calls to `propagate`, use `waitForPropagateCompleted`")

        let needToRestart : boolean,
            result        : PropagationResult

        this.isPropagating          = true

        do {
            needToRestart           = false

            const propagationIterator = this.propagateSingle()

            let iteratorValue

            do {
                iteratorValue       = propagationIterator.next()

                const value         = iteratorValue.value

                if (value instanceof Effect) {
                    let resolutionResult : EffectResolutionResult

                    if (onEffect) {
                        resolutionResult    = await onEffect(value)
                    } else {
                        resolutionResult    = await this.onEffect(value)
                    }

                    if (resolutionResult === EffectResolutionResult.Cancel) {
                        // Escape hatch to get next consistent atom value before rejection
                        if (typeof dryRun === 'function') {
                            dryRun()
                        }

                        // POST-PROPAGATE sequence, TODO refactor
                        this.reject()
                        this.isPropagating  = false
                        await this.propagationCompletedHook()
                        this.onPropagationCompleted(PropagationResult.Canceled)

                        return PropagationResult.Canceled
                    }
                    else if (resolutionResult === EffectResolutionResult.Restart) {
                        this.rejectPartialProgress()

                        needToRestart       = true

                        break
                    }
                }
            } while (!iteratorValue.done)

        } while (needToRestart)

        if (dryRun) {
            // Escape hatch to get next consistent atom value before rejection
            if (typeof dryRun === 'function') {
                dryRun()
            }

            // POST-PROPAGATE sequence, TODO refactor
            this.reject()
            this.isPropagating = false
            await this.propagationCompletedHook()
            this.onPropagationCompleted(PropagationResult.Completed) // Shouldn't it be PropagationResult.Passed?

            result = PropagationResult.Passed
        }
        else {
            // POST-PROPAGATE sequence, TODO refactor
            this.commit()
            this.isPropagating = false
            await this.propagationCompletedHook()
            this.onPropagationCompleted(PropagationResult.Completed)

            result = PropagationResult.Completed
        }

        return result
    }


    async tryPropagateWithNodes (onEffect? : EffectResolverFunction, nodes? : this[ 'nodeT' ][], hatchFn? : Function) : Promise<PropagationResult> {

        if (nodes && nodes.length) {
            nodes = nodes.filter(n => n.graph !== this)
            if (nodes.length) {
                this.addNodes(nodes)
            }
        }

        const result = await this.propagate(onEffect, hatchFn || true)

        if (nodes && nodes.length) {
            nodes && this.removeNodes(nodes)
        }

        return result
    }


    async propagationCompletedHook () {
    }


    onPropagationCompleted (result : PropagationResult) {
        this.propagateCompletedListeners.forEach(listener => listener(result))

        this.propagateCompletedListeners    = []
    }


    // used for debugging, when exception is thrown in the middle of the propagate and edges are not yet committed
    commitAllEdges () {
        this.nodes.forEach(atom => atom.commitEdges())
    }


    toDotOnCycleException () {
        this.commitAllEdges()

        return this.toDot()
    }


    toDot () : string {
        let dot = [
            'digraph ChronoGraph {',
            'splines=spline'
        ]

        const arrAtoms : [ChronoId, ChronoAtom][] = Array.from(this.nodesMap.entries())

        // Group atoms into subgraphs by label
        //
        // atom.self.id    - entity
        // atom.field.name -

        const namedAtomsByGroup : Map<string, Set<[string, ChronoAtom]>> = arrAtoms.reduce(
            (map, [atomId, atom]) => {
                let [group, label] = String(atomId).split('/')

                // @ts-ignore
                const { id, name } = (atom as FieldAtom).self || {},
                      { field } = (atom as FieldAtom)

                group = name || id || group
                label = field && field.name || label

                if (!map.has(group)) {
                    map.set(group, new Set([[label || '', atom]]))
                }
                else {
                    map.get(group).add([label, atom])
                }

                return map
            },
            new Map()
        )

        // Generate subgraphs
        dot = Array.from(namedAtomsByGroup.entries()).reduce(
            (dot, [group, namedAtoms], index) => {
                dot.push(`subgraph cluster_${index} {`)

                dot.push(`label="${group}"`)

                dot = Array.from(namedAtoms.values()).reduce(
                    (dot, [name, atom]) => {
                        let value : any

                        if ((atom as any).newRefs && (atom as any).oldRefs) {
                            const collection    = atom.get()

                            value = `Set(${collection && collection.size || 0})`
                        }
                        else {
                            value = atom.get()
                        }

                        if (value instanceof Date) {
                            value = [value.getFullYear(), '.', value.getMonth() + 1, '.', value.getDate(), ' ', value.getHours() + ':' + value.getMinutes()].join('')
                        }
                        else if (Array.isArray(value)) {
                            value = `Array(${value.length})`
                        }

                        let color = (!this.isAtomNeedRecalculation(atom) /*|| this.isAtomStable(atom)*/) ? 'darkgreen' : 'red'

                        dot.push(`"${atom.id}" [label="${name}=${value}\", fontcolor="${color}"]`)

                        return dot
                    },
                    dot
                )

                dot.push('}')

                return dot
            },
            dot
        )

        let cycle : object = {}

        // Cycle detection
        this.walkDepth(WalkForwardContext.new({
            onCycle : (_node : Node, stack : WalkStep[]) : OnCycleAction => {
                const ci : Node[]   = cycleInfo(stack) as Node[]

                cycle = ci.reduce(
                    ([cycle, prevNode], curNode) => {
                        if (prevNode) {
                            cycle[(prevNode as ChronoAtom).id] = (curNode as ChronoAtom).id
                        }
                        return [cycle, curNode]
                    },
                    [cycle, null]
                )[0]

                return OnCycleAction.Cancel
            }
        }))


        // Generate edges
        dot = arrAtoms.reduce(
            (dot, [fromId, fromAtom] : [ChronoId, ChronoAtom]) => {

                const outgoingEdges = fromAtom.outgoing

                Array.from(outgoingEdges).reduce(
                    (dot, toAtom : ChronoAtom) => {

                        //let edgeLabel = this.getEdgeLabel(fromId, atom.id)
                        const edgeLabel = ''

                        let color = (!this.isAtomNeedRecalculation(fromAtom) /*|| this.isAtomStable(fromAtom)*/) ? 'darkgreen' : 'red'
                        let penwidth = (cycle[fromId] == toAtom.id) ? 5 : 1

                        dot.push(`"${fromId}" -> "${toAtom.id}" [label="${edgeLabel}", color="${color}", penwidth=${penwidth}]`)

                        return dot
                    },
                    dot
                )

                return dot
            },
            dot
        )

        dot.push('}')

        return dot.join('\n')
    }
}

export type ChronoGraph = Mixin<typeof ChronoGraph>
export interface ChronoGraphI extends Mixin<typeof ChronoGraph> {}

export class MinimalChronoGraph extends ChronoGraph(MinimalGraph) {
    nodeT                   : ChronoAtomI
}
