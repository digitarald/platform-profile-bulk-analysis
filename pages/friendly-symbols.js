import _ from 'lodash/fp';

export const friendlySymbols = [
  {
    name: 'parse',
    match: /^nsparser::tokenize/i,
  },
  {
    name: 'parse',
    match: /jsfunction::createscriptforlazilyinterpretedfunction/i,
  },
  {
    name: 'parse',
    match: /nscssparser::parsesheet/i,
  },
  {
    name: 'script',
    match: /js::runscript/i,
  },
  {
    name: 'gc',
    sub: 'nursery',
    match: /js::gc::gcruntime::minorgc/i,
  },
  {
    name: 'gc',
    sub: 'collect',
    match: /nsjscontext::garbagecollectnow|^js::gc::gcruntime::collect|autosuppressgc/i,
  },
  {
    name: 'gc',
    sub: 'forget',
    match: /nscyclecollector::(forgetskippable|collect|freesnowwhite)/i,
  },
  // {
  //   name: 'jit',
  //   match: /js::jit::baselinecompile|js::jit::ionbuilder::build|^linkcodegen/i,
  // },
  {
    name: 'style',
    match: /resolvestylecontext|processpendingrestyles|nsrulenode::walkruletree/i,
  },
  {
    name: 'layout',
    match: /presshell::processreflowcommands/i,
  },
  {
    name: 'paint',
    match: /presshell::paint|builddisplaylist/i,
  },
  {
    match: /mozilla::ipc::messagechannel/i,
    name: 'ipc',
    exclude: true,
  },
  {
    match: /mach_msg_trap|^ntwaitformultipleobjects|^ntgdibitblt/i,
    name: 'idle',
    exclude: true,
  },
];

export const mainSymbols = _.flow([
  _.filter(({ exclude }) => !exclude),
  _.map('name'),
  _.uniq,
])(friendlySymbols).concat(['unknown']);

export const allSymbols = _.flow([
  _.map('name'),
  _.uniq,
])(friendlySymbols).concat(['unknown']);
