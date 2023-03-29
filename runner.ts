export type Handler = () => void | Promise<unknown>;

export function reporterDescribe(suite: Suite) {
  if (suite.depth === 0) {
    console.log();
  }
  console.log("  ".repeat(suite.depth) + suite.title);
}

export function reporterItOnly(suite: Suite, test: Test) {
  console.log(
    "  ".repeat(suite.depth) + "  " + chalk.yellow("○") + ` ${test.title}`
  );
}

export function reporterIt(suite: Suite, test: Test) {
  const symbol = test.result.pass ? chalk.green("✔") : chalk.red("✗");
  console.log("  ".repeat(suite.depth) + "  " + symbol + ` ${test.title}`);
}

export interface AssertionFailure {
  pass: false;
  message: string;
}

export interface AssertionSuccess {
  pass: true;
}

export type Result = AssertionSuccess | AssertionFailure;

interface Suite {
  id: string;
  type: "suite";
  only: boolean;
  title: string;
  depth: number;
  children: string[];
}

interface Test {
  id: string;
  type: "test";
  only: boolean;
  parent: string;
  title: string;
  result: Result;
  handler: Handler;
}

import { EventEmitter as EE } from "events";
import chalk from "chalk";

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type EventMap = Record<string, any>;

type EventKey<T extends EventMap> = string & keyof T;
type EventReceiver<T> = (params: T) => void;

interface TestSummary {
  title: string;
  message: string;
}

interface Emitter<T extends EventMap> {
  on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void;
  emit<K extends EventKey<T>>(eventName: K, params: T[K]): void;
}

class EventEmitter<T extends EventMap> implements Emitter<T> {
  #emitter = new EE();
  currentTest: string | undefined;
  stack: string[] = [];
  rootSuites: string[] = [];
  hasItOnly: boolean = false;
  hasDescribeOnly: boolean = false;

  clear() {
    this.currentTest = undefined;
    this.stack = [];
    this.rootSuites = [];
    this.hasItOnly = false;
  }

  on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>) {
    this.#emitter.on(eventName, fn);
  }

  emit<K extends EventKey<T>>(eventName: K, params: T[K]): void {
    this.#emitter.emit(eventName, params);
  }
}

interface Events {
  "suite:add": {
    title: string;
    handler: Handler;
  };
  "suite:add:only": {
    title: string;
    handler: Handler;
  };
  "suite:add:test": {
    title: string;
    handler: Handler;
  };
  "suite:add:test:only": {
    title: string;
    handler: Handler;
  };
  "test:fail": AssertionFailure;
  run: undefined;
}

const emitter = new EventEmitter<Events>();

const suites = new Map<string, Suite | Test>();

emitter.on("run", () => {
  const summary: TestSummary[] = [];

  function summarize(summary: TestSummary[]) {
    console.log();
    for (const sum of summary) {
      console.log(chalk.red("FAIL") + `: ${sum.title}`);
      console.log(`  ${sum.message}`);
    }
  }

  async function runSuites(ids: string[]) {
    for (const id of ids) {
      const suiteOrTest = suites.get(id);
      if (!suiteOrTest) {
        throw Error(`Suite ${id} not found`);
      }

      if (suiteOrTest.type === "suite") {
        reporterDescribe(suiteOrTest);
        await runSuites(suiteOrTest.children);
        suites.delete(id);
      }

      if (suiteOrTest.type === "test") {
        emitter.currentTest = suiteOrTest.id;
        const parent = suites.get(suiteOrTest.parent);
        if (!parent || parent.type !== "suite") {
          throw Error(`Suite ${id} not found`);
        }

        const isOnlyTest = emitter.hasItOnly && !suiteOrTest.only;

        if (isOnlyTest || (emitter.hasDescribeOnly && !parent.only)) {
          reporterItOnly(parent, suiteOrTest);
          suites.delete(id);
        } else {
          try {
            await suiteOrTest.handler();
          } catch (_e) {
            const e = _e as Error;
            if (e.name === "AssertionError") {
              emitter.emit("test:fail", {
                pass: false,
                message: `Expected: ${JSON.stringify(
                  (e as any).expected
                )}\n  Received: ${JSON.stringify((e as any).actual)}`,
              });
            } else {
              e.message = chalk.red(e.message)
              throw e
            }
          }

          reporterIt(parent, suiteOrTest);

          if (!suiteOrTest.result.pass) {
            summary.push({
              title: suiteOrTest.title,
              message: suiteOrTest.result.message,
            });
          }

          suites.delete(id);
        }
      }
    }

    const done = suites.size === 0;
    if (done) {
      summarize(summary);
      suites.clear();
      emitter.clear();
    }
  }

  runSuites(emitter.rootSuites);
});

function addTest({
  title,
  handler,
  only,
}: {
  title: string;
  handler: Handler;
  only: boolean;
}) {
  const id = uuidv4();
  const currentSuite = suites.get(
    emitter.stack[emitter.stack.length - 1]
  ) as Suite;

  currentSuite.children.push(id);
  suites.set(id, {
    id,
    type: "test",
    only,
    parent: emitter.stack[emitter.stack.length - 1],
    title,
    // assume innocent until proven guilty.
    result: {
      pass: true,
    },
    handler,
  });
}

emitter.on("suite:add:test", ({ title, handler }) => {
  addTest({ title, handler, only: false });
});

emitter.on("suite:add:test:only", ({ title, handler }) => {
  addTest({ title, handler, only: true });
  emitter.hasItOnly = true;
});

emitter.on("test:fail", (result) => {
  const test = suites.get(emitter.currentTest!) as Test;
  test.result = result;
});

function addSuite({
  title,
  handler,
  only,
}: {
  title: string;
  handler: Handler;
  only: boolean;
}) {
  const id = uuidv4();
  if (emitter.stack.length) {
    const currentSuite = suites.get(
      emitter.stack[emitter.stack.length - 1]
    ) as Suite;
    currentSuite.children.push(id);
  } else {
    emitter.rootSuites.push(id);
  }

  const suite: Suite = {
    id,
    type: "suite",
    title,
    only,
    depth: emitter.stack.length,
    children: [],
  };
  emitter.stack.push(id);
  suites.set(id, suite);
  handler();
  emitter.stack.pop();
}

emitter.on("suite:add:only", ({ title, handler }) => {
  addSuite({ title, handler, only: true });
  emitter.hasDescribeOnly = true;
});

emitter.on("suite:add", ({ title, handler }) => {
  addSuite({ title, handler, only: false });
});

type TestDefinition = (title: string, test: () => any) => any;

interface It extends TestDefinition {
  only: TestDefinition;
}

interface Describe extends TestDefinition {
  only: TestDefinition;
}

export const it: It = function (title, handler) {
  emitter.emit("suite:add:test", { title, handler });
};

it.only = (title: string, handler) => {
  emitter.emit("suite:add:test:only", { title, handler });
};

export const describe: Describe = function (title: string, handler: Handler) {
  emitter.emit("suite:add", {
    title,
    handler,
  });
};

describe.only = (title: string, handler) => {
  emitter.emit("suite:add:only", { title, handler });
};

export function run() {
  emitter.emit("run", undefined);
}
