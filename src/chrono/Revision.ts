import { AnyConstructor, Base, Mixin } from "../class/Mixin.js"
import { Identifier, throwUnknownIdentifier } from "./Identifier.js"
import { QuarkI, TombStone } from "./Quark.js"
import { MinimalTransaction } from "./Transaction.js"


export type Scope = Map<Identifier, QuarkI>


//---------------------------------------------------------------------------------------------------------------------
export type RevisionClock   = number

let CLOCK : RevisionClock = 0

export const Revision = <T extends AnyConstructor<Base>>(base : T) =>

class Revision extends base {
    createdAt               : RevisionClock = CLOCK++

    name                    : string    = 'revision-' + this.createdAt

    previous                : Revision  = undefined

    scope                   : Scope     = new Map()

    reachableCount          : number    = 0
    referenceCount          : number    = 0

    selfDependent           : Set<Identifier>   = new Set()


    getLatestEntryFor (identifier : Identifier) : QuarkI {
        let revision : Revision = this

        while (revision) {
            const entry = revision.scope.get(identifier)

            if (entry) return entry

            revision    = revision.previous
        }

        return null
    }


    hasIdentifier (identifier : Identifier) : boolean {
        const latestEntry   = this.getLatestEntryFor(identifier)

        return Boolean(latestEntry && latestEntry.getValue() !== TombStone)
    }


    readIfExists (identifier : Identifier) : any {
        const latestEntry   = this.getLatestEntryFor(identifier)

        if (!latestEntry) return undefined

        const value         = latestEntry.getValue()

        return value !== TombStone ? (value !== undefined ? value : this.read(identifier)) : undefined
    }


    * previousAxis () : Generator<Revision> {
        let revision : Revision = this

        while (revision) {
            yield revision

            revision    = revision.previous
        }
    }


    read (identifier : Identifier) : any {
        const latestEntry   = this.getLatestEntryFor(identifier)

        if (!latestEntry) throwUnknownIdentifier(identifier)

        const value         = latestEntry.getValue()

        if (value === TombStone) throwUnknownIdentifier(identifier)

        if (value !== undefined) {
            return value
        } else {
            return this.calculateLazyEntry(latestEntry)
        }
    }


    calculateLazyEntry (entry : QuarkI) : any {
        const transaction   = MinimalTransaction.new({ baseRevision : this, candidate : this })

        transaction.entries.set(entry.identifier, entry)
        transaction.stackGen.push(entry)

        entry.forceCalculation()

        transaction.propagate()

        return entry.getValue()
    }

}

export type Revision = Mixin<typeof Revision>

export interface RevisionI extends Mixin<typeof Revision> {}


export class MinimalRevision extends Revision(Base) {}
