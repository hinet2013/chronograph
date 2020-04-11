//---------------------------------------------------------------------------------------------------------------------
import { MIN_SMI } from "../util/Helpers.js"
import { compact, Uniqable } from "../util/Uniqable.js"

type Listener<Payload extends Array<unknown>> = (...payload : Payload) => any

export type Disposer = () => any

//---------------------------------------------------------------------------------------------------------------------
export class Event<Payload extends Array<unknown>> {
    compacted       : boolean                           = false
    listeners       : Listener<Payload> [] & Uniqable[] = []


    on (listener : Listener<Payload>) : Disposer {
        // @ts-ignore
        listener.uniqable   = MIN_SMI

        this.listeners.push(listener)

        this.compacted  = false

        return () => this.un(listener)
    }


    un (listener : Listener<Payload>) {
        if (!this.compacted) this.compact()

        const index = this.listeners.indexOf(listener)

        if (index !== -1) this.listeners.splice(index, 1)
    }


    trigger (...payload : Payload) {
        if (!this.compacted) this.compact()

        const listeners     = this.listeners.slice()

        for (let i = 0; i < listeners.length; ++i) {
            listeners[ i ](...payload)
        }
    }


    compact () {
        compact(this.listeners)
    }
}
