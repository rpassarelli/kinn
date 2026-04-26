# Submission summary — Built with Opus 4.7

**kinn** is a real-time Bayesian diagnostic interview engine. After every stakeholder answer, it computes the Expected Information Gain (EIG) of each candidate next question against a Bayesian belief over the stakeholder's situation, and asks the one that collapses the most uncertainty.

The frame is BED-LLM: Opus 4.7 is *both* the answer-distribution sampler (predicting plausible responses) and the belief updater (revising priors). DSPy/GEPA compiles the prompts; runtime is a forced-tool-call loop with prompt caching, two-phase recompile, and dual-algedonic state.

The demo runs the engine against a small-business dental-clinic persona — proving the loop works on the most ordinary SMB intake, not just enterprise discovery. The retrospective publishes the honest dual-gate benchmark: a measurable regression vs the predecessor baseline that the README does not hide.

Built solo across the Apr 21–28 hackathon window in three iterations (kinn → kinn2 → kinn3). Open source (MIT). Demo: `./demo`. Engine: `./src`. Video: 3-min Remotion render in `./video`.

---

**Repo:** https://github.com/rpassarelli/kinn
**Video:** *(paste link from YouTube/Loom upload)*
**Author:** Rodrigo Passarelli (solo) · Claude Opus 4.7 (AI co-author)
