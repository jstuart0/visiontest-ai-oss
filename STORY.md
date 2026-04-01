# The Story Behind VisionTest AI

## It started with a problem every developer knows

I was deep in a side project, using AI to help me write code faster than I ever had before. Claude, GPT, Copilot -- the code was flowing. But there was a catch: every time the AI changed something, I had to *test* it. And not just unit tests. I had to open the app, click around, eyeball every screen, and make sure nothing looked broken.

I was running the same visual checks over and over. Click here, scroll there, does this page still look right? Did that modal shift? Is the sidebar still aligned? It was textbook regression testing -- except I was the test runner, and I was slow.

## From duct tape to a real tool

At first I did what any developer would do: I built a quick internal tool to automate the screenshots and comparisons for my specific app. It was tightly coupled, hardcoded paths everywhere, but it worked. I could run a suite, capture screenshots, and diff them against a known-good baseline. No more squinting at pixels.

Then the thought hit me: *this doesn't need to be specific to my app.* Every team shipping a frontend has this problem. Every team using AI to generate code has it *worse*, because changes come faster and regressions hide in places you weren't looking.

So I started pulling it apart, making it generic. A project system. Multi-browser support. An API. A proper web UI for reviewing diffs.

## AI didn't just write the code -- it shaped the product

Here's where it gets interesting. As I was building VisionTest AI, I was also *using* AI to debug it. When a test failed, I'd feed the error and context to an LLM and ask: "What's the root cause? How do I fix this?" It worked remarkably well.

That's when the bigger idea clicked: **what if the tool itself could do that?** What if, when a visual regression test fails, the platform could investigate the failure, identify the root cause in the code, generate a patch, verify the fix, and open a pull request -- all autonomously?

That became the autonomous bug-fix pipeline. It's ambitious, and it comes with guardrails: AI-generated fixes never touch your main branch directly. They land on isolated branches with full diff review. Fix policies let you control how much autonomy the AI gets -- from "investigate only" to "open a PR." You stay in control.

## Then one feature led to another

Building the visual regression engine opened the door to capabilities I hadn't planned:

**AI-powered visual diffs.** Pixel comparison is great, but it flags every anti-aliasing artifact and sub-pixel shift. I built a 4-stage cascade: pixel diff first, then structural similarity (SSIM), perceptual similarity (LPIPS), semantic understanding (DINOv2), and finally a vision language model that can explain *what* changed and *why it matters* in plain English. The system auto-approves noise and escalates breaking changes.

**Natural language test creation.** Writing test scripts step-by-step is tedious. I added the ability to describe what you want to test in plain English -- "Go to the login page, enter test credentials, click submit, verify the dashboard loads" -- and have AI translate that into executable test steps. It's not perfect, but it gets you 80% of the way there instantly.

**Storybook integration.** If you already have a Storybook, VisionTest can auto-discover your stories and generate visual regression tests for every component. Connect it once, and new components get tested automatically.

**Self-healing selectors.** When a selector breaks because a developer renamed a CSS class, the system tries to heal it automatically -- checking cached patterns, analyzing the DOM, running heuristics, and falling back to an LLM. Tests that would have been marked "flaky" just keep working.

**Flaky test detection.** Speaking of flaky -- the platform tracks test stability over time, calculates flakiness scores, and automatically quarantines tests that cross a threshold. No more "oh that test always fails, just ignore it."

**Smart test selection.** Map your source files to the tests that cover them, and when you push a change, only run the tests that matter. Cut your CI time without cutting coverage.

**API testing.** Visual tests don't catch everything. I added REST and GraphQL API testing with assertions, environment management, and the same execution/reporting infrastructure. One platform for both.

## Why I'm releasing it now

Let me be honest: **this is an alpha release.** There are bugs. There are rough edges. Some features are more polished than others, and the documentation has gaps.

But I've been building this largely on my own, and I've reached the point where shipping it -- imperfect as it is -- is better than polishing it in isolation. If even one person finds it useful, or one contributor sees something they want to improve, that's a win.

The codebase is real. 47 dogfood tests pass at 100% -- VisionTest AI tests itself using its own engine. Every page loads, the AI pipeline connects, natural language parsing works. It's not vaporware. It's a working platform that I use every day.

## What makes it different

- **Self-hosted.** Your screenshots, your data, your infrastructure. Nothing leaves your network.
- **AI-native.** Not AI-as-a-checkbox. The AI is woven into diff analysis, test creation, failure investigation, and automated fixes.
- **Multi-provider.** Bring your own LLM: Anthropic, OpenAI, OpenRouter, Google Gemini, or run Ollama/llama.cpp locally.
- **Full workflow.** Not just screenshots. Approval chains, scheduling, webhooks, teams, RBAC, audit logs, CI/CD integration.
- **Open source.** MIT licensed. Fork it, extend it, contribute back.

## Try it

```bash
git clone https://github.com/jstuart0/visiontest-ai-oss.git
cd visiontest-ai-oss
./scripts/setup.sh
npm run dev
```

Five minutes to a running instance. Or use the Helm chart to deploy to Kubernetes.

I'd love to hear what you think. Open an issue, submit a PR, or just take it for a spin and let me know what breaks. That's how we make it better.

-- Jay
