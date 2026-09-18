Change / date: Pre-approval latency investigation, 2026-09-18
User problem and reproduction: In the Pocket Tasks trial, Studio showed no useful progress for about six minutes before plan/preview approval.
Scope: Read-only timing analysis of the recorded current trial. No playbook change is justified by this one run.

Findings:
- Call 1 used 21,453 input and 3,236 output tokens and took 26.4 seconds. The Requirements playbook result was 21,209 characters; it was returned whole.
- Calls 2 and 3 took 141.9 and 152.9 seconds, with 15,069 and 18,038 reported output tokens. Combined provider time was 294.8 seconds (4 minutes 55 seconds), before approval. Reported output includes model generation that was not all public prose. Private reasoning text was not inspected.
- Call 3 wrote requirements, a static prototype and the Project Brain; later calls inspected the prototype in a browser. The first `project_run` occurred only after the preview approval, so Kanban dispatch cannot explain this initial wait.
- Saved public assistant content included a defaults acknowledgement and “Requirements work is starting now.” Gateway interim frames were not presented by Studio. This is a separate display defect.
- The old run reached a question sooner, but that question and the current plan/preview approval are different milestones; later old timing was confounded by two coordinators in one workspace.

Conclusion: Restoring interim messages addresses visibility. The record still shows substantial pre-approval model generation and preview work. There is no controlled evidence yet that shortening a particular playbook step would preserve required discovery and approval while reducing latency. Measure the next two clean MVP journeys with call timing, output tokens, tool sequence and user wait; reconsider the personal playbook only if the same excess repeats.
