function t(template: TemplateStringsArray, ...values: any[]) {
  return () => {};
}

type Component<P extends {}> = (props?: P) => string;

type Val = "double" | "triple";

const double: Component<{ count: number }> = (props) => {
  const double = () => {
    console.log("double");
    // emit.increase('double')
  };

  return `
    <div>Number is {props.count}</div>
    <button @click="double()">Double</button>
  `;
};

type LeftAngleBracket = { type: "leftAngleBracket"; re: RegExp };
type RightAngleBracket = { type: "rightAngleBracket"; re: RegExp };
type ForwardSlash = { type: "forwardSlash"; re: RegExp };
type DoubleQuote = { type: "doubleQuote"; re: RegExp };
type Equal = { type: "equal"; re: RegExp };
type Whitespace = { type: "whitespace"; re: RegExp };
type Text = { type: "text"; re: RegExp };

const leftAngleBracket: LeftAngleBracket = {
  type: "leftAngleBracket",
  re: /^\</,
};

const whitespace: Whitespace = {
  type: "whitespace",
  re: /^\s/,
};

const rightAngleBracket: RightAngleBracket = {
  type: "rightAngleBracket",
  re: /^\>/,
};

const forwardSlash: ForwardSlash = {
  type: "forwardSlash",
  re: /^\//,
};

const doubleQuote: DoubleQuote = {
  type: "doubleQuote",
  re: /^"/,
};

const equal: Equal = {
  type: "equal",
  re: /^=/,
};

const text: Text = {
  type: "text",
  re: /^([A-Za-z]*)/,
};

// const tokens = ["<", ">", "/", `"`, " ", "="] as const;
const tokens = [
  leftAngleBracket,
  rightAngleBracket,
  whitespace,
  forwardSlash,
  doubleQuote,
  equal,
  text,
] as const;

// "<", ">", "/", "@", '"', "=", "{", "}", "(", ")"];

const eg = `
<html>
    <body>
        <h1>Title</h1>
        <div id="main" class="test">
            <p>Hello <em>world</em>!</p>
        </div>
    </body>
</html>
`;

import { describe, it, expect, run } from "./runner.js";
import assert from "node:assert";

type Match = {
  token: typeof tokens[number];
  char: string;
};

function match(template: string): Match {
  for (const token of tokens) {
    const res = token.re.exec(template);
    if (res?.[0]) {
      return {
        token,
        char: res[0],
      };
    }
  }

  throw Error(`Could not match for ${template}`);
}

function tokenize(template: string): Match[] {
  const toks: Match[] = [];

  while (template) {
    const tok = match(template);
    template = template.slice(tok.char.length);
    toks.push(tok);
  }

  return toks;
}

describe("tokenize", () => {
  it("simple case", () => {
    const tokens = tokenize(`<div>ok</div>`);
    assert.deepEqual(
      tokens.map((x) => x.char),
      ["<", "div", ">", "ok", "<", "/", "div", ">"]
    );
  });

  it("attributes", () => {
    const tokens = tokenize(`<div id="foo">ok</div>`);
    assert.deepEqual(
      tokens.map((x) => x.char),
      [
        "<",
        "div",
        " ",
        "id",
        "=",
        '"',
        "foo",
        '"',
        ">",
        "ok",
        "<",
        "/",
        "div",
        ">",
      ]
    );
  });

  it("nested", () => {
    const tokens = tokenize(`<div><span>ok</span></div>`);
    assert.deepEqual(
      tokens.map((x) => x.char),
      [
        "<",
        "div",
        ">",
        "<",
        "span",
        ">",
        "ok",
        "<",
        "/",
        "span",
        ">",
        "<",
        "/",
        "div",
        ">",
      ]
    );
  });
});

class Parser {
  stack: Match[];

  constructor(_tokens: Match[]) {
    // console.log(_tokens)
    this.stack = _tokens;
  }

  peek() {
    // console.log('peek', this.stack[0])
    return this.stack[0];
  }

  consume() {
    return this.stack.shift();
  }

  consumeWhitespace () {
    while (this.peek().token.type === 'whitespace') {
      this.consume()
    }
  }

  consumeAttrs() {
    const attrs: Array<{ key: string; value: string }> = [];
    while (this.peek().token.type !== "rightAngleBracket") {
      this.consumeWhitespace()
      const key = this.consume();
      // equals
      this.consume();
      // opening "
      this.consume();
      const value = this.consume();
      // close "
      this.consume();

      if (!key || !value) {
        throw Error('Malformed HTML when parsing attrs')
      }

      attrs.push({ key: key!.char, value: value!.char });
    }
    return attrs;
  }

  parseNode() {
    // <
    this.consume();
    const tag = this.consume();

    const attrs = this.consumeAttrs();

    const node = {
      tag,
      attrs,
    };

    console.log(JSON.stringify(node, null, 4));
    // while (tok = this.consume()) {
    //   if () {
    //     // new tag
    //     if () {
    //       const node =
    //     }
    //   }
    // }
  }

  parse() {
    // if (!this.root) {
    this.parseNode();
    // this.root = this.parseNode();
    // }
  }
}

describe("parser", () => {
  it("<div>ok</div>", () => {
    const tokens = tokenize(`<div id="foo" class="bar">ok</div>`);
    const ast = new Parser(tokens).parse();
    // assert.deepEqual(ast, {
    //   id: "1",
    //   tag: "div",
    //   attrs: [],
    //   children: [
    //     {
    //       id: "2",
    //       tag: "ok",
    //       attrs: [],
    //     },
    //   ],
    // });
  });
});

run();
// function mount<P extends {}>(comp: Component<P>) {
//   if (!document) {
//     return
//   }
//   const el = document.createElement('div')
//   document.body.appendChild(el)
//   el.innerHTML = comp()
// }

// mount(double)
