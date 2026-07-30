/*
 * Deterministic, public-data-only M6 producer fixture for the M8/M9 receipt
 * validator.  This is deliberately not a captured CADR session: it expands
 * the tracked release record into the exact *grammar* that the receipt parser
 * expects, with a caller-supplied synthetic session identifier.
 *
 * It exists so the public M8/M9 test can exercise strict raw-transcript and
 * CDRM6I1 validation without reading an ignored runtime capture.  It must not
 * be used as evidence of a native run.
 */

const FORMS = Object.freeze({
  a: Object.freeze([0x4d36, 0x4131, 0xa55a]),
  b: Object.freeze([0x4d36, 0x4232, 0x5aa5]),
  c: Object.freeze([0x4d36, 0x4944, 0x4c45]),
});
const WRITE_BOUNDARIES = Object.freeze([
  Object.freeze([328589384, 328606313, 328623242]),
  Object.freeze([980279676, 980296605, 980313534]),
  Object.freeze([982955347, 982972780, 982990213]),
]);
const BOUNDARIES = Object.freeze([328623243, 980313535, 982990214, 983990214]);
const RETAINED_ALL_UP = 0x18000;
const CLEANUP_HOLD = 1_000_000;

function fail(message) { throw new TypeError(`synthetic M6 producer: ${message}`); }
function dueClock(ordinal) { return Math.floor((ordinal * 1_000_000 + 59) / 60); }
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

function quiescentState(ordinal, scheduleConsumed, debugWrites) {
  return {
    scheduler: { machine_cycles: ordinal, halted: 0, pending_count: 0 },
    keyboard: { scancode: RETAINED_ALL_UP, ready: 0, fifo_count: 0 },
    iob: { csr: 0, sixty_cycle_clock: 0 },
    disk: { status: 3, busy: 0, outstanding_operation: 0, interrupt_request: 1, fault: 0 },
    host: { request_pending: 0, completion_queued: 0, outstanding_request_id: 0 },
    completion: { schedule_consumed: scheduleConsumed, debug_ir_writes: debugWrites },
  };
}

function requireRelease(release) {
  const schedule = release?.schedule;
  const events = [...(schedule?.pre_a_batches ?? []), ...(schedule?.post_a_batches ?? [])].flat();
  if (release?.schema !== "cadr-m6-native-debug-ir-release-record-v1" ||
      schedule?.schema !== "cadr-m6-raw-cadet-boundary-schedule-v1" ||
      typeof schedule?.sha256 !== "string" || !Number.isSafeInteger(schedule?.event_count) ||
      events.length !== schedule.event_count || events.length === 0 ||
      release?.clock_schedule?.event_count !== Math.floor(((BOUNDARIES[3] + 64) * 60) / 1_000_000) ||
      !same(release?.forms?.a?.words16, FORMS.a) || !same(release?.forms?.b?.words16, FORMS.b) ||
      !same(release?.forms?.c?.words16, FORMS.c) ||
      !Array.isArray(release?.expected_debug_writes) || release.expected_debug_writes.length !== 9 ||
      release?.idle_oracle?.wire_schema !== "CDRM6I1" || release.idle_oracle.sample_bytes !== 96 ||
      release.idle_oracle.sample_count !== 64 || !Array.isArray(release.idle_oracle.samples) ||
      release.idle_oracle.samples.length !== 64) {
    fail("tracked release record is not the selected M6 fixture profile");
  }
  for (const [index, event] of events.entries()) {
    if (!Number.isSafeInteger(event?.index) || event.index !== index ||
        !/^[1-9][0-9]*$/.test(event?.due_boundary ?? "") ||
        !Number.isSafeInteger(event?.scancode) ||
        !["boot", "form-a", "form-b"].includes(event?.phase)) {
      fail(`tracked schedule event ${index} is malformed`);
    }
  }
  return Object.freeze({ schedule, events: Object.freeze(events) });
}

/**
 * Expand the selected *tracked* release record into a synthetic raw producer.
 * The source is public release metadata, not ignored native output.  `sessionId`
 * intentionally changes only the meta record so each test materialization is
 * independently bound.
 */
export function materializeSyntheticM6Producer({ release, sessionId }) {
  if (typeof sessionId !== "string" || !/^native-[0-9a-f]{32}$/.test(sessionId)) {
    fail("session identifier is not a synthetic native identifier");
  }
  const { schedule, events } = requireRelease(release);
  const rows = [];
  let sequence = 0;
  const push = (boundary, priority, value) => rows.push({ boundary, priority, sequence: sequence++, value });
  const phase = Object.freeze({ boot: 0, "form-a": 1, "form-b": 2 });

  for (let ordinal = 1; ordinal <= release.clock_schedule.event_count; ordinal += 1) {
    push(dueClock(ordinal), 0, { kind: "clock", ordinal, due_boundary: dueClock(ordinal),
      color_enabled: 0, policy: "ceil(n*1000000/60)" });
  }
  for (const event of events) {
    const due = Number(event.due_boundary);
    push(due, 1, { kind: "event", ordinal: event.index, due_boundary: due,
      scancode: event.scancode, phase: phase[event.phase] });
  }
  for (const [index, write] of release.expected_debug_writes.entries()) {
    const boundary = WRITE_BOUNDARIES[Math.floor(index / 3)][index % 3];
    push(boundary, 2, { kind: "write", boundary, address: write.address, value: write.value });
  }
  const preA = events.filter(event => event.phase !== "form-b").length;
  const boundary = (ordinal, words, consumed, writes) => ({ kind: "boundary", ordinal,
    debug_ir_words: words, state: quiescentState(ordinal, consumed, writes) });
  push(BOUNDARIES[0], 3, boundary(BOUNDARIES[0], FORMS.a, preA, 3));
  push(BOUNDARIES[1], 3, boundary(BOUNDARIES[1], FORMS.b, events.length, 6));
  push(BOUNDARIES[2], 3, boundary(BOUNDARIES[2], FORMS.c, events.length, 9));
  push(BOUNDARIES[3], 4, { kind: "settled", ordinal: BOUNDARIES[3],
    cleanup_hold_boundaries: CLEANUP_HOLD, debug_ir_words: FORMS.c,
    state: quiescentState(BOUNDARIES[3], events.length, 9) });
  for (let index = 0; index < 64; index += 1) {
    const ordinal = BOUNDARIES[3] + index + 1;
    push(ordinal, 3, boundary(ordinal, FORMS.c, events.length, 9));
  }
  rows.sort((left, right) => left.boundary - right.boundary || left.priority - right.priority || left.sequence - right.sequence);
  const transcript = Buffer.from([
    JSON.stringify({ kind: "meta", schema: "cadr-m6-native-raw-v2", schedule_sha256: schedule.sha256,
      schedule_events: schedule.event_count, session_id: sessionId }),
    ...rows.map(row => JSON.stringify(row.value)),
    JSON.stringify({ kind: "complete", clean_shutdown: true, schedule_consumed: schedule.event_count,
      debug_ir_writes: 9 }),
    "",
  ].join("\n"), "utf8");
  const idle = Buffer.concat(release.idle_oracle.samples.map((sample, index) => {
    if (typeof sample !== "string" || !/^[0-9a-f]{192}$/.test(sample)) {
      fail(`tracked idle sample ${index} is malformed`);
    }
    return Buffer.from(sample, "hex");
  }));
  if (idle.byteLength !== 64 * 96) fail("tracked idle samples have the wrong extent");
  return Object.freeze({ transcript, idle, transcript_record_count: rows.length + 2,
    source: "tracked-public-release-record-synthetic-grammar" });
}
