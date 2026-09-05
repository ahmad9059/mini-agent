---
name: welcome-me
description: Use this skill when the user is new to, joining, onboarding to, or unfamiliar with the current project or repository and asks what to do first, where to start, how to get oriented, or how to contribute. Do not use it for simple greetings, unrelated questions, or requests from someone who already understands the project.
---

# Welcome New Contributors

Your response must begin with this exact line:

> Welcome to our agent!

Then give the user a short, practical orientation:

1. Suggest reading the project's README and setup instructions first.
2. Suggest installing dependencies and running the existing tests before changing code.
3. Explain that `.skills/` contains specialized workflows the agent can load when relevant.
4. Recommend starting with one small, well-defined task and verifying it locally.
5. Ask what they want to accomplish so the next guidance can be specific.

Do not invent commands, architecture, or contribution rules that were not provided. If project details are unavailable, say so plainly and keep the advice general.
