import { PassThrough } from "node:stream";

import { renderSync } from "@hermes/ink";
import { encodePromptAnswerFrame } from '@hermes/shared/prompt-answer';
import React from "react";
import { describe, expect, it } from "vitest";

import { answerGuidedClarification } from "../../../web/src/lib/guided-clarification";
import { ClarifyPrompt } from "../components/prompts.js";
import { DEFAULT_THEME } from "../theme.js";

describe("Studio answers through the real Ink prompt", () => {
  it.each([
    { choices: ["UK", "Elsewhere"], answer: "UK" },
    { choices: ["UK", "Elsewhere"], answer: "Canada first\nUK later" },
    { choices: [], answer: "UK only" },
  ])("delivers $answer without submitting a new chat turn", async ({ choices, answer }) => {
    const stdout = new PassThrough();
    const stdin = new PassThrough();
    const stderr = new PassThrough();
    Object.assign(stdout, { columns: 80, rows: 24, isTTY: false });
    Object.assign(stdin, { isTTY: true, setRawMode: () => {}, ref: () => {}, unref: () => {} });
    Object.assign(stderr, { isTTY: false });
    // Drain output: this test exercises keyboard input rather than snapshots.
    stdout.resume();
    stderr.resume();
    let resolveAnswer!: (text: string) => void;
    const answers: string[] = [];
    const received = new Promise<string>((resolve) => { resolveAnswer = resolve; });
    const request = { requestId: "r1", question: "Launch country?", choices, answerProtocol: 'atomic-v1' };

    const instance = renderSync(<ClarifyPrompt onAnswer={text => { answers.push(text); resolveAnswer(text); }} onCancel={() => resolveAnswer("cancelled")} req={request} t={DEFAULT_THEME} />, {
      patchConsole: false,
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WriteStream,
      stderr: stderr as unknown as NodeJS.WriteStream,
    });

    const timers: ReturnType<typeof setTimeout>[] = [];
    let open = true;

    try {
      await new Promise<void>((resolve) => setImmediate(resolve));
      await new Promise<void>((resolve) => setImmediate(resolve));
      // Late answers for another question are ignored, never treated as keys.
      stdin.write(encodePromptAnswerFrame({ requestId: 'expired', answer: 'wrong' }));
      answerGuidedClarification(request, answer, {
        isOpen: () => open,
        send: (frame) => { stdin.write(frame); },
        schedule: (run, delay) => { timers.push(setTimeout(run, delay)); },
      });
      const timeout = new Promise<string>((_, reject) => { timers.push(setTimeout(() => reject(new Error("Ink did not receive the answer")), 5000)); });
      expect(await Promise.race([received, timeout])).toBe(answer);
      stdin.write(encodePromptAnswerFrame({ requestId: request.requestId, answer }));
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(answers).toEqual([answer]);
    } finally {
      open = false;
      timers.forEach(clearTimeout);
      instance.unmount();
      instance.cleanup();
      stdin.destroy();
      stdout.destroy();
      stderr.destroy();
    }
  });
});
