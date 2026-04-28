import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

async function run() {
  try {
    const detector = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32', {
      device: 'wasm',
      dtype: 'q8'
    });
    console.log("Pipeline loaded successfully");
  } catch (e) {
    console.error("Failed:", e);
  }
}
run();
