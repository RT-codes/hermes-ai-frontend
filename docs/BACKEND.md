# Hermes Home backend & runtime

This document describes the **current reference backend used to develop and test Hermes Home**.

It is not a minimum hardware requirement for the frontend. It documents the local AI stack currently powering the project, why these components were chosen, and the performance baseline used during development.

## Stack overview

The current backend combines:

- **Hermes Agent** for conversation, reasoning and orchestration;
- **Qwen3.8 27B Q4_K_M** through Ollama as the main local language model;
- **Hindsight** for persistent memory;
- **Docker + WSL2** for supporting services;
- a small `hermesctl` orchestration script that starts, stops and health-checks the stack as one system.

The stack is intentionally local-first. Normal AI workloads run on owned hardware rather than depending on paid API calls for every request, while leaving the project in control of context, memory, tools, skills and future home integrations.

## Why Qwen3.8 27B?

Qwen3.8 27B currently provides a useful middle ground for the reference machine: large enough for reasoning, coding and agent-style work while still fitting on a single RTX 4090 with a large context window.

The goal was not simply to run the model. The useful target was a **65,536-token context fully resident on the GPU**, without part of inference falling back to slower system memory.

## Baseline vs. tuned runtime

Initial tests showed that simply increasing context size pushed the runtime very close to the GPU memory limit.

| | Initial / default behavior | Current Hermes configuration |
|---|---:|---:|
| Model | Qwen3.8 27B Q4_K_M | Qwen3.8 27B Q4_K_M |
| Context | 32,768 tokens | **65,536 tokens** |
| Loaded size | ~17 GB | ~18 GB |
| GPU residency | 100% at smaller context | **100% at 64K** |
| 64K VRAM use | ~23.6 GB | **~21.8–22.4 GB** |
| CPU offload at 64K | ~6% | **none** |
| KV cache | default | **Q8** |
| Flash Attention | default/runtime dependent | **enabled** |
| Keep-alive | temporary | **Forever while Hermes is running** |
| MTP speculative decoding | enabled/tested | **disabled for stability** |
| Parallel inference | experimental | **1 stable inference slot** |

A straightforward 64K run with the original runtime settings reached roughly:

```text
Context        65,536
Processor      94% GPU / 6% CPU
VRAM           ~23.6 GB
```

After switching the KV cache to Q8 and enabling Flash Attention, the same model and context fit fully on the GPU:

```text
Context        65,536
Processor      100% GPU
VRAM           ~21.8–22.4 GB / 24 GB
```

That difference matters for Hermes because it is an agent rather than a single-shot chatbot. A request may involve several reasoning or tool steps, so keeping the model GPU-resident helps make those steps more responsive and predictable.

## Current performance baseline

The stable configuration currently benchmarks at roughly:

```text
Prompt processing    ~299 tokens/s
Generation           ~45 tokens/s
Context              65,536 tokens
GPU residency        100%
Loaded model size    ~18 GB
Working VRAM         ~21.8–22.4 GB / 24 GB
```

This is the current **stability-first baseline**.

Earlier experiments with Qwen3.8's MTP speculative decoding reached roughly **80+ generated tokens/s**, showing that the hardware has more raw decoding headroom. The current Ollama/Qwen runtime, however, showed instability while creating the additional MTP draft context at 64K.

For now the reference runtime therefore favors:

```text
64K context
+ full GPU residency
+ stable startup
+ predictable memory use
```

over higher peak token throughput with less reliable model loading. MTP can be revisited later as the runtime matures.

## Current reference hardware

Hermes Home is currently developed and tested against:

- **NVIDIA RTX 4090 24 GB**
- **Intel Core i7-12700K**
- **32 GB system RAM**
- **Windows + WSL2**

On this system the current Qwen model runs fully on the RTX 4090 with a 65,536-token context window.

## Orchestration

The local stack is managed through `hermesctl`.

At a high level, `hermesctl start` does roughly this:

```text
Start Docker if needed
↓
Start Ollama with the Hermes runtime settings
↓
Preload the local Qwen model
↓
Start Hindsight memory
↓
Start Hermes
↓
Start Hermes Home
↓
Verify that each service is healthy
```

Shutdown happens in reverse.

`hermesctl stop` also cleans up the managed Ollama inference runner. This was added after failed model loads were found to leave orphaned `llama-server.exe` processes holding RAM and VRAM after Ollama itself had stopped.

## Runtime boundary

```text
Browser
  |
  v
Hermes Home / Vite
  |
  +-- /hermes-api/* ------> Hermes API ------> Ollama / Qwen
  |                              |
  |                              +------> skills / tools
  |
  +-- /hindsight-api/* ----> Hindsight memory
  |
  +-- /system-api/telemetry
          |
          +-- Windows host CPU / RAM
          +-- NVIDIA GPU / VRAM / temperature
          +-- Ollama loaded-model state
```

The frontend is intentionally separate from the AI runtime so the interface can evolve without tying the model, memory system or future tools to one UI implementation.

## Further runtime notes

Detailed experiment history, including MTP tests, memory pressure, orphaned runner discovery and runtime tuning decisions, is tracked in the project runtime log in Notion:

**[Hermes Runtime & Performance Log](https://app.notion.com/p/3c0a2ea2012b819eb016f895cbd25936?pvs=204)**
