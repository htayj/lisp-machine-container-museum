/* Intentionally failing browser-test processor.  It is never a CADR audio
 * renderer: the F15 component harness uses it only to obtain Chromium's real
 * `processorerror` event and verify that no core acknowledgement is fabricated. */
class CadrM13FaultAudioProcessor extends AudioWorkletProcessor {
  process() { throw new Error("intentional M13 browser audio fault"); }
}
registerProcessor("cadr-m13-audio-fault", CadrM13FaultAudioProcessor);
