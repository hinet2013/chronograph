import {Base} from "../../src/class/Mixin.js";
import {calculate, EntityAny, EntityBase, field} from "../../src/replica/Entity.js";
import {MinimalReplica} from "../../src/replica/Replica.js";
import {Schema} from "../../src/schema/Schema.js";

declare const StartTest : any

StartTest(t => {

    t.it('Replica', async t => {
        const SomeSchema        = Schema.new({ name : 'Cool data schema' })

        const entity            = SomeSchema.getEntityDecorator()

        @entity
        class Author extends EntityBase(EntityAny(Base)) {
            @field
            id              : string

            @field
            firstName       : string

            @field
            lastName        : string

            @field
            fullName        : string


            @calculate('fullName')
            * calculateFullName (proposed : string) {
                return (yield this.$.firstName) + ' ' + (yield this.$.lastName)
            }
        }

        @entity
        class Book extends EntityBase(EntityAny(Base)) {
            @field
            name            : string

            @field
            writtenBy       : Author
        }

        // Author.addPrimaryKey(PrimaryKey.new({
        //     fieldSet        : [ Author.getField('id') ]
        // }))
        //
        //
        // Book.addForeignKey(ForeignKey.new({
        //     fieldSet                : [ Book.getField('writtenBy') ],
        //     referencedFieldSet      : [ Author.getField('id') ],
        //
        //     referencedEntity        : Author.getEntity()
        // }))

        const replica1          = MinimalReplica.new({ schema : SomeSchema })

        const markTwain         = Author.new({ firstName : 'Mark', lastName : 'Twain' })
        const tomSoyer          = Book.new({ name : 'Tom Soyer', writtenBy : markTwain })

        replica1.addEntity(markTwain)
        replica1.addEntity(tomSoyer)

        await replica1.propagate()

        t.is(markTwain.fullName, 'Mark Twain', 'Correct name calculated')

        markTwain.firstName     = 'MARK'

        await replica1.propagate()

        t.is(markTwain.fullName, 'MARK Twain', 'Correct name calculated')
    })
})
