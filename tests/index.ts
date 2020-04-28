declare const Siesta : any

const project       = new Siesta.Project.Browser()

project.configure({
    title                   : 'ChronoGraph Test Suite',
    isEcmaModule            : true
})


project.start(
    {
        group       : 'chrono',

        items       : [
            'chrono/010_graph.t.js',
            'chrono/020_performance.t.js',
            'chrono/030_behavior.t.js',
            'chrono/040_effects.t.js',
            'chrono/050_cycle_effect.t.js',
            'chrono/060_try_propagate.t.js'
        ]
    },
    {
        group       : 'Cycle resolver',

        items       : [
            'cycle_resolver/010_memoizing.t.js',
            'cycle_resolver/020_sed.t.js',
            'cycle_resolver/030_sedwu_fixed_duration.t.js',
            'cycle_resolver/040_sedwu_fixed_duration_effort_driven.t.js',
            'cycle_resolver/050_sedwu_fixed_effort.t.js',
            'cycle_resolver/060_sedwu_fixed_units.t.js',
        ]
    },
    {
        group       : 'graph',

        items       : [
            'graph/010_walkable.t.js',
            'graph/020_node.t.js',
            'graph/030_cycle.t.js'
        ]
    },
    {
        group       : 'replica',

        items       : [
            'replica/001_entity.t.js',
            'replica/002_self_atom.t.js',
            'replica/010_replica.t.js',
            'replica/020_relation.t.js',
            'replica/030_reference_resolver.t.js',
            'replica/040_fields_leak.t.js',
            'replica/060_try_propagate.t.js',
            'replica/070_entity_removal.t.js'
        ]
    },
    {
        group       : 'schema',

        items       : [
            'schema/010_schema.t.js',
        ]
    }
)
